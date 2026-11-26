/**
 * Reproducible screenshots of the V2 clay review page.
 * Usage: node --experimental-strip-types capture/capture.ts <base-url> <out-dir> <name>=<query> [...]
 * Example: ... http://127.0.0.1:5183 ../../docs/screenshots exp-origami-v2-crow-study="mode=study&preset=crow"
 * Headless Chromium (software WebGL); viewport 1600x1000; waits for the page's ready flag and a fixed number of frames.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [base, out, ...shots] = process.argv.slice(2);
if (base === undefined || out === undefined || shots.length === 0) throw new Error("usage: capture.ts <base-url> <out-dir> <name>=<query> ...");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
for (const shot of shots) {
  const at = shot.indexOf("=");
  const [name, search] = [shot.slice(0, at), shot.slice(at + 1)];
  await page.goto(`${base}/v2.html?${search}`);
  await page.waitForSelector("body[data-ready='1']");
  await page.evaluate(() => new Promise<void>((resolve) => { let n = 0; const tick = (): void => { n += 1; if (n > 30) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
  const path = join(out, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(path);
}
await browser.close();
