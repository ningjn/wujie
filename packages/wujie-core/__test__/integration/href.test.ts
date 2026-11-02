import { awaitConsoleLogMessage, triggerClickByJsSelector } from "./utils";
import { appInfoList } from "./common";

describe("Vue3 host location href", () => {
  beforeAll(async () => {
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
      localStorage.setItem("preload", "false");
      localStorage.setItem("degrade", "false");
    });
    await page.goto("http://localhost:8000/");
  });

  appInfoList.forEach((appInfo) =>
    it(`${appInfo.name} location href`, async () => {
      const mountedPromise = awaitConsoleLogMessage(page, appInfo.mountedMessage);
      await page.click(appInfo.linkSelector);
      await mountedPromise;

      const routeMountedPromise = awaitConsoleLogMessage(page, appInfo.routeMountedMessage);
      await triggerClickByJsSelector(page, appInfo.routeNavSelector);
      await routeMountedPromise;
      await triggerClickByJsSelector(page, appInfo.routeJumpButtonSelector);
      await page.waitForSelector("iframe[src='https://wujicode.cn/xy/app/prod/official/index']");
      await page.goBack();
      await page.waitForSelector("wujie-app");
    })
  );
});
