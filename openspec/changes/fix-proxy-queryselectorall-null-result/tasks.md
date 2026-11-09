# Tasks

## 1. 查询契约的失败测试（TDD RED）

- [x] 1.1 在 `packages/wujie-core/__test__/unit/` 新增用例，用最小 mock 构造 `proxyGenerator` 所需的 `iframe.contentWindow.__WUJIE`（`shadowRoot` / `proxyLocation`）与 `__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__`，断言 `document.querySelectorAll("base")` 的返回值是 NodeList 而非 `null`；验证方式：运行该用例，确认在修复前失败（实际返回 `null`）
- [x] 1.2 同文件新增用例，断言 `document.querySelectorAll("div")` 在渲染根与 iframe 文档均无匹配时返回空 NodeList 且 `length === 0`；验证方式：运行该用例（**实测结论：该用例在修复前后均 PASS**——fallback 分支对非 `base` 选择器本就可达，故它是「返回值类型契约」的回归护栏而非 RED 用例；真正的 RED 是 1.1）；另补一条「渲染根无匹配时仍回退到 iframe 文档查询结果」的护栏用例，防止退化成「一律返回空 NodeList」（实际返回 `null`）
- [x] 1.3 同文件新增用例，断言 `document.querySelector("base")` 在渲染根无匹配时返回 `null`，且不返回 iframe 文档内的 base 元素；验证方式：运行该用例，确认修复前后均为 PASS（防止 D1 收敛时误伤 `querySelector` 语义）
- [x] 1.4 复跑既有 `packages/wujie-core/__test__/integration/querySelectorAll.test.ts` 所依赖的既有行为断言，确认不受影响；验证方式：单元用例全绿，集成用例在 apply 阶段随全量集成测试一并验证

## 2. Component 层实现（packages/wujie-core/src/proxy.ts）

- [x] 2.1 将 `querySelector` 与 `querySelectorAll` 的 apply 拦截器拆为两个显式分支：`querySelector` 保留 `base` 特判与 iframe 文档回退；`querySelectorAll` 在渲染根无匹配时回退且永不返回 `null`；验证方式：1.1、1.2 用例转绿，1.3 用例保持 PASS
- [x] 2.2 确认回退查询仍使用 `iframe.contentWindow.__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__`（未被代理的原生实现），不引入代理递归；验证方式：代码走查 + 1.2 用例转绿
- [x] 2.3 运行 `pnpm run test:unit`，确认 `packages/wujie-core` 全部单测通过且退出码为 0；验证方式：jest 输出 `Test Suites: N passed` 且无 failed

## 3. 文档与提交

- [x] 3.1 检查 `docs/` 中关于子应用 `document` 查询行为的描述，如与 `specs/document-proxy/spec.md` 固化的契约有出入则同步修正；验证方式：逐条比对文档与 spec 需求，无出入则记录「无需修改」（结论：**已修正**——`docs/guide/information.md` 的「iframe 的 document 改造」示例里，`querySelector`/`querySelectorAll` 仍写的是 `shadowRoot[propKey].bind(shadowRoot)`，既没有渲染根未命中时的 iframe 文档回退，也没有 base 特判，与本次固化的契约（及上游 2023 年那次改造后的实现）均不一致；已按修复后的实现语义改写该片段）
- [x] 3.2 运行 `npx eslint --ext .ts packages/wujie-core/src/proxy.ts`，确认无告警；验证方式：eslint 输出为空
- [x] 3.3 以中文提交信息按 `<类型>: <简述>` 格式提交本次改动（建议 `fix: 修正 document.querySelectorAll 回退时返回 null 的回归`）；验证方式：`git log --oneline -1` 显示新提交

## 4. Code Review 反馈修复

- [x] 4.1 （Important 1）把 tasks.md 的进度更新随本次改动一并提交，保证 apply→archive 链路在提交历史里可追溯；验证方式：`git show --stat` 中包含 tasks.md
- [x] 4.2 （Important 2）补「渲染根与 iframe 文档都命中时，渲染根优先」用例，锁定 spec requirement 1 的核心场景（否则把实现改成「优先 iframe 文档」或「一律返回渲染根结果」现有用例仍会全绿）；验证方式：该用例 PASS
- [x] 4.3 （Minor 1/2）在 `docs/guide/information.md` 的 document 改造示例前增加「简化示例」声明，说明省略了接收者守卫与部分特判；验证方式：文档已声明
- [x] 4.4 （Minor 4）去掉 `shadowResult &&` 冗余判断（`querySelectorAll` 只返回 NodeList，永不为 null）；验证方式：单测全绿
- [x] 4.5 （Minor 6）测试清理时调用 `proxyRevoke()`，释放代理闭包；验证方式：单测全绿
- [x] 4.6 （Minor 3）记录既有遗留：`ctx !== iframe.contentDocument` 分支在 `ctx` 为 iframe 域内**另一个** Document 时存在自递归风险（修复前后行为完全一致，非本次引入），本次不改；验证方式：design.md 中记录该结论
- [x] 4.7 运行全量单测与集成测试，确认退出码 0；验证方式：jest 输出全部 PASS
