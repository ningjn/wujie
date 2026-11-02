<template>
  <section class="home">
    <h1>无界 Vue3 示例</h1>
    <p>该仓库只保留 wujie 核心包与 wujie-vue3 组件封装。</p>
    <div class="actions">
      <label>
        <input v-model="degrade" type="checkbox" :disabled="disableDegrade" />
        降级模式
      </label>
      <label>
        <input v-model="preload" type="checkbox" />
        预加载
      </label>
    </div>
    <div class="links">
      <a href="https://github.com/Tencent/wujie" target="_blank" rel="noreferrer">仓库</a>
      <a href="https://wujie-micro.github.io/doc/" target="_blank" rel="noreferrer">文档</a>
    </div>
  </section>
</template>

<script>
export default {
  name: "Home",
  data() {
    return {
      preload: window.localStorage.getItem("preload") !== "false",
      degrade: window.localStorage.getItem("degrade") === "true" || !window.Proxy || !window.CustomElementRegistry,
      disableDegrade: !window.Proxy || !window.CustomElementRegistry,
    };
  },
  watch: {
    preload(value) {
      window.localStorage.setItem("preload", String(value));
      setTimeout(() => window.location.reload(), 300);
    },
    degrade(value) {
      window.localStorage.setItem("degrade", String(value));
      setTimeout(() => window.location.reload(), 300);
    },
  },
};
</script>

<style scoped>
.home {
  text-align: center;
  padding-top: 80px;
}

.actions,
.links {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 24px;
}

a {
  color: #42b983;
}
</style>
