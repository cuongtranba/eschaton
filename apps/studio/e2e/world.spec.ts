import { expect, test, type Page } from "@playwright/test";

const WORLD = "scene:world";
const WORLD_INSTANCES = 7;

async function openWorld(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("stat-backend")).toHaveText(/^(WebGPU|WebGL2)$/);
  await page.locator(`[data-item="${WORLD}"]`).click();
  await expect(page.getByTestId("inspector-title")).toHaveText("World");
}

const revision = async (page: Page): Promise<number> => Number(await page.getByTestId("world-revision").innerText());

const nextFrames = (page: Page, count: number): Promise<void> =>
  page.evaluate(
    (total) =>
      new Promise<void>((resolve) => {
        let seen = 0;
        const tick = (): void => {
          seen += 1;
          if (seen >= total) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count,
  );

test("attaching and detaching in the Studio updates the inspector's owner and keeps the id", async ({ page }) => {
  await openWorld(page);
  const roof = page.locator("[data-entity]", { hasText: "P03" }).first();
  const id = await roof.getAttribute("data-entity");
  if (id === null) throw new Error("a roof entity must be listed");
  await roof.click();
  await expect(page.getByTestId("world-entity-id")).toHaveText(id);
  await expect(page.getByTestId("world-entity-owner")).toHaveText("placed");
  const start = await revision(page);

  await page.getByTestId("world-detach").click();
  await expect(page.getByTestId("world-entity-owner")).toHaveText("detached");
  await expect(page.getByTestId("world-entity-id")).toHaveText(id);
  await expect(page.getByTestId("world-revision")).toHaveText(String(start + 1));

  await page.getByTestId("world-attach").click();
  await expect(page.getByTestId("world-entity-owner")).toHaveText("placed");
  await expect(page.getByTestId("world-entity-id")).toHaveText(id);
  await expect(page.getByTestId("world-revision")).toHaveText(String(start + 2));
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("toggling decorative offsets changes the image but not the reported state hash", async ({ page }) => {
    await openWorld(page);
    await expect.poll(async () => Number(await page.getByTestId("stat-instances").innerText())).toBe(WORLD_INSTANCES);
    await nextFrames(page, 20);
    const viewport = page.getByRole("region", { name: "Viewport" });
    const hash = await page.getByTestId("world-hash").innerText();
    const before = await viewport.screenshot();

    await page.getByTestId("world-offsets").check();
    await expect.poll(async () => (await viewport.screenshot()).equals(before)).toBe(false);
    await expect(page.getByTestId("world-hash")).toHaveText(hash);

    await page.getByTestId("world-offsets").uncheck();
    await expect.poll(async () => (await viewport.screenshot()).equals(before)).toBe(true);
    await expect(page.getByTestId("world-hash")).toHaveText(hash);
  });
});

test("applying wind commits a new revision and an over-strong gust is shown as a rejection", async ({ page }) => {
  await openWorld(page);
  const start = await revision(page);

  await page.getByTestId("world-wind").fill("0.1");
  await page.getByTestId("world-apply-wind").click();
  await expect(page.getByTestId("world-revision")).toHaveText(String(start + 1));
  await expect(page.getByTestId("world-rejection")).toHaveText("");

  await page.getByTestId("world-wind").fill("1");
  await page.getByTestId("world-apply-wind").click();
  await expect(page.getByTestId("world-rejection")).toContainText("fold");
  await expect(page.getByTestId("world-revision")).toHaveText(String(start + 1));
});

test("replaying the commit log in the Studio reproduces the live state hash", async ({ page }) => {
  await openWorld(page);
  const start = await revision(page);
  await page.locator("[data-entity]", { hasText: "P03" }).first().click();
  await page.getByTestId("world-detach").click();
  await expect(page.getByTestId("world-revision")).toHaveText(String(start + 1));
  const hash = await page.getByTestId("world-hash").innerText();

  await page.getByTestId("world-replay").click();
  await expect(page.getByTestId("world-replay-status")).toHaveText(`match ${hash}`);
});

test("the world view labels its backdrop as not part of the world and the look-dev scene does not", async ({ page }) => {
  await openWorld(page);
  await expect(page.getByTestId("world-backdrop-label")).toHaveText("Backdrop — not part of the world");
  await page.locator('[data-item="scene:reference-composition"]').click();
  await expect(page.getByTestId("world-backdrop-label")).toHaveCount(0);
});
