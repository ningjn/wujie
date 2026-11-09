# Proposal

## Why

上游 PR #1109 引入的「按 href 去重外链 CSS」逻辑，在真实运行时**从未生效**：查找域取的是 sandbox iframe 的 `contentDocument`，而入口 HTML 转换出来的 `<style data-wujie-css-href>` 实际落在**渲染根**上——shadow-root 模式是 `shadowRoot.head`，降级模式是 render iframe 的 document。两者从来不是同一棵树，去重查询恒不命中，因此 issue #1108（Vite 构建产物重复 CSS）依旧复现。

本次改动修正查找域，让该 PR 真正生效。

## What Changes

- 将 CSS 去重的查找域从 sandbox iframe 文档改为**渲染根**（即插入点所在的 `getRootNode()`），sandbox iframe 文档降级为兜底
- `findStyleByCssHref` 入参类型由 `Document | null` 放宽为 `Document | ShadowRoot | null`，使其可直接作用于 ShadowRoot
- 补充单元测试，覆盖 shadow-root 模式与降级模式两条真实调用链（此前测试只测纯函数，未覆盖真实调用点）

## Capabilities

### New Capabilities

- `styles-loading`: 子应用外链样式（`<link rel="stylesheet">`）的劫持加载、入口 HTML 内联转换，以及同 href 去重行为

### Modified Capabilities

（无）

## Impact

- 代码：`packages/wujie-core/src/effect.ts`（`rewriteAppendOrInsertChild` / `loadStyleSheet` / `findStyleByCssHref`）
- 行为：同一渲染根内同 href 的外链 CSS 不再重复生成 `<style>`；命中去重时仍对原 `<link>` 补发 `load` 事件（保证 Vite preload 的 promise 能 settle）
- 兼容性：仅收敛重复样式，不改变既有 CSS 加载顺序、内容与 cssLoader 处理链路
- 风险面：仅影响 `findStyleByCssHref` 的查询范围，不涉及任何公开 API 变更
