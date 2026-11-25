import { assemblyId, foldonId, placeFootprint, presetCatalog, type Catalog, type Cell, type Face, type Rotation } from "@eschaton/foldon";
import { compileTiles, solve, verifyPlacements, type BoundaryFace, type TileSpec, type WavePlacement, type WaveProblem } from "@eschaton/wave";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!presetCatalog.ok) throw new Error("the preset catalog must build");
  return presetCatalog.value;
})();

const POOL: readonly [TileSpec, ...TileSpec[]] = [
  { ref: { kind: "foldon", id: "P08" }, weight: 2 },
  { ref: { kind: "foldon", id: "P03" }, weight: 2 },
  { ref: { kind: "foldon", id: "P07" }, weight: 1 },
  { ref: { kind: "foldon", id: "P01" }, weight: 1 },
  { ref: { kind: "foldon", id: "P06" }, weight: 1 },
  { ref: { kind: "foldon", id: "leaf" }, weight: 1 },
  { ref: { kind: "assembly", id: "column-3" }, weight: 2 },
  { ref: { kind: "assembly", id: "l-block" }, weight: 2 },
  { ref: { kind: "assembly", id: "roof-module" }, weight: 1 },
];
const SIZES: readonly [Cell, ...Cell[]] = [[2, 2, 2], [3, 1, 2], [2, 1, 3], [2, 1, 2], [1, 3, 2], [2, 3, 1], [1, 2, 3]];
const OPPOSITE: Readonly<Record<Face, Face>> = { "+x": "-x", "-x": "+x", "+y": "-y", "-y": "+y", "+z": "-z", "-z": "+z" };
const STEP: Readonly<Record<Face, Cell>> = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] };
const FACES: readonly Face[] = ["+x", "-x", "+y", "-y", "+z", "-z"];
const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];
const key = (cell: Cell): string => cell.join(",");

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

type Instance = Readonly<{ tiles: readonly TileSpec[]; problem: WaveProblem }>;

function instance(seed: number): Instance {
  const next = random(seed);
  const pick = <T>(items: readonly [T, ...T[]]): T => items[next() % items.length] ?? items[0];
  const size = pick(SIZES);
  const tiles = [...new Map(Array.from({ length: 1 + (next() % 3) }, () => pick(POOL)).map((tile) => [tile.ref.id, tile])).values()];
  const cells: Cell[] = [];
  for (let x = 0; x < size[0]; x++) for (let y = 0; y < size[1]; y++) for (let z = 0; z < size[2]; z++) cells.push([x, y, z]);
  const blocked = cells.filter(() => next() % 9 === 0).slice(0, 2);
  const blockedKeys = new Set(blocked.map(key));
  const inside = (cell: Cell): boolean => cell.every((value, axis) => value >= 0 && value < (size[axis] ?? 0));
  const boundary: BoundaryFace[] = [];
  for (const cell of cells) {
    if (blockedKeys.has(key(cell))) continue;
    for (const face of FACES) {
      const step = STEP[face];
      const beyond: Cell = [cell[0] + step[0], cell[1] + step[1], cell[2] + step[2]];
      if ((inside(beyond) && !blockedKeys.has(key(beyond))) || next() % 5 !== 0) continue;
      const donor = catalog.foldon(foldonId(pick(["P08", "P03", "P01", "P06"])));
      const socket = donor?.sockets.find((candidate) => candidate.face === OPPOSITE[face]);
      if (socket !== undefined) boundary.push({ cell, face, socket });
    }
  }
  return {
    tiles,
    problem: { size, seed, airWeight: 1, blocked, boundary, ...(next() % 3 === 0 ? {} : { ground: { profile: "ground" } }), budget: { maxNodes: 50_000, maxBacktracks: 50_000 } },
  };
}

const ORACLE_CAP = 4_000;

