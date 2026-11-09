# Tasks

## 1. spec 场景补充

- [x] 1.1 在 delta spec 中以 MODIFIED 形式给出 Requirement「元素查询优先在渲染根内进行」的完整块（正文 + 既有 2 个场景 + 新增 2 个 `getElementById` 场景）；验证方式：delta 中该 Requirement 的场景数为 4，且与主规范既有场景逐字一致
- [x] 1.2 运行 `openspec validate add-getelementbyid-spec-scenarios --strict`，确认 delta 合法；验证方式：输出 valid

## 2. 同步与归档

- [x] 2.1 将 delta 同步到主规范 `openspec/specs/document-proxy/spec.md`，确认该 Requirement 下有 4 个场景、其余 Requirement 未受影响；验证方式：`openspec validate --specs --strict` 通过且主规范场景数校验通过
- [ ] 2.2 归档本变更并提交归档产物与主规范更新；验证方式：`openspec list` 中不再有本变更，`git log --oneline -1` 显示归档提交
