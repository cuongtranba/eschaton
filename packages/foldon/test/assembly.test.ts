import { expect, test } from "vitest";
import {
  assemblyCatalog,
  assemblyId,
  createCatalog,
  defaultCatalog,
  foldonId,
  placeFootprint,
  placementId,
  primitiveCatalog,
  type AssemblyPart,
  type AssemblyRecipe,
  type Catalog,
  type Cell,
  type PartRef,
  type Rotation,
  type ValidationCode,
} from "@eschaton/foldon";

const foldonRef = (id: string): PartRef => ({ kind: "foldon", id: foldonId(id), version: 1 });
const assemblyRef = (id: string): PartRef => ({ kind: "assembly", id: assemblyId(id), version: 1 });

const part = (id: string, ref: PartRef, anchor: Cell, rotation: Rotation = 0): AssemblyPart => ({
  id: placementId(id),
  ref,
  anchor,
  rotation,
});

const recipe = (id: string, parts: readonly AssemblyPart[], level: 1 | 2 | 3 = 1, name = id): AssemblyRecipe => ({
  id: assemblyId(id),
  version: 1,
  name,
  level,
  parts,
  tags: [],
});

const key = (cell: Cell): string => cell.join(",");

function compile(...extra: readonly AssemblyRecipe[]) {
  return createCatalog({ foldons: primitiveCatalog, assemblies: [...assemblyCatalog, ...extra] });
}

function codes(result: ReturnType<typeof compile>): readonly ValidationCode[] {
  return result.ok ? [] : result.error.map((issue) => issue.code);
}

function catalogOf(result: ReturnType<typeof compile>): Catalog {
  if (!result.ok) throw new Error(`catalog failed: ${result.error.map((i) => i.code).join(",")}`);
  return result.value;
}

function defaults(): Catalog {
  return catalogOf(defaultCatalog);
}

function foldonIds(catalog: Catalog, id: string): ReadonlySet<string> {
  return new Set(catalog.flatten(assemblyId(id)).map((instance) => instance.definitionId));
}

function leafCells(catalog: Catalog, id: string): readonly string[] {
  return catalog
    .flatten(assemblyId(id))
    .flatMap((instance) => {
      const definition = catalog.foldon(instance.definitionId, instance.definitionVersion);
      if (definition === undefined) throw new Error(`missing foldon ${instance.definitionId}`);
      return placeFootprint(definition, instance);
    })
    .map(key)
    .sort();
}

const box = foldonRef("P08");

test("the default catalog compiles all four authored assemblies", () => {
  expect(defaultCatalog.ok).toBe(true);
  expect(
    defaults()
      .assemblies()
      .map((a) => a.recipe.id)
      .sort(),
  ).toEqual(["roof-house", "roof-module", "ruined-gate", "watchtower"]);
});

test("watchtower, roof-house and ruined-gate reuse shared pieces but are distinct recipes", () => {
  const catalog = defaults();
  const [tower, house, gate] = ["watchtower", "roof-house", "ruined-gate"].map((id) => foldonIds(catalog, id));
  const shared = [...(tower ?? [])].filter((id) => house?.has(id) === true && gate?.has(id) === true);
  expect(shared.length).toBeGreaterThanOrEqual(2);
  const hashes = ["watchtower", "roof-house", "ruined-gate"].map((id) => catalog.assembly(assemblyId(id))?.hash);
  expect(new Set(hashes).size).toBe(3);
});

test("a rotated nested assembly flattens to the same cells as placing its mask rotated", () => {
  const pair = recipe(
    "roof-pair",
    [part("left", assemblyRef("roof-module"), [0, 0, 0]), part("right", assemblyRef("roof-module"), [2, 0, 1], 1)],
    2,
  );
  const catalog = catalogOf(compile(pair));
  const module = catalog.assembly(assemblyId("roof-module"));
  const parent = catalog.assembly(assemblyId("roof-pair"));
  if (module === undefined || parent === undefined) throw new Error("missing assembly");
  const expected = [
    ...placeFootprint(module, { anchor: [0, 0, 0], rotation: 0 }),
    ...placeFootprint(module, { anchor: [2, 0, 1], rotation: 1 }),
  ];
  expect(parent.footprint.map(key).sort()).toEqual(expected.map(key).sort());
  expect(leafCells(catalog, "roof-pair")).toEqual(parent.footprint.map(key).sort());
  expect(catalog.flatten(assemblyId("roof-pair")).map((i) => i.path)).toContain("roof-pair/right/slope-east");
});

