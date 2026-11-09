# Tasks

## 1. Entity 层：新增空骨架标记常量

- [x] 1.1 在 `packages/wujie-core/src/constant.ts` 新增常量 `WUJIE_EMPTY_SKELETON_FLAG = "data-wujie-empty-skeleton"`（与既有 `data-wujie-*` 标记命名风格一致）；验证方式：常量被导出且命名与同文件其他 `WUJIE_*` 标记一致

## 2. 渲染层契约的失败测试（TDD RED）

- [x] 2.1 在 `packages/wujie-core/__test__/unit/` 新增用例，断言模板为空时调用 `renderTemplateToShadowRoot` 后，`shadowRoot.head` 与 `shadowRoot.body` 均为有效元素、且渲染根内不含字面量 `undefined` 文本；验证方式：运行该用例，确认在修复前失败（head/body 为 undefined）
- [x] 2.2 同文件新增用例，断言模板为空时渲染根的 `head.appendChild` 已被劫持（插入一个 `<style>` 后该元素被转换为 wujie 接管的样式元素，而非原样插入）；验证方式：运行该用例，确认在修复前失败
- [x] 2.3 同文件新增用例，断言模板为空时 `sandbox.head`/`sandbox.body`（即 `iframeWindow.__WUJIE.head/body`）为有效元素；验证方式：运行该用例，确认在修复前失败（为 undefined）
- [x] 2.4 同文件新增用例，断言模板非空时渲染根内只有一个 `<html>` 且 `shadowRoot.firstElementChild` 为内容承载元素（覆盖「空模板后再真实渲染」的序列）；验证方式：运行该用例（**实测结论：该用例在修复前后均 PASS**——修复前早退时渲染根内本就没有骨架，故它是防止「引入空骨架后出现两个 `<html>`」的双向护栏，真正的 RED 是 2.1/2.2/2.3/2.5）
- [x] 2.5 同文件新增用例，断言模板为空时降级渲染（`renderTemplateToIframe`）的渲染文档内不含 `undefined` 文本、且渲染文档的 `head.appendChild` 已被劫持；验证方式：运行该用例，确认在修复前失败
- [x] 2.6 复跑既有 `upstream-fixes.test.ts` 的空模板用例，确认基线行为未被破坏；验证方式：该文件 PASS（**实测结论：该基线用例必须按新契约更新**——它断言的是「渲染根为空 / 渲染文档 body 为空」的旧契约，而本次变更正是重新定义该契约；已保留其原始意图「不渲染字面量 undefined」，并把 mock 补齐为真实 `__WUJIE` sandbox（旧代码早退在触碰 `__WUJIE` 之前，空 mock 才够用））

## 3. Component 层实现（packages/wujie-core/src/shadow.ts）

- [x] 3.1 把 `renderTemplateToHtml` 中「补齐 head/body」的两段代码前移到 `sandbox.head`/`sandbox.body` 赋值之前，保证赋值拿到真实元素而非 `null`；验证方式：2.3 用例转绿
- [x] 3.2 在 `renderTemplateToShadowRoot` 中移除 `if (!template) return;`，改为：模板为空时创建带 `WUJIE_EMPTY_SKELETON_FLAG` 标记的最小骨架（`html > head + body`）并 append 到渲染根，随后完成 `shadowRoot.head`/`shadowRoot.body` 赋值、`sandbox.head`/`sandbox.body` 赋值与 `patchRenderEffect` 安装，最后输出一次 warn 并返回；验证方式：2.1、2.2、2.3 用例转绿
- [x] 3.3 在 `renderTemplateToShadowRoot` 的真实渲染分支入口，移除带 `WUJIE_EMPTY_SKELETON_FLAG` 标记的骨架后再 append 真实 html，保证渲染根内不并存两个 `<html>`；验证方式：2.4 用例转绿
- [x] 3.4 在 `replaceHeadAndBody` 中对缺失的 `head`/`body` 参数做容错（缺一则跳过该项替换）；验证方式：2.3、2.4 用例保持 PASS
- [x] 3.5 在 `renderTemplateToIframe` 中移除 `if (!template) return;`，改为把模板归一化为 `template ?? ""`，让空模板走通 `renderTemplateToHtml` → `replaceChild` → `initBase` → `patchRenderEffect` 的既有流程；验证方式：2.5 用例转绿
- [x] 3.6 运行 `pnpm run test:unit`，确认 `packages/wujie-core` 全部单测通过且退出码为 0；验证方式：jest 输出 `Test Suites: N passed` 且无 failed

