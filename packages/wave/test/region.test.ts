import { presetCatalog, type Catalog } from "@eschaton/foldon";
import { compileTiles, prepareRegion, proposalOf, solve, type RegionRequest, type TileSpec } from "@eschaton/wave";
import {
  applyPatch,
  applyProposal,
  checkInvariants,
  createWorld,
  hashState,
  replay,
  type CommitRecord,
  type Entity,
  type Region,
  type WorldOp,
  type WorldState,
} from "@eschaton/world";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!presetCatalog.ok) throw new Error("the preset catalog must build");
  return presetCatalog.value;
})();

const tile = (kind: "foldon" | "assembly", id: string, weight: number): TileSpec => ({ ref: { kind, id }, weight });
const tiles = (() => {
  const result = compileTiles(catalog, [tile("foldon", "P08", 6), tile("foldon", "P03", 3), tile("assembly", "roof-module", 2), tile("assembly", "l-block", 2), tile("assembly", "column-3", 2)]);
  if (!result.ok) throw new Error(result.error.join("; "));
  return result.value;
})();

const origin = { kind: "job", id: "wave-test" } as const;
const region: Region = { min: [0, 0, 0], max: [7, 3, 7] };
const request = (seed: number, extra: Partial<RegionRequest> = {}): RegionRequest => ({
  region,
  seed,
  airWeight: 4,
  ground: { y: 0, profile: "ground" },
  budget: { maxNodes: 20_000, maxBacktracks: 2_000 },
  ...extra,
});

let log: CommitRecord[] = [];
let initial: WorldState;
function commit(state: WorldState, ...ops: WorldOp[]): WorldState {
  const result = applyPatch(catalog, state, { baseRevision: state.header.revision, ops, origin: { kind: "command", id: "test" } });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  log.push(result.value.record);
  return result.value.state;
}

function village(): WorldState {
  log = [];
  const created = createWorld({ catalog, seed: 42 });
  if (!created.ok) throw new Error("world must build");
  initial = created.value;
  return commit(
    created.value,
    { op: "instantiate", ref: { kind: "assembly", id: "watchtower" }, anchor: [3, 0, 3], rotation: 0 },
    { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [8, 0, 2], rotation: 0 },
    { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [30, 0, 30], rotation: 0 },
  );
}

function solved(state: WorldState, seed: number, extra: Partial<RegionRequest> = {}) {
  const job = prepareRegion(catalog, state, request(seed, extra));
  if (!job.ok) throw new Error(job.error.join("; "));
  const outcome = solve(tiles, job.value.problem);
  if (outcome.kind !== "solved") throw new Error(outcome.kind);
  return { job: job.value, outcome, proposal: proposalOf(job.value, outcome, origin) };
}

const byId = (state: WorldState): ReadonlyMap<string, Entity> => new Map(state.entities.map((entity) => [entity.id, entity]));

test("a region solved around pinned and frozen entities commits as one revision and keeps every existing entity identical", () => {
  const before = village();
  const { proposal, outcome } = solved(before, 1);
  const result = applyProposal(catalog, before, proposal);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  const after = result.value.state;
  expect(checkInvariants(catalog, after)).toEqual([]);
  expect([after.header.revision, outcome.placements.length > 5]).toEqual([before.header.revision + 1, true]);
  const kept = byId(after);
  expect(before.entities.map((entity) => kept.get(entity.id))).toEqual(before.entities);
});

test("the same world, request and seed give the same committed state hash", () => {
  const hashes = [0, 1].map(() => {
    const before = village();
    const result = applyProposal(catalog, before, solved(before, 9).proposal);
    return result.ok ? hashState(result.value.state) : "rejected";
  });
  expect(hashes[0]).toBe(hashes[1]);
});

test("several seeds give different valid arrangements around the same pins", () => {
  const before = village();
  const hashes = [1, 2, 3, 4, 5].map((seed) => {
    const result = applyProposal(catalog, before, solved(before, seed).proposal);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(checkInvariants(catalog, result.value.state)).toEqual([]);
    return hashState(result.value.state);
  });
  expect(new Set(hashes).size).toBe(5);
});

test("a solve that raced with an unrelated commit still commits, and one that raced with a commit in its region is a conflict", () => {
  const before = village();
  const { proposal } = solved(before, 3);
  const elsewhere = commit(before, { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [40, 0, 40], rotation: 0 });
  const inside = commit(before, { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [0, 0, 7], rotation: 0 });
  const [far, near] = [applyProposal(catalog, elsewhere, proposal), applyProposal(catalog, inside, proposal)];
  expect([far.ok ? "committed" : far.error.kind, near.ok ? "committed" : near.error.kind]).toEqual(["committed", "conflict"]);
});

test("a rebased wave commit replays from the log to the same state hash", () => {
  const before = village();
  const { proposal } = solved(before, 4);
  const later = commit(before, { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [40, 0, 40], rotation: 0 });
  const result = applyProposal(catalog, later, proposal);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  const replayed = replay(catalog, initial, [...log, result.value.record]);
  expect(replayed.ok ? hashState(replayed.value) : "diverged").toBe(hashState(result.value.state));
});

test("generation is refused before solving while conservation is closed", () => {
  const closed = commit(village(), { op: "conserve" });
  const job = prepareRegion(catalog, closed, request(1));
  expect(job.ok ? [] : job.error.length).toBe(1);
});

test("a cleared entity is consumed and its cells are solved again, while a straddling entity cannot be cleared", () => {
  const before = commit(village(), { op: "instantiate", ref: { kind: "foldon", id: "P03" }, anchor: [0, 0, 0], rotation: 0 });
  const roof = before.entities.at(-1);
  const straddler = before.entities.find((entity) => entity.owner.kind === "placed" && entity.owner.anchor[0] === 8);
  if (roof === undefined || straddler === undefined) throw new Error("fixtures must exist");
  const { proposal } = solved(before, 2, { clear: [roof.id] });
  const result = applyProposal(catalog, before, proposal);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  expect(byId(result.value.state).get(roof.id)?.owner.kind).toBe("consumed");
  const refused = prepareRegion(catalog, before, request(2, { clear: [straddler.id] }));
  expect(refused.ok).toBe(false);
});

test("a region that cannot support the entity pinned above it is unsatisfiable", () => {
  const before = village();
  const roofs = compileTiles(catalog, [tile("assembly", "roof-house", 1)]);
  if (!roofs.ok) throw new Error("tiles must compile");
  const tight: Region = { min: [3, 7, 3], max: [4, 7, 4] };
  const job = prepareRegion(catalog, commit(before, { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [3, 8, 3], rotation: 0 }), { ...request(1), region: tight });
  if (!job.ok) throw new Error(job.error.join("; "));
  expect(solve(roofs.value, job.value.problem).kind).toBe("unsatisfiable");
});
