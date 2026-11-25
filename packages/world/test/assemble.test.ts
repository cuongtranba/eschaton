import {
  assemblyCatalog,
  assemblyId,
  createCatalog,
  foldonId,
  moduleContracts,
  placementId,
  primitiveCatalog,
  type AssemblyRecipe,
  type Catalog,
} from "@eschaton/foldon";
import {
  applyPatch,
  assemble,
  cellOccupant,
  checkInvariants,
  createWorld,
  hashState,
  storeId,
  type EntityId,
  type WorldOp,
  type WorldState,
} from "@eschaton/world";
import { expect, test } from "vitest";

const slopeRow: AssemblyRecipe = {
  id: assemblyId("slope-row"),
  version: 1,
  name: "Slope row",
  level: 1,
  tags: ["test"],
  parts: [
    { id: placementId("front"), ref: { kind: "foldon", id: foldonId("P03"), version: 1 }, anchor: [0, 0, 0], rotation: 0 },
    { id: placementId("back"), ref: { kind: "foldon", id: foldonId("P03"), version: 1 }, anchor: [0, 0, 2], rotation: 0 },
  ],
};

const catalog: Catalog = (() => {
  const built = createCatalog({ foldons: primitiveCatalog, assemblies: [...assemblyCatalog, slopeRow], contracts: moduleContracts });
  if (!built.ok) throw new Error(JSON.stringify(built.error));
  return built.value;
})();

const bin = storeId("bin");

function commit(state: WorldState, ...ops: WorldOp[]): WorldState {
  const result = applyPatch(catalog, state, { baseRevision: state.header.revision, ops, origin: { kind: "command", id: "test" } });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value.state;
}

function stored(target: string): { state: WorldState; ids: readonly EntityId[] } {
  const created = createWorld({ catalog, seed: 2 });
  if (!created.ok) throw new Error("world must build");
  const built = commit(created.value, { op: "instantiate", ref: { kind: "assembly", id: target }, anchor: [0, 0, 0], rotation: 0 });
  const ids = built.entities.map((entity) => entity.id);
  return { state: commit(built, ...ids.map((entity): WorldOp => ({ op: "store", entity, store: bin }))), ids };
}

test("a roof-module is reassembled from inventory fragments with the same entity ids", () => {
  const { state, ids } = stored("roof-module");
  const result = assemble(catalog, state, { target: { id: "roof-module" }, anchor: [10, 0, 10], rotation: 2, from: bin });
  if (!result.ok) throw new Error(JSON.stringify(result.error.rejection));
  const placed = result.value.state.entities.filter((entity) => entity.owner.kind === "placed").map((entity) => entity.id);
  expect(placed.toSorted()).toEqual([...ids].sort());
  expect(result.value.state.entities).toHaveLength(ids.length);
});

test("an inventory missing one piece fails before committing anything and leaves the world unchanged", () => {
  const { state, ids } = stored("roof-module");
  const [first] = ids;
  if (first === undefined) throw new Error("pieces expected");
  const short = commit(state, { op: "consume", entity: first });
  const result = assemble(catalog, short, { target: { id: "roof-module" }, anchor: [10, 0, 10], rotation: 0, from: bin });
  expect(result.ok ? undefined : [result.error.records.length, result.error.state]).toEqual([0, short]);
});

test("self-assembly in closed conservation mode leaves material totals unchanged", () => {
  const { state } = stored("watchtower");
  const closed = commit(state, { op: "conserve" });
  const result = assemble(catalog, closed, { target: { id: "watchtower" }, anchor: [20, 0, 0], rotation: 1, from: bin });
  if (!result.ok) throw new Error(JSON.stringify(result.error.rejection));
  expect(result.value.records).toHaveLength(closed.entities.length);
  expect(checkInvariants(catalog, result.value.state)).toEqual([]);
  expect(result.value.state.conservation).toEqual(closed.conservation);
});

test("reassembly into a different valid structure succeeds", () => {
  const { state, ids } = stored("roof-module");
  const result = assemble(catalog, state, { target: { id: "slope-row" }, anchor: [4, 0, 4], rotation: 0, from: bin });
  if (!result.ok) throw new Error(JSON.stringify(result.error.rejection));
  expect([cellOccupant(catalog, result.value.state, [4, 0, 4]), cellOccupant(catalog, result.value.state, [4, 0, 6])].sort()).toEqual([...ids].sort());
});

test("a self-assembly stops at the first rejected step and keeps the last valid state", () => {
  const { state } = stored("watchtower");
  const blocked = commit(state, { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [30, 3, 0], rotation: 0 });
  const result = assemble(catalog, blocked, { target: { id: "watchtower" }, anchor: [30, 0, 0], rotation: 0, from: bin });
  if (result.ok) throw new Error("the blocked cell must stop the assembly");
  const { state: last, records } = result.error;
  expect(records.length).toBeGreaterThan(0);
  expect(last.header.revision).toBe(blocked.header.revision + records.length);
  expect(hashState(last)).toBe(records.at(-1)?.stateHash);
  expect(last.entities.filter((entity) => entity.owner.kind === "placed" && entity.owner.anchor[1] >= 3)).toHaveLength(1);
});
