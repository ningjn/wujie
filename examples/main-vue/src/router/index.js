import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import Vue3 from "../views/Vue3.vue";
import Vue3Sub from "../views/Vue3-sub.vue";
import Vite from "../views/Vite.vue";
import ViteSub from "../views/Vite-sub.vue";
import Multiple from "../views/Multiple.vue";

const basename = process.env.NODE_ENV === "production" ? "/demo-main-vue/" : "";

const routes = [
  { path: "/home", name: "home", component: Home },
  { path: "/vue3", name: "vue3", component: Vue3 },
  { path: "/vue3-sub/:path", name: "vue3-sub", component: Vue3Sub },
  { path: "/vite", name: "vite", component: Vite },
  { path: "/vite-sub/:path", name: "vite-sub", component: ViteSub },
  { path: "/all", name: "all", component: Multiple },
  { path: "/", redirect: "/home" },
];

const router = createRouter({
  history: createWebHistory(basename),
  routes,
});

export default router;
