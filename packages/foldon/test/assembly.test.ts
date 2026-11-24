import { expect, test } from "vitest";
import {
  allRotations,
  assemblyCatalog,
  assemblyId,
  contractId,
  createCatalog,
  defaultCatalog,
  foldonId,
  moduleContracts,
  placeFootprint,
  placementId,
  primitiveCatalog,
  type AssemblyPart,
  type AssemblyRecipe,
  type Catalog,
  type Cell,
  type ContractRef,
  type ModuleContract,
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

const contractRef = (id: string): ContractRef => ({ id: contractId(id), version: 1 });

const declaring = (target: AssemblyRecipe, contract: string): AssemblyRecipe => ({
  ...target,
  contract: contractRef(contract),
});

function compile(...extra: readonly AssemblyRecipe[]) {
  return createCatalog({
    foldons: primitiveCatalog,
    assemblies: [...assemblyCatalog, ...extra],
    contracts: moduleContracts,
  });
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

test("assembly definitions and module contracts round-trip through JSON to deep-equal values", () => {
  for (const definition of defaults().assemblies()) {
    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
  }
  expect(JSON.parse(JSON.stringify(moduleContracts))).toEqual(moduleContracts);
});

const grid2x2 = (ref: PartRef): readonly AssemblyPart[] => [
  part("a", ref, [0, 0, 0]),
  part("b", ref, [1, 0, 0]),
  part("c", ref, [0, 0, 1]),
  part("d", ref, [1, 0, 1]),
];

test("roof-module satisfies module-2x2 and roof-house satisfies module-4x4", () => {
  const catalog = defaults();
  expect(catalog.satisfiesContract(assemblyId("roof-module"), contractId("module-2x2"), 0).ok).toBe(true);
  expect(catalog.satisfiesContract(assemblyId("roof-house"), contractId("module-4x4"), 0).ok).toBe(true);
});

test("a module-2x2 recipe whose footprint is not the full 2x2 square is rejected with the footprint code", () => {
  const lShape = recipe("l-shape", [
    part("a", foldonRef("P01"), [0, 0, 0]),
    part("b", foldonRef("P01"), [1, 0, 0]),
    part("c", foldonRef("P01"), [0, 0, 1]),
  ]);
  expect(codes(compile(declaring(lShape, "module-2x2")))).toContain("contract-footprint-mismatch");
});

test("a module-2x2 recipe exposing a wall profile on its sides is rejected with the boundary code", () => {
  const walled = recipe("walled-block", grid2x2(box));
  expect(codes(compile(declaring(walled, "module-2x2")))).toContain("contract-boundary-incompatible");
});

test("an unknown contract reference is rejected", () => {
  const lone = recipe("lone-panel", [part("a", foldonRef("P01"), [0, 0, 0])]);
  expect(codes(compile(declaring(lone, "module-9x9")))).toContain("contract-unknown");
});

test("a 4x4 module built from nested 2x2 modules satisfies module-4x4", () => {
  const roof = assemblyRef("roof-module");
  const quad = declaring(
    recipe(
      "roof-quad",
      [part("nw", roof, [0, 0, 0]), part("ne", roof, [2, 0, 0]), part("sw", roof, [0, 0, 2]), part("se", roof, [2, 0, 2])],
      2,
    ),
    "module-4x4",
  );
  expect(catalogOf(compile(quad)).satisfiesContract(assemblyId("roof-quad"), contractId("module-4x4"), 0).ok).toBe(true);
});

const asymmetricContract: ModuleContract = {
  id: contractId("wall-east"),
  version: 1,
  name: "Wall on the east side",
  size: { x: 2, z: 2 },
  boundary: {
    "+x": ["wall"],
    "-x": ["open"],
    "+z": ["open", "wall"],
    "-z": ["open", "wall"],
    "-y": ["base"],
    "+y": ["deck"],
  },
};

test("a module satisfies an asymmetric contract only at the quarter turn that lines its boundary up", () => {
  const split = recipe("split-module", [
    part("open-west", foldonRef("P01"), [0, 0, 0]),
    part("open-east", foldonRef("P01"), [1, 0, 0]),
    part("wall-west", box, [0, 0, 1]),
    part("wall-east", box, [1, 0, 1]),
  ]);
  const catalog = catalogOf(
    createCatalog({
      foldons: primitiveCatalog,
      assemblies: [...assemblyCatalog, split],
      contracts: [...moduleContracts, asymmetricContract],
    }),
  );
  const fits = allRotations.map((rotation) =>
    catalog.satisfiesContract(assemblyId("split-module"), asymmetricContract.id, rotation).ok,
  );
  expect(fits).toEqual([false, true, false, false]);
});

test("a symmetric contract is satisfied at every quarter turn", () => {
  const fits = allRotations.map((rotation) =>
    defaults().satisfiesContract(assemblyId("roof-module"), contractId("module-2x2"), rotation).ok,
  );
  expect(fits).toEqual([true, true, true, true]);
});

test("declaring a contract does not change the canonical hash", () => {
  const pair = [part("a", foldonRef("P03"), [0, 0, 0]), part("b", foldonRef("P03"), [1, 0, 0])];
  const hashOf = (r: AssemblyRecipe): string | undefined =>
    catalogOf(createCatalog({ foldons: primitiveCatalog, assemblies: [r], contracts: moduleContracts })).assembly(r.id)?.hash;
  expect(hashOf(declaring(recipe("declared", pair), "module-2x2"))).toBe(hashOf(recipe("undeclared", pair)));
});
