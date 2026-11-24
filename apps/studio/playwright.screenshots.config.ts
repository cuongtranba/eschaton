import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "screenshots",
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5173", viewport: { width: 1440, height: 860 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 860 } } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