## 4. Component 层防御性加固（packages/wujie-core/src/sandbox.ts）

- [x] 4.1 在 `patchCssRules()` 中增加 `shadowRoot.head` 缺失时的守卫，缺失则跳过 host 样式挂载而不抛异常；验证方式：新增一个「渲染根无 head 时调用 patchCssRules 不抛异常」的用例并确认 PASS
- [x] 4.2 在 `rebuildStyleSheets()` 中增加目标 head 缺失时的守卫，缺失则直接返回而不抛异常；验证方式：新增一个「渲染根无 head 时调用 rebuildStyleSheets 不抛异常」的用例并确认 PASS
- [x] 4.3 运行 `pnpm run test:unit`，确认新增守卫用例与全量单测一并通过且退出码为 0；验证方式：jest 输出 `Test Suites: N passed` 且无 failed

## 5. 文档与提交

- [x] 5.1 检查 `docs/` 中关于子应用渲染流程的描述，如与 `specs/app-rendering/spec.md` 固化的契约（空模板时渲染根仍完整）有出入则同步修正；验证方式：逐条比对文档与 spec 需求，无出入则记录「无需修改」（结论：无需修改——`docs/guide/information.md` 描述的是「`ShadowRoot` 内部的副作用必须进行处理，主要处理的就是 `shadowRoot` 的 `head` 和 `body`」，这正是本次变更要保证的目标状态：空模板路径下 head/body 引用有效且副作用劫持已安装，文档描述与修复后行为一致）
- [x] 5.2 运行 `npx eslint --ext .ts packages/wujie-core/src/shadow.ts packages/wujie-core/src/sandbox.ts packages/wujie-core/src/constant.ts`，确认无告警；验证方式：eslint 输出为空
- [x] 5.3 以中文提交信息按 `<类型>: <简述>` 格式提交本次改动（建议 `fix: 修正空模板场景下渲染根半初始化的问题`）；验证方式：`git log --oneline -1` 显示新提交

## 6. Code Review 反馈修复

