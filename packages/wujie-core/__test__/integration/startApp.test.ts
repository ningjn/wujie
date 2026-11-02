import { awaitConsoleLogMessage } from "./utils";
import { appInfoList } from "./common";

describe("Vue3 host startApp", () => {
  beforeAll(async () => {
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
      localStorage.setItem("preload", "false");
      localStorage.setItem("degrade", "false");
    });
    await page.goto("http://localhost:8000/");
  });

  appInfoList.forEach((appInfo) =>
    it(`${appInfo.name} startApp`, async () => {
      const mountedPromise = awaitConsoleLogMessage(page, appInfo.mountedMessage);
      await page.click(appInfo.linkSelector);
      await mountedPromise;
      await page.waitForSelector("wujie-app");
    })
  );
});
