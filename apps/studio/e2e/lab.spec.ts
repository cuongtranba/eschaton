import { expect, test, type Page } from "@playwright/test";

const ITEM_NAMES = {
  roofModule: "Roof module",
  watchtower: "Watchtower",
  roofHouse: "Pitched-roof house",
  ruinedGate: "Ruined gate",
} as const;

const stat = (page: Page, name: string) => page.getByTestId(`stat-${name}`);

async function openLab(page: Page, search = ""): Promise<void> {
  await page.goto(`/${search}`);
  await expect(stat(page, "backend")).toHaveText(/^(WebGPU|WebGL2)$/);
}

async function readNumber(page: Page, name: string): Promise<number> {
  return Number(await stat(page, name).innerText());
}

async function choose(page: Page, key: string): Promise<void> {
  await page.locator(`[data-item="${key}"]`).click();
}

async function nonBackgroundFraction(page: Page): Promise<number> {
  const png = await page.getByRole("region", { name: "Viewport" }).screenshot();
  return page.evaluate(async (encoded) => {
    const response = await fetch(`data:image/png;base64,${encoded}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (context === null) return 0;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const reference = [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0];
    let differing = 0;
    for (let i = 0; i < data.length; i += 4) {
      const delta =
        Math.abs((data[i] ?? 0) - (reference[0] ?? 0)) +
        Math.abs((data[i + 1] ?? 0) - (reference[1] ?? 0)) +
        Math.abs((data[i + 2] ?? 0) - (reference[2] ?? 0));
      if (delta > 30) differing += 1;
    }
    return differing / (data.length / 4);
  }, png.toString("base64"));
}

test("renders a non-blank scene on a reported backend", async ({ page }) => {
  await openLab(page);
  await expect.poll(() => nonBackgroundFraction(page)).toBeGreaterThan(0.01);
});

test("falls back to the WebGL2 backend when forced", async ({ page }) => {
  await openLab(page, "?forceWebGL=1");
  await expect(stat(page, "backend")).toHaveText("WebGL2");
});

test("selecting every catalog item updates the inspector title", async ({ page }) => {
  await openLab(page);
  const items = page.locator("[data-item]");
  await expect(items).toHaveCount(13);
  for (const item of await items.all()) {
    const name = await item.getAttribute("data-name");
    await item.click();
    await expect(page.getByTestId("inspector-title")).toHaveText(name ?? "missing data-name");
  }
  await expect(page.locator('[data-item^="primitive:P0"]')).toHaveCount(9);
  for (const name of Object.values(ITEM_NAMES)) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.getByTestId("inspector-title")).toHaveText(name);
  }
});

test("bracket keys walk the catalog", async ({ page }) => {
  await openLab(page);
  await choose(page, "primitive:P01");
  await expect(page.getByTestId("inspector-title")).toHaveText("Planar panel");
  await page.keyboard.press("]");
  await expect(page.getByTestId("inspector-title")).toHaveText("Triangular facet");
  await page.keyboard.press("[");
  await expect(page.getByTestId("inspector-title")).toHaveText("Planar panel");
});

test("moving the fold slider to zero flattens every crease readout to 0°", async ({ page }) => {
  await openLab(page);
  await choose(page, "primitive:P08");
  const readouts = page.getByTestId(/^crease-current-/);
  await expect(readouts.first()).toHaveText("-90.0°");
  await page.getByTestId("fold-slider").fill("0");
  for (const readout of await readouts.all()) {
    await expect(readout).toHaveText("0.0°");
  }
});

test("the sockets overlay shows a legend and adds a draw call", async ({ page }) => {
  await openLab(page);
  await expect(page.getByTestId("socket-legend")).toHaveCount(0);
  await expect.poll(() => readNumber(page, "draw-calls")).toBeGreaterThan(0);
  const before = await readNumber(page, "draw-calls");
  await page.keyboard.press("s");
  await expect(page.getByRole("checkbox", { name: /Sockets/ })).toBeChecked();
  await expect(page.getByTestId("socket-legend")).toBeVisible();
  await expect.poll(() => readNumber(page, "draw-calls")).toBe(before + 1);
});

test("leaf foldons are batched into fewer draw calls than instances", async ({ page }) => {
  await openLab(page);
  await choose(page, "assembly:roof-house");
  await expect.poll(() => readNumber(page, "instances")).toBeGreaterThan(30);
  expect(await readNumber(page, "draw-calls")).toBeLessThan(15);
});

test("switching items repeatedly does not grow GPU resources", async ({ page }) => {
  await openLab(page);
  await expect.poll(() => readNumber(page, "instances")).toBeGreaterThan(0);
  const snapshot = () =>
    page.evaluate(() => {
      const read = (name: string): number => Number(document.querySelector(`[data-testid="stat-${name}"]`)?.textContent);
      return { instances: read("instances"), geometries: read("geometries"), textures: read("textures") };
    });
  const baseline = await snapshot();
  for (let round = 0; round < 10; round++) {
    await choose(page, "assembly:watchtower");
    await expect.poll(async () => (await snapshot()).instances).not.toBe(baseline.instances);
    await choose(page, "assembly:roof-house");
    await expect.poll(async () => (await snapshot()).instances).toBe(baseline.instances);
  }
  await expect.poll(snapshot).toEqual(baseline);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("play fold jumps to the opposite end instead of animating", async ({ page }) => {
    await openLab(page);
    await expect(page.getByRole("checkbox", { name: "Reduced motion" })).toBeChecked();
    await expect(page.getByTestId("fold-slider")).toHaveValue("1");
    await page.keyboard.press("f");
    await expect(page.getByTestId("fold-slider")).toHaveValue("0");
  });
});
