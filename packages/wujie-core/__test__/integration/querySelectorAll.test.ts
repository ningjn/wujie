import { appInfoMap } from "./common";
import { awaitConsoleLogMessage } from "./utils";

describe("Vue3 host document querySelectorAll fallback", () => {
  beforeAll(async () => {
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
      localStorage.setItem("preload", "false");
      localStorage.setItem("degrade", "false");
    });
    await page.goto("http://localhost:8000/");
  });

  it("falls back to the execution iframe when shadowRoot has no scripts", async () => {
    const appInfo = appInfoMap.vue3;
    const mountedPromise = awaitConsoleLogMessage(page, appInfo.mountedMessage);
    await page.click(appInfo.linkSelector);
    await mountedPromise;

    const scriptCount = await page.evaluate((childName) => {
      const childWindow = Array.from(window.frames).find((frame) => frame.name === childName) as any;
      const childDocument = childWindow.__WUJIE.proxy.document;
      const script = childDocument.createElement("script");
      script.text = "window.__WUJIE_QUERY_SELECTOR_ALL_TEST = true";
      childDocument.head.appendChild(script);
      return childDocument.querySelectorAll("script").length;
    }, appInfo.name);

    expect(scriptCount).toBeGreaterThan(0);
  });
});
