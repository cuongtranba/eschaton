# ADR 0004: Multi-cell encoding

- Status: Accepted for Phase 0 (public contract); solver internals are a Phase 2 decision
- Date: 2026-11-24
- Master plan: §5.2, §14 step 6; research R3

## Context

A multi-cell piece (a 2×2 house, a sparse L-shaped 3×2 courtyard, a 4×4 assembly) must be placed, pinned and released atomically. Two encodings were on the table: **placement** (the domain is the set of live `(tile, anchor, rotation)` candidates covering a cell) and **offset-state** (every cell holds `(tile, rotation, offset within the footprint)` and neighbours of the same tile must agree on offsets).

## Options considered

1. **Placement encoding.** Committing a placement fixes all its cells and kills overlapping candidates. Only external faces are checked.
2. **Offset-state encoding.** Plain arc consistency over per-cell domains; multi-cell atomicity is implied by offset agreement.
3. **Build both.** Rejected: double the surface to maintain.

## Decision

- The **public contract is placement-based**: a `Placement` is `{ id, definitionId, definitionVersion, anchor, rotation }` (`packages/foldon/src/transform.ts`). Assemblies flatten to lists of such placements with path ids (`catalog.flatten`).
- Recommend the **placement encoding as the Phase 2 solver's primary representation**, with offset-state as a documented fallback if profiling shows placement support checks dominate. This is a recommendation from a small experiment, not a gate.

## Consequences

- Pins, freezing and local re-collapse (§5.4) operate on whole placements, which matches the contract.
- Placement cost was 1.0–1.7× the offset-state p50 on the experiment machine from unoptimised code (for example 47.2 vs 30.0 ms at 16×16 open; 68.0 vs 39.1 ms at 16×16 constrained). The §9.1 Local WFC target (16×16×8 region, p95 ≤ 250 ms in a worker) was **not** assessed: the experiment is 2D, height 1, main-thread, with an easy tile set.
- Search behaviour was identical between encodings (mean nodes within 0.1, mean backtracks within 0.06, identical final grids for 97–100 of 100 seeds per row). Correctness does not decide between them.

## Evidence

- Experiment, tests and bench: `experiments/wfc-placement/` (commit `0e34f55`); numbers in `experiments/wfc-placement/results/bench-2026-11-24.md` and `.json`; narrative and "Not tested" list in `experiments/wfc-placement/README.md`.
- 1200 timed runs all ended `solved`; no `unsatisfiable` or `budget-exceeded` case occurred outside the unit tests. The result says nothing about hard catalogs.
- Not tested: 3D stacking, workers and cancellation, local re-collapse, tiles larger than 3×2, non-chronological backtracking, cross-platform determinism.
- R3 (Tessera) could not be read as text, so its encoding claims were not used.
