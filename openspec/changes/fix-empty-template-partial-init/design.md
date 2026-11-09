# Design

## Context

见 proposal.md 的 Why。技术现状：

`packages/wujie-core/src/sandbox.ts#WuJie.active()` 的渲染顺序是：

```
this.template = template ?? this.template
→ renderTemplateToShadowRoot(shadowRoot, iframeWindow, this.template)   // 早退点在这里
→ this.patchCssRules()
```

`renderTemplateToShadowRoot` 内部顺序为：

```
renderTemplateToHtml(iframeWindow, template)   // 产出 html>head+body，并设置 sandbox.head/body
processCssLoaderForTemplate(...)
shadowRoot.appendChild(processedHtml)
shadowRoot.head = shadowRoot.querySelector("head")
shadowRoot.body = shadowRoot.querySelector("body")
patchRenderEffect(shadowRoot, id, false)        // 安装 DOM 副作用劫持
```

上游 PR #1112 的 `if (!template) return;` 落在**整个函数的最开头**，因此跳过了上述全部步骤。已确认的三类后果：

1. `shadowRoot.head` / `shadowRoot.body` 保持 `undefined` → `patchCssRules()` 中的 `this.shadowRoot.head.appendChild(...)` 与 `rebuildStyleSheets()` 中的 `rawElementAppendChild.call(this.shadowRoot.head, ...)` 存在 TypeError 风险；同时子应用侧 `document.head`（映射到 `shadowRoot.head`）为 `undefined`
2. `patchRenderEffect` 未安装 → 渲染根的 `head/body.appendChild` 未被劫持
3. `sandbox.head` / `sandbox.body` 保持 `undefined` → 后续 `renderTemplateToHtml` 走 `!alive && execFlag` 分支时，`replaceHeadAndBody(html, undefined, undefined)` 触发 TypeError

另外两个已核实的实现细节：

- `renderTemplateToHtml` 中 `sandbox.head = html.querySelector("head")` 的赋值发生在「补齐 head/body」**之前**，因此即使模板非空，赋值也可能拿到 `null`
- `replaceHeadAndBody` 依赖 `head`/`body` 元素已存在，通过 `replaceChild` 把旧 head/body 搬进新 html；shadow-root 模式下渲染是 `appendChild` 而非 `replaceChild`，因此渲染根内可能并存多个 `<html>`

约束：

- 必须保持上游 PR #1112 的修复效果——不得把字面量 `undefined` 渲染进渲染根
- 不得引入「渲染根内并存两个 `<html>` 且 `shadowRoot.firstElementChild` 指向空壳」的新问题（该问题会使命中的 `getBoundingClientRect` / `parentNode` 补丁打在错误的元素上）

## Goals / Non-Goals

**Goals:**

- 空模板时渲染根仍处于**完整可用**状态：head/body 引用有效、DOM 副作用劫持已安装、`sandbox.head`/`sandbox.body` 有效
- 空模板时输出一次可观测告警
- 非空模板的渲染路径与产物**逐字节不变**

**Non-Goals:**

- 不改变 `replaceHeadAndBody` 的复用语义（head/body 跨次渲染复用是既有设计）
- 不改动 `patchCssRules` / `rebuildStyleSheets` 的样式提取逻辑，仅增加缺失 head/body 时的守卫
- 不处理「模板内容非空但 `<head>`/`<body>` 缺失」以外的 HTML 畸形场景

## Decisions

### D1：`renderTemplateToHtml` 中把 head/body 的补齐前移到 `sandbox.head/body` 赋值之前

当前顺序：

```ts
if (!alive && execFlag) { html = replaceHeadAndBody(html, head, body); }
else { sandbox.head = html.querySelector("head"); sandbox.body = html.querySelector("body"); }
/* ... 遍历元素 ... */
if (!html.querySelector("head")) html.appendChild(document.createElement("head"));
if (!html.querySelector("body")) html.appendChild(document.createElement("body"));
```

调整为**先补齐、再赋值**：

```ts
if (!html.querySelector("head")) html.appendChild(document.createElement("head"));
if (!html.querySelector("body")) html.appendChild(document.createElement("body"));

if (!alive && execFlag) { html = replaceHeadAndBody(html, head, body); }
else { sandbox.head = html.querySelector("head"); sandbox.body = html.querySelector("body"); }
```

这是**纯顺序调整**，不改变任何分支的取值语义，但保证 `sandbox.head` / `sandbox.body` 永远指向真实元素而不是 `null`。

### D2：空模板走「空骨架」，真实渲染前移除

空模板时 `ensureEmptyRenderRoot` 按以下顺序挑选承载 html：

1. 渲染根内**已有自带 head 与 body 的 html**（此前真实渲染留下的）→ 直接复用，
   **不新建骨架、也不打标记**：此时渲染根保留原有内容，旧 UI 继续显示（空模板不会清空既有渲染内容）；
   后续真实渲染时 `removeEmptyRenderRoot` 是 no-op（没有骨架可移除）
