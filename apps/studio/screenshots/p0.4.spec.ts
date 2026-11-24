import { test } from "@playwright/test";
import { openLab, output, rendersAfter } from "./support";

const shot = (name: string): string => output("p0.4", name);

test("P08 mid-fold with crease axes", async ({ page }) => {
  await openLab(page);
  await page.locator('[data-item="primitive:P08"]').click();
  await page.getByTestId("fold-slider").fill("0.5");
  await rendersAfter(page, () => page.keyboard.press("c"));
  await page.screenshot({ path: shot("p08-mid-fold-creases") });
});

test("roof-house with sockets overlay", async ({ page }) => {
  await openLab(page);
  await page.locator('[data-item="assembly:roof-house"]').click();
  await rendersAfter(page, () => page.keyboard.press("s"));
  await page.screenshot({ path: shot("roof-house-sockets") });
});

test("watchtower in the composition camera", async ({ page }) => {
  await openLab(page);
  await page.locator('[data-item="assembly:watchtower"]').click();
  await rendersAfter(page, () => page.keyboard.press("o"));
  await page.screenshot({ path: shot("watchtower-composition") });
});
