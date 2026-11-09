# Tasks

## 1. 去重契约的失败测试（TDD RED）

- [x] 1.1 在 `packages/wujie-core/__test__/unit/` 新增用例，构造 shadow-root 模式的真实劫持链路（`patchRenderEffect(shadowRoot, id, false)` + 入口 HTML 内联 `<style data-wujie-css-href>`），向 `shadowRoot.head` 插入同 href 的 `<link rel="stylesheet">`，断言渲染根内 `data-wujie-css-href` 的 `<style>` 数量仍为 1；验证方式：运行该用例，确认在修复前失败（当前实现下数量为 2）
- [x] 1.2 同文件新增降级模式用例（`patchRenderEffect(renderDocument, id, true)`，入口 style 位于渲染 iframe document），断言同 href 的 `<link>` 不会在渲染 iframe document 内产生第二份 `<style>`；验证方式：运行该用例，确认在修复前失败
- [x] 1.3 同文件新增 href 含换行等非法选择器字符的用例，断言去重查询不抛异常、且返回 `null`（不误命中）；验证方式：运行该用例，确认在修复前抛出 `DOMException`
- [x] 1.4 保留并复跑既有 `css-href-dedupe.test.ts`（纯函数 + 异步 load 派发）与 `defer-style-href.test.ts`，确认基线用例全绿、未被新用例破坏；验证方式：`pnpm run test:unit` 中这两个文件 PASS

## 2. Component 层实现（packages/wujie-core/src/effect.ts）

- [x] 2.1 将 `findStyleByCssHref` 入参类型放宽为 `Document | ShadowRoot | null`，并把基于拼接 CSS 选择器的查找改为遍历 `style` 元素比较 `getAttribute("data-wujie-css-href")`（保留既有 `/* href */` 注释前缀的 legacy 兼容分支）；验证方式：1.3 用例转绿
- [x] 2.2 在 `loadStyleSheet` 中用插入点元素的 `getRootNode()` 取得渲染根，去重查询按「渲染根优先、`sandbox.iframe.contentDocument` 兜底」的顺序执行；验证方式：1.1、1.2 用例转绿
- [x] 2.3 确认命中去重时仍走 `dispatchStyleSheetLoadAsync` 对原 `<link>` 补发 `load`，且不在同一调用栈内同步派发；验证方式：既有 `css-href-dedupe.test.ts` 的两个异步派发用例保持 PASS
- [x] 2.4 运行 `pnpm run test:unit`，确认 `packages/wujie-core` 全部单测通过且退出码为 0；验证方式：jest 输出 `Test Suites: N passed` 且无 failed

## 3. 文档与提交

- [x] 3.1 检查 `docs/api/startApp.md`、`docs/api/preloadApp.md`、`docs/guide/plugin.md` 中关于 `cssExcludes` / 外链样式加载的描述，如与修复后行为（同一渲染根内同 href 只保留一份样式）有出入则同步修正；验证方式：逐条比对文档描述与 `specs/styles-loading/spec.md` 的需求，无出入则记录「无需修改」（结论：无需修改——三处文档仅描述 `cssExcludes`/`cssIgnores` 的插件语义，未描述外链 CSS 内联与去重行为，与修复后行为无出入）
- [x] 3.2 运行 `npx eslint --ext .ts packages/wujie-core/src/effect.ts`，确认无告警；验证方式：eslint 输出为空
- [x] 3.3 以中文提交信息按 `<类型>: <简述>` 格式提交本次改动（建议 `fix: 修正外链 CSS 去重的查找域为渲染根`）；验证方式：`git log --oneline -1` 显示新提交

## 4. Code Review 反馈修复（加载失败不得阻断重试）

- [x] 4.1 在 `packages/wujie-core/__test__/unit/css-dedupe-render-scope.test.ts` 补「CSS 请求失败后再次插入同一地址应重新请求并注入内容」的用例；验证方式：运行该用例，确认在修复前失败（当前 fetchCount 停在 1，重试被首次失败留下的空占位 style 去重掉）
- [x] 4.2 在 `packages/wujie-core/src/effect.ts` 的 `loadStyleSheet` 成功分支中，占位元素填充内容后按实际内容决定去重标记：内容非空则保留 `data-wujie-css-href`，内容为空（`fetchAssets` 对 cssFlag 的失败路径 resolve 成 `""`）则撤销该标记；验证方式：4.1 用例转绿
- [x] 4.3 在 `packages/wujie-core/src/entry.ts` 的 `getEmbedHTML` 中，样式内容为空时改为输出原始 `<link>`（与 `cssIgnores` 分支一致），不输出带去重标记的 `<style>`；验证方式：新增用例断言入口 HTML 内联失败时产物不含 `data-wujie-css-href` 且仍含 `<link>`
- [x] 4.4 补 spec 场景「不同地址的样式互不影响」用例：渲染根内已有 X 时插入 Y，断言生成第二份带 Y 标记的 style 且 Y 的内容被注入；验证方式：该用例 PASS
- [x] 4.5 把 `deleteWujieById` 移入 `afterEach`，避免断言中途失败时污染模块级 sandbox 缓存；验证方式：全量单测通过
- [x] 4.6 把 `getRenderRoot` 的 `fallback` 类型改为 `Document | null`、返回类型改为 `Document | ShadowRoot | null`，并去掉多余的 `getRootNode?.()` 可选调用；验证方式：`tsc` 编译通过
- [x] 4.7 运行 `pnpm run test:unit` 与集成测试，确认全量通过且退出码为 0；验证方式：jest 输出全部 PASS

## 5. Code Review 复审反馈处理（Minor 项）

- [x] 5.1 复审 Minor-1：`contentPromise` reject 分支（用户 loadError 回调抛错等可达）同样撤销去重标记并移除空占位；验证方式：新增 rejection 用例，断言渲染根内不残留带标记的 style
- [x] 5.2 复审 Minor-2：内容为空时移除占位元素且不再 push 进 `styleSheetElements`，避免渲染根堆叠空 style；验证方式：新增断言，失败后渲染根内 `style` 数量为 0
- [x] 5.3 复审 Minor-5：恢复 `getRootNode?.()` 可选调用，消除「Chrome 53 等理论边界」风险；验证方式：`tsc` 编译通过、行为不变
- [x] 5.4 复审 Minor-6：测试 `afterEach` 补 `clearAssetsCache()`，避免模块级 `styleCache` 在用例间串味；验证方式：全量单测通过
- [x] 5.5 复审 Minor-3 结论澄清：实测（puppeteer）确认 **shadow tree 内的 `<link rel="stylesheet">` 会被浏览器加载并生效**（computed style 变为 link 提供的值），因此 design.md D5「保留原始 `<link>` 以便浏览器自行加载/重试」的表述成立，无需修改；把该实测证据补记入 design.md；验证方式：design.md 中记录实测结论与复现方式
- [x] 5.6 复审 Minor-4 结论澄清：`<link>` 兜底丢失 `media`/`crossorigin` 等属性与既有 `cssIgnores` 分支写法一致，按「与既有行为对齐」处理，不在本变更内修改；验证方式：design.md 中记录该结论
- [x] 5.7 运行 `pnpm run test:unit` 与集成测试，确认全量通过且退出码为 0；验证方式：jest 输出全部 PASS
