# Proposal

## Why

`document-proxy` 主规范的 Requirement「元素查询优先在渲染根内进行」的正文点名了 `querySelector`、`querySelectorAll`、`getElementById` 三个方法，但只枚举了 `querySelector` 的两个场景。

`getElementById` 的行为（渲染根优先 + 未命中回退 iframe 文档）现已被单元测试钉住，但测试缺少对应的 spec 场景锚点：spec-first 的约定下，测试应当能追溯到一条明确枚举的场景。

## What Changes

- 为 Requirement「元素查询优先在渲染根内进行」补充两个 `getElementById` 场景：渲染根内存在匹配元素、渲染根内无匹配时回退 iframe 文档
- 只修改 spec，不改动任何运行时代码

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `document-proxy`: Requirement「元素查询优先在渲染根内进行」补充 `getElementById` 的两个场景，使其与正文点名的三个方法一一对应

## Impact

- 制品：`openspec/specs/document-proxy/spec.md`（经 sync 合并）
- 代码：无
- 行为：无
