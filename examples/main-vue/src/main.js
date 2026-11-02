import "whatwg-fetch";
import "custom-event-polyfill";

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import WujieVue from "wujie-vue3";
import hostMap from "./hostMap";
import credentialsFetch from "./fetch";
import lifecycles from "./lifecycle";

const isProduction = process.env.NODE_ENV === "production";
const { setupApp, preloadApp, bus } = WujieVue;

bus.$on("click", (msg) => window.alert(msg));

// 子应用同步路由时，宿主应用同步跳转以保持菜单激活状态。
bus.$on("sub-route-change", (name, path) => {
  const mainName = `${name}-sub`;
  const mainPath = `/${name}-sub${path}`;
  const currentRoute = router.currentRoute.value;
  if (mainName === currentRoute.name && mainPath !== currentRoute.path) {
    router.push({ path: mainPath });
  }
});

const degrade = window.localStorage.getItem("degrade") === "true" || !window.Proxy || !window.CustomElementRegistry;
const props = {
  jump: (name) => {
    router.push({ name });
  },
};
// 生产环境修正 iframe 的 src，避免 GitHub Pages CSP 报错。
const attrs = isProduction ? { src: hostMap("//localhost:8000/") } : {};

setupApp({
  name: "vue3",
  url: hostMap("//localhost:7300/"),
  attrs,
  exec: true,
  destroyOnUnmount: true,
  alive: true,
  plugins: [{ cssExcludes: ["https://stackpath.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css"] }],
  props,
  fetch: (url, options) =>
    url.includes(hostMap("//localhost:7300/")) ? credentialsFetch(url, options) : window.fetch(url, options),
  degrade,
  ...lifecycles,
});

setupApp({
  name: "vite",
  url: hostMap("//localhost:7500/"),
  attrs,
  exec: true,
  props,
  fetch: credentialsFetch,
  degrade,
  ...lifecycles,
});

if (window.localStorage.getItem("preload") !== "false" && window.Proxy) {
  preloadApp({ name: "vue3" });
  preloadApp({ name: "vite" });
}

createApp(App).use(WujieVue).use(router).mount("#app");
