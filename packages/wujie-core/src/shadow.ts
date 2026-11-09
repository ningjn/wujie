import {
  WUJIE_APP_ID,
  WUJIE_IFRAME_CLASS,
  WUJIE_SHADE_STYLE,
  CONTAINER_POSITION_DATA_FLAG,
  CONTAINER_OVERFLOW_DATA_FLAG,
  LOADING_DATA_FLAG,
  WUJIE_LOADING_STYLE,
  WUJIE_LOADING_SVG,
  WUJIE_EMPTY_SKELETON_FLAG,
} from "./constant";
import {
  getWujieById,
  rawAppendChild,
  rawElementAppendChild,
  rawElementRemoveChild,
  relativeElementTagAttrMap,
} from "./common";
import { getExternalStyleSheets } from "./entry";
import Wujie from "./sandbox";
import { initBase, patchElementEffect } from "./iframe";
import { patchRenderEffect } from "./effect";
import { getCssLoader, getPresetLoaders } from "./plugin";
import { getAbsolutePath, getContainer, getCurUrl, isFunction, setAttrsToElement, warn } from "./utils";

const cssSelectorMap = {
  ":root": ":host",
};

declare global {
  interface ShadowRoot {
    head: HTMLHeadElement;
    body: HTMLBodyElement;
  }
}

/**
 * 处理 wujie-app webComponent disconnect 时的销毁策略，按运行模式自动决定 destroy / unmount：
 *
 * - 保活模式（alive）：仅 unmount，保留 sandbox / iframe，再次进入直接 active 复用。
 * - 单例模式（非保活但做了生命周期改造，存在 __WUJIE_MOUNT）：仅 unmount，sandbox 复用，
 *   再次进入走 startApp 的 unmount → active → mount 时序。
 * - 重建模式（非保活且未做生命周期改造）：sandbox 不会被复用，且 unmount 对其而言基本是空操作
 *   （没有 mountFlag / __WUJIE_UNMOUNT），若仅 unmount 会导致 sandbox / iframe 长期驻留累积，
 *   故直接 destroy。
 */
export function handleWujieAppDisconnect(sandbox: Wujie | null | undefined): void {
  if (!sandbox) return;
  const iframeWindow = sandbox.iframe?.contentWindow;
  const isRebuildMode = !sandbox.alive && !isFunction(iframeWindow?.__WUJIE_MOUNT);
  if (isRebuildMode) {
    sandbox.destroy().catch((e) => warn(`destroy error: ${e}`));
  } else {
    sandbox.unmount().catch((e) => warn(`unmount error: ${e}`));
  }
}

/**
 * 定义 wujie webComponent，将shadow包裹并获得dom装载和卸载的生命周期
 */
export function defineWujieWebComponent() {
  const customElements = window.customElements;
  if (customElements && !customElements?.get("wujie-app")) {
    class WujieApp extends HTMLElement {
      connectedCallback(): void {
        if (this.shadowRoot) return;
        const shadowRoot = this.attachShadow({ mode: "open" });
        const sandbox = getWujieById(this.getAttribute(WUJIE_APP_ID));
        patchElementEffect(shadowRoot, sandbox.iframe.contentWindow);
        sandbox.shadowRoot = shadowRoot;
      }

      disconnectedCallback(): void {
        const sandbox = getWujieById(this.getAttribute(WUJIE_APP_ID));
        handleWujieAppDisconnect(sandbox);
      }
    }
    customElements?.define("wujie-app", WujieApp);
  }
}

export function createWujieWebComponent(id: string): HTMLElement {
  const contentElement = window.document.createElement("wujie-app");
  contentElement.setAttribute(WUJIE_APP_ID, id);
  contentElement.classList.add(WUJIE_IFRAME_CLASS);
  return contentElement;
}

/**
 * 将准备好的内容插入容器
 */
export function renderElementToContainer(
  element: Element | ChildNode,
  selectorOrElement: string | HTMLElement
): HTMLElement {
  const container = getContainer(selectorOrElement);
  if (container && !container.contains(element)) {
    // 有 loading 无需清理，已经清理过了
    if (!container.querySelector(`div[${LOADING_DATA_FLAG}]`)) {
      // 清除内容
      clearChild(container);
    }
    // 插入元素
    if (element) {
      rawElementAppendChild.call(container, element);
    }
  }
  return container;
}

/**
 * 将降级的iframe挂在到容器上并进行初始化
 */
