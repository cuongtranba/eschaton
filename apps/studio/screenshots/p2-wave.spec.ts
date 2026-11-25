import { expect, test, type Page } from "@playwright/test";
import { nextFrames, openLab, output, settled } from "./support";

test.use({ reducedMotion: "reduce" });
test.setTimeout(180_000);

async function openWorld(page: Page): Promise<void> {
  await openLab(page);
  await page.locator('[data-item="scene:world"]').click();
  await expect(page.getByTestId("world-backdrop-label")).toBeVisible();
}

async function solveAndShoot(page: Page, size: string, seed: number, name: string): Promise<void> {
  await openWorld(page);
  await page.getByTestId("wave-size").selectOption(size);
  await page.getByTestId("wave-seed").fill(String(seed));
  await page.getByTestId("wave-solve").click();
  await expect(page.getByTestId("wave-status")).toHaveText("committed", { timeout: 120_000 });
  await settled(page);
  await page.screenshot({ path: output("p2", name) });
}

test("wave: medium region around the pinned pieces, seed 1", async ({ page }) => {
  await solveAndShoot(page, "medium", 1, "wave-medium-seed-1");
});

test("wave: the same region, seed 2", async ({ page }) => {
  await solveAndShoot(page, "medium", 2, "wave-medium-seed-2");
});

test("wave: large 16x8x16 region, seed 5", async ({ page }) => {
  await solveAndShoot(page, "large", 5, "wave-large-seed-5");
});

test("wave: a huge region while the worker is still solving (preview, not part of the world)", async ({ page }) => {
  await openWorld(page);
  await page.getByTestId("wave-size").selectOption("huge");
  await page.getByTestId("wave-solve").click();
  await expect(page.getByTestId("wave-progress")).toContainText(/ [1-9]\d{3} of 6272 cells decided/);
  await nextFrames(page, 3);
  await page.screenshot({ path: output("p2", "wave-solving-preview") });
  await expect(page.getByTestId("wave-status")).toHaveText("committed", { timeout: 120_000 });
});
