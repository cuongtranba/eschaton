import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const output = (name: string): string =>
  fileURLToPath(new URL(`../../../docs/screenshots/p0.4-${name}.png`, import.meta.url));

async function openLab(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("stat-backend")).toHaveText(/^(WebGPU|WebGL2)$/);
}

async function rendersAfter(page: Page, action: () => Promise<void>): Promise<void> {
  const frames = async (): Promise<number> => Number(await page.getByTestId("stats").getAttribute("data-frames"));
  const before = await frames();
  await action();
  await expect.poll(frames).toBeGreaterThan(before);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => { resolve(); }))),
  );
}

test("P08 mid-fold with crease axes", async ({ page }) => {
  await openLab(page);
  await page.locator('[data-item="primitive:P08"]').click();
  await page.getByTestId("fold-slider").fill("0.5");
  await rendersAfter(page, () => page.keyboard.press("c"));
  await page.screenshot({ path: output("p08-mid-fold-creases") });
});

test("roof-house with sockets overlay", async ({ page }) => {
  await openLab(page);
  await page.locator('[data-item="assembly:roof-house"]').click();
  await rendersAfter(page, () => page.keyboard.press("s"));
  await page.screenshot({ path: output("roof-house-sockets") });
});

test("watchtower in the composition camera", async ({ page }) => {
  await openLab(page);
  await page.locator('[data-item="assembly:watchtower"]').click();
  await rendersAfter(page, () => page.keyboard.press("o"));
  await page.screenshot({ path: output("watchtower-composition") });
});
