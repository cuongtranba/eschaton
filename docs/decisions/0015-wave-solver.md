# ADR 0015: Wave solver — placement-based 3D multi-cell WFC

- Status: **Accepted for Phase 2** under owner decision R7 (2026-11-25), which authorizes the Phase 2 design within its stated scope. Three choices in "Choices to confirm at the Phase 2 gate" go beyond the letter of the master plan and are flagged for the owner.
- Date: 2026-11-25
- Master plan: §5.1, §5.2, §5.4, §11 Phase 2. Builds on ADR 0004, 0012, 0013.

## Context

ADR 0004 recommended the placement encoding from a 2D throwaway experiment. Phase 2 needs a production solver: 3D, multi-cell footprints (1×1, 2×2, 4×4 and irregular masks), oriented sockets from the one catalog socket table, explicit air, pins, frozen boundaries, bounded work, cancellation and explicit outcomes.

## Decision

### Model

- **Variant:** a catalog item (foldon or assembly) at one quarter turn, normalised so its cells start at the origin. Variants that are indistinguishable (same cells, same external socket signatures) are merged so symmetry does not multiply weight.
- **Candidate:** a variant at an anchor, with every cell inside the region and on a free cell. A candidate is atomic: all of its cells or none.
- **Cell domain:** the live candidates covering the cell, plus **air**.
- **Air is explicit.** A solved cell is either covered by exactly one chosen candidate or is air. Air has an integer weight. Cells outside the region that hold no entity are air and stay air (the exterior is frozen).
- **Face rule.** For two face-adjacent cells that belong to different candidates, the two sockets must be a legal adjacency under `socketMismatches` with the catalog's table. A face toward air is legal unless its profile is `needsMate` (socket table v3; in the default table only `base`). A face toward a frozen entity must be legal with that entity's socket. A face on the declared ground plane meets a virtual socket of the declared ground profile.
- **`needsMate` is a generation rule, not a world invariant.** The world keeps accepting a `base` face over nothing, because detaching a supporting piece must stay legal until Phase 4 defines support. The rule lives in the socket table so there is one versioned source.

### Search

- **Compile once.** `compileTiles(catalog, tiles)` enumerates variants and assigns every external unit face a socket signature; a signature-pair table is filled once by calling `socketMismatches`. A compiled tile set is immutable and reusable across solves.
- **Propagation** is arc consistency with support counts: per cell, per direction, per signature, the number of live candidates presenting that signature. A candidate dies when one of its external faces has no supporting option in the neighbouring cell.
- **Choice.** The next cell is the undecided cell with the fewest live options; ties go to the smaller total weight, then the lowest cell index. The option is drawn by weight from a local `mulberry32` stream. All of it is integer arithmetic.
- **Backtracking** is chronological over a trail; the failed option is removed and propagated.
- **Bounds.** `maxNodes` (decisions) and `maxBacktracks`. The solver is steppable (`step(nodes)`), which gives the worker host its cancellation points.
- **Outcomes:** `solved` (placements and air cells), `unsatisfiable` (search space exhausted, with a bounded trace), `budget-exceeded`. `cancelled` is produced by the job host. Nothing partial is ever returned as a result.
- **Self-check.** Before returning `solved`, the solver re-validates coverage and every face from scratch and fails loudly if its own result is invalid.

### Determinism scope

- The solver uses only integers, `Math.imul`, comparisons and array order. It never uses `Math.log`, `Math.random`, floating-point accumulation, `Date`, or object key order. So the same compiled tiles and problem give the same result on any conforming ECMAScript engine **by construction**.
- **Tested (2026-11-25, macOS arm64):** one golden digest over four fixed 12×6×12 solves (`goldenDigest`) is identical on V8 (Node v24.20 and Playwright Chromium 159), SpiderMonkey (Playwright Firefox 159) and JavaScriptCore (Playwright WebKit 27.2). The Node check is a unit test in CI; the three-browser check is `pnpm --filter @eschaton/studio engines`, run locally and **not** in CI.
- **Not tested:** other engine versions, other CPU architectures, and real Safari or Firefox release builds. No claim is made for them beyond the argument above.
- "Same result" means the same placements for the same catalog fingerprint, tile list, weights, seed, region size and constraints. Entity ids additionally depend on the commit revision (ADR 0010).

## Choices to confirm at the Phase 2 gate

1. **Cell choice by fewest options, not Shannon entropy.** Master plan §5.1 names weighted Shannon entropy. `Math.log` is implementation-approximated, so entropy ties could differ between engines (ADR 0004's open question). The integer rule keeps cross-engine determinism simple. Weights still shape the outcome through the weighted draw.
2. **`needsMate` in the socket table**, and only as a generation rule.
3. **The ground plane is a parameter of a solve request** (`{ y, profile }`), not world state. The world has no ground entity.

## Consequences

- The solver does not know entities, ids, bonds or revisions. Region extraction and the proposal are ADR 0016.
- Soft preferences are weights only. Semantic roles, connectivity and hierarchy are Phase 3.
- Chronological backtracking can thrash on hard catalogs; the budget turns that into an explicit `budget-exceeded`. Smarter backtracking waits for evidence.

## Implementation (Phase 2)

- **Code:** `packages/wave/src/solver/compile.ts` (`compileTiles`), `packages/wave/src/solver/solve.ts` (`createSolve`, `solve`), `packages/wave/src/golden.ts`. The solver folder imports `@eschaton/foldon` only; lint forbids `@eschaton/world`, the region glue and the job host there.
- **Propagation was rewritten once, on a measurement.** The first version revised every neighbouring candidate on each change and took about 2.5 s for 16×8×16 with the town tile set. Face queues (only the faces whose support changed) plus signature bitmasks took the same solves to about 70 ms, with identical placements.
- **Weights.** A tile's weight applies per candidate. A large tile covers a cell from many anchors, so it is drawn more often than its weight alone suggests; the tile list is where that is tuned.
- **Job host:** `packages/wave/src/host.ts` (`createWaveHost`) runs a job in slices through an injected scheduler, posts progress previews and one `done` message (`solved`, `unsatisfiable`, `budget-exceeded`, `invalid`, `cancelled`, `failed`). It rebuilds the catalog from `catalog.source()` and refuses a fingerprint mismatch. The Studio owns the actual `Worker` (`apps/studio/src/worker/`).
- **Tests:** `packages/wave/test/solver.test.ts` (12) and `host.test.ts` (3); Studio `e2e/wave.spec.ts` (5) against the real worker.
- **Benchmarks:** `benchmarks/phase-2/`; summary in [`../phase-2-exit.md`](../phase-2-exit.md).
