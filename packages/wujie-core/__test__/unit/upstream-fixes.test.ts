/**
 * Regression tests for selected upstream pull-request fixes.
 */

export {};

const { renderTemplateToShadowRoot, renderTemplateToIframe } = require("../../src/shadow");
const { recordEventListeners } = require("../../src/iframe");
const { clearAssetsCache: coreClearAssetsCache } = require("../../src/index");
const WujieVue = require("../../../wujie-vue3/index.js").default;

describe("empty template rendering", () => {
  it("does not render literal undefined into shadow root", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadowRoot = host.attachShadow({ mode: "open" });

    await expect(renderTemplateToShadowRoot(shadowRoot, {} as any, "")).resolves.toBeUndefined();
    expect(shadowRoot.innerHTML).toBe("");

    host.remove();
  });

  it("does not render literal undefined into degrade iframe", async () => {
    const renderDocument = document.implementation.createHTMLDocument();

    await expect(renderTemplateToIframe(renderDocument, {} as any, "")).resolves.toBeUndefined();
    expect(renderDocument.body.innerHTML).toBe("");
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
