import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STUDIO_PORT ?? 5173);
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: "screenshots",
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: origin, viewport: { width: 1440, height: 860 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 860 } } }],
  webServer: {
    command: "pnpm dev",
    url: origin,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