export function initRenderIframeAndContainer(
  id: string,
  parent: string | HTMLElement,
  degradeAttrs: { [key: string]: any } = {}
): { iframe: HTMLIFrameElement; container: HTMLElement } {
  const iframe = createIframeContainer(id, degradeAttrs);
  const container = renderElementToContainer(iframe, parent);
  const contentDocument = iframe.contentWindow.document;
  contentDocument.open();
  contentDocument.write("<!DOCTYPE html><html><head></head><body></body></html>");
  contentDocument.close();
  return { iframe, container };
}

/**
 * 处理css-before-loader 以及 css-after-loader
 */
async function processCssLoaderForTemplate(sandbox: Wujie, html: HTMLHtmlElement): Promise<HTMLHtmlElement> {
  const document = sandbox.iframe.contentDocument;
  const { plugins, replace, proxyLocation } = sandbox;
  const cssLoader = getCssLoader({ plugins, replace });
  const cssBeforeLoaders = getPresetLoaders("cssBeforeLoaders", plugins);
  const cssAfterLoaders = getPresetLoaders("cssAfterLoaders", plugins);
  const curUrl = getCurUrl(proxyLocation);

  return await Promise.all([
    Promise.all(
      getExternalStyleSheets(cssBeforeLoaders, sandbox.fetch, sandbox.lifecycles.loadError).map(
        ({ src, contentPromise }) => contentPromise.then((content) => ({ src, content }))
      )
    ).then((contentList) => {
      contentList.forEach(({ src, content }) => {
        if (!content) return;
        const styleElement = document.createElement("style");
        styleElement.setAttribute("type", "text/css");
        styleElement.appendChild(document.createTextNode(content ? cssLoader(content, src, curUrl) : content));
        const head = html.querySelector("head");
        const body = html.querySelector("body");
        html.insertBefore(styleElement, head || body || html.firstChild);
      });
    }),
    Promise.all(
      getExternalStyleSheets(cssAfterLoaders, sandbox.fetch, sandbox.lifecycles.loadError).map(
        ({ src, contentPromise }) => contentPromise.then((content) => ({ src, content }))
      )
    ).then((contentList) => {
      contentList.forEach(({ src, content }) => {
        if (!content) return;
        const styleElement = document.createElement("style");
        styleElement.setAttribute("type", "text/css");
        styleElement.appendChild(document.createTextNode(content ? cssLoader(content, src, curUrl) : content));
        html.appendChild(styleElement);
      });
    }),
  ]).then(
    () => html,
    () => html
  );
}

// 替换html的head和body
function replaceHeadAndBody(html: HTMLHtmlElement, head: HTMLHeadElement, body: HTMLBodyElement): HTMLHtmlElement {
  const headElement = html.querySelector("head");
  const bodyElement = html.querySelector("body");
  // head/body 缺失时跳过对应替换：sandbox 尚未完成首次渲染时它们可能仍是 undefined
  if (headElement && head) {
    while (headElement.firstChild) {
      rawAppendChild.call(head, headElement.firstChild.cloneNode(true));
      headElement.removeChild(headElement.firstChild);
    }
    headElement.parentNode.replaceChild(head, headElement);
  }
  if (bodyElement && body) {
    while (bodyElement.firstChild) {
      rawAppendChild.call(body, bodyElement.firstChild.cloneNode(true));
      bodyElement.removeChild(bodyElement.firstChild);
    }
    bodyElement.parentNode.replaceChild(body, bodyElement);
  }
  return html;
}

/**
 * 将template渲染成html元素
 */
function renderTemplateToHtml(iframeWindow: Window, template: string): HTMLHtmlElement {
  const sandbox = iframeWindow.__WUJIE;
  const { head, body, alive, execFlag } = sandbox;
  const document = iframeWindow.document;
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(template, "text/html");

  // 无论 template 是否包含html，documentElement 必然是 HTMLHtmlElement
  const parsedHtml = parsedDocument.documentElement as HTMLHtmlElement;
  const sourceAttributes = parsedHtml.attributes;
  let html = document.createElement("html");
  html.innerHTML = template;
  for (let i = 0; i < sourceAttributes.length; i++) {
    html.setAttribute(sourceAttributes[i].name, sourceAttributes[i].value);
  }
  const ElementIterator = document.createTreeWalker(html, NodeFilter.SHOW_ELEMENT, null, false);
  let nextElement = ElementIterator.currentNode as HTMLElement;
  while (nextElement) {
    patchElementEffect(nextElement, iframeWindow);
    const relativeAttr = relativeElementTagAttrMap[nextElement.tagName];
    const url = nextElement[relativeAttr];
    if (relativeAttr) nextElement.setAttribute(relativeAttr, getAbsolutePath(url, nextElement.baseURI || ""));
    nextElement = ElementIterator.nextNode() as HTMLElement;
  }
  // 先补齐 head/body，再决定 sandbox.head / sandbox.body：
  // 顺序颠倒会让赋值拿到 null，进而使后续 replaceHeadAndBody 拿到空引用
  if (!html.querySelector("head")) {
    const head = document.createElement("head");
    html.appendChild(head);
  }
  if (!html.querySelector("body")) {
    const body = document.createElement("body");
    html.appendChild(body);
  }
  // 组件多次渲染，head和body必须一直使用同一个来应对被缓存的场景
  if (!alive && execFlag) {
    html = replaceHeadAndBody(html, head, body);
  } else {
    sandbox.head = html.querySelector("head");
    sandbox.body = html.querySelector("body");
  }
  return html;
}

