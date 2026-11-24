import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STUDIO_PORT ?? 5173);
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: origin },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: origin,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
