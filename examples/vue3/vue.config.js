// vue.config.js

/**
 * @type {import('@vue/cli-service').ProjectOptions}
 */
module.exports = {
  transpileDependencies: ["vue-router", "element-plus", "@ctrl/tinycolor"],
  publicPath: "./",
  devServer: {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    port: "7300",
  },
};