/**
 * 给渲染根承载内容的 html 打补丁：
 * 修复 parentNode 与 getBoundingClientRect（真实渲染路径与空模板路径都需要）
 */
function patchShadowHtmlElement(shadowHtml: HTMLElement, iframeWindow: Window): void {
  Object.defineProperties(shadowHtml, {
    // 修复 html parentNode
    parentNode: {
      enumerable: true,
      configurable: true,
      get: () => iframeWindow.document,
    },

    // 修复 html getBoundingClientRect
    getBoundingClientRect: {
      enumerable: true,
      configurable: true,
      value: () =>
        iframeWindow.__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR__.call(iframeWindow.document, "html")!.getBoundingClientRect(),
    },
  });
}

/** 已就空模板告警过的子应用，避免每次激活都重复告警 */
const emptyTemplateWarned = new WeakSet<Wujie>();

/**
 * 确保渲染根内存在一个**自带 head 与 body** 的 html（空模板场景）。
 *
 * 不能直接取渲染根内的第一个 html：多次渲染后（!alive && execFlag 路径下
 * replaceHeadAndBody 会把旧 head/body 搬进新 html），旧的 html 会变成无 head 的空壳，
 * 直接使用会让 shadowRoot.head 变成 null，进而使 patchRenderEffect 抛错。
 *
 */
function ensureEmptyRenderRoot(shadowRoot: ShadowRoot, iframeWindow: Window): HTMLHtmlElement {
  const candidates = Array.from(shadowRoot.querySelectorAll("html")) as HTMLHtmlElement[];
  // 优先复用自带 head/body 的 html（此前真实渲染留下的）：
  // 取**最后一个**而不是第一个 —— 真实渲染路径每次都追加新 html，
  // 最早那个 html 的 head 可能是过期的（与真实路径取「刚 append 的那个」保持对称）
  for (let i = candidates.length - 1; i >= 0; i--) {
    const item = candidates[i];
    if (item.querySelector("head") && item.querySelector("body")) return item;
  }

  // 复用既有的空骨架，避免重复创建
  const skeleton = shadowRoot.querySelector(`html[${WUJIE_EMPTY_SKELETON_FLAG}]`) as HTMLHtmlElement | null;
  if (skeleton) {
    if (!skeleton.querySelector("head")) skeleton.appendChild(skeleton.ownerDocument.createElement("head"));
    if (!skeleton.querySelector("body")) skeleton.appendChild(skeleton.ownerDocument.createElement("body"));
    return skeleton;
  }

  const html = renderTemplateToHtml(iframeWindow, "");
  html.setAttribute(WUJIE_EMPTY_SKELETON_FLAG, "");
  shadowRoot.appendChild(html);
  return html;
}

/** 移除渲染根内的空骨架（若有） */
function removeEmptyRenderRoot(shadowRoot: ShadowRoot): void {
  const skeleton = shadowRoot.querySelector(`html[${WUJIE_EMPTY_SKELETON_FLAG}]`);
  if (!skeleton) return;
  /**
   * 必须用 remove() 而不是 skeleton.parentNode.removeChild(skeleton)：
   * 空模板路径给 html 打的 parentNode 补丁会把 parentNode 指向 iframeWindow.document，
   * 用它做 removeChild 的接收者会抛 NotFoundError。remove() 走内部父节点，不受影响。
   */
  skeleton.remove();
}

/**
 * 将template渲染到shadowRoot
 */
