import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const GOLDEN = "69cd859eaf36a48f-9d3ff649a9a17f0d-5d4abb4866979287-2b72687a6cf860ae";
const waveSource = `/@fs${fileURLToPath(new URL("../../../packages/wave/src/index.ts", import.meta.url))}`;

test("the solver gives the recorded golden digest on this browser's JavaScript engine", async ({ page, browser, browserName }) => {
  console.log(`engine: ${browserName} ${browser.version()}`);
  await page.goto("/");
  const digest = await page.evaluate(async (url) => {
    const loaded: unknown = await import(url);
    const hasGolden = (value: unknown): value is { goldenPresetDigest: () => string } =>
      typeof value === "object" && value !== null && "goldenPresetDigest" in value && typeof value.goldenPresetDigest === "function";
    return hasGolden(loaded) ? loaded.goldenPresetDigest() : "the wave module did not load";
  }, waveSource);
  expect(`${browserName}:${digest}`).toBe(`${browserName}:${GOLDEN}`);
});
