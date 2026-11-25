import { expect, test, type Page } from "@playwright/test";
import { openLab, output, settled } from "./support";

test.use({ reducedMotion: "reduce" });
test.setTimeout(240_000);

async function generate(page: Page, seed: number): Promise<void> {
  await page.getByTestId("genesis-seed").fill(String(seed));
  await page.getByTestId("genesis-generate").click();
  await expect(page.getByTestId("genesis-status")).toHaveText("committed", { timeout: 120_000 });
  await settled(page);
}

async function openWorld(page: Page): Promise<void> {
  await openLab(page);
  await page.locator('[data-item="scene:world"]').click();
  await expect(page.getByTestId("world-backdrop-label")).toBeVisible();
}

for (const seed of [1, 2, 3]) {
  test(`genesis: Last District, seed ${seed}`, async ({ page }) => {
    await openWorld(page);
    await generate(page, seed);
    await page.getByTestId("genesis-map").scrollIntoViewIfNeeded();
    await page.screenshot({ path: output("p3", `genesis-district-seed-${seed}`) });
  });
}

test("genesis: a second district continuing the first one to the east", async ({ page }) => {
  await openWorld(page);
  await generate(page, 4);
  await generate(page, 9);
  await page.getByTestId("genesis-map").scrollIntoViewIfNeeded();
  await page.screenshot({ path: output("p3", "genesis-two-districts") });
});

test("genesis: a district with the look-dev decorative offsets switched on", async ({ page }) => {
  await openWorld(page);
  await generate(page, 1);
  await page.getByTestId("world-offsets").check();
  await settled(page);
  await page.screenshot({ path: output("p3", "genesis-district-offsets") });
});
