# Proposal

## Why

上游 `fix/get-script-attrs` 引入的 document 代理回退逻辑长期依赖 `target.apply(shadowRoot, args) || fallback` 这一短路求值。由于**空的 NodeList 也是 truthy**，该 fallback 对 `querySelectorAll` 实际上**永远不可达**；本次上游移植为修复这一点改成了显式的长度判断，fallback 变得可达——但同时把**只适用于 `querySelector` 的 `"base"` 选择器特判**一并复用到了 `querySelectorAll`，导致 `document.querySelectorAll("base")` 返回 `null`。

`querySelectorAll` 的契约要求返回 NodeList，任何 `document.querySelectorAll("base").length` 会抛 `TypeError: Cannot read properties of null`，属于本次移植引入的回归。

## What Changes

- 把 `"base"` 选择器的特判**限制在 `querySelector` 分支**，不再让 `querySelectorAll` 返回 `null`
- `querySelectorAll` 分支在渲染根无匹配时回退到 iframe 文档的查询结果，并保证返回值始终是 NodeList
- 补充单元测试，锁定 `querySelector` / `querySelectorAll` 两条分支的返回值类型契约

## Capabilities

### New Capabilities

- `document-proxy`: 子应用侧 `document` 代理的查询语义——`querySelector` / `querySelectorAll` / `getElementById` 等在渲染根与 iframe 文档之间的查找优先级与回退规则

### Modified Capabilities

（无）

## Impact

- 代码：`packages/wujie-core/src/proxy.ts`（`proxyGenerator` 中 `querySelector` / `querySelectorAll` 的 apply 拦截器）
- 行为：`document.querySelectorAll("base")` 由返回 `null` 修正为返回空 NodeList；其余选择器的查找结果不变
- 兼容性：不涉及公开 API 变更；`querySelectorAll` 的回退范围与上游移植保持一致
