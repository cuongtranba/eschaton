import { expect, test, type Page } from "@playwright/test";
import { openLab, output, settled } from "./support";

test.use({ reducedMotion: "reduce" });

async function openWorld(page: Page): Promise<void> {
  await openLab(page);
  await page.locator('[data-item="scene:world"]').click();
  await expect(page.getByTestId("world-backdrop-label")).toBeVisible();
}

test("world mode with zero decorative offsets", async ({ page }) => {
  await openWorld(page);
  await settled(page);
  await page.screenshot({ path: output("p1", "world-mode") });
});

test("world mode with look-dev offsets after detaching a roof", async ({ page }) => {
  await openWorld(page);
  await page.locator("[data-entity]", { hasText: "P03" }).first().click();
  await page.getByTestId("world-detach").click();
  await expect(page.getByTestId("world-entity-owner")).toHaveText("detached");
  await page.getByTestId("world-offsets").check();
  await settled(page);
  await page.screenshot({ path: output("p1", "world-mode-offsets") });
});
