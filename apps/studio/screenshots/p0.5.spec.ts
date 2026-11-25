import { expect, test, type Page } from "@playwright/test";
import { openLab, output, settled } from "./support";

test.use({ reducedMotion: "reduce" });

const shot = (name: string): string => output("p0.5", name);

type LookChange = Readonly<{
  palette?: string;
  hatching?: number;
  haze?: number;
  quantize?: boolean;
  grain?: boolean;
  outlines?: boolean;
}>;

async function openComposition(page: Page): Promise<void> {
  await openLab(page);
  await page.locator('[data-item="scene:reference-composition"]').click();
  await expect(page.getByTestId("layout-hash")).toBeVisible();
}

async function useCompositionCamera(page: Page): Promise<void> {
  await page.keyboard.press("o");
  await expect(page.getByRole("button", { name: /Camera: Composition/ })).toBeVisible();
}

async function applyLook(page: Page, look: LookChange): Promise<void> {
  if (look.palette !== undefined) await page.getByLabel("Palette preset").selectOption({ label: look.palette });
  if (look.hatching !== undefined) await page.getByTestId("look-hatching").fill(String(look.hatching));
  if (look.haze !== undefined) await page.getByTestId("look-haze").fill(String(look.haze));
  const toggles: readonly (readonly [RegExp, boolean | undefined])[] = [
    [/Quantized light/, look.quantize],
    [/Paper grain/, look.grain],
    [/Ink outlines/, look.outlines],
  ];
  for (const [name, value] of toggles) {
    if (value !== undefined) await page.getByRole("checkbox", { name }).setChecked(value);
  }
}

test("reference composition at the composition camera", async ({ page }) => {
  await openComposition(page);
  await useCompositionCamera(page);
  await settled(page);
  await page.screenshot({ path: shot("reference-composition") });
});

test("reference composition with another seed", async ({ page }) => {
  await openComposition(page);
  await useCompositionCamera(page);
  await page.getByTestId("seed-input").fill("77");
  await page.getByTestId("seed-input").press("Enter");
  await expect(page.getByTestId("scene-seed")).toHaveText("77");
  await settled(page);
  await page.screenshot({ path: shot("reference-seed-2") });
});

const comparisons: readonly (readonly [string, readonly LookChange[]])[] = [
  ["flat", [{ palette: "Flat (no ink)" }]],
  [
    "quantized",
    [{ palette: "Last World", hatching: 0, haze: 0, grain: false, outlines: false, quantize: true }],
  ],
  ["hatching", [{ palette: "Last World", hatching: 0.85, haze: 0, grain: false, outlines: false, quantize: true }]],
  ["full", [{ palette: "Last World", hatching: 0.85, haze: 0.6, grain: true, outlines: true, quantize: true }]],
];

test("technique comparison at a fixed camera and light", async ({ page }) => {
  await openComposition(page);
  await useCompositionCamera(page);
  for (const [name, changes] of comparisons) {
    for (const change of changes) await applyLook(page, change);
    await settled(page);
    await page.screenshot({ path: shot(`compare-${name}`) });
  }
});

async function orbitBy(page: Page, dx: number): Promise<void> {
  const box = await page.locator("canvas.viewport__canvas").boundingBox();
  if (box === null) throw new Error("canvas is not laid out");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 10 });
  await page.mouse.up();
  await settled(page);
}

test("orbit stability pair of the same scene", async ({ page }) => {
  test.setTimeout(240_000);
  await openComposition(page);
  await settled(page);
  await orbitBy(page, 24);
  await page.screenshot({ path: shot("orbit-stability-a") });
  await orbitBy(page, 16);
  await page.screenshot({ path: shot("orbit-stability-b") });
});
