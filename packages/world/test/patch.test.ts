import { createCatalog, defaultCatalog, primitiveCatalog, type Catalog } from "@eschaton/foldon";
import {
  applyPatch,
  checkInvariants,
  createWorld,
  hashState,
  replay,
  type CommitRecord,
  type WorldOp,
  type WorldState,
} from "@eschaton/world";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!defaultCatalog.ok) throw new Error("the default catalog must build");
  return defaultCatalog.value;
})();

const origin = { kind: "command", id: "test" } as const;

function emptyWorld(): WorldState {
  const world = createWorld({ catalog, seed: 11 });
  if (!world.ok) throw new Error("world must build");
  return world.value;
}

function commit(state: WorldState, ...ops: WorldOp[]): { state: WorldState; record: CommitRecord } {
  const result = applyPatch(catalog, state, { baseRevision: state.header.revision, ops, origin });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  expect(checkInvariants(catalog, result.value.state)).toEqual([]);
  return result.value;
}

const box = (x: number, z: number): WorldOp => ({ op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [x, 0, z], rotation: 0 });

test("a committed patch raises the revision by exactly one", () => {
  const first = commit(emptyWorld(), { op: "annotate", note: "start" });
  const second = commit(first.state, box(0, 0));
  expect([first.record.revision, second.state.header.revision]).toEqual([1, 2]);
});

test("a stale patch is rejected and consumes no revision", () => {
  const world = commit(emptyWorld(), box(0, 0)).state;
  const stale = applyPatch(catalog, world, { baseRevision: 0, ops: [box(5, 5)], origin });
  expect(stale).toEqual({ ok: false, error: { kind: "stale", base: 0, current: 1 } });
});

test("a proposal whose read region was untouched by an intervening commit is still rejected under strict equality", () => {
  const base = emptyWorld();
  const proposal = { baseRevision: base.header.revision, ops: [box(40, 40)], origin: { kind: "job", id: "far-region" } } as const;
  const elsewhere = commit(base, box(0, 0)).state;
  expect(applyPatch(catalog, elsewhere, proposal).ok).toBe(false);
});

test("a patch whose final op is invalid leaves none of its earlier ops applied", () => {
  const world = emptyWorld();
  const result = applyPatch(catalog, world, { baseRevision: 0, ops: [box(0, 0), box(1, 0), box(0, 0)], origin });
  expect(result.ok ? [] : result.error.kind === "invalid" ? result.error.issues.map((i) => i.code) : []).toEqual(["cell-occupied"]);
  expect(world.entities).toEqual([]);
});

test("replaying the commit log reproduces the live state hash", () => {
  const initial = emptyWorld();
  const a = commit(initial, box(0, 0), box(2, 0));
  const b = commit(a.state, { op: "instantiate", ref: { kind: "assembly", id: "roof-module" }, anchor: [6, 0, 0], rotation: 1 });
  const replayed = replay(catalog, initial, [a.record, b.record]);
  expect(replayed.ok ? hashState(replayed.value) : "diverged").toBe(hashState(b.state));
});

test("a corrupted commit record is reported as a divergence at its revision", () => {
  const initial = emptyWorld();
  const a = commit(initial, box(0, 0));
  const b = commit(a.state, box(3, 0));
  const tampered: CommitRecord = { ...b.record, patch: { ...b.record.patch, ops: [box(4, 0)] } };
  const replayed = replay(catalog, initial, [a.record, tampered]);
  expect(replayed.ok ? undefined : { revision: replayed.error.revision, reason: replayed.error.reason }).toEqual({ revision: 2, reason: "hash-mismatch" });
});

test("replay against a different catalog version is refused", () => {
  const initial = emptyWorld();
  const a = commit(initial, box(0, 0));
  const other = createCatalog({ foldons: primitiveCatalog, assemblies: [] });
  if (!other.ok) throw new Error("primitive catalog must build");
  const replayed = replay(other.value, initial, [a.record]);
  expect(replayed.ok ? undefined : replayed.error.reason).toBe("version-mismatch");
});
