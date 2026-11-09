# Design

## Context

见 proposal.md 的 Why。技术现状：

`packages/wujie-core/src/proxy.ts` 的 `proxyGenerator` 为 `proxyDocument`（一个以 `{}` 为目标的 `Proxy.revocable`）安装了 get 拦截器。iframe 侧的 `Document.prototype.querySelector` / `querySelectorAll` 被 `iframe.ts#patchDocumentEffect` 重定义为返回 `sandbox.proxyDocument[propKey]`，因此子应用调用 `document.querySelectorAll(...)` 时：

- `this`（apply 拦截器的 `ctx`）是 `iframe.contentDocument`
- 拦截器返回的是一个包装了 `shadowRoot.querySelectorAll` 的 Proxy

拦截器当前的分支逻辑：

```ts
const shadowResult = target.apply(shadowRoot, args);
if (shadowResult && (propKey === "querySelector" || (shadowResult as NodeList).length > 0)) {
  return shadowResult;
}
return args[0] === "base"
  ? null
  : iframe.contentWindow[rawPropMap[propKey]].call(iframe.contentWindow.document, args[0]);
```

其中 `"base"` 特判来自上游 2023 年的 `fix/get-script-attrs`，其语义是「`querySelector("base")` 不应返回 sandbox iframe 注入的 `<base>` 元素」（该 `<base>` 由 `initBase` 注入，用于修正子应用相对路径解析，与子应用自己的 base 无关）。该特判原本**只对 `querySelector` 有意义**，因为 `querySelectorAll` 分支永远走不到 fallback。

约束：

- `proxy.ts` 属于副作用编排层（Component 层），不得反向依赖上层模块
- 返回值类型必须符合 Web 标准，不能为了「返回 null」而破坏 `querySelectorAll` 的契约
- `iframe.contentWindow.__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__` 在 `initIframeDom` 中于 `patchDocumentEffect` **之前**捕获，是未被代理的原生实现，可安全用于回退查询

## Goals / Non-Goals

**Goals:**

- 消除 `document.querySelectorAll(...)` 可能返回 `null` 的行为
- 保持 `querySelector` 与 `querySelectorAll` 两条分支各自的语义：前者保留 `base` 特判，后者保持 NodeList 契约
- 用测试锁定两条分支的返回值类型

**Non-Goals:**

- 不改变「渲染根优先、iframe 文档回退」的查找顺序（本次移植刚把它对 `querySelectorAll` 打开，保持不变）
- 不调整 `getElementById` 的查找逻辑（其 `base` 语义与本问题无关）
- 不引入 NodeList 的跨文档合并（回退是「二选一」，与上游 `fix/get-script-attrs` 的原始设计一致）

## Decisions

### D1：把 `"base"` 特判收敛到 `querySelector` 分支

将 `querySelector` 与 `querySelectorAll` 拆成两个显式分支，各自表达自己的契约：

```ts
const shadowResult = target.apply(shadowRoot, args);
if (propKey === "querySelector") {
  // querySelector 可返回 null
  return shadowResult || (args[0] === "base" ? null : rawQuerySelector.call(iframe.contentWindow.document, args[0]));
}
// querySelectorAll 必须返回 NodeList
if (shadowResult && shadowResult.length > 0) return shadowResult;
if (args[0] === "base") return shadowResult;   // 空 NodeList，绝不返回 null
return rawQuerySelectorAll.call(iframe.contentWindow.document, args[0]);
```

- `querySelector` 分支行为与改动前**完全一致**（空结果为 `null` → `base` 特判 → 回退 iframe 文档）
- `querySelectorAll` 分支：`base` 选择器返回空 NodeList；其余选择器回退到 iframe 文档的原生查询结果（同样是 NodeList）

**备选方案与否决理由**：

