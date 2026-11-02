import { awaitConsoleLogMessage, getTextContentByJsSelector } from "./utils";
import { appInfoList } from "./common";

describe("Vue3 host degrade", () => {
  beforeAll(async () => {
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
      localStorage.setItem("preload", "false");
      localStorage.setItem("degrade", "true");
    });
    await page.goto("http://localhost:8000/");
  });

  appInfoList.forEach((appInfo) =>
    it(`${appInfo.name} degrade`, async () => {
      const mountedPromise = awaitConsoleLogMessage(page, appInfo.mountedMessage);
      await page.click(appInfo.linkSelector);
      await mountedPromise;
      expect(await getTextContentByJsSelector(page, appInfo.degradeTitleJsSelector)).toBe(appInfo.titleText);
    })
  );
});
