# Design

## Context

见 proposal.md 的 Why。技术现状：

- `rewriteAppendOrInsertChild` 是外链样式的劫持入口，由 `patchRenderEffect(render, id, degrade)` 安装到**渲染根**的 `head/body` 上：
  - 非降级：`render` 是 `ShadowRoot`，样式最终落在 `shadowRoot.head`
  - 降级：`render` 是**渲染 iframe** 的 document，样式落在该 document
- 入口 HTML 在 `entry.ts#getEmbedHTML` 阶段把 `<link rel="stylesheet">` 替换为 `<style data-wujie-css-href="绝对地址">/* 绝对地址 */内容</style>`，该字符串随 template 一起被渲染进**同一个渲染根**
- 现状去重查询用的是 `sandbox.iframe.contentDocument`（跑 JS 的 sandbox iframe），它与上面两种渲染根都**不是同一棵树**

约束：

- `effect.ts` 属于副作用编排层，允许读写 DOM，但不能反向依赖上层模块
- 必须同时兼容 shadow-root 与降级两种渲染形态，且不改变既有 CSS 加载顺序与 cssLoader 处理链路

## Goals / Non-Goals

**Goals:**

- 让同 href 去重在**两种渲染形态下都真实生效**
- 查询域随渲染形态自适应，新增形态时不需要再改去重逻辑
- 消除去重查询因 href 含非法字符而抛异常、打断 `appendChild` 的风险
- 补齐覆盖真实调用链的单元测试

**Non-Goals:**

- 不改动 `entry.ts` 写入 `data-wujie-css-href` 的方式（保持与上游 PR #1109 一致，便于后续 rebase）
- 不引入 href → style 的索引缓存（本次只修正确性，性能优化另议）
- 不调整 `dispatchStyleSheetLoadAsync` 的异步派发时机（上游 PR #1109 已定稿且有测试覆盖）

## Decisions

### D1：查找域取「插入点所在的渲染根」，而不是 sandbox iframe 文档

`loadStyleSheet` 是 `appendChildOrInsertBefore` 内的箭头函数，其 `this` 就是被劫持的 `head`/`body` 元素。因此：

```ts
const renderRoot = (this as Node).getRootNode?.() as Document | ShadowRoot | null;
```

- 非降级模式：`this` 属于 `shadowRoot` → `getRootNode()` 返回 `ShadowRoot` → 命中入口 HTML 内联的 `<style>`
- 降级模式：`this` 属于渲染 iframe 的 document → `getRootNode()` 返回该 `Document` → 命中入口 HTML 内联的 `<style>`

**备选方案与否决理由**：

| 备选 | 否决理由 |
|---|---|
| 在 `sandbox.degrade` 上分支，分别取 `shadowRoot` / 渲染 iframe document | 渲染形态判断散落在副作用层，新增形态需同步维护；且 `sandbox` 里并未持有渲染 iframe 的 document |
| 只查 `sandbox.styleSheetElements` | 该数组只收录**运行时动态注入**的 style，入口 HTML 内联的 style 是 template 字符串的一部分，**不在其中**，单独使用覆盖不到主要场景 |
| 查 `document`（主应用 document） | 主应用 document 与子应用渲染根无关，永远查不到 |

**结论**：D1 采用 `getRootNode()`，并保留 `sandbox.iframe.contentDocument` 作为**兜底**（防止个别场景下渲染根与实际持有者不一致）。

### D2：放弃拼接 CSS 选择器，改为遍历比较属性

现状用 `doc.querySelector('style[data-wujie-css-href="..."]')` 查找，`cssHrefLookupValue` 只转义了 `\` 与 `"`。href 中若含换行等非法字符，`querySelector` 会抛 `DOMException`，而该调用位于被劫持的 `appendChild` 调用栈内，异常会直接打断子应用的 DOM 操作。

改为：

```ts
const styles = doc.querySelectorAll("style");
for (...) {
  if (styles[i].getAttribute("data-wujie-css-href") === href) return styles[i];
}
```

- 消除选择器注入与非法字符抛异常的风险
- 不依赖 `CSS.escape` 的可用性（本框架已要求 ES6 `Proxy`，`CSS.escape` 的浏览器覆盖与之基本重合，但少一个依赖更稳）
- 属性比较比既有 fallback 的 `textContent` 前缀比较更廉价
- 代价是 O(n) 遍历；既有 fallback 本就是 O(n)，不构成新增性能回退

### D3：查找顺序为「渲染根优先，sandbox iframe 文档兜底」

```ts
const found =
  findStyleByCssHref(renderRoot, styleHref) ??
  findStyleByCssHref(iframeDocument, styleHref);
```

保留兜底是为了不破坏「样式最终被放进 sandbox iframe 文档」的少数既有路径（例如 `patchCssRules` 提取出的 host/font 样式）。

### D4：`findStyleByCssHref` 的入参类型放宽为 `Document | ShadowRoot | null`

`ShadowRoot` 与 `Document` 都实现了 `querySelector` / `querySelectorAll`，签名放宽后函数内部逻辑无需分叉。既有 legacy 兼容分支（`/* href */` 注释前缀）保持不变。

### D5：去重标记只在样式内容实际存在时保留

