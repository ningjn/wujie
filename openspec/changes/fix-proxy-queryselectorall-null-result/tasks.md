# Tasks

## 1. 查询契约的失败测试（TDD RED）

- [ ] 1.1 在 `packages/wujie-core/__test__/unit/` 新增用例，用最小 mock 构造 `proxyGenerator` 所需的 `iframe.contentWindow.__WUJIE`（`shadowRoot` / `proxyLocation`）与 `__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__`，断言 `document.querySelectorAll("base")` 的返回值是 NodeList 而非 `null`；验证方式：运行该用例，确认在修复前失败（实际返回 `null`）
- [ ] 1.2 同文件新增用例，断言 `document.querySelectorAll("div")` 在渲染根与 iframe 文档均无匹配时返回空 NodeList 且 `length === 0`；验证方式：运行该用例，确认在修复前失败（实际返回 `null`）
- [ ] 1.3 同文件新增用例，断言 `document.querySelector("base")` 在渲染根无匹配时返回 `null`，且不返回 iframe 文档内的 base 元素；验证方式：运行该用例，确认修复前后均为 PASS（防止 D1 收敛时误伤 `querySelector` 语义）
- [ ] 1.4 复跑既有 `packages/wujie-core/__test__/integration/querySelectorAll.test.ts` 所依赖的既有行为断言，确认不受影响；验证方式：单元用例全绿，集成用例在 apply 阶段随全量集成测试一并验证

## 2. Component 层实现（packages/wujie-core/src/proxy.ts）

- [ ] 2.1 将 `querySelector` 与 `querySelectorAll` 的 apply 拦截器拆为两个显式分支：`querySelector` 保留 `base` 特判与 iframe 文档回退；`querySelectorAll` 在渲染根无匹配时回退且永不返回 `null`；验证方式：1.1、1.2 用例转绿，1.3 用例保持 PASS
- [ ] 2.2 确认回退查询仍使用 `iframe.contentWindow.__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__`（未被代理的原生实现），不引入代理递归；验证方式：代码走查 + 1.2 用例转绿
- [ ] 2.3 运行 `pnpm run test:unit`，确认 `packages/wujie-core` 全部单测通过且退出码为 0；验证方式：jest 输出 `Test Suites: N passed` 且无 failed

## 3. 文档与提交

- [ ] 3.1 检查 `docs/` 中关于子应用 `document` 查询行为的描述，如与 `specs/document-proxy/spec.md` 固化的契约有出入则同步修正；验证方式：逐条比对文档与 spec 需求，无出入则记录「无需修改」
- [ ] 3.2 运行 `npx eslint --ext .ts packages/wujie-core/src/proxy.ts`，确认无告警；验证方式：eslint 输出为空
- [ ] 3.3 以中文提交信息按 `<类型>: <简述>` 格式提交本次改动（建议 `fix: 修正 document.querySelectorAll 回退时返回 null 的回归`）；验证方式：`git log --oneline -1` 显示新提交
