import { expect, test, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });
test.setTimeout(180_000);

const SLOW = { timeout: 90_000 } as const;

async function openWorld(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("stat-backend")).toHaveText(/^(WebGPU|WebGL2)$/);
  await page.locator('[data-item="scene:world"]').click();
  await expect(page.getByTestId("world-backdrop-label")).toBeVisible();
}

const text = (page: Page, id: string): Promise<string> => page.getByTestId(id).innerText();
const entityIds = (page: Page): Promise<(string | null)[]> => page.locator("[data-entity]").evaluateAll((items) => items.map((item) => item.getAttribute("data-entity")));

async function generateWith(page: Page, seed: number): Promise<string> {
  await openWorld(page);
  await page.getByTestId("genesis-seed").fill(String(seed));
  await page.getByTestId("genesis-generate").click();
  await expect(page.getByTestId("genesis-status")).toHaveText("committed", SLOW);
  return text(page, "world-hash");
}

test("generating a district in the worker commits one revision of new pieces beside the existing ones and replays", async ({ page }) => {
  await openWorld(page);
  const before = await entityIds(page);
  await page.getByTestId("genesis-generate").click();
  await expect(page.getByTestId("genesis-status")).toHaveText("committed", SLOW);
  await expect(page.getByTestId("world-revision")).toHaveText("2");
  const after = await entityIds(page);
  expect([after.slice(0, before.length), after.length > before.length + 800, Number(await text(page, "genesis-entities")) === after.length - before.length]).toEqual([before, true, true]);
  await page.getByTestId("world-replay").click();
  await expect(page.getByTestId("world-replay-status")).toHaveText(`match ${await text(page, "world-hash")}`, SLOW);
});

test("the same district seed gives the same world hash and another seed a different one", async ({ page }) => {
  const first = await generateWith(page, 3);
  const again = await generateWith(page, 3);
  const other = await generateWith(page, 4);
  expect([again === first, other === first]).toEqual([true, false]);
});

test("the plan map shows the semantic layers and hides the network routes when their layer is switched off", async ({ page }) => {
  await generateWith(page, 2);
  const map = page.getByTestId("genesis-map");
  const classes = await map.locator("rect").evaluateAll((cells) => [...new Set(cells.map((cell) => cell.getAttribute("class")))].sort());
  expect(classes).toEqual(expect.arrayContaining(["plan-map__bridge", "plan-map__house", "plan-map__plaza", "plan-map__road", "plan-map__tower", "plan-map__water"]));
  expect(await page.getByTestId("genesis-route").count()).toBeGreaterThan(2);
  await page.getByTestId("genesis-layer-routes").uncheck();
  await expect(page.getByTestId("genesis-route")).toHaveCount(0);
});

test("a second district continues the first one to the east as one more revision", async ({ page }) => {
  await generateWith(page, 5);
  const count = (await entityIds(page)).length;
  await page.getByTestId("genesis-seed").fill("6");
  await page.getByTestId("genesis-generate").click();
  await expect(page.getByTestId("genesis-districts")).toHaveText("2", SLOW);
  expect([await text(page, "world-revision"), await text(page, "genesis-status"), (await entityIds(page)).length > count + 800]).toEqual(["3", "committed", true]);
});

test("cancelling a generation ends it as cancelled and leaves the world revision and hash unchanged", async ({ page }) => {
  await openWorld(page);
  const hash = await text(page, "world-hash");
  await page.evaluate(async () => {
    const press = (id: string): void => { document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)?.click(); };
    press("genesis-generate");
    await Promise.resolve();
    await Promise.resolve();
    press("genesis-cancel");
  });
  await expect(page.getByTestId("genesis-status")).toHaveText("cancelled", SLOW);
  expect([await text(page, "world-revision"), await text(page, "world-hash")]).toEqual(["1", hash]);
});
