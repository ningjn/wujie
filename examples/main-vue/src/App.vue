<template>
  <div id="app">
    <nav id="nav">
      <router-link to="/home">介绍</router-link>
      <router-link to="/vue3">vue3</router-link>
      <router-link to="/vue3-sub/state">vue3-state</router-link>
      <router-link to="/vite">vite</router-link>
      <router-link to="/all">多实例</router-link>
    </nav>
    <div class="content">
      <router-view />
    </div>
  </div>
</template>

<script>
export default {
  name: "App",
};
</script>

<style scoped>
#nav {
  display: flex;
  gap: 24px;
  justify-content: center;
  align-items: center;
  padding: 16px;
  font-size: 18px;
}

#nav a {
  color: #2c3e50;
  text-decoration: none;
}

#nav a.router-link-exact-active {
  color: #42b983;
  font-weight: 600;
}

.content {
  height: calc(100vh - 62px);
  overflow: hidden;
}
</style>
