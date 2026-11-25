import {
  assemblyCatalog,
  assemblyId,
  createCatalog,
  defaultCatalog,
  moduleContracts,
  placementId,
  primitiveCatalog,
  type AssemblyRecipe,
  type Catalog,
} from "@eschaton/foldon";
import { applyPatch, cellOccupant, checkInvariants, createWorld, type WorldOp, type WorldState } from "@eschaton/world";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!defaultCatalog.ok) throw new Error("the default catalog must build");
  return defaultCatalog.value;
})();

function world(using: Catalog = catalog): WorldState {
  const created = createWorld({ catalog: using, seed: 3 });
  if (!created.ok) throw new Error("world must build");
  return created.value;
}

function apply(state: WorldState, ops: readonly WorldOp[], using: Catalog = catalog) {
  const result = applyPatch(using, state, { baseRevision: state.header.revision, ops, origin: { kind: "command", id: "test" } });
  if (result.ok) expect(checkInvariants(using, result.value.state)).toEqual([]);
  return result;
}

function commit(state: WorldState, ops: readonly WorldOp[], using: Catalog = catalog): WorldState {
  const result = apply(state, ops, using);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value.state;
}

const roofModule = (x: number, z: number, rotation: 0 | 1 | 2 | 3 = 0): WorldOp => ({
  op: "instantiate",
  ref: { kind: "assembly", id: "roof-module" },
  anchor: [x, 0, z],
  rotation,
});

test("instantiating the same assembly twice at overlapping anchors rejects the second patch", () => {
  const once = commit(world(), [roofModule(0, 0)]);
  const twice = apply(once, [roofModule(1, 0)]);
  expect(twice.ok ? [] : twice.error.kind === "invalid" ? twice.error.issues.map((i) => i.code) : []).toContain("cell-occupied");
});

test("instantiating the same assembly at two world poses yields disjoint entity ids and occupied cells", () => {
  const state = commit(world(), [roofModule(0, 0), roofModule(10, 0, 1)]);
  const groups = new Set(state.entities.map((entity) => entity.group));
  const ids = new Set(state.entities.map((entity) => entity.id));
  expect([groups.size, ids.size]).toEqual([2, state.entities.length]);
  expect(cellOccupant(catalog, state, [10, 0, 0])).not.toBe(cellOccupant(catalog, state, [0, 0, 0]));
});

test("entity ids do not depend on recipe part ids", () => {
  const original = assemblyCatalog.find((recipe) => recipe.id === assemblyId("roof-module"));
  if (original === undefined) throw new Error("roof-module recipe must exist");
  const renamed: AssemblyRecipe = { ...original, parts: original.parts.map((part, i) => ({ ...part, id: placementId(`renamed-${i}`) })).reverse() };
  const catalogOf = (recipe: AssemblyRecipe): Catalog => {
    const built = createCatalog({ foldons: primitiveCatalog, assemblies: [recipe], contracts: moduleContracts });
    if (!built.ok) throw new Error(JSON.stringify(built.error));
    return built.value;
  };
  const idsFor = (using: Catalog) =>
    commit(world(using), [roofModule(0, 0)], using).entities.map((entity) => [entity.id, entity.definition.id, entity.owner]);
  expect(idsFor(catalogOf(renamed))).toEqual(idsFor(catalogOf(original)));
});

test("touching entities with incompatible sockets are rejected", () => {
  const roof = commit(world(), [{ op: "instantiate", ref: { kind: "foldon", id: "P03" }, anchor: [0, 0, 0], rotation: 0 }]);
  const beside = apply(roof, [{ op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [1, 0, 0], rotation: 0 }]);
  expect(beside.ok ? [] : beside.error.kind === "invalid" ? beside.error.issues.map((i) => i.code) : []).toEqual(["socket-incompatible"]);
});

test("instantiating an unknown definition is rejected without minting anything", () => {
  const result = apply(world(), [{ op: "instantiate", ref: { kind: "foldon", id: "P99" }, anchor: [0, 0, 0], rotation: 0 }]);
  expect(result.ok ? [] : result.error.kind === "invalid" ? result.error.issues.map((i) => i.code) : []).toEqual(["ref-unknown"]);
});
