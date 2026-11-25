import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { output, settled } from "./support";

test.use({ reducedMotion: "reduce" });
test.setTimeout(240_000);

async function compositionCamera(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Camera:/ }).click();
  await expect(page.getByRole("button", { name: /Camera: Composition/ })).toBeVisible();
}

async function openStudy(page: Page): Promise<void> {
  await page.goto("/?study=rebuild");
  await expect(page.getByTestId("stat-backend")).toHaveText(/^(WebGPU|WebGL2)$/, { timeout: 120_000 });
  await page.locator('[data-item="scene:world"]').click();
  await expect(page.getByTestId("world-study")).toBeVisible();
  await compositionCamera(page);
}

test("the old look-dev reference composition, composition camera", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("stat-backend")).toHaveText(/^(WebGPU|WebGL2)$/);
  await page.locator('[data-item="scene:reference-composition"]').click();
  await compositionCamera(page);
  await settled(page);
  await page.screenshot({ path: output("p1", "rebuild-old") });
});

test("the reference composition rebuilt from validated world commits, zero offsets", async ({ page }) => {
  await openStudy(page);
  await settled(page);
  await page.screenshot({ path: output("p1", "rebuild-new") });
  const report = {
    revision: await page.getByTestId("world-revision").innerText(),
    hash: await page.getByTestId("world-hash").innerText(),
    entities: await page.getByTestId("world-entity-count").innerText(),
    study: await page.getByTestId("world-study").innerText(),
  };
  writeFileSync(fileURLToPath(new URL("../../../docs/review/p1-rebuild-study.json", import.meta.url)), `${JSON.stringify(report, null, 2)}\n`);
});

test("the rebuilt composition with the illustrative look-dev offset envelope", async ({ page }) => {
  await openStudy(page);
  await page.getByTestId("world-offsets").check();
  await settled(page);
  await page.screenshot({ path: output("p1", "rebuild-new-offsets") });
});
