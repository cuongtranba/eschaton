import { fnv1a64, foldonId, placeSockets, presetCatalog, type Catalog, type Cell } from "@eschaton/foldon";
import { compileTiles, solve, type CompiledTiles, type TileSpec, type WaveOutcome, type WaveProblem } from "@eschaton/wave";
import { applyPatch, cellOccupant, checkInvariants, createWorld, type WorldOp } from "@eschaton/world";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!presetCatalog.ok) throw new Error("the preset catalog must build");
  return presetCatalog.value;
})();

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

function compiled(tiles: readonly TileSpec[] = TOWN): CompiledTiles {
  const result = compileTiles(catalog, tiles);
  if (!result.ok) throw new Error(result.error.join("; "));
  return result.value;
}

const problem = (size: Cell, seed: number, extra: Partial<WaveProblem> = {}): WaveProblem => ({
  size,
  seed,
  airWeight: 4,
  ground: { profile: "ground" },
  budget: { maxNodes: 20_000, maxBacktracks: 2_000 },
  ...extra,
});

const digest = (outcome: WaveOutcome): string =>
  outcome.kind === "solved"
    ? fnv1a64(outcome.placements.map((p) => `${p.ref.id}@${p.anchor.join(",")}r${p.rotation}`).sort().join(";"))
    : outcome.kind;

function worldIssues(outcome: WaveOutcome): readonly string[] {
  if (outcome.kind !== "solved") return [outcome.kind];
  const world = createWorld({ catalog, seed: 1 });
  if (!world.ok) return ["world"];
  const ops = outcome.placements.map((p): WorldOp => ({ op: "instantiate", ref: p.ref, anchor: p.anchor, rotation: p.rotation }));
  if (ops.length === 0) return [];
  const committed = applyPatch(catalog, world.value, { baseRevision: 0, ops, origin: { kind: "job", id: "test" } });
  if (!committed.ok) return committed.error.kind === "invalid" ? committed.error.issues.map((i) => i.code) : ["stale"];
  return checkInvariants(catalog, committed.value.state).map((i) => i.code);
}

test("the same tiles, seed and region give the same placements", () => {
  const tiles = compiled();
  expect(digest(solve(tiles, problem([8, 4, 8], 7)))).toBe(digest(solve(compiled(), problem([8, 4, 8], 7))));
});

test("every solved region of a seed corpus is accepted by the world as overlap-free and legally adjacent", () => {
  const tiles = compiled();
  const results = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => worldIssues(solve(tiles, problem([6, 4, 6], seed))));
  expect(results).toEqual(results.map(() => []));
});

test("different seeds give different arrangements", () => {
  const tiles = compiled();
  const digests = new Set([11, 12, 13, 14, 15, 16].map((seed) => digest(solve(tiles, problem([8, 4, 8], seed)))));
  expect(digests.size).toBeGreaterThanOrEqual(5);
});

test("a solved region uses multi-cell and irregular pieces and leaves explicit air", () => {
  const outcome = solve(compiled(), problem([10, 5, 10], 3));
  if (outcome.kind !== "solved") throw new Error(outcome.kind);
  const used = new Set(outcome.placements.map((p) => p.ref.id));
  expect([used.has("l-block"), used.has("column-3") || used.has("roof-house"), outcome.airCells > 0, outcome.placements.length > 10]).toEqual([true, true, true, true]);
});

test("no piece that needs support floats over air", () => {
  const outcome = solve(compiled(), problem([6, 5, 6], 21));
  if (outcome.kind !== "solved") throw new Error(outcome.kind);
  const world = createWorld({ catalog, seed: 1 });
  if (!world.ok) throw new Error("world must build");
  const committed = applyPatch(catalog, world.value, {
    baseRevision: 0,
    ops: outcome.placements.map((p): WorldOp => ({ op: "instantiate", ref: p.ref, anchor: p.anchor, rotation: p.rotation })),
    origin: { kind: "job", id: "test" },
  });
  if (!committed.ok) throw new Error("the solved region must commit");
  const { state } = committed.value;
  const floating = state.entities.flatMap((entity) => {
    const definition = catalog.foldon(entity.definition.id, entity.definition.version);
    if (definition === undefined || entity.owner.kind !== "placed") return [];
    return placeSockets(definition, entity.owner)
      .filter((socket) => socket.profile === "base" && socket.cell[1] > 0)
      .filter((socket) => cellOccupant(catalog, state, [socket.cell[0], socket.cell[1] - 1, socket.cell[2]]) === undefined)
      .map(() => entity.id);
  });
  expect(state.entities.some((entity) => entity.owner.kind === "placed" && entity.owner.anchor[1] > 0)).toBe(true);
  expect(floating).toEqual([]);
});

