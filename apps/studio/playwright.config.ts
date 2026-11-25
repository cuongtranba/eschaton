import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STUDIO_PORT ?? 5173);
const origin = `http://localhost:${port}`;
const onCI = process.env.CI !== undefined && process.env.CI !== "";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: [["list"]],
  timeout: onCI ? 90_000 : 30_000,
  expect: { timeout: onCI ? 15_000 : 5_000 },
  use: { baseURL: origin },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: origin,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