- [x] 6.1 （Important 1）`patchCssRules()` 只有在样式**确实挂载成功**时才写 `WUJIE_DATA_ATTACH_CSS_FLAG`：否则标记会让后续调用直接早退，`:root → :host` 补丁永久丢失；验证方式：新增用例断言「host 样式未挂载时不写标记」
- [x] 6.2 （Important 2）`ensureEmptyRenderRoot` 必须返回**自带 head 与 body** 的 html：多次渲染后旧 html 会变成无 head 的空壳，直接使用会让 `shadowRoot.head` 为 null 并使 `patchRenderEffect` 抛错；验证方式：新增「多次渲染后遇空模板」用例
- [x] 6.3 （Important 3）空模板告警改为**每个子应用只输出一次**（WeakSet 记录已告警的 sandbox），与 D5 及 spec「输出一次告警」一致；验证方式：新增用例断言二次空渲染不再告警
- [x] 6.4 （Important 4）修正 design.md 中 D1 的风险描述：补齐 head/body 前移确实改变了「模板自身没有 head」时的 `replaceHeadAndBody` 行为（旧 head 现在会被搬进新 html 并保留内容，更符合既有意图），并补用例锁定该新行为；验证方式：design.md 已修正 + 新增复用同一 head 的用例
- [x] 6.5 （Important 5）补齐 spec 覆盖缺口：warn 断言 / 真实渲染后再遇空模板 / `execFlag === true` 的空模板路径 / 降级模式 base 注入断言；验证方式：对应用例 PASS
- [x] 6.6 （Minor 6）空模板路径也给承载内容的 html 应用 `parentNode` / `getBoundingClientRect` 补丁；验证方式：抽出公共 helper `patchShadowHtmlElement`，两条路径共用
- [x] 6.7 （Minor 7）空模板路径的 head/body 取值与真实路径语义对齐（绑定到所管理的 html 自身的 head/body）
- [x] 6.8 （Minor 8）修正 design.md 中「patchRenderEffect 两次安装作用于不同元素」的描述：`execFlag === true` 时骨架的 head 就是真实 head，属同一元素
- [x] 6.9 （Minor 9）空骨架的移除与真实 html 的追加相邻执行（中间不跨 await），避免并发空渲染重新建骨架导致两个 `<html>`；验证方式：既有「空模板后再真实渲染」用例保持 PASS
- [x] 6.10 （Minor 10）修正 design.md 中 D4 的伪码，使描述与实现一致（`rebuildStyleSheets` 跳过重建但仍调用 `patchCssRules`）
- [x] 6.11 （Minor 11）`effect.ts` 的 `handleStylesheetElementPatch` 对 `sandbox.shadowRoot?.head` 加守卫，防 sandbox 在防抖期间被销毁后抛错
- [x] 6.12 修复由 Minor 6 引入的连带问题：`parentNode` 补丁会让 `skeleton.parentNode` 指向 `iframeWindow.document`，`removeEmptyRenderRoot` 改用 `remove()`（走内部父节点，不受补丁影响）；验证方式：空模板→真实渲染用例 PASS
- [x] 6.13 运行全量单测与集成测试，确认退出码 0；验证方式：jest 输出全部 PASS

## 7. Code Review 复审反馈处理

- [x] 7.1 （Important A）补上 tasks.md 6.1 声称存在但实际缺失的断言：「渲染根无 head、host 样式未挂载时不得写 `WUJIE_DATA_ATTACH_CSS_FLAG`」，并补一条「head 存在且挂载成功时应写标记」的对照用例；验证方式：回退 `sandbox.ts` 到基线版本时这两条用例必须失败（已实测：基线下 3 条失败 / 修复后全绿）
- [x] 7.2 （Minor 1/2）`patchCssRules()` 的标记语义细化为 `attached`（本次确实挂载）与 `pending`（仍有可重试的待办补丁）：host 因缺 head 被跳过时算 pending，font 容器缺失时不算 pending；验证方式：7.1 的两条断言 + 全量单测
- [x] 7.3 （Minor 3）删除 `ensureEmptyRenderRoot` 返回值中未被使用的 `created` 字段（告警改由 WeakSet 判定）；验证方式：`tsc` 编译通过且无未使用变量
- [x] 7.4 （Minor 4/5）更新 design.md：D2 补充空骨架的三分支选择规则、「空模板不清空既有渲染内容」、骨架移除与追加必须相邻、两条路径 head/body 取值对称；D4 伪码补充 `pending` 语义；D5 括注改为「以 sandbox 实例为键告警一次」
- [x] 7.5 （Minor 6）真实渲染路径的 `shadowRoot.head/body` 改为取承载内容的 html 自身的 head/body，与空模板路径对称（多次渲染后渲染根内可能残留旧 html，渲染根范围的 querySelector 会取到过期的 head）；验证方式：新增「重复渲染后 shadowRoot.head 与 sandbox.head 指向同一元素」用例
- [x] 7.6 修正 mock：`getPatchStyleElements` 依赖 `style.sheet`（CSSOM），jsdom 只有元素真正位于文档中时才有 sheet，`createHTMLDocument()` 里的 style 没有 sheet 会让用例退化；验证方式：7.1 的断言在基线实现下确实失败
- [x] 7.7 运行全量单测与集成测试，确认退出码 0；验证方式：jest 输出全部 PASS
