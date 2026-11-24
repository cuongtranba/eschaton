import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

export const output = (prefix: string, name: string): string =>
  fileURLToPath(new URL(`../../../docs/screenshots/${prefix}-${name}.png`, import.meta.url));

export async function openLab(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("stat-backend")).toHaveText(/^(WebGPU|WebGL2)$/);
}

const frames = async (page: Page): Promise<number> => Number(await page.getByTestId("stats").getAttribute("data-frames"));

export const nextFrames = (page: Page, count: number): Promise<void> =>
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

export async function rendersAfter(page: Page, action: () => Promise<void>): Promise<void> {
  const before = await frames(page);
  await action();
  await expect.poll(() => frames(page)).toBeGreaterThan(before);
  await nextFrames(page, 2);
}

export async function settled(page: Page): Promise<void> {
  let last = -1;
  await expect
    .poll(
      async () => {
        await nextFrames(page, 6);
        const current = await frames(page);
        const stable = current === last && current > 0;
        last = current;
        return stable;
      },
      { timeout: 90_000 },
    )
    .toBe(true);
}
