const { resolve } = require("path");
const LERNA_EXEC = resolve(__dirname, "../../node_modules/.bin/lerna");

// CI 环境需要 --no-sandbox，由 PUPPETEER_LAUNCH_ARGS 注入。
const launchArgs = (process.env.PUPPETEER_LAUNCH_ARGS || "").split(/\s+/).filter(Boolean);

const isDebug = false;

module.exports = {
  launch: {
    headless: !isDebug,
    devtools: isDebug,
    product: "chrome",
    ...(launchArgs.length ? { args: launchArgs } : {}),
  },
  server: [
    {
      command: LERNA_EXEC + " run start --scope vue3",
      usedPortAction: "kill",
      launchTimeout: 60000,
      host: "0.0.0.0",
      port: 7300,
    },
    {
      command: LERNA_EXEC + " run start --scope vite",
      usedPortAction: "kill",
      launchTimeout: 60000,
      host: "0.0.0.0",
      port: 7500,
    },
    {
      command: LERNA_EXEC + " run start --scope main-vue",
      usedPortAction: "kill",
      launchTimeout: 60000,
      host: "0.0.0.0",
      port: 8000,
    },
  ],
  browserContext: "default",
};
