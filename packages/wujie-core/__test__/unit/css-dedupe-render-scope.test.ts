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

const CHILD_URL = "http://child.example.com/index.html";

/** 等待劫持链路中的样式内容 promise 落定 */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createSandbox(id: string, iframe: HTMLIFrameElement): any {
  return {
    id,
    styleSheetElements: [],
    replace: (html: string) => html,
    fetch: () => Promise.resolve(new Response(".dedupe{color:red}")),
    plugins: [],
    iframe,
    lifecycles: { loadError: () => undefined },
    proxyLocation: new URL(CHILD_URL) as any,
    fiber: false,
    degrade: false,
  };
}

/** 构造 shadow-root 模式的渲染根，并在其 head 内放入入口 HTML 内联出来的 style */
function createShadowRender(href: string, id: string) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadowRoot: any = host.attachShadow({ mode: "open" });

  const head = document.createElement("head");
  const body = document.createElement("body");
  const entryStyle = document.createElement("style");
  entryStyle.setAttribute("data-wujie-css-href", href);
  entryStyle.textContent = `/* ${href} */.entry{color:blue}`;
  head.appendChild(entryStyle);
  shadowRoot.appendChild(head);
  shadowRoot.appendChild(body);
  shadowRoot.head = head;
  shadowRoot.body = body;

  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);

  const sandbox = createSandbox(id, iframe);
  addSandboxCacheWithWujie(id, sandbox);
  patchRenderEffect(shadowRoot, id, false);
  return { shadowRoot, sandbox, host, iframe };
}

describe("CSS 按 href 去重 / 查找域必须是渲染根", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

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
    deleteWujieById(id);
  });

  it("降级模式：入口 HTML 已内联同 href 样式时不再重复生成 style", async () => {
    const href = "http://child.example.com/assets/degrade.css";
    const id = "css-dedupe-degrade";

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
    patchRenderEffect(renderDocument as any, id, true);

    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", href);
    (renderDocument.head as any).appendChild(link);
    await flush();

    expect(renderDocument.querySelectorAll("style[data-wujie-css-href]")).toHaveLength(1);
    deleteWujieById(id);
  });

  it("href 含非法选择器字符时去重查询不抛异常且不误命中", () => {
    const badHref = "http://child.example.com/assets/a\nb.css";
    const doc = document.implementation.createHTMLDocument("");
    // 文档内存在另一个同样含非法字符的 href，但与待查询的 badHref 不同
    doc.head.innerHTML = `<style data-wujie-css-href="http://child.example.com/assets/other\n.css"></style>`;

    expect(() => findStyleByCssHref(doc, badHref)).not.toThrow();
    expect(findStyleByCssHref(doc, badHref)).toBeNull();
  });
});
