import { expect, test, type Page } from "@playwright/test";
import type { GenesisBench, GenesisSample } from "../src/bench/genesisBench";

/** State hash of the Last District, seed 1, in an empty world with seed 20261125, as Node records it. */
const GOLDEN = "5dc9053d2e6bd656";

async function openBench(page: Page): Promise<void> {
  await page.goto("/bench.html");
  await page.waitForFunction(() => Reflect.has(window, "eschatonGenesisBench"), undefined, { timeout: 60_000 });
}

test("a real worker on this browser generates the district with the recorded state hash", async ({ page, browser, browserName }) => {
  await openBench(page);
  const sample: GenesisSample = await page.evaluate(() => (Reflect.get(window, "eschatonGenesisBench") as GenesisBench).district(1));
  console.log(`engine: ${browserName} ${browser.version()} round trip ${sample.roundTripMs.toFixed(0)} ms, settle ${sample.settleMs.toFixed(0)} ms, ${sample.progressMessages} progress messages`);
  expect([sample.status, sample.hash, sample.detail === "" ? "no detail" : "detail"]).toEqual(["committed", GOLDEN, "detail"]);
});

test("a real worker on this browser reports a cancelled generation as cancelled", async ({ page }) => {
  await openBench(page);
  expect(await page.evaluate(() => (Reflect.get(window, "eschatonGenesisBench") as GenesisBench).cancelled())).toBe("cancelled");
});
