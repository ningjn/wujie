import { awaitConsoleLogMessage } from "./utils";
import { appInfoMap } from "./common";

describe("Vue3 host lifecycle", () => {
  beforeAll(async () => {
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
      localStorage.setItem("preload", "false");
      localStorage.setItem("degrade", "false");
    });
    await page.goto("http://localhost:8000/");
  });

  it("vue3 entry lifecycles", async () => {
    const promises = appInfoMap.vue3.entryLifecycles.map((message) => awaitConsoleLogMessage(page, message));
    await page.click(appInfoMap.vue3.linkSelector);
    await Promise.all(promises);
  });

  it("vite entry lifecycles", async () => {
    const promises = [...appInfoMap.vue3.leaveLifecycles, ...appInfoMap.vite.entryLifecycles].map((message) =>
      awaitConsoleLogMessage(page, message)
    );
    await page.click(appInfoMap.vite.linkSelector);
    await Promise.all(promises);
  });

  it("vue3 entry again lifecycles", async () => {
    const promises = [...appInfoMap.vite.leaveLifecycles, ...appInfoMap.vue3.entryLifecycles.slice(1)].map(
      (message) => awaitConsoleLogMessage(page, message)
    );
    await page.click(appInfoMap.vue3.linkSelector);
    await Promise.all(promises);
  });

  it("vite entry again lifecycles", async () => {
    const promises = [...appInfoMap.vue3.leaveLifecycles, ...appInfoMap.vite.entryLifecycles.slice(1)].map(
      (message) => awaitConsoleLogMessage(page, message)
    );
    await page.click(appInfoMap.vite.linkSelector);
    await Promise.all(promises);
  });
});
