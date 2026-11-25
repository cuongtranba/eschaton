import { test } from "vitest";
import { foldonId, presetCatalog, type Cell } from "@eschaton/foldon";
import { compileTiles, prepareRegion, proposalOf, solve, type TileSpec, type WaveProblem } from "@eschaton/wave";
import { applyPatch, applyProposal, createWorld, readRegion, type Region, type WorldOp, type WorldState } from "@eschaton/world";

const OPTIONS = { warmupIterations: 5, warmupTime: 200, time: 1500 } as const;

if (!presetCatalog.ok) throw new Error("catalog failed to build");
const catalog = presetCatalog.value;
const tile = (kind: "foldon" | "assembly", id: string, weight: number): TileSpec => ({ ref: { kind, id }, weight });
const TOWN: readonly TileSpec[] = [
  tile("foldon", "P08", 6),
  tile("foldon", "P03", 3),
  tile("foldon", "P07", 1),
  tile("assembly", "roof-module", 2),
  tile("assembly", "column-3", 2),
  tile("assembly", "l-block", 2),
  tile("assembly", "roof-house", 1),
];
const compiled = compileTiles(catalog, TOWN);
const packing = compileTiles(catalog, [tile("assembly", "l-block", 3), tile("assembly", "column-3", 1)]);
if (!compiled.ok || !packing.ok) throw new Error("tiles failed to compile");
const town = compiled.value;

const problem = (size: Cell, seed: number): WaveProblem => ({ size, seed, airWeight: 8, ground: { profile: "ground" }, budget: { maxNodes: 200_000, maxBacktracks: 20_000 } });

const base = catalog.foldon(foldonId("P08"))?.sockets.find((socket) => socket.face === "-y");
if (base === undefined) throw new Error("P08 bottom socket missing");
const roofed: WaveProblem = {
  ...problem([6, 3, 6], 0),
  boundary: Array.from({ length: 36 }, (_, i) => ({ cell: [i % 6, 2, Math.floor(i / 6)] as const, face: "+y" as const, socket: base })),
};

function grid(count: number): WorldState {
  const created = createWorld({ catalog, seed: 1 });
  if (!created.ok) throw new Error("world failed to build");
  const side = Math.ceil(Math.sqrt(count));
  const ops: WorldOp[] = [];
  for (let i = 0; i < count; i++) ops.push({ op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [100 + (i % side) * 2, 0, 100 + Math.floor(i / side) * 2], rotation: 0 });
  const result = applyPatch(catalog, created.value, { baseRevision: 0, ops, origin: { kind: "command", id: "bench" } });
  if (!result.ok) throw new Error("grid failed to commit");
  return result.value.state;
}

const region: Region = { min: [0, 0, 0], max: [7, 3, 7] };
function prepared(state: WorldState) {
  const job = prepareRegion(catalog, state, { region, seed: 1, airWeight: 8, ground: { y: 0, profile: "ground" }, budget: { maxNodes: 200_000, maxBacktracks: 20_000 } });
  if (!job.ok) throw new Error("region failed to prepare");
  const outcome = solve(town, job.value.problem);
  if (outcome.kind !== "solved") throw new Error("region failed to solve");
  return proposalOf(job.value, outcome, { kind: "job", id: "bench" });
}

const worlds = [100, 1_000, 10_000].map((count) => {
  const state = grid(count);
  return { count, state, proposal: prepared(state) };
});

let seed = 0;

test("solve", async ({ bench }) => {
  await bench.compare(
    bench("compile the town tile set (7 tiles)", () => {
      compileTiles(catalog, TOWN);
    }),
    bench("solve town 8x4x8 (256 cells), a new seed each run", () => {
      solve(town, problem([8, 4, 8], (seed += 1)));
    }),
    bench("solve town 16x8x16 (2,048 cells, Local WFC target size), a new seed each run", () => {
      solve(town, problem([16, 8, 16], (seed += 1)));
    }),
    bench("solve town 28x8x28 (6,272 cells), a new seed each run", () => {
      solve(town, problem([28, 8, 28], (seed += 1)));
    }),
    bench("pack 6x3x6 completely with L-blocks and columns (backtracking), a new seed each run", () => {
      solve(packing.value, { ...roofed, seed: (seed += 1) });
    }),
    OPTIONS,
  );
});

test("transactions at scale", async ({ bench }) => {
  await bench.compare(
    ...worlds.flatMap(({ count, state, proposal }) => [
      bench(`readRegion 8x4x8 in a ${count}-entity world`, () => {
        readRegion(catalog, state, region);
      }),
      bench(`applyProposal (8x4x8 solved region) into a ${count}-entity world`, () => {
        applyProposal(catalog, state, proposal);
      }),
    ]),
    OPTIONS,
  );
});