export async function renderTemplateToShadowRoot(
  shadowRoot: ShadowRoot,
  iframeWindow: Window,
  template: string
): Promise<void> {
  /**
   * 模板为空时不渲染任何内容，但渲染根必须保持可用。
   *
   * 上游 PR #1112 在这里直接 return，把「渲染根准备」也一起跳过了，导致
   * shadowRoot.head / shadowRoot.body 始终是 undefined：子应用侧 document.head 为 undefined、
   * patchRenderEffect 未安装（动态注入的样式/脚本不被接管）、
   * sandbox.head / sandbox.body 也为空（后续 replaceHeadAndBody 会拿到空引用）。
   *
   * 这里改为只准备一个空骨架（html > head + body）并完成渲染根的准备动作；
   * 真实模板到来时该骨架会被移除，渲染根内不会并存两个 <html>。
   */
  if (!template) {
    const html = ensureEmptyRenderRoot(shadowRoot, iframeWindow);
    const head = html.querySelector("head") as HTMLHeadElement;
    const body = html.querySelector("body") as HTMLBodyElement;
    shadowRoot.head = head;
    shadowRoot.body = body;
    const sandbox = iframeWindow.__WUJIE;
    sandbox.head = head;
    sandbox.body = body;
    patchRenderEffect(shadowRoot, sandbox.id, false);
    patchShadowHtmlElement(html, iframeWindow);
    // 每个子应用只告警一次，避免每次激活都刷屏
    if (!emptyTemplateWarned.has(sandbox)) {
      emptyTemplateWarned.add(sandbox);
      warn(`[wujie] app ${sandbox.id} template is empty, render root prepared without content`);
    }
    return;
  }

  const html = renderTemplateToHtml(iframeWindow, template);
  // 处理 css-before-loader 和 css-after-loader
  const processedHtml = await processCssLoaderForTemplate(iframeWindow.__WUJIE, html);
  // 移除空骨架与追加真实 html 必须相邻执行（中间不能有 await）：
  // 否则并发的空渲染会重新创建骨架，导致渲染根内并存两个 <html>、
  // shadowRoot.firstElementChild 指向空壳
  removeEmptyRenderRoot(shadowRoot);
  // change ownerDocument
  shadowRoot.appendChild(processedHtml);
  const shade = document.createElement("div");
  shade.setAttribute("style", WUJIE_SHADE_STYLE);
  processedHtml.insertBefore(shade, processedHtml.firstChild);
  // 取承载内容的 html 自身的 head/body（与空模板路径对称）：
  // 多次渲染后渲染根内可能残留旧的 html，用渲染根范围的 querySelector 会取到过期的 head
  shadowRoot.head = processedHtml.querySelector("head") as HTMLHeadElement;
  shadowRoot.body = processedHtml.querySelector("body") as HTMLBodyElement;

  const shadowHtml = shadowRoot.firstElementChild as HTMLElement;
  patchShadowHtmlElement(shadowHtml, iframeWindow);

  patchRenderEffect(shadowRoot, iframeWindow.__WUJIE.id, false);
}

export function createIframeContainer(id: string, degradeAttrs: { [key: string]: any } = {}): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  const defaultStyle = "height:100%;width:100%";
  setAttrsToElement(iframe, {
    ...degradeAttrs,
    style: [defaultStyle, degradeAttrs.style].join(";"),
    [WUJIE_APP_ID]: id,
  });
  return iframe;
}

/**
 * 将template渲染到iframe
 */
export async function renderTemplateToIframe(
  renderDocument: Document,
  iframeWindow: Window,
  template: string
): Promise<void> {
  // 空模板以空字符串兜底：renderTemplateToHtml 会产出空骨架（html > head + body），
  // 从而让 initBase 与 patchRenderEffect 正常执行，同时不会把 "undefined" 写进渲染文档。
  // 降级模式用 replaceChild 替换 documentElement，不存在并存两个 <html> 的问题。
  const safeTemplate = template ?? "";

  // 插入template
  const html = renderTemplateToHtml(iframeWindow, safeTemplate);
  // 处理 css-before-loader 和 css-after-loader
  const processedHtml = await processCssLoaderForTemplate(iframeWindow.__WUJIE, html);
  renderDocument.replaceChild(processedHtml, renderDocument.documentElement);

  // 修复 html parentNode
  Object.defineProperty(renderDocument.documentElement, "parentNode", {
    enumerable: true,
    configurable: true,
    get: () => iframeWindow.document,
  });

  // 降级渲染 iframe 无 src 补丁，需与 JS iframe 一样注入 base，供 img 等相对路径解析到子应用域名
  const renderWindow = renderDocument.defaultView;
  if (renderWindow) {
    // 对于降级场景不需要添加 path
    initBase(renderWindow, iframeWindow.__WUJIE.url, "");
    // 降级模式内联事件运行在渲染 iframe realm，需把辅助函数注入到该 window，
    // 使编译后的 with(window.__getWujieWindow__(...)) 可调用（其内部会向 parent.document 查找沙箱 iframe）
    (renderWindow as any).__getWujieWindow__ = (window as any).__getWujieWindow__;
  }

  patchRenderEffect(renderDocument, iframeWindow.__WUJIE.id, true);
}

