import { expect, test } from "@playwright/test";
import type { RegionSample, WaveBench } from "../src/bench/waveBench";

test("a real worker on this browser solves a region and the result commits to the world", async ({ page, browser, browserName }) => {
  console.log(`engine: ${browserName} ${browser.version()}`);
  await page.goto("/bench.html");
  await expect(page.locator("#status")).toHaveText("ready", { timeout: 60_000 });
  const sample: RegionSample = await page.evaluate(() => (Reflect.get(window, "eschatonWaveBench") as WaveBench).region([8, 4, 8], 7, true));
  expect([sample.outcome, sample.committed, sample.placements > 10]).toEqual(["solved", true, true]);
});

test("a real worker on this browser reports a cancelled job as cancelled", async ({ page }) => {
  await page.goto("/bench.html");
  await expect(page.locator("#status")).toHaveText("ready", { timeout: 60_000 });
  expect(await page.evaluate(() => (Reflect.get(window, "eschatonWaveBench") as WaveBench).cancelled())).toBe("cancelled");
});
