import { awaitConsoleLogMessage } from "./utils";
import { appInfoList } from "./common";

describe("Vue3 host proxy", () => {
  beforeAll(async () => {
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
      localStorage.setItem("preload", "false");
      localStorage.setItem("degrade", "false");
    });
    await page.goto("http://localhost:8000/");
  });

  appInfoList.forEach((appInfo) =>
    it(`${appInfo.name} proxy`, async () => {
      const mountedPromise = awaitConsoleLogMessage(page, appInfo.mountedMessage);
      await page.click(appInfo.linkSelector);
      await mountedPromise;

      const result = await page.evaluate((childName) => {
        const childWindowCollection = [window[0], window[1], window[2], window[3]];
        const childWindow: any = childWindowCollection.find((itemWindow) => itemWindow.name === childName);
        const currentObject: any = {};
        const childProxyWindow = childWindow.__WUJIE.proxy;
        childProxyWindow.addAttributeToObject = function addAttributeToObject() {
          this.currentAttribute = "Add attribute";
        };
        childProxyWindow.addAttributeToObject.call(currentObject);
        return {
          targetCurrentAttribute: currentObject.currentAttribute,
          isSameBoundFn: childProxyWindow.setTimeout === childProxyWindow.setTimeout,
        };
      }, appInfo.name);

      expect(result.targetCurrentAttribute).toBe("Add attribute");
      expect(result.isSameBoundFn).toBe(true);
    })
  );
});
