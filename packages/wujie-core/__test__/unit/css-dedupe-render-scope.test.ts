/**
 * CSS 去重查找域回归测试（OpenSpec change: fix-css-dedupe-render-scope）
 *
 * 背景：上游 PR #1109 的「按 href 去重外链 CSS」依赖 findStyleByCssHref 在正确的渲染根内查找。
 * 实现里查的是 sandbox iframe 的 contentDocument，而入口 HTML 内联出来的
 * <style data-wujie-css-href> 实际落在渲染根上：
 *   - 非降级（shadow-root 模式）：shadowRoot.head
 *   - 降级模式：渲染 iframe 的 document
 * 两者从来不是同一棵树 → 去重查询恒不命中，重复 CSS 依旧复现。
 *
 * 本文件覆盖的是**真实劫持链路**（patchRenderEffect + 动态插入 <link>），
 * 而不只是 findStyleByCssHref 这个纯函数——纯函数测试无法发现查找域写错。
 */

export {};

const { patchRenderEffect, findStyleByCssHref } = require("../../src/effect");
const { addSandboxCacheWithWujie, deleteWujieById } = require("../../src/common");
const { processCssLoader } = require("../../src/entry");
const { genLinkReplaceSymbol } = require("../../src/template");

const CHILD_URL = "http://child.example.com/index.html";

/** 模块级 sandbox 缓存里的 id，测试结束后统一清理 */
const usedIds: string[] = [];

afterEach(() => {
  document.body.innerHTML = "";
  // 断言中途失败时也能清理，避免污染同 worker 的其它用例
  usedIds.forEach((id) => deleteWujieById(id));
  usedIds.length = 0;
  jest.restoreAllMocks();
});

/** 等待劫持链路中的样式内容 promise 落定 */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createSandbox(id: string, iframe: HTMLIFrameElement, fetchImpl?: () => Promise<any>): any {
  return {
    id,
    styleSheetElements: [],
    replace: (html: string) => html,
    fetch: fetchImpl || (() => Promise.resolve(new Response(".dedupe{color:red}"))),
    plugins: [],
    iframe,
    lifecycles: { loadError: () => undefined },
    proxyLocation: new URL(CHILD_URL) as any,
    fiber: false,
    degrade: false,
    // 非去重路径会走到 handleStylesheetElementPatch，需要这两个字段存在
    inject: {},
    deferredStyleObservers: [],
  };
}

/** 构造 shadow-root 模式的渲染根，并按需在 head 内放入入口 HTML 内联出来的 style */
function createShadowRender(href: string, id: string, fetchImpl?: () => Promise<any>, withEntryStyle = true) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadowRoot: any = host.attachShadow({ mode: "open" });

  const head = document.createElement("head");
  const body = document.createElement("body");
  if (withEntryStyle) {
    const entryStyle = document.createElement("style");
    entryStyle.setAttribute("data-wujie-css-href", href);
    entryStyle.textContent = `/* ${href} */.entry{color:blue}`;
    head.appendChild(entryStyle);
  }
  shadowRoot.appendChild(head);
  shadowRoot.appendChild(body);
  shadowRoot.head = head;
  shadowRoot.body = body;

  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);

  const sandbox = createSandbox(id, iframe, fetchImpl);
  addSandboxCacheWithWujie(id, sandbox);
  usedIds.push(id);
  patchRenderEffect(shadowRoot, id, false);
  return { shadowRoot, sandbox, host, iframe };
}

