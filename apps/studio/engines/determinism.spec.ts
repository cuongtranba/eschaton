import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const GOLDEN = "69cd859eaf36a48f-9d3ff649a9a17f0d-5d4abb4866979287-2b72687a6cf860ae";
const waveSource = `/@fs${fileURLToPath(new URL("../../../packages/wave/src/index.ts", import.meta.url))}`;

test("the solver gives the recorded golden digest on this browser's JavaScript engine", async ({ page, browser, browserName }) => {
  console.log(`engine: ${browserName} ${browser.version()}`);
  await page.goto("/");
  const digest = await page.evaluate(async (url) => {
    const loaded: unknown = await import(url);
    const hasGolden = (value: unknown): value is { goldenPresetDigest: () => string } =>
      typeof value === "object" && value !== null && "goldenPresetDigest" in value && typeof value.goldenPresetDigest === "function";
    return hasGolden(loaded) ? loaded.goldenPresetDigest() : "the wave module did not load";
  }, waveSource);
  expect(`${browserName}:${digest}`).toBe(`${browserName}:${GOLDEN}`);
});

/** Fingerprint of the preset catalog as Node records it. Every world state hash includes it. */
const CATALOG = "e77d898a9014df16";
const foldonSource = `/@fs${fileURLToPath(new URL("../../../packages/foldon/src/index.ts", import.meta.url))}`;

test("the preset catalog has the recorded fingerprint on this browser's JavaScript engine", async ({ page, browserName }) => {
  await page.goto("/");
  const fingerprint = await page.evaluate(async (url) => {
    const loaded: unknown = await import(url);
    const hasCatalog = (value: unknown): value is { presetCatalog: { ok: boolean; value?: { fingerprint: string } } } =>
      typeof value === "object" && value !== null && "presetCatalog" in value && typeof value.presetCatalog === "object" && value.presetCatalog !== null;
    return hasCatalog(loaded) ? (loaded.presetCatalog.value?.fingerprint ?? "the catalog did not build") : "the foldon module did not load";
  }, foldonSource);
  expect(`${browserName}:${fingerprint}`).toBe(`${browserName}:${CATALOG}`);
});
