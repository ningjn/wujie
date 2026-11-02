<template>
  <div class="multiple">
    <WujieVue class="item" name="vue3" :url="vue3Url" :sync="true"></WujieVue>
    <WujieVue class="item" name="vite" :url="viteUrl" :sync="true"></WujieVue>
  </div>
</template>

<script>
import hostMap from "../hostMap";

export default {
  name: "Multiple",
  data() {
    return {
      vue3Url: hostMap("//localhost:7300/"),
      viteUrl: hostMap("//localhost:7500/"),
    };
  },
};
</script>

<style scoped>
.multiple {
  display: flex;
  flex-wrap: wrap;
  height: 100%;
}

.item {
  flex: 1 1 45%;
  margin: 12px;
  border: 1px dashed #ccc;
  border-radius: 8px;
  overflow: auto;
}
</style>
