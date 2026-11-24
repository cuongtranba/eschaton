# WFC placement vs offset-state encoding (P0.6, throwaway)

Throwaway experiment for master plan §5.2 and §14 step 6. It answers one question: can the multi-cell placement encoding be solved with ordinary WFC machinery, and how does it compare with the offset-state encoding? It is **not** the Phase 2 solver. Nothing outside `experiments/wfc-placement` imports it, and it may be deleted once the decision is recorded in an ADR.

## What is here

| Path | Purpose |
|---|---|
| `src/placement-solver.ts` | Encoding A: `solvePlacement(problem, options)` |
| `src/offset-solver.ts` | Encoding B: `solveOffsetState(problem, options)` |
| `src/verify.ts` | Independent checker `verifySolution(problem, grid)` and `hashGrid(grid)` |
| `src/tiles.ts` | Demo tile set (`ground`, `road-straight`, `road-turn`, `road-end`, 2×2 `house` with a door, `tower`, sparse L-shaped 3×2 `courtyard`, explicit `empty`) and problem builders |
| `src/model.ts` | Shared rotation, variant, socket and pin handling used by both solvers and the checker |
| `test/wfc.test.ts` | Behavioural tests through the package entry point |
| `bench/run.ts` | `pnpm bench`: writes `wfc.md` and `wfc.json` (summaries only) into the benchmark run directory, `benchmarks/runs/…` by default; see `benchmarks/README.md` |

Both solvers share: weighted choice with p = w / Σw over surviving options, weighted entropy H = −Σ p ln p for minimum-entropy cell selection, a local mulberry32 PRNG seeded from `options.seed` (ties are collected in cell-index order and picked by the PRNG), chronological backtracking over a trail, budgets `maxNodes` (decisions) and `maxBacktracks`, and the result type `solved | unsatisfiable | budget-exceeded`. A solver verifies its own grid with `verifySolution` before returning `solved` and throws if that fails; that path never triggered. Unsatisfiable and budget results carry `stats` and a bounded `trace` (last 24 events); `unsatisfiable` also carries `stats`, which the task statement did not require.

Problems are a 2D XZ grid (height 1), a tile set, optional pinned placements, and a boundary rule (border faces must carry `open` or `ground` sockets). Malformed problems (bad size, unknown tile, duplicate id, pins outside the grid or overlapping each other) return `unsatisfiable` with an `invalid` trace event rather than throwing.

## Encodings

**A. Placement.** Every candidate (tile, anchor, rotation) whose footprint fits the grid and whose border faces satisfy the boundary rule becomes a placement; `empty` is one 1×1 placement per cell. A cell's domain is the set of live placements covering it. Committing a placement fixes all its cells at once and kills every other placement that overlaps. A placement is killed by propagation when one of its *external* faces has no live neighbour candidate with a compatible facing socket. Internal faces are never examined. A cell with exactly one live placement is committed without a decision.

**B. Offset-state.** Each (tile, rotation, cell offset) becomes one state per cell. Where a state's neighbour in some direction belongs to the same tile, the compatibility table allows only the matching offset state of the same rotation; elsewhere it uses socket compatibility. Footprints that would leave the grid disappear through the same border pruning (an internal neighbour outside the grid is never allowed). Propagation is plain arc consistency over per-cell state domains. A decision removes all other states of one cell.

Symmetric 1×1 tiles are deduplicated by rotation in both encodings so identical variants do not double their weight.

## Measured results

Copied from `results/bench-2026-11-24.md` (the output of the former `pnpm bench`, which wrote into this directory; superseded by `benchmarks/phase-0/` after the next recorded run, see `benchmarks/README.md`). Machine: Linux 6.18.58.1-microsoft-standard-WSL2 (x64), AMD Ryzen 7 7800X3D (8 logical cores), Node v24.5.0, 19.5 GiB. Seeds 1..100 per scenario × size × encoding, 5 untimed warm-up runs per cell, `performance.now()` around each solve on the main thread, budget `maxNodes` 5000 and `maxBacktracks` 500. Times cover every run. One run on one machine: treat timing differences below about 10% as noise.