`fetchAssets` 对 cssFlag 的失败路径（4xx/5xx 与网络异常）都 **resolve 成 `""` 而非 reject**，
因此 `loadStyleSheet` 走的是成功分支：占位 `<style>` 被填充为空内容、**去重标记仍然保留**、
并且给原 `<link>` 派发了 `load`（假成功）。

查找域修正到渲染根后，这个空占位会被去重查询命中 → 该 href 被静默吞掉，
子应用后续再插入同一地址时既不会重新请求、也拿不到任何样式。
（改动前查的是 sandbox iframe 文档，与渲染根从不相交，失败后的重试路径是通的。）

因此：

- 动态插入路径：占位元素创建时**先带上标记**（保持并发插入去重的能力），
  内容填充完成后，若内容为空则**撤销标记**，让后续插入可以重新请求
- 入口 HTML 内联路径（`entry.ts`）：内容为空时**不输出带标记的 `<style>`**，
  改为保留原始 `<link>`，交由浏览器自行加载/重试

**为什么不采用「命中时要求内容非空」**：pending 状态的占位元素此刻内容同样为空，
那样会连带破坏「并发插入同一地址只生成一份样式」这一既有能力。

**已知遗留（不在本次范围）**：失败时给 `<link>` 派发的是 `load` 而非 `error`，
这是上游既有行为，本次不改动；如需修正应另开变更。

**实测结论（复审 Minor-3）**：复审曾怀疑「浏览器不处理 shadow tree 内的
`<link rel="stylesheet">`」，据此认为上面的 `<link>` 兜底在 shadow 模式下无效。
实测（puppeteer / Chromium）证明该怀疑**不成立**：

```js
const sr = host.attachShadow({ mode: "open" });
sr.innerHTML = `<style>#t{color:rgb(1,2,3)}</style><div id="t">x</div>`;
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = "data:text/css," + encodeURIComponent("#t{color:rgb(9,9,9)}");
sr.appendChild(link);
// → computedStyle(#t).color === "rgb(9, 9, 9)"，即 link 的样式已生效
```

浏览器会加载并应用 shadow tree 内的 `<link rel="stylesheet">`，
与既有 `cssIgnores` 特性所依赖的形态一致，因此 `<link>` 兜底在两种渲染模式下均成立。

**复审 Minor-4 结论**：`<link>` 兜底硬编码 `rel="stylesheet" type="text/css"`，
丢失原 link 的 `media`/`crossorigin`/`disabled`。该写法与既有 `cssIgnores` 分支完全一致，
按「与既有行为对齐」处理，不在本变更内单独修改。

## 分层设计（ECC 三层约束在本项目的映射）

本项目是 TypeScript 前端库，ECC 的 `Control / Component / Entity` 三层约束按语义映射到 wujie-core 的模块划分（依赖方向单向不可逆：`Control → Component → Entity`）：

| 层 | 本项目对应 | 本次改动 |
|---|---|---|
| **Control**（公共 API 边界） | `src/index.ts` — `startApp` / `preloadApp` / `destroyApp` / `refreshApp` / `setupApp` / `clearAssetsCache` | 不涉及 |
| **Component**（副作用编排） | `src/sandbox.ts`（生命周期编排）、`src/effect.ts`（DOM 副作用劫持）、`src/shadow.ts`（渲染根构建）、`src/proxy.ts`（window/document/location 代理）、`src/entry.ts`（HTML 资源导入） | **`src/effect.ts`：修改 `rewriteAppendOrInsertChild` / `loadStyleSheet` / `findStyleByCssHref`** |
| **Entity**（纯数据与契约） | `src/constant.ts`（常量）、`src/template.ts`（模板解析纯函数）、`src/plugin.ts`（插件契约）、`src/common.ts`（原始 DOM 方法快照） | 不涉及 |

跨层约束核验：

- 本次改动**不新增**任何 Entity → Component 的反向依赖
- `effect.ts` 不感知 `index.ts` 的公共 API，不新增对 Control 层的引用
- `findStyleByCssHref` 是 Component 层内部的纯查询工具，导出仅供同层与测试使用，不构成对外契约

## Risks / Trade-offs

- **[Risk] 兜底分支仍可能命中非渲染根中的 style，导致过度去重（该样式实际未在当前渲染根生效）** → 兜底只在渲染根完全没有匹配时才生效；且 sandbox iframe 文档中的 style 均由 wujie 自身注入（入口 loader / base / font），去重它们不会丢失子应用样式
- **[Risk] 遍历查找把原本 O(1) 的属性命中退化为 O(n)** → 入口 HTML 内联 style 数量级通常为个位数到数十；且既有 fallback 路径本就是 O(n)，无新增回退
- **[Risk] 命中去重后不再生成 `<style>`，若被去重的那个 `<style>` 实际内容为空（CSS 加载失败留下的空占位），会导致样式缺失** → 由 D5 处理：去重标记只在样式内容实际存在时保留，内容为空时撤销标记，使后续插入能够重新加载
- **[Trade-off] 不引入 href → style 索引缓存** → 以少量性能换取实现简单与正确性；如后续压测显示动态样式插入频繁成为瓶颈，可单独提案引入缓存

## Migration Plan

纯内部修复，无数据迁移、无配置变更、无公开 API 变更。回滚策略：单文件回退 `packages/wujie-core/src/effect.ts` 即可，不影响其他模块。
