import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3003",
    viewport: { width: 1024, height: 768 },
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: "node server.js",
    port: 3003,
    env: { PORT: "3003" },
    reuseExistingServer: !process.env.CI,
  },
});
