import {
  allRotations,
  assemblyId,
  contractId,
  createCatalog,
  foldonId,
  placementId,
  primitiveCatalog,
  type AssemblyPart,
  type AssemblyRecipe,
  type Catalog,
  type ModuleContract,
  type Rotation,
} from "@eschaton/foldon";
import { applyPatch, assemble, createWorld, storeId, type WorldOp, type WorldState } from "@eschaton/world";
import { expect, test } from "vitest";

const slope = (id: string, x: number, z: number): AssemblyPart => ({
  id: placementId(id),
  ref: { kind: "foldon", id: foldonId("P03"), version: 1 },
  anchor: [x, 0, z],
  rotation: 0,
});

const longContract: ModuleContract = {
  id: contractId("module-2x4"),
  version: 1,
  name: "2x4 module",
  size: { x: 2, z: 4 },
  boundary: { "-y": ["base"] },
};

const longRoof: AssemblyRecipe = {
  id: assemblyId("long-roof"),
  version: 1,
  name: "Long roof",
  level: 1,
  tags: ["test"],
  contract: { id: longContract.id, version: 1 },
  parts: [slope("a", 0, 0), slope("b", 1, 0), slope("c", 0, 2), slope("d", 1, 2)],
};

const roofPair: AssemblyRecipe = {
  id: assemblyId("roof-pair"),
  version: 1,
  name: "Two long roofs, the second quarter-turned",
  level: 2,
  tags: ["test"],
  parts: [
    { id: placementId("north"), ref: { kind: "assembly", id: longRoof.id, version: 1 }, anchor: [0, 0, 0], rotation: 0 },
    { id: placementId("east"), ref: { kind: "assembly", id: longRoof.id, version: 1 }, anchor: [6, 0, 0], rotation: 1 },
  ],
};

const catalog: Catalog = (() => {
  const built = createCatalog({ foldons: primitiveCatalog, assemblies: [longRoof, roofPair], contracts: [longContract] });
  if (!built.ok) throw new Error(JSON.stringify(built.error));
  return built.value;
})();

const bin = storeId("bin");

function commit(state: WorldState, ...ops: WorldOp[]): WorldState {
  const result = applyPatch(catalog, state, { baseRevision: state.header.revision, ops, origin: { kind: "command", id: "test" } });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value.state;
}

const empty = (): WorldState => {
  const created = createWorld({ catalog, seed: 4 });
  if (!created.ok) throw new Error("world must build");
  return created.value;
};

const placedCells = (state: WorldState): readonly string[] =>
  state.entities.flatMap((e) => (e.owner.kind === "placed" ? [`${e.owner.anchor.join(",")}@${e.owner.rotation}`] : [])).sort();

function bothWays(target: string, rotation: Rotation): readonly (readonly string[])[] {
  const instantiated = commit(empty(), { op: "instantiate", ref: { kind: "assembly", id: target }, anchor: [20, 0, 20], rotation });
  const parts = commit(empty(), { op: "instantiate", ref: { kind: "assembly", id: target }, anchor: [0, 0, 0], rotation: 0 });
  const stored = commit(parts, ...parts.entities.map((e): WorldOp => ({ op: "store", entity: e.id, store: bin })));
  const assembled = assemble(catalog, stored, { target: { id: target }, anchor: [20, 0, 20], rotation, from: bin });
  return [placedCells(instantiated), assembled.ok ? placedCells(assembled.value.state) : [JSON.stringify(assembled.error.rejection)]];
}

test("an assembly with an asymmetric module contract self-assembles at every rotation at which it can be instantiated", () => {
  for (const rotation of allRotations) {
    const [instantiated, assembled] = bothWays("long-roof", rotation);
    expect(assembled).toEqual(instantiated);
  }
});

test("an assembly nesting a quarter-turned contracted module is placed identically by instantiate and by self-assembly", () => {
  for (const rotation of allRotations) {
    const [instantiated, assembled] = bothWays("roof-pair", rotation);
    expect(assembled).toEqual(instantiated);
  }
});