/** Exhaustive search written from the rules: every way to cover the free cells with tiles or air, then verified. */
function oracle({ tiles, problem }: Instance): "sat" | "unsat" | "capped" {
  const [nx, ny, nz] = problem.size;
  const cells: Cell[] = [];
  for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) cells.push([x, y, z]);
  const blocked = new Set((problem.blocked ?? []).map(key));
  const options: WavePlacement[] = [];
  for (const tile of tiles) {
    const shape = tile.ref.kind === "foldon" ? catalog.foldon(foldonId(tile.ref.id)) : catalog.assembly(assemblyId(tile.ref.id));
    if (shape === undefined) continue;
    const version = "version" in shape ? shape.version : shape.recipe.version;
    for (const rotation of ROTATIONS) {
      for (let x = -3; x < nx + 3; x++) for (let y = 0; y < ny; y++) for (let z = -3; z < nz + 3; z++) {
        options.push({ ref: { kind: tile.ref.kind, id: tile.ref.id, version }, anchor: [x, y, z], rotation });
      }
    }
  }
  const free = new Set(cells.map(key).filter((cell) => !blocked.has(cell)));
  const usable = options
    .map((option) => {
      const shape = option.ref.kind === "foldon" ? catalog.foldon(foldonId(option.ref.id)) : catalog.assembly(assemblyId(option.ref.id));
      return { option, footprint: shape === undefined ? [] : placeFootprint(shape, option).map(key) };
    })
    .filter(({ footprint }) => footprint.length > 0 && footprint.every((cell) => free.has(cell)));
  const covering = new Map<string, typeof usable>();
  for (const entry of usable) for (const cell of entry.footprint) covering.set(cell, [...(covering.get(cell) ?? []), entry]);
  let visited = 0;
  const taken = new Set<string>();
  const chosen: WavePlacement[] = [];
  const search = (from: number): boolean | undefined => {
    visited += 1;
    if (visited > ORACLE_CAP) return undefined;
    let at = from;
    while (at < cells.length && !(free.has(key(cells[at] ?? [0, 0, 0])) && !taken.has(key(cells[at] ?? [0, 0, 0])))) at += 1;
    if (at === cells.length) return verifyPlacements(catalog, tiles, problem, chosen).length === 0;
    const cell = key(cells[at] ?? [0, 0, 0]);
    for (const { option, footprint } of covering.get(cell) ?? []) {
      if (footprint.some((covered) => taken.has(covered))) continue;
      for (const covered of footprint) taken.add(covered);
      chosen.push(option);
      const found = search(at + 1);
      chosen.pop();
      for (const covered of footprint) taken.delete(covered);
      if (found !== false) return found;
    }
    taken.add(cell);
    const asAir = search(at + 1);
    taken.delete(cell);
    return asAir;
  };
  const verdict = search(0);
  return verdict === undefined ? "capped" : verdict ? "sat" : "unsat";
}

test("the solver and an independent exhaustive search agree on which tiny problems are solvable, and every solution verifies", { timeout: 120_000 }, () => {
  const tally = { sat: 0, unsat: 0, capped: 0, disagreements: [] as number[], invalid: [] as number[] };
  for (let seed = 1; seed <= 300; seed++) {
    const input = instance(seed);
    const tiles = compileTiles(catalog, input.tiles);
    if (!tiles.ok) throw new Error(tiles.error.join("; "));
    const outcome = solve(tiles.value, input.problem);
    if (outcome.kind === "solved" && verifyPlacements(catalog, input.tiles, input.problem, outcome.placements).length > 0) tally.invalid.push(seed);
    const expected = oracle(input);
    if (expected === "capped") tally.capped += 1;
    else if ((expected === "sat") !== (outcome.kind === "solved") || (expected === "unsat" && outcome.kind !== "unsatisfiable")) tally.disagreements.push(seed);
    else tally[expected] += 1;
  }
  expect([tally.disagreements, tally.invalid]).toEqual([[], []]);
  expect([tally.sat > 100, tally.unsat > 50]).toEqual([true, true]);
});
