import { presetCatalog, type Catalog, type Cell } from "@eschaton/foldon";
import {
  applyPatch,
  cellOccupant,
  checkInvariants,
  createWorld,
  runSystem,
  windFold,
  type Entity,
  type System,
  type WorldOp,
  type WorldState,
} from "@eschaton/world";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!presetCatalog.ok) throw new Error("the preset catalog must build");
  return presetCatalog.value;
})();

function commit(state: WorldState, ...ops: WorldOp[]): WorldState {
  const result = applyPatch(catalog, state, { baseRevision: state.header.revision, ops, origin: { kind: "command", id: "test" } });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value.state;
}

const garden = (): WorldState => {
  const created = createWorld({ catalog, seed: 1 });
  if (!created.ok) throw new Error("world must build");
  return commit(
    created.value,
    { op: "instantiate", ref: { kind: "assembly", id: "roof-module" }, anchor: [0, 0, 0], rotation: 0 },
    { op: "instantiate", ref: { kind: "foldon", id: "leaf" }, anchor: [5, 0, 0], rotation: 0 },
    { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [8, 0, 0], rotation: 0 },
  );
};

const byDefinition = (state: WorldState, id: string): readonly Entity[] => state.entities.filter((entity) => entity.definition.id === id);

function blow(state: WorldState, strength: number) {
  const result = runSystem(catalog, state, windFold, { wind: [strength, 0, 0] });
  if (result.ok) expect(checkInvariants(catalog, result.value.state)).toEqual([]);
  return result;
}

test("wind folds both a roof and a leaf through the same system", () => {
  const before = garden();
  const after = blow(before, 0.1);
  if (!after.ok) throw new Error(JSON.stringify(after.error));
  const changed = (id: string) => byDefinition(after.value.state, id).map((e, i) => JSON.stringify(e.fold) !== JSON.stringify(byDefinition(before, id)[i]?.fold));
  expect([...changed("P03"), ...changed("leaf")]).toEqual([true, true, true]);
});

test("an entity without wind-responsive is not folded", () => {
  const before = garden();
  const after = blow(before, 0.1);
  if (!after.ok) throw new Error(JSON.stringify(after.error));
  expect(byDefinition(after.value.state, "P08")[0]?.fold).toEqual(byDefinition(before, "P08")[0]?.fold);
});

test("a fold target outside a crease range is rejected and nothing changes", () => {
  const before = garden();
  const result = blow(before, 1);
  expect(result.ok ? [] : result.error.kind === "invalid" ? result.error.issues.map((i) => i.code) : []).toEqual(["fold-invalid"]);
});

test("folding never changes occupancy", () => {
  const before = garden();
  const after = blow(before, 0.1);
  if (!after.ok) throw new Error(JSON.stringify(after.error));
  const cells: Cell[] = [];
  for (let x = -1; x < 11; x++) for (let z = -1; z < 3; z++) cells.push([x, 0, z]);
  expect(cells.map((cell) => cellOccupant(catalog, after.value.state, cell))).toEqual(cells.map((cell) => cellOccupant(catalog, before, cell)));
});

test("a system cannot change entities outside its declared components", () => {
  const before = garden();
  const box = byDefinition(before, "P08")[0];
  if (box === undefined) throw new Error("box expected");
  const rogue: System<null> = { id: "rogue", reads: ["wind-responsive"], plan: () => ({ ok: true, value: [{ op: "detach", entity: box.id }] }) };
  const result = runSystem(catalog, before, rogue, null);
  expect(result.ok ? [] : result.error.kind === "invalid" ? result.error.issues.map((i) => i.code) : []).toEqual(["op-invalid"]);
});
