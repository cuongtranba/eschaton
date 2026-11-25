# ADR 0015: Wave solver — placement-based 3D multi-cell WFC

- Status: **Accepted with amendments** — owner decision W4 (2026-11-25, recorded in [`../review/phase-2-owner-review.md`](../review/phase-2-owner-review.md)), conditional on the amendments and review corrections applied in "Amendments (owner W4)" below, which override the text above where they differ.
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
- **Outcomes:** `solved` (placements and air cells), `unsatisfiable` (search space exhausted, with a reason), `budget-exceeded`, `invalid` (malformed problem). `cancelled` is produced by the job host. Nothing partial is ever returned as a result.
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

## Amendments (owner W4, 2026-11-25)

The three flagged choices are decided, with their scope made explicit.

1. **Cell selection is MRV, integer-only. It is not Shannon entropy and must not be described as such.** The next cell is the undecided cell with the fewest live options (ties: smaller total weight, then lowest index). Master plan §5.1 is amended to say so. The placement itself is drawn by weight from a seeded integer stream.
   - **Per-candidate weight bias.** A tile's weight applies to each candidate. A large tile covers a cell from many anchors, so it is drawn more often than its weight suggests, and more so the larger it is. This is a known bias, tuned through the tile list.
   - **Future heuristic comparisons** (entropy with a fixed-point table, per-tile normalised weights, weighted MRV) are open work. Any replacement has to keep the integer-only property or re-establish the cross-engine evidence.
2. **`needsMate` is a generation-only constraint.** It is not structural physics and says nothing about support, load or stability. The solver and `verifyPlacements` enforce it; the world's invariants do not. Support semantics are Phase 4.
3. **The ground plane is a solve-request parameter in Phase 2.** Phase 3 (Genesis) revisits it when terrain gets semantics. A request whose region starts below the ground is refused.
4. **Tested cross-engine scope, no universal promise.** The golden corpus is identical on V8 (Node 24, Chromium 159), SpiderMonkey (Firefox 159) and JavaScriptCore (WebKit 27.2), locally on macOS arm64 and in CI on Linux x64. That is arithmetic determinism of the solver. It is not a product promise for every browser, version or device, and worker portability is a separate property (below).
5. **Closed conservation.** Generation never mints while conservation is closed. Rebuilding from finite inventory with a search is explicitly deferred to Phase 6.

### Review corrections (W2)

An independent read-only review found no soundness or completeness defect; its own exhaustive oracle agreed with the solver on 7,100 tiny instances. It found one major latent defect and several robustness gaps, all fixed with failing tests first (commit `fd6aaec`):

- **Rotations:** an assembly is offered only at quarter turns that every leaf foldon allows. Before, the world could reject a "solved" result.
- **Weights** are limited to 1–65,535 so the per-cell weight sum stays inside the 32-bit draw.
- **`step`** treats a count below one as one. The self-check also requires every placement to be whole.
- **Results are not trusted.** `verifyPlacements` re-checks a result from the rules alone, sharing only the catalog shape lookup with the solver. `settleJob` is the single way a job result reaches the world: shape check, cancel wins over a finished solve, verification, then `applyProposal`.
- **Job host:** every accepted job gets exactly one `done`, also when the solver or the port throws; duplicate ids are ignored; setup is still one synchronous step (not sliced), which is a known limit for very large regions.
- **Compiled tiles hold a memo.** `signatureOf` and `legal` cache lazily, so a compiled tile set is logically immutable but not frozen deep. Results do not depend on the cache.

### Arithmetic determinism versus worker portability

| Property | What is tested | Where |
|---|---|---|
| Arithmetic determinism | The same four fixed solves give one golden digest | Node (unit test) and Chromium, Firefox, WebKit (`engines/determinism.spec.ts`), in CI |
| Worker transport | A real module worker solves a region, the result commits, and a cancelled job reports `cancelled` | Chromium, Firefox, WebKit (`engines/worker.spec.ts`), in CI |
| Worker performance | Timings through the production worker | Chromium and installed Chrome only (`bench:wave`), locally |

### Performance (W1)

Measured through the production worker and bundle, not Node: see [`../phase-2-exit.md`](../phase-2-exit.md) §5. Setup (candidate enumeration and the first propagation) is about as expensive as the search itself for a 16×8×16 region and is not yet sliced.