### Scenario `open`: demo tile set, no pins

| Size | Encoding | Solved | Unsat | Budget | p50 ms | p95 ms | Mean nodes | Mean backtracks | Mean prop. steps |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 8×8 | placement | 100 | 0 | 0 | 5.76 | 8.04 | 53.7 | 0.00 | 8515 |
| 8×8 | offset-state | 100 | 0 | 0 | 4.43 | 4.86 | 53.7 | 0.00 | 458 |
| 12×12 | placement | 100 | 0 | 0 | 18.93 | 26.03 | 110.5 | 0.00 | 24658 |
| 12×12 | offset-state | 100 | 0 | 0 | 13.37 | 18.35 | 110.5 | 0.00 | 1126 |
| 16×16 | placement | 100 | 0 | 0 | 47.21 | 50.18 | 186.9 | 0.00 | 48553 |
| 16×16 | offset-state | 100 | 0 | 0 | 29.95 | 34.35 | 186.9 | 0.00 | 2072 |

### Scenario `constrained`: demo tile set without `road-end`, one house pinned at the centre

| Size | Encoding | Solved | Unsat | Budget | p50 ms | p95 ms | Mean nodes | Mean backtracks | Mean prop. steps |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 8×8 | placement | 100 | 0 | 0 | 3.61 | 7.84 | 49.8 | 4.41 | 4652 |
| 8×8 | offset-state | 100 | 0 | 0 | 3.59 | 5.88 | 49.8 | 4.41 | 449 |
| 12×12 | placement | 100 | 0 | 0 | 19.44 | 26.23 | 103.7 | 1.30 | 18207 |
| 12×12 | offset-state | 100 | 0 | 0 | 15.84 | 19.31 | 103.7 | 1.36 | 1115 |
| 16×16 | placement | 100 | 0 | 0 | 67.96 | 97.77 | 174.0 | 1.63 | 37831 |
| 16×16 | offset-state | 100 | 0 | 0 | 39.07 | 56.13 | 173.9 | 1.59 | 2048 |

### Agreement between encodings

| Scenario | Size | Both solved | Identical grid hash |
|---|---|---:|---:|
| open | 8×8 | 100 | 100 |
| open | 12×12 | 100 | 98 |
| open | 16×16 | 100 | 100 |
| constrained | 8×8 | 100 | 100 |
| constrained | 12×12 | 100 | 98 |
| constrained | 16×16 | 100 | 97 |


Propagation steps are counted per worklist item: placements re-checked in A, cells revised in B. The two columns are not comparable and are listed only to show how each encoding scales with size.

## Observations