/**
 * 清除Element所有节点
 */
export function clearChild(root: ShadowRoot | Node): void {
  // 清除内容
  while (root?.firstChild) {
    rawElementRemoveChild.call(root, root.firstChild);
  }
}

/**
 * 给容器添加loading
 */
export function addLoading(el: string | HTMLElement, loading: HTMLElement): void {
  const container = getContainer(el);
  clearChild(container);
  // 给容器设置一些样式，防止 loading 抖动
  let containerStyles = null;
  try {
    containerStyles = window.getComputedStyle(container);
  } catch {
    return;
  }
  if (containerStyles.position === "static") {
    container.setAttribute(CONTAINER_POSITION_DATA_FLAG, containerStyles.position);
    container.setAttribute(
      CONTAINER_OVERFLOW_DATA_FLAG,
      containerStyles.overflow === "visible" ? "" : containerStyles.overflow
    );
    container.style.setProperty("position", "relative");
    container.style.setProperty("overflow", "hidden");
  } else if (["relative", "sticky"].includes(containerStyles.position)) {
    container.setAttribute(
      CONTAINER_OVERFLOW_DATA_FLAG,
      containerStyles.overflow === "visible" ? "" : containerStyles.overflow
    );
    container.style.setProperty("overflow", "hidden");
  }
  const loadingContainer = document.createElement("div");
  loadingContainer.setAttribute(LOADING_DATA_FLAG, "");
  loadingContainer.setAttribute("style", WUJIE_LOADING_STYLE);
  if (loading) loadingContainer.appendChild(loading);
  else loadingContainer.innerHTML = WUJIE_LOADING_SVG;
  container.appendChild(loadingContainer);
}
/**
 * 移除loading
 */
export function removeLoading(el: HTMLElement): void {
  // 去除容器设置的样式
  const positionFlag = el.getAttribute(CONTAINER_POSITION_DATA_FLAG);
  const overflowFlag = el.getAttribute(CONTAINER_OVERFLOW_DATA_FLAG);
  if (positionFlag) el.style.removeProperty("position");
  if (overflowFlag !== null) {
    overflowFlag ? el.style.setProperty("overflow", overflowFlag) : el.style.removeProperty("overflow");
  }
  el.removeAttribute(CONTAINER_POSITION_DATA_FLAG);
  el.removeAttribute(CONTAINER_OVERFLOW_DATA_FLAG);
  const loadingContainer = el.querySelector(`div[${LOADING_DATA_FLAG}]`);
  loadingContainer && el.removeChild(loadingContainer);
}
/**
 * 获取修复好的样式元素
 * 主要是针对对root样式和font-face样式
 */
export function getPatchStyleElements(rootStyleSheets: Array<CSSStyleSheet>): Array<HTMLStyleElement | null> {
  const rootCssRules = [];
  const fontCssRules = [];
  const rootStyleReg = /:root/g;

  // 找出root的cssRules
  for (let i = 0; i < rootStyleSheets.length; i++) {
    const cssRules = rootStyleSheets[i]?.cssRules ?? [];
    for (let j = 0; j < cssRules.length; j++) {
      const cssRuleText = cssRules[j].cssText;
      // 如果是root的cssRule
      if (rootStyleReg.test(cssRuleText)) {
        rootCssRules.push(cssRuleText.replace(rootStyleReg, (match) => cssSelectorMap[match]));
      }
      // 如果是font-face的cssRule
      if (cssRules[j].type === CSSRule.FONT_FACE_RULE) {
        fontCssRules.push(cssRuleText);
      }
    }
  }

  let rootStyleSheetElement = null;
  let fontStyleSheetElement = null;

  // 复制到host上
  if (rootCssRules.length) {
    rootStyleSheetElement = window.document.createElement("style");
    rootStyleSheetElement.innerHTML = rootCssRules.join("");
  }

  if (fontCssRules.length) {
    fontStyleSheetElement = window.document.createElement("style");
    fontStyleSheetElement.innerHTML = fontCssRules.join("");
  }

  return [rootStyleSheetElement, fontStyleSheetElement];
}
