import { expect, test } from "vitest";
import {
  createConstrainedProblem,
  createDemoProblem,
  hashGrid,
  solveOffsetState,
  solvePlacement,
  verifySolution,
} from "@eschaton/exp-wfc-placement";
import type { CellState, Grid, Pin, SolveResult } from "@eschaton/exp-wfc-placement";

const SEEDS = Array.from({ length: 50 }, (_, index) => index + 1);
const encodings = [
  { name: "placement", solve: solvePlacement },
  { name: "offset-state", solve: solveOffsetState },
] as const;

const housePin: Pin = { tile: "house", anchor: [3, 2], rotation: 1 };

function solvedGrid(result: SolveResult): Grid {
  if (result.kind !== "solved") throw new Error(`expected a solved result, got ${result.kind}`);
  return result.grid;
}

for (const { name, solve } of encodings) {
  test(`${name}: same seed and problem give the same solution hash`, () => {
    for (const seed of [1, 2, 3]) {
      const problem = createDemoProblem(8, 8);
      const first = solvedGrid(solve(problem, { seed }));
      const second = solvedGrid(solve(problem, { seed }));
      expect(hashGrid(second)).toBe(hashGrid(first));
    }
  });

  test(`${name}: every solved grid in the seed corpus verifies`, () => {
    let solved = 0;
    for (const problem of [createDemoProblem(8, 8), createConstrainedProblem(8, 8)]) {
      for (const seed of SEEDS) {
        const result = solve(problem, { seed });
        if (result.kind !== "solved") continue;
        solved++;
        expect(verifySolution(problem, result.grid)).toEqual({ ok: true });
      }
    }
    expect(solved).toBeGreaterThan(SEEDS.length);
  });

  test(`${name}: a pinned 2x2 house appears wholly and exactly at its pin`, () => {
    const problem = createDemoProblem(8, 8, [housePin]);
    const expected: readonly (readonly [number, number, number, number])[] = [
      [2, 2, 0, 1],
      [3, 2, 0, 0],
      [2, 3, 1, 1],
      [3, 3, 1, 0],
    ];
    for (const seed of [1, 2, 3, 4, 5]) {
      const grid = solvedGrid(solve(problem, { seed }));
      for (const [x, z, ox, oz] of expected) {
        const cell = grid.cells[z * 8 + x];
        expect(cell).toEqual<CellState>({ tile: "house", rotation: 1, offset: [ox, oz] });
      }
      expect(verifySolution(problem, grid)).toEqual({ ok: true });
    }
  });

  test(`${name}: overlapping pins and a door facing the border are unsatisfiable, never solved`, () => {
    const overlapping = createDemoProblem(8, 8, [
      { tile: "house", anchor: [2, 2], rotation: 0 },
      { tile: "tower", anchor: [3, 3], rotation: 0 },
    ]);
    const doorAtBorder = createDemoProblem(8, 8, [{ tile: "house", anchor: [0, 6], rotation: 0 }]);
    expect(solve(overlapping, { seed: 1 }).kind).toBe("unsatisfiable");
    expect(solve(doorAtBorder, { seed: 1 }).kind).toBe("unsatisfiable");
  });

  test(`${name}: a tiny node budget reports budget-exceeded without a grid`, () => {
    const result = solve(createDemoProblem(8, 8), { seed: 1, maxNodes: 3 });
    expect(result.kind).toBe("budget-exceeded");
    expect("grid" in result).toBe(false);
  });

  test(`${name}: the sparse L-shaped courtyard appears in all four rotations and verifies`, () => {
    const problem = createDemoProblem(8, 8);
    const rotations = new Set<number>();
    for (const seed of SEEDS) {
      const result = solve(problem, { seed });
      if (result.kind !== "solved") continue;
      expect(verifySolution(problem, result.grid).ok).toBe(true);
      for (const cell of result.grid.cells) {
        if (cell.tile === "courtyard" && cell.offset[0] === 0 && cell.offset[1] === 0) rotations.add(cell.rotation);
      }
    }
    expect([...rotations].sort()).toEqual([0, 1, 2, 3]);
  });
}

test("the checker rejects a house that is missing one of its cells", () => {
  const problem = createDemoProblem(8, 8, [housePin]);
  const grid = solvedGrid(solvePlacement(problem, { seed: 1 }));
  const broken: Grid = { ...grid, cells: grid.cells.map((cell, index) => (index === 2 * 8 + 3 ? { tile: "ground", rotation: 0, offset: [0, 0] } : cell)) };
  const verdict = verifySolution(problem, broken);
  if (verdict.ok) throw new Error("checker accepted a house with a missing cell");
  expect(verdict.violations.map((v) => v.kind)).toContain("incomplete");
});
