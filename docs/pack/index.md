---
sidebarDepth: 2
---

# Vue3 组件封装

无界基于 Vue3 的组件封装。查看 [demo](https://wujie-micro.github.io/demo-main-vue/)，查看 [demo github](https://github.com/Tencent/wujie/tree/master/examples/main-vue/)

## 安装

```bash
npm i wujie-vue3 -S
```

## 引入

```javascript
import WujieVue from "wujie-vue3";

const { bus, setupApp, preloadApp, destroyApp, refreshApp, clearAssetsCache } = WujieVue;
```

## 使用

```vue
<WujieVue
  width="100%"
  height="100%"
  name="xxx"
  :url="xxx"
  :sync="true"
  :fetch="fetch"
  :props="props"
  :beforeLoad="beforeLoad"
  :beforeMount="beforeMount"
  :afterMount="afterMount"
  :beforeUnmount="beforeUnmount"
  :afterUnmount="afterUnmount"
></WujieVue>
```

### bus

组件封装将`bus`导出，方便用户使用

```javascript
import WujieVue from "wujie-vue3";

const { bus } = WujieVue;
```

### startApp

组件封装基于[startApp](/api/startApp.html)封装，如果用户需要主动调用`startApp`，请参考[startApp](/api/startApp.html)