- **Correctness.** All 1200 timed runs ended `solved` and every solved grid passed the independent checker; the solvers' own pre-return check never fired. The unit corpus (50 seeds × two problems × two encodings on 8×8) also verifies, the pinned house lands exactly on its pin in both encodings, overlapping pins and a pinned house whose door faces the border return `unsatisfiable`, and a 3-node budget returns `budget-exceeded` with no grid.
- **The encodings behave the same, search-wise.** Mean nodes are within 0.1 of each other in every row and mean backtracks within 0.06, and the final grids are identical for 97–100 of 100 seeds per row. With equal weights and the same tie-breaking, per-cell domains (live placements covering a cell versus live offset states of that cell) are the same set, so arc consistency prunes identically. The few differing grids (12×12 and 16×16) most likely come from the different candidate ordering when a domain holds several multi-cell options (not isolated). The choice of encoding does not change how hard a problem is for the search. It changes only constant factors and implementation effort.
- **Cost.** Offset-state had the lower or equal p50 in all six rows, and the gap grows with size: 4.43 vs 5.76 ms (8×8 open), 29.95 vs 47.21 ms (16×16 open), 39.07 vs 67.96 ms (16×16 constrained); 8×8 constrained is a tie (3.59 vs 3.61 ms). The placement encoding revisits placements through neighbour candidate lists, while the offset encoding precomputes allowed-target lists once. Neither solver is optimised (no bitsets, no support counters); the p50 ratio is about 1.0–1.7× on this machine and this implementation, not a property of the encodings.
- **Backtracking.** The `open` scenario never backtracked because plain `ground`/`empty` can always fill a hole. The `constrained` scenario (no `road-end`, so every door must be joined to another door by a road path) backtracked on average 1.3–4.4 times, with a worst case of 170 backtracks on one 8×8 seed (both encodings) and 13 on the worst 16×16 seed. Chronological backtracking was enough for this tile set. No `unsatisfiable` or `budget-exceeded` case occurred in the benchmark; those paths are exercised only by the unit tests.
- **Implementation complexity.** Source size is similar (`placement-solver.ts` 334 lines, `offset-solver.ts` 276). A needs candidate enumeration with footprint and border filtering, per-face external-socket tables, overlap kills on commit, a forced-commit step for singleton cells (without it, an overlapping candidate elsewhere would survive), and a trail that records both kills and commits. B needs a state compiler with internal-neighbour rules, and its trail is a single stream of removed (cell, state) pairs. B's invariants are local to one cell pair, so it is easier to reason about; A's atomic commit maps directly to the public placement contract and to pins and local re-collapse, where whole placements must be frozen or released.
- **Weights.** In both encodings a multi-cell tile's weight applies once per covered cell, so large tiles are not down-weighted by footprint size. This is a tuning knob for Phase 2, not a correctness issue.
- **Tile set caveat.** The demo tiles are easy: every instance is solvable by filling with `ground`. Zero unsatisfiable results in the benchmark says nothing about hard catalogs.

## Recommendation for Phase 2

Keep the **placement-based contract public** (as master plan §5.2 already says) and adopt the **placement encoding as the solver's primary representation**, with offset-state as a documented fallback if profiling shows placement support checks dominate.

1. Equivalence: on this experiment the two encodings produced the same search statistics, so correctness and solvability do not decide between them.
2. Fit to the product contract: committing, freezing, pinning and releasing whole placements is the unit of local re-collapse (§5.4), transactions and stable IDs. Under placement encoding these are the native operations; under offset-state they must be rebuilt from per-cell states and can be half-applied.
3. Cost gap is a constant factor (about 1.0–1.7× at p50 here) from unoptimised code. Support counters or bitsets per placement face, which §5.1 already defers until profiling, are the obvious remedy. The measured 16×16 times (48–68 ms p50 for A) leave room, but they do not include 3D, larger catalogs or the 4×4 tiles.
4. Do not build both. If Phase 2 profiling shows the gap matters, the offset compiler can be written against the same `problem` and `grid` contract, because `verifySolution` and the grid type are encoding-neutral.

This is a recommendation from a small 2D experiment, not a go/no-go gate; the ADR for the multi-cell encoding should cite this file.

## Not tested

- 3D stacking, support rules and multiple levels (the grid is 2D with height 1).
- Web Workers, off-main-thread solves, cancellation and progress reporting (all Phase 2).
- Local re-collapse, dirty-region expansion, frozen exterior contracts and streaming seams.
- Tile footprints beyond 3×2 (no 4×4 tile), tiles whose geometry extends outside nominal occupancy, and boundary-straddling placements as a deliberate feature (the checker rejects them).
- Hard instances: catalogs where unsatisfiable or budget-limited outcomes are common, restart strategies and non-chronological backjumping.
- Optimised propagation (bitsets, support counters) and memory use.
- Cross-platform determinism: the PRNG and hash are integer-only, but entropy uses `Math.log` in doubles, which was only checked on one machine and one Node version.

## Commands

From the repository root: `pnpm test` (Vitest, includes this package), `pnpm typecheck`, `pnpm lint`, `pnpm bench` (writes to the untracked `benchmarks/runs/` directory; `BENCH_RECORD=1` writes the tracked evidence directory, see `benchmarks/README.md`).
