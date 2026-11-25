# ADR 0004: Multi-cell encoding

- Status: **Accepted with amendments** — owner decision D3 (2026-11-25, recorded in [`../review/phase-0-owner-review.md`](../review/phase-0-owner-review.md) §0) approved this ADR on condition that the independent-review amendments ([`../review/adr-review.md`](../review/adr-review.md)) are applied. They are applied in the section "Amendments (owner D3, 2026-11-25)" below; the Phase 0 code follows it (public contract). Solver internals stay a Phase 2 decision.
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

- Experiment, tests and bench: `experiments/wfc-placement/` (commit `0e34f55`); numbers recorded on clean commit `e9e50c5` in [`benchmarks/phase-0/2026-11-24-e9e50c527/wfc.md`](../../benchmarks/phase-0/2026-11-24-e9e50c527/wfc.md) (the original run at `0e34f55` is in git history); narrative and "Not tested" list in `experiments/wfc-placement/README.md`.
- 1200 timed runs all ended `solved`; no `unsatisfiable` or `budget-exceeded` case occurred outside the unit tests. The result says nothing about hard catalogs.
- Not tested: 3D stacking, workers and cancellation, local re-collapse, tiles larger than 3×2, non-chronological backtracking, cross-platform determinism.
- R3 (Tessera) could not be read as text, so its encoding claims were not used.

## Amendments (owner D3, 2026-11-25)

The review recommends approval as written; no change to the decision.

- **Integration with the world (recorded for Phase 2).** Solver output is a `Patch` committed through the same `applyPatch` as every other change (ADR 0011). Unchanged placements **keep their `EntityId`**: the solver reports "keep" for an identical `(definition, anchor, rotation)` instead of consuming and re-instantiating it. Removed placements become `detach` (rubble) or `consume` according to the scenario policy; in closed conservation they cannot be consumed (ADR 0010).
- **Open owner question, Phase 2 scope:** must "same seed → same world" hold across browsers, which would need integer-only entropy instead of `Math.log` with a `1e-9` tie tolerance (`experiments/wfc-placement/src/util.ts`)? Or only within one JS engine version, with cross-engine reproduction through the commit log? Replay is engine-independent either way, because it applies recorded patches and never re-runs the solver. This question does not block Phase 1.
