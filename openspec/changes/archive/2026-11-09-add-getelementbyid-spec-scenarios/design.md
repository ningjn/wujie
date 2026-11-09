# Design

## Context

`document-proxy` 主规范的 Requirement「元素查询优先在渲染根内进行」正文点名了三个查询方法，场景只覆盖 `querySelector`。

`packages/wujie-core/src/proxy.ts` 中 `getElementById` 的实现是：先在渲染根内按 `[id="..."]` 查找，未命中时回退到 iframe 文档按 `#id` 查找（外层有 try/catch，异常时告警并返回 `null`）。

`packages/wujie-core/__test__/unit/proxy-queryselectorall.test.ts` 已补两条用例钉住该行为：同名 id 时命中渲染根的那个、无匹配时回退到 iframe 文档的那个。

## Goals / Non-Goals

**Goals:**

- 让 `getElementById` 的两条行为在 spec 中有明确枚举的场景，使新增用例可追溯到 spec 锚点

**Non-Goals:**

- 不改变任何运行时代码或行为
- 不调整该 Requirement 的正文描述（正文已正确点名三个方法）

## Decisions

### D1：新增场景而非拆成独立 Requirement

`getElementById` 与 `querySelector` 遵循同一条查找顺序（渲染根优先、未命中回退 iframe 文档），拆成独立 Requirement 会重复同一条规则。补场景即可让三个方法在同一条 Requirement 下都有覆盖。

### D2：场景措辞与既有场景保持一致

沿用「渲染根内存在匹配元素」「渲染根内无匹配时回退到 iframe 文档」的 WHEN/THEN 结构，主语由 `document.querySelector` 换成 `document.getElementById`。

## Risks / Trade-offs

- **[Risk] spec 场景与实现漂移** → 场景描述与 `proxy.ts` 的实现逐句对应，且已有两条单元用例分别锚定「渲染根命中」与「回退 iframe 文档」

## Migration Plan

纯 spec 变更，无代码改动、无迁移。归档时经 sync 合并进主规范。
