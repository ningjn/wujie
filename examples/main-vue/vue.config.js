module.exports = {
  lintOnSave: false,
  publicPath: process.env.NODE_ENV === "production" ? "/demo-main-vue/" : "/",
  devServer: {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    open: false,
    port: "8000",
  },
};
