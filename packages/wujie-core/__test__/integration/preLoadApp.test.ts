import { awaitConsoleLogMessage, getTextContentByJsSelector } from "./utils";
import { appInfoList } from "./common";

describe("Vue3 host preload", () => {
  beforeAll(async () => {
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
      localStorage.setItem("preload", "true");
      localStorage.setItem("degrade", "false");
    });

    const mountedPromises = appInfoList.map((appInfo) => awaitConsoleLogMessage(page, appInfo.mountedMessage));
    await page.goto("http://localhost:8000/");
    await Promise.all(mountedPromises);
  });

  appInfoList.forEach((appInfo) =>
    it(`${appInfo.name} preload`, async () => {
      expect(await getTextContentByJsSelector(page, appInfo.preloadTitleJsSelector)).toBe(appInfo.titleText);
    })
  );
});
