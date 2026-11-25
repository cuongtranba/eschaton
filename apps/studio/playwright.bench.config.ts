import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STUDIO_PORT ?? 5173);
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: "bench",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 20 * 60_000,
  reporter: [["list"]],
  use: {
    baseURL: origin,
    viewport: { width: 1440, height: 860 },
    deviceScaleFactor: 1,
    launchOptions: { args: ["--enable-precise-memory-info", "--js-flags=--expose-gc"] },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 860 },
        deviceScaleFactor: 1,
        ...(process.env.BENCH_CHANNEL === undefined ? {} : { channel: process.env.BENCH_CHANNEL }),
      },
    },
  ],
  webServer: {
    command: `pnpm exec vite preview --port ${port} --strictPort`,
    url: origin,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