test("a cell that can hold neither a tile nor air makes the region unsatisfiable", () => {
  const base = catalog.foldon(foldonId("P08"))?.sockets.find((socket) => socket.face === "-y");
  if (base === undefined) throw new Error("P08 must have a bottom socket");
  const roofOnly = compiled([tile("foldon", "P03", 1)]);
  const underBox = solve(roofOnly, problem([1, 1, 2], 1, { boundary: [{ cell: [0, 0, 0], face: "+y", socket: base }] }));
  expect(underBox.kind).toBe("unsatisfiable");
});

test("a budget too small for the region ends as budget-exceeded with no placements", () => {
  const outcome = solve(compiled(), problem([8, 4, 8], 5, { budget: { maxNodes: 10, maxBacktracks: 0 } }));
  expect(outcome.kind === "budget-exceeded" ? ["budget-exceeded", outcome.stats.nodes, Object.keys(outcome).sort()] : outcome.kind).toEqual(["budget-exceeded", 10, ["kind", "stats"]]);
});

test("blocked cells stay empty and their sockets constrain the neighbours", () => {
  const wall = catalog.foldon(foldonId("P08"))?.sockets.find((socket) => socket.face === "+x");
  if (wall === undefined) throw new Error("P08 must have a side socket");
  const boxesOnly = compiled([tile("foldon", "P03", 1)]);
  const outcome = solve(boxesOnly, problem([2, 1, 2], 1, { blocked: [[0, 0, 0], [0, 0, 1]], boundary: [{ cell: [1, 0, 0], face: "-x", socket: wall }, { cell: [1, 0, 1], face: "-x", socket: wall }] }));
  expect(outcome.kind === "solved" ? [outcome.placements.length, outcome.airCells] : outcome.kind).toEqual([0, 2]);
});

test("a malformed problem is reported as invalid, not solved", () => {
  expect(solve(compiled(), problem([0, 1, 1], 1)).kind).toBe("invalid");
});

function roofedOver(size: Cell): Pick<WaveProblem, "boundary"> {
  const base = catalog.foldon(foldonId("P08"))?.sockets.find((socket) => socket.face === "-y");
  if (base === undefined) throw new Error("P08 must have a bottom socket");
  const boundary = [];
  for (let x = 0; x < size[0]; x++) for (let z = 0; z < size[2]; z++) boundary.push({ cell: [x, size[1] - 1, z] as const, face: "+y" as const, socket: base });
  return { boundary };
}

test("a packing that propagation alone cannot refute is found unsatisfiable by exhausting the search", () => {
  const trominoes = compiled([tile("assembly", "l-block", 1)]);
  const outcome = solve(trominoes, problem([2, 1, 2], 1, roofedOver([2, 1, 2])));
  expect(outcome.kind === "unsatisfiable" ? [outcome.kind, outcome.stats.nodes > 0] : outcome.kind).toEqual(["unsatisfiable", true]);
});

test("a search that must backtrack still ends in a valid, completely filled region", () => {
  const tiles = compiled([tile("assembly", "l-block", 3), tile("assembly", "column-3", 1)]);
  const size: Cell = [4, 3, 3];
  const outcomes = [1, 2, 3, 4, 5, 6].map((seed) => solve(tiles, problem(size, seed, roofedOver(size))));
  expect(outcomes.map((outcome) => (outcome.kind === "solved" ? outcome.airCells : outcome.kind))).toEqual(outcomes.map(() => 0));
  expect(outcomes.reduce((sum, outcome) => sum + (outcome.kind === "solved" ? outcome.stats.backtracks : 0), 0)).toBeGreaterThan(0);
  expect(outcomes.map(worldIssues)).toEqual(outcomes.map(() => []));
});