describe("CSS 按 href 去重 / 查找域必须是渲染根", () => {
  it("shadow-root 模式：入口 HTML 已内联同 href 样式时不再重复生成 style", async () => {
    const href = "http://child.example.com/assets/index.css";
    const id = "css-dedupe-shadow";
    const { shadowRoot } = createShadowRender(href, id);

    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", href);

    // 命中去重后应向原 link 补发 load，且消费方是在 appendChild 返回之后才注册监听
    // （Vite preload 的真实顺序），因此必须是异步派发
    let loaded = 0;
    shadowRoot.head.appendChild(link);
    link.addEventListener("load", () => {
      loaded += 1;
    });

    expect(loaded).toBe(0);
    await flush();

    expect(shadowRoot.querySelectorAll("style[data-wujie-css-href]")).toHaveLength(1);
    expect(loaded).toBe(1);
  });

  it("降级模式：入口 HTML 已内联同 href 样式时不再重复生成 style", async () => {
    const href = "http://child.example.com/assets/degrade.css";
    const id = "css-dedupe-degrade";

    // 降级模式有两个 iframe：跑 JS 的 sandbox iframe 与承载 DOM 的渲染 iframe
    const sandboxIframe = document.createElement("iframe");
    document.body.appendChild(sandboxIframe);
    const renderIframe = document.createElement("iframe");
    document.body.appendChild(renderIframe);

    const renderDocument = renderIframe.contentDocument as Document;
    renderDocument.open();
    renderDocument.write(
      `<html><head><style data-wujie-css-href="${href}">/* ${href} */.entry{color:blue}</style></head><body></body></html>`
    );
    renderDocument.close();

    const sandbox = createSandbox(id, sandboxIframe);
    sandbox.degrade = true;
    addSandboxCacheWithWujie(id, sandbox);
    usedIds.push(id);
    patchRenderEffect(renderDocument as any, id, true);

    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", href);
    (renderDocument.head as any).appendChild(link);
    await flush();

    expect(renderDocument.querySelectorAll("style[data-wujie-css-href]")).toHaveLength(1);
  });

  it("href 含非法选择器字符时去重查询不抛异常且不误命中", () => {
    const badHref = "http://child.example.com/assets/a\nb.css";
    const doc = document.implementation.createHTMLDocument("");
    // 文档内存在另一个同样含非法字符的 href，但与待查询的 badHref 不同
    doc.head.innerHTML = `<style data-wujie-css-href="http://child.example.com/assets/other\n.css"></style>`;

    expect(() => findStyleByCssHref(doc, badHref)).not.toThrow();
    expect(findStyleByCssHref(doc, badHref)).toBeNull();
  });

  it("渲染根内已有 X 时插入 Y，应为 Y 生成独立的 style", async () => {
    const hrefX = "http://child.example.com/assets/x.css";
    const hrefY = "http://child.example.com/assets/y.css";
    const id = "css-dedupe-multi";

    const { shadowRoot } = createShadowRender(hrefX, id);

    const linkY = document.createElement("link");
    linkY.setAttribute("rel", "stylesheet");
    linkY.setAttribute("href", hrefY);
    shadowRoot.head.appendChild(linkY);
    await flush();

    const styles = Array.from(shadowRoot.querySelectorAll("style[data-wujie-css-href]")) as HTMLStyleElement[];
    // 入口的 X + 动态生成的 Y
    expect(styles).toHaveLength(2);
    expect(styles.some((style) => style.getAttribute("data-wujie-css-href") === hrefX)).toBe(true);
    expect(styles.some((style) => style.getAttribute("data-wujie-css-href") === hrefY)).toBe(true);
  });
});

describe("CSS 按 href 去重 / 加载失败不得阻断后续重试", () => {
  it("CSS 请求失败后再次插入同一地址，应重新请求并注入内容", async () => {
    const href = "http://child.example.com/assets/fail-then-retry.css";
    const id = "css-dedupe-retry";

    // 首次请求 404（fetchAssets 对 cssFlag 会 resolve 成 ""），第二次成功
    let fetchCount = 0;
    const fetchImpl = () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return Promise.resolve({ status: 404, text: () => Promise.resolve("") });
      }
      return Promise.resolve(new Response(".retry{color:green}"));
    };
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    // 渲染根内没有入口 style，才能走到真实的「加载 → 失败 → 重试」链路
    const { shadowRoot } = createShadowRender(href, id, fetchImpl, false);

    const insertLink = () => {
      const link = document.createElement("link");
      link.setAttribute("rel", "stylesheet");
      link.setAttribute("href", href);
      shadowRoot.head.appendChild(link);
    };

    // 第一次：加载失败
    insertLink();
    await flush();
    expect(fetchCount).toBe(1);

    // 第二次：应重新请求，而不是被首次失败留下的空占位 style 去重掉
    insertLink();
    await flush();
    expect(fetchCount).toBe(2);

    const styles = Array.from(shadowRoot.querySelectorAll("style[data-wujie-css-href]")) as HTMLStyleElement[];
    expect(styles.some((style) => style.textContent.indexOf(".retry{color:green}") !== -1)).toBe(true);
  });
});

describe("入口 HTML 内联失败时不得留下已加载标记", () => {
  function createEntrySandbox(): any {
    return {
      proxyLocation: new URL(CHILD_URL),
      plugins: [],
      replace: (html: string) => html,
    };
  }

  it("内容为空的样式应保留原始 link，且不产生 data-wujie-css-href", async () => {
    const src = "http://child.example.com/assets/entry-fail.css";
    const template = `<html><head>${genLinkReplaceSymbol(src)}</head><body></body></html>`;

    const html = await processCssLoader(createEntrySandbox(), template, () => [
      { src, contentPromise: Promise.resolve("") },
    ]);

    expect(html.indexOf("data-wujie-css-href")).toBe(-1);
    expect(html.indexOf(`<link href="${src}"`)).not.toBe(-1);
  });

  it("内容非空时仍然输出带标记的 style", async () => {
    const src = "http://child.example.com/assets/entry-ok.css";
    const template = `<html><head>${genLinkReplaceSymbol(src)}</head><body></body></html>`;

    const html = await processCssLoader(createEntrySandbox(), template, () => [
      { src, contentPromise: Promise.resolve(".entry{color:blue}") },
    ]);

    expect(html.indexOf(`data-wujie-css-href="${src}"`)).not.toBe(-1);
  });
});
