import { expect, test, type CDPSession, type Page } from "@playwright/test";

const WARMUP_CYCLES = 10;
const MEASURED_CYCLES = 20;
const COLLECTIONS = 6;
const MAX_GROWTH_BYTES = 1_250_000;

const readStat = async (page: Page, name: string): Promise<number> => Number(await page.getByTestId(`stat-${name}`).innerText());

async function choose(page: Page, key: string): Promise<void> {
  await page.locator(`[data-item="${key}"]`).click();
}

async function retainedHeapBytes(session: CDPSession): Promise<number> {
  for (let pass = 0; pass < COLLECTIONS; pass++) await session.send("HeapProfiler.collectGarbage");
  return (await session.send("Runtime.getHeapUsage")).usedSize;
}

test("switching catalog items repeatedly does not retain disposed scene content in the JS heap", async ({ page }) => {
  test.setTimeout(240_000);
  const session = await page.context().newCDPSession(page);
  await page.goto("/");
  await expect(page.getByTestId("stat-backend")).toHaveText(/^(WebGPU|WebGL2)$/);
  await choose(page, "assembly:roof-house");
  await expect.poll(() => readStat(page, "instances")).toBe(36);

  const cycle = async (): Promise<void> => {
    await choose(page, "scene:reference-composition");
    await expect.poll(() => readStat(page, "instances")).toBeGreaterThan(36);
    await choose(page, "assembly:roof-house");
    await expect.poll(() => readStat(page, "instances")).toBe(36);
  };

  for (let round = 0; round < WARMUP_CYCLES; round++) await cycle();
  const baseline = await retainedHeapBytes(session);
  for (let round = 0; round < MEASURED_CYCLES; round++) await cycle();

  await expect.poll(async () => (await retainedHeapBytes(session)) - baseline).toBeLessThan(MAX_GROWTH_BYTES);
});
