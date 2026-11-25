import { presetCatalog, type Catalog, type Cell, type FoldonDefinition } from "@eschaton/foldon";
import {
  applyPatch,
  cellOccupant,
  checkInvariants,
  createWorld,
  hashState,
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

test("a system that proposes a fold outside a crease range has its whole patch rejected", () => {
  const before = garden();
  const leaf = byDefinition(before, "leaf")[0];
  const roof = byDefinition(before, "P03")[0];
  if (leaf === undefined || roof === undefined) throw new Error("leaf and roof expected");
  const overbend: System<null> = {
    id: "overbend",
    reads: ["foldable"],
    plan: () => ({
      ok: true,
      value: [
        { op: "fold", entity: roof.id, angles: { ridge: 0 } },
        { op: "fold", entity: leaf.id, angles: { midrib: 10 } },
      ],
    }),
  };
  const hash = hashState(before);
  const result = runSystem(catalog, before, overbend, null);
  expect(result.ok ? [] : result.error.kind === "invalid" ? result.error.issues.map((i) => i.code) : []).toEqual(["fold-invalid"]);
  expect(hashState(before)).toBe(hash);
});

const windCreases = (definition: FoldonDefinition): readonly string[] => {
  const wind = definition.components.some((component) => component.kind === "wind-responsive");
  return wind ? definition.components.flatMap((component) => (component.kind === "foldable" ? component.creases.map(String) : [])) : [];
};

const creaseOf = (definition: FoldonDefinition, id: string) => {
  const crease = definition.geometry.creases.find((candidate) => candidate.id === id);
  if (crease === undefined) throw new Error(`crease ${id} expected`);
  return crease;
};

function gust(state: WorldState, strength: number): WorldState {
  const result = blow(state, strength);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value.state;
}

test("every crease a wind-responsive definition folds can reach flat and its rest angle", () => {
  const checked = catalog.foldons().flatMap((definition) =>
    windCreases(definition).map((id) => {
      const { range, restAngle } = creaseOf(definition, id);
      expect({ definition: definition.id, id, flat: range[0] <= 0 && 0 <= range[1], rest: range[0] <= restAngle && restAngle <= range[1] }).toEqual({
        definition: definition.id,
        id,
        flat: true,
        rest: true,
      });
      return id;
    }),
  );
  expect(checked.length).toBeGreaterThan(0);
});

test("a gust past a leaf's stiffness/drag threshold no longer rejects the whole wind patch", () => {
  const before = garden();
  const result = blow(before, 1);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  const leaf = byDefinition(result.value.state, "leaf")[0];
  const roofs = byDefinition(result.value.state, "P03");
  expect(Math.abs(leaf?.fold.midrib ?? NaN)).toBeCloseTo(0, 12);
  expect(roofs.every((roof, i) => JSON.stringify(roof.fold) !== JSON.stringify(byDefinition(before, "P03")[i]?.fold))).toBe(true);
});

test("a gust exactly at the leaf threshold flattens the leaf and commits", () => {
  const after = gust(garden(), 0.25);
  expect(Math.abs(byDefinition(after, "leaf")[0]?.fold.midrib ?? NaN)).toBeCloseTo(0, 12);
});

test("a gust just above the leaf threshold keeps the leaf flat instead of folding it the other way", () => {
  const after = gust(garden(), 0.3);
  expect(Math.abs(byDefinition(after, "leaf")[0]?.fold.midrib ?? NaN)).toBeCloseTo(0, 12);
});

test("zero wind folds every wind-responsive crease to its rest angle", () => {
  const after = gust(garden(), 0);
  for (const entity of after.entities) {
    const definition = catalog.foldons().find((candidate) => candidate.id === entity.definition.id && candidate.version === entity.definition.version);
    if (definition === undefined) continue;
    for (const id of windCreases(definition)) expect(entity.fold[id]).toBeCloseTo(creaseOf(definition, id).restAngle, 12);
  }
});

test("a gust below the leaf threshold folds the leaf in proportion to its drag over stiffness", () => {
  const before = garden();
  const after = gust(before, 0.1);
  const leaf = catalog.foldons().find((definition) => definition.id === "leaf");
  if (leaf === undefined) throw new Error("leaf expected");
  expect(byDefinition(after, "leaf")[0]?.fold.midrib).toBeCloseTo(creaseOf(leaf, "midrib").restAngle * (1 - (0.1 * 0.8) / 0.2), 12);
});

test.each([10, 50])("a gust of strength %d stays inside every crease range and never reverses a fold", (strength) => {
  const after = gust(garden(), strength);
  let seen = 0;
  for (const entity of after.entities) {
    const definition = catalog.foldons().find((candidate) => candidate.id === entity.definition.id);
    if (definition === undefined) continue;
    for (const id of windCreases(definition)) {
      const { range, restAngle } = creaseOf(definition, id);
      const angle = entity.fold[id] ?? NaN;
      expect(angle).toBeGreaterThanOrEqual(range[0]);
      expect(angle).toBeLessThanOrEqual(range[1]);
      expect(angle * restAngle).toBeGreaterThanOrEqual(0);
      expect(Math.abs(angle)).toBeLessThanOrEqual(Math.abs(restAngle) + 1e-12);
      seen += 1;
    }
  }
  expect(seen).toBeGreaterThan(0);
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
