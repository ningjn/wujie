# Proposal

## Why

上游 PR #1112 为解决「首次加载闪现 `undefined` 文本」的问题，在 `renderTemplateToShadowRoot` / `renderTemplateToIframe` 的**最开头**加了 `if (!template) return;`。但该早退发生在**渲染根准备动作之前**，导致：

- shadow-root 模式下 `shadowRoot.head` / `shadowRoot.body` 未被赋值，`patchRenderEffect` 未执行 → 子应用后续动态注入的 CSS / JS 完全不被 wujie 处理（不转 `<style>`、不走 cssLoader、不提取 `@font-face`）
- `sandbox.patchCssRules()` / `sandbox.rebuildStyleSheets()` 中的 `this.shadowRoot.head.appendChild(...)` 会因 `shadowRoot.head` 为 `undefined` 抛 `TypeError`
- 降级模式同理跳过 `initBase` 与 `patchRenderEffect(renderDocument, ...)`

即：修掉了「闪现 undefined」，却引入了「渲染根半初始化」的更大问题。

## What Changes

- 把「准备渲染根」（head/body 赋值、`patchRenderEffect`、降级模式的 `initBase`）与「渲染模板内容」拆成两段，空模板只跳过后者
- 空模板时输出一次 `warn`，便于定位「模板为何为空」
- 保证 `sandbox.head` / `sandbox.body` 的初始化不依赖模板内容，避免后续 `replaceHeadAndBody` 拿到 `undefined`
- 补充单元测试，锁定「空模板不渲染内容」与「渲染根仍被正确初始化」两个契约

## Capabilities

### New Capabilities

- `app-rendering`: 子应用从模板到渲染根的构建流程——模板渲染、渲染根准备（head/body 赋值、副作用劫持安装）、空模板降级处理

### Modified Capabilities

（无）

## Impact

- 代码：`packages/wujie-core/src/shadow.ts`（`renderTemplateToShadowRoot` / `renderTemplateToIframe`）、`packages/wujie-core/src/sandbox.ts`（必要时补齐 `sandbox.head` / `sandbox.body` 初始化）
- 行为：模板为空时子应用不再渲染出 `undefined` 文本（保持上游 PR #1112 的修复效果），同时渲染根不再处于半初始化状态
- 兼容性：不涉及公开 API 变更；正常（非空）模板的渲染路径与产物保持不变
