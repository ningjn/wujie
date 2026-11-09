/**
 * Regression tests for selected upstream pull-request fixes.
 */

export {};

const { renderTemplateToShadowRoot, renderTemplateToIframe } = require("../../src/shadow");
const { addSandboxCacheWithWujie, deleteWujieById } = require("../../src/common");
const { recordEventListeners } = require("../../src/iframe");
const { clearAssetsCache: coreClearAssetsCache } = require("../../src/index");
const WujieVue = require("../../../wujie-vue3/index.js").default;

describe("empty template rendering", () => {
  /**
   * 空模板现在会走到渲染根准备逻辑，需要一个真实的 __WUJIE sandbox
   * （旧实现早退在触碰 __WUJIE 之前，所以当时的空 mock 才够用）。
   */
  function createIframeWindowMock(): any {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeWindow: any = iframe.contentWindow;
    const sandbox = {
      id: "empty-template-upstream",
      url: "http://child.example.com/index.html",
      alive: false,
      execFlag: false,
      head: undefined,
      body: undefined,
      plugins: [],
      replace: (html: string) => html,
      proxyLocation: new URL("http://child.example.com/index.html"),
      iframe,
      fetch: () => Promise.resolve(new Response("")),
      lifecycles: { loadError: () => undefined },
      inject: {},
      degrade: false,
      // 被劫持的 appendChild 会解构这些字段，缺失会导致 undefined.push 报错
      styleSheetElements: [],
      fontStyleSheetElements: [],
      execQueue: [],
      deferredStyleObservers: [],
    };
    iframeWindow.__WUJIE = sandbox;
    // 注册到 sandbox 缓存：被劫持的 appendChild 需要按 id 找到它并解构上述字段
    addSandboxCacheWithWujie(sandbox.id, sandbox);
    return iframeWindow;
  }

  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    deleteWujieById("empty-template-upstream");
    jest.restoreAllMocks();
  });

  it("does not render literal undefined into shadow root", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const iframeWindow = createIframeWindowMock();

    await expect(renderTemplateToShadowRoot(shadowRoot, iframeWindow, "")).resolves.toBeUndefined();

    // 上游 PR #1112 的修复意图：不得渲染出字面量 undefined
    expect(shadowRoot.innerHTML).not.toContain("undefined");
    // 本次变更后的契约：空模板时渲染根仍保持完整可用
    // （ShadowRoot.head/body 是 wujie 的全局增强类型，本测试未引入 src/shadow.ts 的类型，故用 any）
    expect((shadowRoot as any).head).toBeTruthy();
    expect((shadowRoot as any).body).toBeTruthy();

    host.remove();
  });

  it("does not render literal undefined into degrade iframe", async () => {
    const iframeWindow = createIframeWindowMock();
    const renderDocument = document.implementation.createHTMLDocument();

    await expect(renderTemplateToIframe(renderDocument, iframeWindow, "")).resolves.toBeUndefined();

    expect(renderDocument.documentElement.outerHTML).not.toContain("undefined");
  });
});

describe("wujie-vue3 clearAssetsCache export", () => {
  it("exposes the core cache API", () => {
    expect(WujieVue.clearAssetsCache).toBe(coreClearAssetsCache);
  });
});

describe("degrade event listener cache removal", () => {
  it("keeps cached listeners when removing an unknown handler", () => {
    const originalAdd = Node.prototype.addEventListener;
    const originalRemove = Node.prototype.removeEventListener;
    const cache = new Map();
    const iframeWindow = {
      Node,
      __WUJIE: { elementEventCacheMap: cache },
    };

    try {
      recordEventListeners(iframeWindow as any);
      const element = document.createElement("div");
      const first = () => undefined;
      const second = () => undefined;

      element.addEventListener("click", first);
      element.addEventListener("click", second);
      element.removeEventListener("click", () => undefined);

      expect(cache.get(element)).toEqual([
        { type: "click", handler: first, options: undefined },
        { type: "click", handler: second, options: undefined },
      ]);
    } finally {
      Node.prototype.addEventListener = originalAdd;
      Node.prototype.removeEventListener = originalRemove;
    }
  });
});
