import { presetCatalog, type Catalog } from "@eschaton/foldon";
import { auditDistrict, continueFrom, generateDistrict, lastDistrict, settleDistrict, type DistrictOutcome } from "@eschaton/genesis";
import { applyPatch, checkInvariants, createWorld, hashState, replay, type WorldOp, type WorldState } from "@eschaton/world";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!presetCatalog.ok) throw new Error("the preset catalog must build");
  return presetCatalog.value;
})();

const live = { cancelRequested: false } as const;
const origin = { kind: "command", id: "test" } as const;

function emptyWorld(): WorldState {
  const created = createWorld({ catalog, seed: 20_261_125 });
  if (!created.ok) throw new Error("world must build");
  return created.value;
}

function commit(state: WorldState, ...ops: WorldOp[]): WorldState {
  const result = applyPatch(catalog, state, { baseRevision: state.header.revision, ops, origin });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value.state;
}

type Generated = Extract<DistrictOutcome, { kind: "generated" }>;

function generated(state: WorldState, seed: number): Generated {
  const outcome = generateDistrict(catalog, state, { preset: lastDistrict, seed, at: [0, 0, 0] });
  if (outcome.kind !== "generated") throw new Error(`${outcome.stage}: ${outcome.reason}`);
  return outcome;
}

function committedDistrict(seed: number): { before: WorldState; after: WorldState; outcome: Generated } {
  const before = commit(emptyWorld(), { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [-6, 0, -6], rotation: 0 });
  const outcome = generated(before, seed);
  const settled = settleDistrict(catalog, before, outcome, live);
  if (settled.status !== "committed") throw new Error(settled.detail);
  return { before, after: settled.committed.state, outcome };
}

test("a generated district commits as one revision that passes the world invariants and keeps existing entities identical", () => {
  const { before, after, outcome } = committedDistrict(1);
  expect(checkInvariants(catalog, after)).toEqual([]);
  expect([after.header.revision, after.entities[0], outcome.metrics.pieces > 800]).toEqual([before.header.revision + 1, before.entities[0], true]);
});

test("ten seeds give ten distinct districts that all pass the plan validators, the world invariants and the audit", { timeout: 120_000 }, () => {
  const hashes = Array.from({ length: 10 }, (_, i) => {
    const { after, outcome } = committedDistrict(i + 1);
    expect([checkInvariants(catalog, after), auditDistrict(catalog, after, outcome.plan, outcome.at), outcome.metrics.lots.house > 5, outcome.metrics.lots.tower > 0]).toEqual([[], [], true, true]);
    return hashState(after);
  });
  expect(new Set(hashes).size).toBe(10);
});

test("the same seed gives the same committed state hash", () => {
  expect(hashState(committedDistrict(7).after)).toBe(hashState(committedDistrict(7).after));
});

test("a district that cannot meet its road contract fails explicitly and commits nothing", () => {
  const state = emptyWorld();
  const outcome = generateDistrict(catalog, state, { preset: { ...lastDistrict, rules: { ...lastDistrict.rules, maxBridges: 0 } }, seed: 1, at: [0, 0, 0] });
  expect(outcome.kind === "failed" ? outcome.stage : outcome.kind).toBe("plan:roads");
  expect(settleDistrict(catalog, state, outcome, live).status).toBe("failed");
});

test("generation is refused on ground that already holds entities", () => {
  const occupied = commit(emptyWorld(), { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [5, 0, 5], rotation: 0 });
  const outcome = generateDistrict(catalog, occupied, { preset: lastDistrict, seed: 1, at: [0, 0, 0] });
  expect(outcome.kind === "failed" ? outcome.stage : outcome.kind).toBe("world");
});

test("a result whose world would not match its plan is refused by the audit", () => {
  const state = emptyWorld();
  const outcome = generated(state, 2);
  const { ops } = outcome.proposal;
  const firstRoad = ops.findIndex((op) => op.op === "instantiate" && op.ref.id === "paving");
  const firstRoof = ops.findIndex((op) => op.op === "instantiate" && op.ref.id === "P03");
  const tampered = [
    { ...outcome, proposal: { ...outcome.proposal, ops: ops.filter((_, index) => index !== firstRoad) } },
    { ...outcome, proposal: { ...outcome.proposal, ops: ops.map((op, index) => (index === firstRoof && op.op === "instantiate" ? { ...op, anchor: [op.anchor[0], op.anchor[1] + 6, op.anchor[2]] as const } : op)) } },
    { ...outcome, plan: { ...outcome.plan, kinds: outcome.plan.kinds.map((kind) => (kind === "bridge" ? "open" : kind)) } },
    { kind: "generated" },
    "nonsense",
  ];
  expect(tampered.map((result) => settleDistrict(catalog, state, result, live).status)).toEqual(tampered.map(() => "failed"));
});

test("a cancel request wins over a finished generation, and a change in the district box is a conflict", () => {
  const state = emptyWorld();
  const outcome = generated(state, 3);
  const raced = commit(state, { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [20, 0, 20], rotation: 0 });
  expect([settleDistrict(catalog, state, outcome, { cancelRequested: true }).status, settleDistrict(catalog, raced, outcome, live).status]).toEqual(["cancelled", "conflict"]);
});

test("a district that continues a neighbour's road conflicts when that road changes and commits when an unrelated piece does", { timeout: 60_000 }, () => {
  const { after: first, outcome: neighbour } = committedDistrict(4);
  const link = continueFrom(neighbour.plan, neighbour.at, "east");
  const request = { preset: lastDistrict, seed: 9, at: link.at, gates: [...link.gates, { edge: "east", at: 20 } as const], depends: link.depends };
  const second = generateDistrict(catalog, first, request);
  if (second.kind !== "generated") throw new Error(`${second.stage}: ${second.reason}`);
  const road = link.depends[5]?.min;
  const paving = first.entities.find((entity) => entity.owner.kind === "placed" && entity.definition.id === "paving" && entity.owner.anchor.join() === road?.join());
  const house = first.entities.find((entity) => entity.owner.kind === "placed" && entity.definition.id === "P03" && entity.owner.anchor[0] < 20);
  if (paving === undefined || house === undefined) throw new Error("fixtures must exist");
  const roadCut = commit(first, { op: "consume", entity: paving.id });
  const roofGone = commit(first, { op: "consume", entity: house.id });
  expect([link.gates.length > 0, link.depends.length > 5]).toEqual([true, true]);
  expect([settleDistrict(catalog, roadCut, second, live).status, settleDistrict(catalog, roofGone, second, live).status, settleDistrict(catalog, first, second, live).status]).toEqual(["conflict", "committed", "committed"]);
});

test("a committed district replays from the log to the same state hash", () => {
  const start = emptyWorld();
  const settled = settleDistrict(catalog, start, generated(start, 5), live);
  if (settled.status !== "committed") throw new Error(settled.detail);
  const replayed = replay(catalog, start, [settled.committed.record]);
  expect(replayed.ok ? hashState(replayed.value) : "diverged").toBe(hashState(settled.committed.state));
});
