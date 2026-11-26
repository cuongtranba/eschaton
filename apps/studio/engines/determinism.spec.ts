import { fileURLToPath } from "node:url";
import type * as Foldon from "@eschaton/foldon";
import type * as World from "@eschaton/world";
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

/** Fold angles `windFold` gives a leaf and two roof panels for the wind [0.1, 0.1, 0.1], as Node records them. */
const OFF_AXIS_WIND = JSON.stringify([{ midrib: 0.3574988523517096 }, { ridge: -0.9056611201481806 }, { ridge: -0.9056611201481806 }]);
const worldSource = `/@fs${fileURLToPath(new URL("../../../packages/world/src/index.ts", import.meta.url))}`;

test("a wind off the x axis folds to the recorded angles on this browser's JavaScript engine", async ({ page, browserName }) => {
  await page.goto("/");
  const folds = await page.evaluate(
    async ([foldonUrl, worldUrl]) => {
      const foldon: unknown = await import(foldonUrl);
      const world: unknown = await import(worldUrl);
      const isFoldon = (value: unknown): value is typeof Foldon => typeof value === "object" && value !== null && "presetCatalog" in value;
      const isWorld = (value: unknown): value is typeof World => typeof value === "object" && value !== null && "windFold" in value;
      if (!isFoldon(foldon) || !isWorld(world)) return "the packages did not load";
      const preset = foldon.presetCatalog;
      if (!preset.ok) return "the catalog did not build";
      const catalog = preset.value;
      const created = world.createWorld({ catalog, seed: 1 });
      if (!created.ok) return "the world did not build";
      const placed = world.applyPatch(catalog, created.value, {
        baseRevision: 0,
        ops: [
          { op: "instantiate", ref: { kind: "assembly", id: "roof-module" }, anchor: [0, 0, 0], rotation: 0 },
          { op: "instantiate", ref: { kind: "foldon", id: "leaf" }, anchor: [5, 0, 0], rotation: 0 },
        ],
        origin: { kind: "command", id: "engines" },
      });
      if (!placed.ok) return "the garden did not commit";
      const blown = world.runSystem(catalog, placed.value.state, world.windFold, { wind: [0.1, 0.1, 0.1] });
      if (!blown.ok) return "the wind did not commit";
      const folds = (id: string) => blown.value.state.entities.filter((entity) => entity.definition.id === id).map((entity) => entity.fold);
      return JSON.stringify([...folds("leaf"), ...folds("P03")]);
    },
    [foldonSource, worldSource] as const,
  );
  expect(`${browserName}:${folds}`).toBe(`${browserName}:${OFF_AXIS_WIND}`);
});
