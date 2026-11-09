/**
 * 空模板场景下渲染根完整性回归测试（OpenSpec change: fix-empty-template-partial-init）
 *
 * 背景：上游 PR #1112 为解决「首次加载闪现 undefined 文本」，在 renderTemplateToShadowRoot /
 * renderTemplateToIframe 的**最开头**加了 `if (!template) return;`。
 * 但该早退发生在「渲染根准备」之前，导致：
 *   - shadowRoot.head / shadowRoot.body 未被赋值 → patchRenderEffect 无法安装、
 *     子应用侧 document.head 为 undefined、patchCssRules/rebuildStyleSheets 可能抛 TypeError；
 *   - sandbox.head / sandbox.body 未被赋值 → 后续 replaceHeadAndBody(html, undefined, undefined) 抛 TypeError。
 *
 * 本文件覆盖真实渲染链路（renderTemplateToShadowRoot / renderTemplateToIframe）。
 */

export {};

const { renderTemplateToShadowRoot, renderTemplateToIframe } = require("../../src/shadow");
const { addSandboxCacheWithWujie, deleteWujieById } = require("../../src/common");
const Wujie = require("../../src/sandbox").default;

const CHILD_URL = "http://child.example.com/index.html";

/**
 * 构造真实可用的渲染环境：
 * - 真实 iframe → 其 contentWindow 作为 iframeWindow（提供真实的 document / createTreeWalker）
 * - sandbox 挂在 iframeWindow.__WUJIE 上，供 renderTemplateToHtml / processCssLoaderForTemplate 消费
 */
function createRenderEnv() {
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  const iframeWindow: any = iframe.contentWindow;

  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadowRoot: any = host.attachShadow({ mode: "open" });

  const sandbox: any = {
    id: "empty-template-app",
    url: CHILD_URL,
    alive: false,
    execFlag: false,
    head: undefined,
    body: undefined,
    styleSheetElements: [],
    plugins: [],
    replace: (html: string) => html,
    proxyLocation: new URL(CHILD_URL),
    iframe,
    fetch: () => Promise.resolve(new Response("")),
    lifecycles: { loadError: () => undefined },
    inject: {},
    degrade: false,
    shadowRoot,
  };
  iframeWindow.__WUJIE = sandbox;
  // 被劫持的 appendChild 按 id 查 sandbox，必须注册
  addSandboxCacheWithWujie(sandbox.id, sandbox);

  return { iframe, iframeWindow, sandbox, shadowRoot };
}