| 备选 | 否决理由 |
|---|---|
| 对 `querySelectorAll` 的 `base` 分支也返回 `null` | 直接违反 `querySelectorAll` 的 Web 标准契约，是本次要修的回归本身 |
| 对 `querySelectorAll` 的 `base` 分支返回 iframe 文档的 base 元素 | 与 `querySelector` 的语义不对称；`base` 特判的初衷就是不暴露 sandbox 注入的 base |
| 完全移除 `base` 特判 | 会改变 `querySelector("base")` 的既有行为，超出本变更范围，且可能影响依赖该行为的子应用路由逻辑 |

### D2：回退查询统一走 `iframe.contentWindow.__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__`

保持使用 `rawPropMap` 映射到 iframe window 上的原生方法，不改用 `proxyDocument` 自身，避免回退路径再次进入代理拦截器形成递归。

### D3：`getElementById` 不在本变更范围内

`getElementById` 走的是独立的 `shadowRoot.querySelector` 包装，查找顺序为「渲染根按 `[id="..."]` 匹配 → iframe 文档按 `#...` 匹配」，且已有 try/catch 兜底返回 `null`，其返回值类型本就符合契约，与本问题无关。

## 分层设计（ECC 三层约束在本项目的映射）

| 层 | 本项目对应 | 本次改动 |
|---|---|---|
| **Control**（公共 API 边界） | `src/index.ts` — `startApp` / `preloadApp` / `destroyApp` / `refreshApp` / `setupApp` / `clearAssetsCache` | 不涉及 |
| **Component**（副作用编排） | `src/sandbox.ts`、`src/effect.ts`、`src/shadow.ts`、`src/proxy.ts`、`src/entry.ts` | **`src/proxy.ts`：修改 `proxyGenerator` 中 `querySelector` / `querySelectorAll` 的 apply 拦截器** |
| **Entity**（纯数据与契约） | `src/constant.ts`、`src/template.ts`、`src/plugin.ts`、`src/common.ts` | 不涉及 |

跨层约束核验：

- `proxy.ts` 的改动完全发生在 Component 层内部，不新增对 Control 层的引用
- 不新增 Entity → Component 的反向依赖
- 未触碰 `Document.prototype` 的重定义逻辑（属 `iframe.ts` 的 Component 层职责），本变更只改代理的取值行为

## 已知遗留（不在本次范围）

- **`ctx !== iframe.contentDocument` 分支的自递归风险**：当 `ctx` 是 iframe 域内**另一个** Document
  （例如子应用在 iframe 内 `document.implementation.createHTMLDocument()`）时，
  `ctx["querySelector"]` 命中被改写的 `Document.prototype` getter → 返回同一个 `proxyDocument[propKey]`
  → apply 再次以同一 `ctx` 进入 → 无限递归（RangeError）。
  对 Element 接收者则是正确的（`Element.prototype.querySelector` 未被改写）。
  该行为在本次改动前后**完全一致**（改动前同样是 `ctx[propKey]?.apply(ctx, args)`），不构成回归；
  若要修复，应单开变更处理。

## Risks / Trade-offs

- **[Risk] `querySelectorAll` 回退到 iframe 文档后，子应用会看到 sandbox 注入的 `<base>` 与 loader `<script>`** → 这是上游 `fix/get-script-attrs` 的既定语义（渲染根为空时以 iframe 文档为准），本次不改变回退范围；已在 spec 中以场景形式固化「空结果返回空 NodeList」的契约
- **[Risk] 拆分分支后 `querySelector` 分支存在行为漂移** → 该分支在改动前后逐语句等价，且已有 `getElementById` 同款写法可参照；由测试锁定
- **[Trade-off] `querySelectorAll` 的回退结果与渲染根分属不同 document** → 属上游既有设计；跨 document 的 NodeList 在调用方只做长度/遍历使用时无差异

## Migration Plan

纯内部修复，无配置变更、无公开 API 变更。回滚策略：单文件回退 `packages/wujie-core/src/proxy.ts`。