2. 否则复用**既有的带标记空骨架**（补齐缺失的 head/body）
3. 否则新建一个带 `WUJIE_EMPTY_SKELETON_FLAG` 标记的空骨架

不能简单地取渲染根内的第一个 html：多次渲染后（`!alive && execFlag` 路径下
`replaceHeadAndBody` 会把旧 head/body 搬进新 html），旧的 html 会变成无 head 的空壳，
直接使用会让 `shadowRoot.head` 变成 null，进而使 `patchRenderEffect` 抛错。

**真实渲染时移除骨架与追加真实 html 必须相邻执行**（中间不跨 await）：
否则并发的空渲染会重新创建骨架，导致渲染根内并存两个 `<html>`、`shadowRoot.firstElementChild` 指向空壳。

**两条路径的 head/body 取值保持对称**：都取「承载内容的 html 自身的 head/body」，
而不是渲染根范围内的第一个 head（多次渲染后渲染根内可能残留旧 html，取到的会是过期的 head）。

空模板时不直接 `return`，而是准备一个**最小骨架**：

```
shadowRoot
└── html[data-wujie-empty-skeleton]
    ├── head
    └── body
```

骨架创建时同步完成：`shadowRoot.head`/`shadowRoot.body` 赋值、`sandbox.head`/`sandbox.body` 赋值、`patchRenderEffect(shadowRoot, id, false)` 安装。

真实渲染（模板非空）时，**移除骨架与 append 真实 html 相邻执行**，从而保证：

- 「空骨架 → 真实渲染」这条路径下渲染根内只有一个 `<html>`，`shadowRoot.firstElementChild` 指向内容承载元素
- 承载内容的 head/body 取自**刚 append 的那个 html 自身**，而不是渲染根范围内的第一个 head

**为什么需要标记**：仅靠「移除渲染根内所有 `<html>`」无法区分「空骨架」与「上一次真实渲染的残留 html」（后者在 `!alive && execFlag` 的复用路径中是允许存在的）。用 DOM 属性标记可精确识别、精确移除。

**备选方案与否决理由**：

| 备选 | 否决理由 |
|---|---|
| 空模板时也走完整渲染（`template ?? ""`） | 渲染根内会并存「空骨架 html」与「真实 html」两个 `<html>`，`shadowRoot.firstElementChild` 指向空壳 → `getBoundingClientRect`/`parentNode` 补丁打在错误元素上；且 `shadowRoot.querySelector("head")` 会命中空壳的 head，导致子应用 `document.head` 与真实 head 分离 |
| 空模板时直接 `return`（上游 PR #1112 原样） | 正是本次要修的半初始化问题 |
| 空模板时只补 `sandbox.head`/`sandbox.body`，不碰 shadowRoot | `shadowRoot.head` 仍为 `undefined` → 子应用侧 `document.head` 为 `undefined`；`patchRenderEffect` 也无法安装（它要求 `render.head`/`render.body` 存在） |
| 把「空模板」判定上移到 `sandbox.active()`，整段 active 走 no-op | `active()` 还要负责 `this.el = renderElementToContainer(...)`、路由同步、fetch 注入等职责，整段跳过的影响面远大于渲染层；且无法解决「骨架缺失」问题 |

### D3：`replaceHeadAndBody` 对缺失的 head/body 容错

```ts
if (headElement && head) { /* ...搬运... */ }
if (bodyElement && body) { /* ...搬运... */ }
```

理由：即便采用 D2 的骨架方案，`sandbox.head`/`sandbox.body` 仍有可能因 sandbox 重建等边缘路径缺失；`replaceHeadAndBody` 属于内部工具函数，对缺失参数容错比抛 TypeError 更稳妥。这是防御性加固，不改变正常路径行为。

### D4：`patchCssRules()` 与 `rebuildStyleSheets()` 增加 head/body 缺失守卫

```ts
// patchCssRules：attached 表示本次确实挂载了样式，pending 表示仍有补丁待补（且重试有意义）。
// 只有「既挂载成功、又没有任何待办补丁」时才允许打「已处理」标记，
// 否则下次调用会因标记存在而直接早退，:root → :host 的补丁就永久丢了。
const rootHead = this.shadowRoot?.head;
if (hostStyleSheetElement) {
  if (rootHead) { rootHead.appendChild(hostStyleSheetElement); attached = true; }
  else pending = true;            // head 之后可能被补上 → 允许下次重试
}
if (fontStyleSheetElement && this.inject.fontStyleSheetContainer) {
  this.inject.fontStyleSheetContainer.appendChild(fontStyleSheetElement);
  attached = true;
  // 容器缺失时无处可挂、重试也无意义 → 不算 pending
}
(attached && !pending) && this.shadowRoot.host.setAttribute(WUJIE_DATA_ATTACH_CSS_FLAG, "");

// rebuildStyleSheets：目标 head 缺失时跳过重建（不直接 return），
// 仍继续调用 patchCssRules，让 :root 补丁有机会被补上
const target = this.degrade ? this.document?.head : this.shadowRoot?.head;
if (target && this.styleSheetElements?.length) { /* 重新挂载 */ }
this.patchCssRules();
```

