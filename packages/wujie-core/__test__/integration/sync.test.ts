import { appInfoMap } from "./common";

describe("Vue3 host sync", () => {
  beforeAll(async () => {
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
      localStorage.setItem("preload", "false");
      localStorage.setItem("degrade", "false");
    });
    await page.goto("http://localhost:8000/");
  });

  it("syncs multiple application routes", async () => {
    await page.click("a[href='/all']");
    await page.waitForFunction(
      () => document.querySelectorAll("wujie-app").length === 2,
      { polling: 100 }
    );
    await page.waitForFunction(
      () =>
        new URL(window.location.href).searchParams.get("vue3") === "/home" &&
        new URL(window.location.href).searchParams.get("vite") === "/home",
      { polling: 100 }
    );

    const dialogSelectors = [appInfoMap.vue3.dialogNavSelectorInAll, appInfoMap.vite.dialogNavSelectorInAll];
    for (const selector of dialogSelectors) {
      await page.evaluate((selector) => {
        eval(selector).click();
      }, selector);
    }

    await page.waitForFunction(
      () =>
        new URL(window.location.href).searchParams.get("vue3") === "/dialog" &&
        new URL(window.location.href).searchParams.get("vite") === "/dialog",
      { polling: 100 }
    );
  });

  it("restores routes from shared url", async () => {
    await page.goto("http://localhost:8000/all?vue3=%2Fdialog&vite=%2Fdialog");
    await page.waitForFunction(
      () => {
        const vue3Link = document
          .querySelector("#app > div.content > div > div:nth-child(1) > wujie-app")
          ?.shadowRoot?.querySelector("#nav > a:nth-child(2)");
        const viteLink = document
          .querySelector("#app > div.content > div > div:nth-child(2) > wujie-app")
          ?.shadowRoot?.querySelector("#nav > a:nth-child(2)");
        return vue3Link?.classList.contains("router-link-exact-active") && viteLink?.classList.contains("router-link-exact-active");
      },
      { polling: 100 }
    );
  });
});
