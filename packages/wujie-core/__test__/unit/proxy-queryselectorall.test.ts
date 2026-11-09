/**
 * document 代理查询语义回归测试（OpenSpec change: fix-proxy-queryselectorall-null-result）
 *
 * 背景：上游 fix/get-script-attrs 的 document 代理回退逻辑依赖
 * `target.apply(shadowRoot, args) || fallback` 的短路求值。由于**空的 NodeList 也是 truthy**，
 * fallback 对 querySelectorAll 实际上永远不可达；本次移植改为显式长度判断后 fallback 变得可达，
 * 但把只适用于 querySelector 的 `"base"` 选择器特判一并复用到了 querySelectorAll，
 * 导致 `document.querySelectorAll("base")` 返回 `null`——违反 Web 标准的返回值类型契约。
 *
 * 本文件覆盖 proxyGenerator 的真实代理链路，而不是只测纯函数。
 */

export {};

const { proxyGenerator } = require("../../src/proxy");

/**
 * 构造最小可用的代理环境：
 * - iframe.contentWindow.__WUJIE：shadowRoot + proxyLocation
 * - __WUJIE_RAW_DOCUMENT_QUERY_SELECTOR[_ALL]：未被代理的原生实现
 */
function createProxy(): {
  iframe: HTMLIFrameElement;
  shadowRoot: ShadowRoot;
  proxyDocument: any;
  revoke: () => void;
} {
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);

  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadowRoot: any = host.attachShadow({ mode: "open" });

  const w: any = iframe.contentWindow;
  w.__WUJIE = { shadowRoot, proxyLocation: new URL("http://child.example.com/index.html") };
  w.__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR__ = w.Document.prototype.querySelector;
  w.__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__ = w.Document.prototype.querySelectorAll;

  const anchor = document.createElement("a");
  const { proxyDocument, proxyRevoke } = proxyGenerator(iframe, anchor, "http://main/", "http://child/");
  return { iframe, shadowRoot, proxyDocument: proxyDocument as any, revoke: proxyRevoke };
}

/** 子应用侧调用 document.querySelectorAll —— this 必须是 iframe 文档 */
function queryAll(proxyDocument: any, iframe: HTMLIFrameElement, selector: string): any {
  return proxyDocument.querySelectorAll.call(iframe.contentDocument, selector);
}

/** 子应用侧调用 document.querySelector */
function queryOne(proxyDocument: any, iframe: HTMLIFrameElement, selector: string): any {
  return proxyDocument.querySelector.call(iframe.contentDocument, selector);
}

describe("document 代理 / querySelectorAll 始终返回 NodeList", () => {
  const revokes: Array<() => void> = [];

  afterEach(() => {
    document.body.innerHTML = "";
    revokes.forEach((revoke) => revoke());
    revokes.length = 0;
  });

  it("querySelectorAll('base') 必须返回 NodeList 而非 null", () => {
    const { iframe, proxyDocument, revoke } = createProxy();
    revokes.push(revoke);

    const res = queryAll(proxyDocument, iframe, "base");

    expect(res).not.toBeNull();
    expect(res).not.toBeUndefined();
    expect(typeof res.length).toBe("number");
  });

  it("querySelectorAll('div') 在渲染根与 iframe 文档均无匹配时返回空 NodeList", () => {
    const { iframe, proxyDocument, revoke } = createProxy();
    revokes.push(revoke);

    const res = queryAll(proxyDocument, iframe, "div");

    expect(res).not.toBeNull();
    expect(res.length).toBe(0);
  });

  it("渲染根无匹配时，querySelectorAll 仍回退到 iframe 文档的查询结果", () => {
    const { iframe, proxyDocument, revoke } = createProxy();
    revokes.push(revoke);
    // 渲染根内没有 div，iframe 文档里放一个
    (iframe.contentDocument as Document).body.innerHTML = "<div id='in-iframe'></div>";

    const res = queryAll(proxyDocument, iframe, "div");

    expect(res).not.toBeNull();
    expect(res.length).toBe(1);
    expect(res[0].id).toBe("in-iframe");
  });

  it("渲染根与 iframe 文档都命中时，渲染根优先", () => {
    const { iframe, shadowRoot, proxyDocument, revoke } = createProxy();
    revokes.push(revoke);
    // 两边各放一个 div，渲染根里的应当胜出
    shadowRoot.innerHTML = "<div id='in-shadow'></div>";
    (iframe.contentDocument as Document).body.innerHTML = "<div id='in-iframe'></div>";

    const all = queryAll(proxyDocument, iframe, "div");
    expect(all.length).toBe(1);
    expect(all[0].id).toBe("in-shadow");

    const one = queryOne(proxyDocument, iframe, "div");
    expect(one).not.toBeNull();
    expect(one.id).toBe("in-shadow");
  });

  it("querySelector('base') 在渲染根无匹配时返回 null，且不返回 iframe 文档内的 base", () => {
    const { iframe, proxyDocument, revoke } = createProxy();
    revokes.push(revoke);
    // iframe 文档里存在 base，但子应用不应看到它
    (iframe.contentDocument as Document).head.innerHTML = "<base href='http://child.example.com/' />";

    const res = queryOne(proxyDocument, iframe, "base");

    expect(res).toBeNull();
  });
});