理由：这两处是唯一在渲染层之外直接消费 `shadowRoot.head` 的地方，守卫可把「渲染根不完整」的后果从 TypeError 降级为静默跳过。

### D5：空模板时输出一次告警

```ts
warn(`[wujie] app ${id} template is empty, render root prepared without content`);
```

理由：上游 PR #1112 把「模板为空」这一异常状态变成了静默行为，排障时无从察觉。告警只输出一次（以 sandbox 实例为键记录，与骨架是否存在无关）。

### D6：降级模式不需要骨架

降级模式的 `renderTemplateToIframe` 用的是 `renderDocument.replaceChild(processedHtml, renderDocument.documentElement)`——**替换**而非追加，因此渲染文档内不会出现并存 html。只需：

- 去掉早退，把模板归一化为 `template ?? ""`，让 `renderTemplateToHtml` 产出空骨架（`<html><head></head><body></body></html>`）
- 由此 `initBase(renderWindow, ...)` 与 `patchRenderEffect(renderDocument, id, true)` 正常执行

降级模式下 `renderTemplateToHtml` 使用的是 sandbox iframe 的 document，产出的空骨架会被 `replaceChild` 采用进渲染文档，语义正确。

## 分层设计（ECC 三层约束在本项目的映射）

| 层 | 本项目对应 | 本次改动 |
|---|---|---|
| **Control**（公共 API 边界） | `src/index.ts` — `startApp` / `preloadApp` / `destroyApp` / `refreshApp` / `setupApp` / `clearAssetsCache` | 不涉及 |
| **Component**（副作用编排） | `src/sandbox.ts`（生命周期编排）、`src/effect.ts`（DOM 副作用劫持）、`src/shadow.ts`（渲染根构建）、`src/proxy.ts`（window/document/location 代理）、`src/entry.ts`（HTML 资源导入） | **`src/shadow.ts`：修改 `renderTemplateToHtml` / `renderTemplateToShadowRoot` / `renderTemplateToIframe` / `replaceHeadAndBody`；`src/sandbox.ts`：修改 `patchCssRules` / `rebuildStyleSheets`** |
| **Entity**（纯数据与契约） | `src/constant.ts`（常量）、`src/template.ts`（模板解析纯函数）、`src/plugin.ts`（插件契约）、`src/common.ts`（原始 DOM 方法快照） | **新增一个常量**（空骨架标记属性名），归入 Entity 层 |

跨层约束核验：

- 新增常量归入 `src/constant.ts`（Entity 层），由 `src/shadow.ts`（Component 层）单向引用，方向符合 `Component → Entity`
- `src/shadow.ts` 不新增对 `src/index.ts`（Control 层）的引用
- `src/sandbox.ts` 与 `src/shadow.ts` 同属 Component 层，彼此调用是既有关系，不构成反向依赖

## Risks / Trade-offs

- **[Risk] 骨架 html 残留在渲染根内（若空模板后再无真实渲染）** → 骨架无内容、无视觉影响（`WUJIE_SHADE_STYLE` 为 `visibility: hidden`）；且 `shadowRoot.head`/`body` 有效，子应用若被插件注入脚本运行，其 `document.head` 可用
- **[Risk] 移除骨架时误删真实内容** → 移除只针对带 `data-wujie-empty-skeleton` 标记的元素，真实渲染产出的 html 不带该标记
- **[Risk] `patchRenderEffect` 被安装两次（骨架一次、真实渲染一次）** → 在 `execFlag === true` 的空模板→真实渲染路径中，骨架的 head **就是**真实 head（被 `replaceHeadAndBody` 搬进新 html），因此两次安装作用于**同一元素**，`patchEventListener` 会重置其 `_cacheListeners`（空模板阶段记录的监听簿记被丢弃）。实际影响很小：`removeEventListener` 仍委托给原生实现，监听本身不会被解绑
- **[Risk] D1 的顺序调整改变了「模板自身没有 `<head>`」时的 `replaceHeadAndBody` 行为** → 调整前：新 html 没有 head 时 `headElement` 为 null，替换被跳过，旧 head 留在被搬空的旧 html 里，新 html 拿到一个全新的空 head（子应用此前注入到 head 的内容在两次渲染之间丢失，`sandbox.head` 与 `shadowRoot.head` 也发生分叉）；调整后：补齐保证 head 存在，旧 head 会被搬进新 html 并保留其内容。**新行为更符合「head/body 必须一直使用同一个」的既有意图**，但确实是一处语义变化，已由用例 `renderTemplateToHtml` 的 head/body 复用场景锁定
- **[Trade-off] 多出一个 DOM 标记属性与一段骨架创建/移除逻辑** → 换取渲染根在异常路径下仍可用；相比「整段跳过」更接近「渲染根始终完整」的目标

## Migration Plan

纯内部修复，无配置变更、无公开 API 变更。回滚策略：回退 `packages/wujie-core/src/shadow.ts` 与 `packages/wujie-core/src/sandbox.ts` 两个文件。
