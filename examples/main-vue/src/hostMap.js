const map = {
  "//localhost:7300/": "//wujie-micro.github.io/demo-vue3/",
  "//localhost:7500/": "//wujie-micro.github.io/demo-vite/",
  "//localhost:8000/": "//wujie-micro.github.io/demo-main-vue/",
};

export default function hostMap(host) {
  if (process.env.NODE_ENV === "production") return map[host];
  return host;
}
