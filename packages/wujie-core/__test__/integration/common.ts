export type AppInfo = {
  name: string;
  linkSelector: string;
  mountedMessage: string;
  entryLifecycles: string[];
  leaveLifecycles: string[];
  homeNavSelectorInAll: string;
  homeQueryParam: string;
  dialogNavSelector: string;
  dialogNavSelectorInAll: string;
  dialogQueryParam: string;
  dialogMountedMessage: string;
  stateNavSelector?: string;
  stateNumberJsSelector?: string;
  stateIncrementSelector?: string;
  stateMountedMessage?: string;
  routeNavSelector: string;
  routeNavSelectorInAll: string;
  routeJumpButtonSelector: string;
  routeMountedMessage: string;
  communicationNavSelectorInAll: string;
  preloadTitleJsSelector: string;
  degradeTitleJsSelector: string;
  titleJsSelector: string;
  titleText: string;
};

export const appInfoMap: Record<"vue3" | "vite", AppInfo> = {
  vue3: {
    name: "vue3",
    linkSelector: "a[href='/vue3']",
    mountedMessage: "vue3 activated 生命周期",
    entryLifecycles: ["vue3 beforeLoad 生命周期", "vue3 activated 生命周期"],
    leaveLifecycles: ["vue3 deactivated 生命周期"],
    homeNavSelectorInAll:
      'document.querySelector("#app > div.content > div > div:nth-child(1) > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(1)")',
    homeQueryParam: "%2Fhome",
    dialogNavSelector:
      'document.querySelector("#app > div.content > div > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(2)")',
    dialogNavSelectorInAll:
      'document.querySelector("#app > div.content > div > div:nth-child(1) > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(2)")',
    dialogQueryParam: "%2Fdialog",
    dialogMountedMessage: "vue3 dialog mounted",
    stateNavSelector:
      'document.querySelector("#app > div.content > div > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(5)")',
    stateNumberJsSelector:
      'document.querySelector("#app > div.content > div > wujie-app").shadowRoot.querySelector("#app > div.content > p.number-content > span")',
    stateIncrementSelector:
      'document.querySelector("#app > div.content > div > wujie-app").shadowRoot.querySelector("#app > div.content > p.number-content > button:nth-child(3)")',
    stateMountedMessage: "vue3 state mounted",
    routeNavSelector:
      'document.querySelector("#app > div.content > div > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(3)")',
    routeNavSelectorInAll:
      'document.querySelector("#app > div.content > div > div:nth-child(1) > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(3)")',
    routeJumpButtonSelector:
      'document.querySelector("#app > div.content > div > wujie-app").shadowRoot.querySelector("#app > div.content > button")',
    routeMountedMessage: "vue3 location mounted",
    communicationNavSelectorInAll:
      'document.querySelector("#app > div.content > div > div:nth-child(1) > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(4)")',
    preloadTitleJsSelector:
      'window.frames.vue3.document.querySelector("#app > div:nth-child(2) > div.hello > h2")',
    degradeTitleJsSelector:
      "window.document.querySelector(\"iframe[data-wujie-id='vue3']\").contentDocument.querySelector(\"#app > div:nth-child(2) > div.hello > h2\")",
    titleJsSelector:
      'document.querySelector("#app > div.content > div > wujie-app").shadowRoot.querySelector("#app > div:nth-child(2) > div.hello > h2")',
    titleText: "Vue3示例",
  },
  vite: {
    name: "vite",
    linkSelector: "a[href='/vite']",
    mountedMessage: "vite afterMount 生命周期",
    entryLifecycles: ["vite beforeLoad 生命周期", "vite beforeMount 生命周期", "vite afterMount 生命周期"],
    leaveLifecycles: ["vite beforeUnmount 生命周期", "vite afterUnmount 生命周期"],
    homeNavSelectorInAll:
      'document.querySelector("#app > div.content > div > div:nth-child(2) > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(1)")',
    homeQueryParam: "%2Fhome",
    dialogNavSelector:
      'document.querySelector("#app > div.content > div > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(2)")',
    dialogNavSelectorInAll:
      'document.querySelector("#app > div.content > div > div:nth-child(2) > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(2)")',
    dialogQueryParam: "%2Fdialog",
    dialogMountedMessage: "vite dialog mounted",
    routeNavSelector:
      'document.querySelector("#app > div.content > div > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(3)")',
    routeNavSelectorInAll:
      'document.querySelector("#app > div.content > div > div:nth-child(2) > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(3)")',
    routeJumpButtonSelector:
      'document.querySelector("#app > div.content > div > wujie-app").shadowRoot.querySelector("#app > div.content > button")',
    routeMountedMessage: "vite location mounted",
    communicationNavSelectorInAll:
      'document.querySelector("#app > div.content > div > div:nth-child(2) > wujie-app").shadowRoot.querySelector("#nav > a:nth-child(4)")',
    preloadTitleJsSelector:
      'window.frames.vite.document.querySelector("#app > div:nth-child(2) > div.hello > h2")',
    degradeTitleJsSelector:
      "window.document.querySelector(\"iframe[data-wujie-id='vite']\").contentDocument.querySelector(\"#app > div:nth-child(2) > div.hello > h2\")",
    titleJsSelector:
      'document.querySelector("#app > div.content > div > wujie-app").shadowRoot.querySelector("#app > div:nth-child(2) > div.hello > h2")',
    titleText: "Vue3 + vite示例",
  },
};

export const appInfoList = Object.entries(appInfoMap).map(([key, value]) => ({
  key: key as keyof typeof appInfoMap,
  ...value,
}));
export const appNameList = Object.keys(appInfoMap) as Array<keyof typeof appInfoMap>;
