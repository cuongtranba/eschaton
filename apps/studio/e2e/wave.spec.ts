import { expect, test, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });
test.setTimeout(120_000);

const SLOW = { timeout: 60_000 } as const;

async function openWorld(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("stat-backend")).toHaveText(/^(WebGPU|WebGL2)$/);
  await page.locator('[data-item="scene:world"]').click();
  await expect(page.getByTestId("world-backdrop-label")).toBeVisible();
}

const text = (page: Page, id: string): Promise<string> => page.getByTestId(id).innerText();

async function solveWith(page: Page, seed: number): Promise<string> {
  await openWorld(page);
  await page.getByTestId("wave-seed").fill(String(seed));
  await page.getByTestId("wave-solve").click();
  await expect(page.getByTestId("wave-status")).toHaveText("committed", SLOW);
  return text(page, "world-hash");
}

test("solving a region in the worker commits one revision of new pieces around the pinned ones and replays", async ({ page }) => {
  await openWorld(page);
  const pinned = await page.locator("[data-entity]").evaluateAll((items) => items.map((item) => item.getAttribute("data-entity")));
  await page.getByTestId("wave-solve").click();
  await expect(page.getByTestId("wave-status")).toHaveText("committed", SLOW);
  await expect(page.getByTestId("world-revision")).toHaveText("2");
  const after = await page.locator("[data-entity]").evaluateAll((items) => items.map((item) => item.getAttribute("data-entity")));
  expect(after.slice(0, pinned.length)).toEqual(pinned);
  expect(after.length).toBeGreaterThan(pinned.length + 10);
  await page.getByTestId("world-replay").click();
  await expect(page.getByTestId("world-replay-status")).toHaveText(`match ${await text(page, "world-hash")}`);
});

test("the same wave seed gives the same world hash and another seed a different one", async ({ page }) => {
  const first = await solveWith(page, 3);
  const again = await solveWith(page, 3);
  const other = await solveWith(page, 4);
  expect([again === first, other === first]).toEqual([true, false]);
});

test("while a large region is being solved the Studio stays responsive and the preview is not part of the world", async ({ page }) => {
  await openWorld(page);
  const hash = await text(page, "world-hash");
  const target = (await page.locator("[data-entity]").nth(2).getAttribute("data-entity")) ?? "";
  await page.getByTestId("wave-size").selectOption("huge");
  await page.evaluate(() => {
    const read = (id: string): string => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "";
    const seen = new Set<string>();
    Reflect.set(window, "waveTrace", seen);
    new MutationObserver(() => {
      seen.add([read("wave-status"), read("world-revision"), read("world-hash"), read("world-entity-id"), read("wave-progress").startsWith("Preview, not part of the world")].join("|"));
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.getByTestId("wave-solve").click();
  await page.locator("[data-entity]").nth(2).click();
  await expect(page.getByTestId("wave-status")).toHaveText("committed", SLOW);
  const trace = await page.evaluate(() => [...(Reflect.get(window, "waveTrace") as Set<string>)]);
  expect(trace).toContain(["solving", "1", hash, target, "true"].join("|"));
  await expect(page.getByTestId("world-revision")).toHaveText("2");
});

test("cancelling a solve ends it as cancelled and leaves the world revision and hash unchanged", async ({ page }) => {
  await openWorld(page);
  const hash = await text(page, "world-hash");
  await page.getByTestId("wave-size").selectOption("huge");
  await page.getByTestId("wave-solve").click();
  await expect(page.getByTestId("wave-status")).toHaveText("solving", SLOW);
  await page.getByTestId("wave-cancel").click();
  await expect(page.getByTestId("wave-status")).toHaveText("cancelled", SLOW);
  expect([await text(page, "world-revision"), await text(page, "world-hash")]).toEqual(["1", hash]);
});

test("solving the same region again finds everything pinned and still commits a valid world", async ({ page }) => {
  await openWorld(page);
  await page.getByTestId("wave-solve").click();
  await expect(page.getByTestId("wave-status")).toHaveText("committed", SLOW);
  await page.getByTestId("wave-x").fill("9");
  await page.getByTestId("wave-solve").click();
  await expect(page.getByTestId("world-revision")).toHaveText("3", SLOW);
  await expect(page.getByTestId("world-rejection")).toHaveText("");
});
