import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STUDIO_PORT ?? 5173);
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: "engines",
  reporter: [["list"]],
  timeout: 120_000,
  use: { baseURL: origin },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: { command: "pnpm dev", url: origin, reuseExistingServer: true, timeout: 60_000 },
});
