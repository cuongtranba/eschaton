import { presetCatalog, type Catalog } from "@eschaton/foldon";
import { compileTiles, prepareRegion, settleJob, solve, type RegionJob, type TileSpec } from "@eschaton/wave";
import { applyPatch, createWorld, hashState, type WorldState } from "@eschaton/world";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!presetCatalog.ok) throw new Error("the preset catalog must build");
  return presetCatalog.value;
})();

const tiles: readonly TileSpec[] = [
  { ref: { kind: "foldon", id: "P08" }, weight: 4 },
  { ref: { kind: "foldon", id: "P03" }, weight: 2 },
  { ref: { kind: "assembly", id: "l-block" }, weight: 2 },
];
const origin = { kind: "job", id: "settle-test" } as const;
const live = { origin, cancelRequested: false } as const;

function setup(): { state: WorldState; job: RegionJob; solved: unknown } {
  const created = createWorld({ catalog, seed: 6 });
  if (!created.ok) throw new Error("world must build");
  const pinned = applyPatch(catalog, created.value, { baseRevision: 0, ops: [{ op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [2, 0, 2], rotation: 0 }], origin });
  if (!pinned.ok) throw new Error("pin must commit");
  const job = prepareRegion(catalog, pinned.value.state, { region: { min: [0, 0, 0], max: [5, 2, 5] }, seed: 3, airWeight: 4, ground: { y: 0, profile: "ground" }, budget: { maxNodes: 20_000, maxBacktracks: 2_000 } });
  const compiled = compileTiles(catalog, tiles);
  if (!job.ok || !compiled.ok) throw new Error("job must prepare");
  return { state: pinned.value.state, job: job.value, solved: JSON.parse(JSON.stringify(solve(compiled.value, job.value.problem))) };
}

test("a solved job is verified and committed as one revision", () => {
  const { state, job, solved } = setup();
  const settled = settleJob(catalog, state, job, tiles, solved, live);
  expect(settled.status === "committed" ? settled.committed.state.header.revision : settled.detail).toBe(state.header.revision + 1);
});

test("a cancel that was requested wins over a job that finished as solved", () => {
  const { state, job, solved } = setup();
  expect(settleJob(catalog, state, job, tiles, solved, { origin, cancelRequested: true }).status).toBe("cancelled");
});

test("malformed job results are reported as failed instead of throwing or committing", () => {
  const { state, job, solved } = setup();
  const good = solved as { placements: { rotation: number; anchor: unknown }[] };
  const variants: unknown[] = [
    undefined,
    { kind: "mystery" },
    { kind: "solved" },
    { ...good, placements: [{ ...good.placements[0], rotation: 7 }] },
    { ...good, placements: [{ ...good.placements[0], anchor: undefined }] },
    { ...good, placements: "many" },
  ];
  expect(variants.map((outcome) => settleJob(catalog, state, job, tiles, outcome, live).status)).toEqual(variants.map(() => "failed"));
});

test("a result that breaks the generation rules is refused even though the world alone would accept it", () => {
  const { state, job } = setup();
  const floating = { kind: "solved", airCells: 0, stats: { cells: 0, candidates: 0, nodes: 0, backtracks: 0, propagations: 0 }, placements: [{ ref: { kind: "foldon", id: "P08", version: 1 }, anchor: [0, 2, 0], rotation: 0 }] };
  const outside = { ...floating, placements: [{ ref: { kind: "foldon", id: "P08", version: 1 }, anchor: [9, 0, 0], rotation: 0 }] };
  const foreign = { ...floating, placements: [{ ref: { kind: "foldon", id: "P07", version: 1 }, anchor: [0, 0, 0], rotation: 0 }] };
  const overPin = { ...floating, placements: [{ ref: { kind: "foldon", id: "P08", version: 1 }, anchor: [2, 0, 2], rotation: 0 }] };
  const results = [floating, outside, foreign, overPin].map((outcome) => settleJob(catalog, state, job, tiles, outcome, live));
  expect(results.map((result) => result.status)).toEqual(["failed", "failed", "failed", "failed"]);
  expect(hashState(state)).toBe(hashState(setup().state));
});

test("a job whose region changed before it settled is a conflict and commits nothing", () => {
  const { state, job, solved } = setup();
  const changed = applyPatch(catalog, state, { baseRevision: state.header.revision, ops: [{ op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [5, 0, 5], rotation: 0 }], origin });
  if (!changed.ok) throw new Error("the racing commit must succeed");
  expect(settleJob(catalog, changed.value.state, job, tiles, solved, live).status).toBe("conflict");
});
