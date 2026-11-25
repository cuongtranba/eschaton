import { fnv1a64, presetCatalog, type Catalog } from "@eschaton/foldon";
import { compileTiles, type TileSpec } from "./solver/compile";
import { solve, type WaveOutcome } from "./solver/solve";

const GOLDEN_TILES: readonly TileSpec[] = [
  { ref: { kind: "foldon", id: "P08" }, weight: 6 },
  { ref: { kind: "foldon", id: "P03" }, weight: 3 },
  { ref: { kind: "foldon", id: "P07" }, weight: 1 },
  { ref: { kind: "assembly", id: "roof-module" }, weight: 2 },
  { ref: { kind: "assembly", id: "column-3" }, weight: 2 },
  { ref: { kind: "assembly", id: "l-block" }, weight: 2 },
  { ref: { kind: "assembly", id: "roof-house" }, weight: 1 },
];

export const placementDigest = (outcome: WaveOutcome): string =>
  outcome.kind === "solved"
    ? fnv1a64(outcome.placements.map((p) => `${p.ref.kind}:${p.ref.id}@${p.ref.version}|${p.anchor.join(",")}|${p.rotation}`).join(";"))
    : outcome.kind;

/**
 * One fixed solve whose digest is recorded in the tests. Running it on another JavaScript engine and comparing the
 * digest is the cross-engine determinism check (ADR 0015).
 */
export function goldenDigest(catalog: Catalog): string {
  const tiles = compileTiles(catalog, GOLDEN_TILES);
  if (!tiles.ok) return `failed: ${tiles.error.join("; ")}`;
  const seeds = [1, 2, 3, 20261125];
  return seeds
    .map((seed) => placementDigest(solve(tiles.value, { size: [12, 6, 12], seed, airWeight: 8, ground: { profile: "ground" }, budget: { maxNodes: 100_000, maxBacktracks: 10_000 } })))
    .join("-");
}

export const goldenPresetDigest = (): string => (presetCatalog.ok ? goldenDigest(presetCatalog.value) : "the preset catalog failed to build");