describe("空模板 / 渲染根准备独立于模板内容", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    // 空模板会打 warn，避免污染测试输出
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    deleteWujieById("empty-template-app");
    jest.restoreAllMocks();
  });

  it("模板为空时 shadowRoot.head / body 有效，且不渲染出 undefined 文本", async () => {
    const { iframeWindow, shadowRoot } = createRenderEnv();

    await renderTemplateToShadowRoot(shadowRoot, iframeWindow, "");

    expect(shadowRoot.head).toBeTruthy();
    expect(shadowRoot.body).toBeTruthy();
    expect(shadowRoot.innerHTML).not.toContain("undefined");
  });

  it("模板为空时渲染根 head.appendChild 已被劫持", async () => {
    const { iframeWindow, sandbox, shadowRoot } = createRenderEnv();

    await renderTemplateToShadowRoot(shadowRoot, iframeWindow, "");

    const style = document.createElement("style");
    style.innerHTML = ".hijacked{color:red}";
    shadowRoot.head.appendChild(style);

    // 被劫持的 STYLE 分支会把样式登记进 sandbox.styleSheetElements
    expect(sandbox.styleSheetElements.length).toBeGreaterThan(0);
    expect(sandbox.styleSheetElements[0]).toBe(style);
  });

  it("模板为空时 sandbox.head / sandbox.body 为有效元素", async () => {
    const { iframeWindow, sandbox, shadowRoot } = createRenderEnv();

    await renderTemplateToShadowRoot(shadowRoot, iframeWindow, "");

    expect(sandbox.head).toBeTruthy();
    expect(sandbox.body).toBeTruthy();
  });

  it("空模板后再真实渲染：渲染根内只有一个 <html>，且 firstElementChild 是内容承载元素", async () => {
    const { iframeWindow, shadowRoot } = createRenderEnv();

    await renderTemplateToShadowRoot(shadowRoot, iframeWindow, "");
    await renderTemplateToShadowRoot(
      shadowRoot,
      iframeWindow,
      "<head><title>t</title></head><body>real-content</body>"
    );

    expect(shadowRoot.querySelectorAll("html")).toHaveLength(1);
    expect(shadowRoot.firstElementChild.textContent).toContain("real-content");
  });

  it("空模板会告警，且同一子应用只告警一次", async () => {
    const { iframeWindow, shadowRoot } = createRenderEnv();

    await renderTemplateToShadowRoot(shadowRoot, iframeWindow, "");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("empty-template-app");

    // 再次空渲染不重复告警（避免每次激活都刷屏）
    await renderTemplateToShadowRoot(shadowRoot, iframeWindow, "");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("真实渲染之后再遇空模板：渲染根保留原有内容，head/body 仍有效", async () => {
    const { iframeWindow, shadowRoot } = createRenderEnv();

    await renderTemplateToShadowRoot(
      shadowRoot,
      iframeWindow,
      "<head><title>t</title></head><body>real-content</body>"
    );
    const realHtml = shadowRoot.firstElementChild;
    const realHead = shadowRoot.head;

    await renderTemplateToShadowRoot(shadowRoot, iframeWindow, "");

    // 不应追加第二个 <html>，也不应把 head 指向空壳
    expect(shadowRoot.querySelectorAll("html")).toHaveLength(1);
    expect(shadowRoot.firstElementChild).toBe(realHtml);
    expect(shadowRoot.head).toBe(realHead);
    expect(shadowRoot.textContent).toContain("real-content");
  });

  it("execFlag=true（start 之后再次渲染）时，空模板路径仍能得到有效的 head/body", async () => {
    const { iframeWindow, sandbox, shadowRoot } = createRenderEnv();

    await renderTemplateToShadowRoot(shadowRoot, iframeWindow, "");
    sandbox.execFlag = true;

    await renderTemplateToShadowRoot(shadowRoot, iframeWindow, "");

    expect(shadowRoot.head).toBeTruthy();
    expect(shadowRoot.body).toBeTruthy();
    expect(sandbox.head).toBe(shadowRoot.head);
    expect(sandbox.body).toBe(shadowRoot.body);
  });

  it("模板自身没有 head 时，再次渲染复用同一个 head（锁定 D1 的语义变化）", async () => {
    const { iframeWindow, sandbox, shadowRoot } = createRenderEnv();

    await renderTemplateToShadowRoot(shadowRoot, iframeWindow, "<head><title>t</title></head><body>first</body>");
    const firstHead = shadowRoot.head;
    expect(firstHead).toBeTruthy();

    // start() 之后再次渲染：此时走 !alive && execFlag 的 head/body 复用路径
    sandbox.execFlag = true;
    await renderTemplateToShadowRoot(shadowRoot, iframeWindow, "<body>second</body>");

    // 旧 head 被搬进新 html 并保留，而不是被丢弃后换成新的空 head
    expect(shadowRoot.head).toBe(firstHead);
  });

  it("模板为空时降级渲染：渲染文档不含 undefined 文本，且 head.appendChild 已被劫持", async () => {
    const { iframeWindow, sandbox } = createRenderEnv();
    const renderIframe = document.createElement("iframe");
    document.body.appendChild(renderIframe);
    const renderDocument = renderIframe.contentDocument as Document;

    await renderTemplateToIframe(renderDocument, iframeWindow, "");

    expect(renderDocument.documentElement.outerHTML).not.toContain("undefined");
    expect(renderDocument.head).toBeTruthy();
    // 降级模式仍需完成相对路径基准的注入
    expect(renderDocument.querySelector("base")).toBeTruthy();

    const style = document.createElement("style");
    style.innerHTML = ".hijacked{color:red}";
    (renderDocument.head as any).appendChild(style);

    expect(sandbox.styleSheetElements.length).toBeGreaterThan(0);
    expect(sandbox.styleSheetElements[0]).toBe(style);
  });
});

describe("渲染根不完整时的防御性守卫", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  /** 构造一个「渲染根没有 head」的 sandbox 替身 */
  function createIncompleteSandbox(): any {
    const iframeDocument = document.implementation.createHTMLDocument("");
    // 带一条 :root 规则，尽量命中 host 样式提取分支
    const style = iframeDocument.createElement("style");
    style.textContent = ":root{color:red}";
    iframeDocument.head.appendChild(style);

    return {
      id: "incomplete-root-app",
      degrade: false,
      shadowRoot: { host: document.createElement("div") }, // 故意没有 head / body
      iframe: { contentDocument: iframeDocument },
      styleSheetElements: [],
      inject: {},
      // rebuildStyleSheets 内部会调用它，挂真实实现以便守卫一起被验证
      patchCssRules: Wujie.prototype.patchCssRules,
    };
  }

  it("渲染根无 head 时调用 patchCssRules 不抛异常", () => {
    const sandbox = createIncompleteSandbox();
    expect(() => Wujie.prototype.patchCssRules.call(sandbox)).not.toThrow();
  });

  it("渲染根无 head 时调用 rebuildStyleSheets 不抛异常", () => {
    const sandbox = createIncompleteSandbox();
    // 即使有已登记的样式元素，也不应因为缺少 head 而抛异常
    sandbox.styleSheetElements = [document.createElement("style")];
    expect(() => Wujie.prototype.rebuildStyleSheets.call(sandbox)).not.toThrow();
  });
});
