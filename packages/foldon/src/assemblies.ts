import type { AssemblyPart, AssemblyRecipe, PartRef } from "./assembly";
import { primitiveCatalog } from "./catalog";
import type { Rotation } from "./definition";
import { assemblyId, foldonId, placementId } from "./ids";
import type { ValidationIssue } from "./issues";
import { createCatalog, type Catalog } from "./registry";
import type { Result } from "./result";
import type { Cell } from "./vec";

const primitive = (id: string): PartRef => ({ kind: "foldon", id: foldonId(id), version: 1 });
const nested = (id: string): PartRef => ({ kind: "assembly", id: assemblyId(id), version: 1 });

const part = (id: string, ref: PartRef, anchor: Cell, rotation: Rotation = 0): AssemblyPart => ({
  id: placementId(id),
  ref,
  anchor,
  rotation,
});

const grid = (xs: number, ys: readonly number[], zs: number, ref: PartRef, name: string): readonly AssemblyPart[] =>
  ys.flatMap((y) =>
    Array.from({ length: zs }, (_, z) =>
      Array.from({ length: xs }, (_, x) => part(`${name}-${x}-${y}-${z}`, ref, [x, y, z])),
    ).flat(),
  );

const range = (from: number, to: number): readonly number[] => Array.from({ length: to - from }, (_, i) => from + i);

const roofModule: AssemblyRecipe = {
  id: assemblyId("roof-module"),
  version: 1,
  name: "Roof module",
  level: 1,
  tags: ["roof", "module-2x2"],
  parts: [part("slope-west", primitive("P03"), [0, 0, 0]), part("slope-east", primitive("P03"), [1, 0, 0])],
};

const watchtower: AssemblyRecipe = {
  id: assemblyId("watchtower"),
  version: 1,
  name: "Watchtower",
  level: 2,
  tags: ["tower", "ruin"],
  parts: [
    ...grid(2, range(0, 6), 2, primitive("P08"), "shaft"),
    part("band-beam", primitive("P06"), [0, 6, 0], 1),
    part("peak-west", primitive("P07"), [0, 6, 1]),
    part("peak-east", primitive("P07"), [1, 6, 1]),
  ],
};

const roofHouse: AssemblyRecipe = {
  id: assemblyId("roof-house"),
  version: 1,
  name: "Pitched-roof house",
  level: 2,
  tags: ["house", "module-4x4"],
  parts: [
    ...range(0, 4).flatMap((x) => range(0, 2).map((z) => part(`porch-${x}-${z}`, primitive("P01"), [x, 0, z]))),
    ...range(0, 4).flatMap((x) =>
      range(0, 2).flatMap((y) => range(2, 4).map((z) => part(`wall-${x}-${y}-${z}`, primitive("P08"), [x, y, z]))),
    ),
    part("finial-west", primitive("P07"), [0, 1, 0]),
    part("eave-beam", primitive("P06"), [1, 1, 0], 1),
    part("finial-east", primitive("P07"), [3, 1, 0]),
    part("roof-left", nested("roof-module"), [0, 2, 2]),
    part("roof-right", nested("roof-module"), [2, 2, 2]),
  ],
};

const ruinedGate: AssemblyRecipe = {
  id: assemblyId("ruined-gate"),
  version: 1,
  name: "Ruined gate",
  level: 2,
  tags: ["gate", "ruin"],
  parts: [
    ...range(0, 5).map((y) => part(`post-west-${y}`, primitive("P08"), [0, y, 0])),
    ...range(0, 3).map((y) => part(`post-east-${y}`, primitive("P08"), [3, y, 0])),
    part("cap-east", primitive("P07"), [3, 3, 0]),
    part("crossbeam-west", primitive("P06"), [0, 5, 0], 1),
    part("crossbeam-east", primitive("P06"), [2, 5, 0], 1),
    part("debris-a", primitive("P09"), [1, 0, 0]),
    part("debris-b", primitive("P09"), [2, 0, 0]),
    part("debris-facet", primitive("P02"), [2, 0, 1]),
  ],
};

export const assemblyCatalog: readonly AssemblyRecipe[] = [roofModule, watchtower, roofHouse, ruinedGate];

export const defaultCatalog: Result<Catalog, readonly ValidationIssue[]> = createCatalog({
  foldons: primitiveCatalog,
  assemblies: assemblyCatalog,
});
