<template>
  <WujieVue width="100%" height="100%" name="vue3" :url="vue3Url"></WujieVue>
</template>

<script>
import WujieVue from "wujie-vue3";
import hostMap from "../hostMap";

export default {
  name: "Vue3Sub",
  data() {
    return {
      vue3Url: hostMap("//localhost:7300/"),
    };
  },
  watch: {
    "$route.params.path": {
      handler() {
        WujieVue.bus.$emit("vue3-router-change", `/${this.$route.params.path}`);
      },
      immediate: true,
    },
  },
};
</script>