test("flattened leaf cells of every default assembly equal its occupancy mask", () => {
  const catalog = defaults();
  for (const definition of catalog.assemblies()) {
    expect(leafCells(catalog, definition.recipe.id), definition.recipe.id).toEqual(definition.footprint.map(key).sort());
  }
});

test("overlapping parts are rejected", () => {
  const result = compile(recipe("stacked", [part("a", box, [0, 0, 0]), part("b", box, [0, 0, 0])]));
  expect(codes(result)).toContain("part-overlap");
});

test("touching parts with incompatible sockets are rejected", () => {
  const result = compile(recipe("mismatch", [part("wall", box, [0, 0, 0]), part("roof", foldonRef("P03"), [1, 0, 0])]));
  expect(codes(result)).toContain("socket-incompatible");
});

test("a cyclic assembly reference is rejected", () => {
  const result = compile(
    recipe("ping", [part("p", assemblyRef("pong"), [0, 0, 0])], 2),
    recipe("pong", [part("q", assemblyRef("ping"), [0, 0, 0])], 2),
  );
  expect(codes(result)).toContain("assembly-cycle");
});

test("nesting an assembly of equal or higher level is rejected", () => {
  const result = compile(recipe("flat", [part("m", assemblyRef("roof-module"), [0, 0, 0])], 1));
  expect(codes(result)).toContain("level-not-above-children");
});

test("unknown references and empty recipes are rejected", () => {
  expect(codes(compile(recipe("ghost", [part("g", foldonRef("P99"), [0, 0, 0])])))).toContain("ref-unknown");
  expect(codes(compile(recipe("nothing", [])))).toContain("recipe-empty");
});

test("the canonical hash ignores part ids, order and name but not rotation", () => {
  const hashOf = (r: AssemblyRecipe): string | undefined =>
    catalogOf(createCatalog({ foldons: primitiveCatalog, assemblies: [r] })).assembly(r.id)?.hash;
  const base = recipe("base", [part("a", foldonRef("P03"), [0, 0, 0]), part("b", foldonRef("P03"), [1, 0, 0])]);
  const reshuffled = recipe(
    "other-name",
    [part("zzz", foldonRef("P03"), [1, 0, 0]), part("yyy", foldonRef("P03"), [0, 0, 0])],
    1,
    "Renamed",
  );
  const turned = recipe("turned", [part("a", foldonRef("P03"), [0, 0, 0]), part("b", foldonRef("P03"), [1, 0, 0], 2)]);
  expect(hashOf(reshuffled)).toBe(hashOf(base));
  expect(hashOf(turned)).not.toBe(hashOf(base));
});

test("two recipes with identical content under different ids are rejected as duplicates", () => {
  const parts = [part("a", foldonRef("P03"), [0, 0, 0]), part("b", foldonRef("P03"), [1, 0, 0])];
  expect(codes(compile(recipe("roof-twin", parts)))).toContain("duplicate-recipe");
});

test("the roof-house exposes only sockets on the outer boundary of its occupancy mask", () => {
  const house = defaults().assembly(assemblyId("roof-house"));
  if (house === undefined) throw new Error("missing roof-house");
  const mask = new Set(house.footprint.map(key));
  expect(house.sockets.length).toBeGreaterThan(0);
  const internal = house.sockets.filter((s) => {
    const across: Cell = [s.cell[0] + s.normal[0], s.cell[1] + s.normal[1], s.cell[2] + s.normal[2]];
    return mask.has(key(across));
  });
  expect(internal).toEqual([]);
  expect(house.bounds.max[0] - house.bounds.min[0] + 1).toBe(4);
  expect(house.bounds.max[2] - house.bounds.min[2] + 1).toBe(4);
});

test("assembly definitions round-trip through JSON to deep-equal values", () => {
  for (const definition of defaults().assemblies()) {
    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
  }
});
