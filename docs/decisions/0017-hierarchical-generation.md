# ADR 0017: Hierarchical district generation (Genesis)

- Status: **Accepted for Phase 3** under owner decision W7 (2026-11-25), which authorizes the Phase 3 design within its stated scope. Choices that go beyond the master plan's wording are listed under "Choices to confirm at the Phase 3 gate". **Choice 9 was decided as (a) by the owner on 2026-11-27** (decision P3D-4, recorded in [`../review/phase-3-owner-decision-packet.md`](../review/phase-3-owner-decision-packet.md) §0). **Choices 1–8 are not confirmed** (P3D-3 is pending).
- Date: 2026-11-25
- Master plan: §5.3, §11 Phase 3. Builds on ADR 0013, 0015, 0016.

## Context

Phase 2 fills a box with compatible Foldons. It has no notion of a road, a river or a house, so its output is valid and meaningless. Phase 3 must produce a district: connected roads, a river and boundaries that hold as contracts, lots with roles, and recognisable structures, from a seed, as one atomic change to the world.

## Decision

### Layers and who enforces what

| Layer | Decides | Enforced by |
|---|---|---|
| Request | Preset, seed, district box, boundary contract (road gates, river inlet and outlet) | Request validation |
| Semantic plan (2D) | River course, road network, plaza, lots and their roles | The planner, then **independent validators**: river continuous between its terminals; every gate connected to the plaza through road, bridge or plaza cells; built lots have road frontage; nothing overlaps |
| Network pieces | One ground Foldon per road, plaza, water and bridge cell | Derived mechanically from the plan |
| Structures | Which Foldons fill each lot | The wave solver, per lot, with the role's tile set, around frozen neighbours |
| World | Occupancy, legal adjacency, bonds, identity | `applyProposal` and the world invariants |

The solver handles local compatibility only. Connectivity and boundaries are graph problems solved and checked by separate code. A failure at any layer is an explicit result with a stage and a reason.

### Determinism and seeds

- Everything is integer arithmetic over seeded streams, as in ADR 0015.
- **Scoped sub-seeds:** `seed(scope) = hash(world seed, district seed, preset id, scope name, attempt)`. Scopes are named (`river`, `roads`, `lots`, `lot:<id>`), so adding or reordering one stage does not change the others.
- Retries are bounded and explicit: a new attempt is a new scope value, recorded in the diagnostics.

### One atomic change, no second world

- The generator works on a **scratch state**: an immutable value of the ordinary world type, validated by the world for every step, never published (see "The scratch world is small" below for its final form). Each lot is solved against it, so it sees the network pieces and earlier lots as frozen neighbours.
- The result is **one proposal** for the whole district box, read against the real state the job started from. The world applies it once or rejects it. Intermediate scratch states, previews and the plan are not world state.
- The plan is kept beside the result for inspection (semantic layers, routes, diagnostics). It is derived data: the world does not store it.

### Nonlocal read dependencies (ADR 0016 amendment)

- `Proposal.depends` lists further regions with the digest each had when the job started. `applyProposal` compares them like the main read set.
- A district that **continues a neighbour's network** depends on more than its one-cell shell: its claim "this gate leads somewhere" rests on the neighbour's road. It declares the cells of the connected road it attaches to (bounded in length) as dependencies. A change to that road conflicts; an unrelated change in the neighbour does not.

### Results are audited independently

`settleDistrict` is the only way a district reaches the world. It applies the proposal to get a **candidate** state (a value, not yet adopted) and audits it from scratch against the plan: every road, plaza, bridge and water cell holds the right ground piece; no structure stands on the network; every structure lies in its lot; no piece that needs support stands on air; roads in the candidate world are connected to every gate. Only a clean candidate is adopted.

### Pieces

- New ground Foldons are flat presets built with the shared net helpers: `paving`, `water`, `bridge`. They are single cells, not building meshes.
- Structures reuse the catalog and the Phase 2 presets. The regular lattice is unchanged.

## Choices to confirm at the Phase 3 gate

1. **Terrain is land and water only.** No elevation. The ground plane stays a request parameter (ADR 0015 amendment).
2. **Roles and their tile sets are preset data** (`tower`, `house`, `ruin`, `garden`), chosen by distance to the plaza and road frontage with seeded variation.
3. **Lots are solved in a fixed order against earlier lots**, not jointly. A later lot adapts to an earlier one, never the reverse.
4. **The semantic plan is not stored in the world.** A reloaded world has its entities but not its plan.

## Consequences

- Hierarchical backtracking (revising the plan when a lot cannot be filled) is not implemented. A lot that stays empty is reported.
- Multi-district worlds need a persistent semantic layer and seam ownership; that is beyond this phase.

## Implementation (Phase 3)

- **Code:** `packages/genesis/src/` — `seed.ts` (scoped seeds, integer streams), `plan.ts` (river, plaza, roads with bridges, side streets, lots, roles), `validate.ts` (`planIssues`, written independently of the planner), `district.ts` (`createDistrictJob`, `generateDistrict`), `audit.ts` (`auditDistrict`), `settle.ts` (`settleDistrict`), `continuation.ts` (`continueFrom`), `host.ts` (`createGenesisHost`: sliced, cancellable, snapshot in, inert outcome out), `presets.ts` (`lastDistrict`, 40×40).
- **Imports:** `@eschaton/foldon`, `@eschaton/world`, `@eschaton/wave` only (lint area and architecture tests). No renderer, no UI, no Node built-ins.
- **Studio:** `apps/studio/src/worker/genesis.worker.ts` and `genesisClient.ts`; session commands `genesisSet`, `genesisStart`, `genesisCancel`, `genesisProgress`, `genesisDone` in `lab/world/session.ts`; `ui/GenesisPanel.tsx` (seed, generate, cancel, progress, plan map with role and route layers, metrics, diagnostics). The viewport draws committed entities only; the plan map is labelled as the generator's semantic layer.
- **Tests:** `packages/genesis/test/{plan,district,host}.test.ts`, `packages/world/test/region.test.ts` (dependencies, `draftProposal`), `apps/studio/e2e/genesis.spec.ts`, `apps/studio/engines/{genesis,determinism}.spec.ts`.

### The scratch world is small (changed during implementation)

The first implementation advanced the real world value as its scratch state, committing once per lot. The district workload profile showed generation time growing with the world around the district (474 ms, 923 ms, 2,959 ms for the first three chained districts under load), because every scratch commit read and hashed the whole world.

- The job now builds a **private scratch world**: an empty world with the same seed and catalog, plus copies of the pieces that touch the district's one-cell shell. Copies are legal because they are a subset of a valid world's contacts and `needsMate` is a generation-only rule (ADR 0015 amendment). If the copy is refused, the job fails with stage `scratch`.
- Scratch steps use **`draftProposal`** (`@eschaton/world`): the same validation as `applyProposal`, returning the candidate state without a commit record and therefore without hashing it. A drafted state cannot be logged or replayed.
- Nothing about the result changes: the job still returns one proposal read against the real world, and the world validates it again. The corpus state hashes were identical before and after both changes.
- Measured effect (Node main thread, same machine, load 17–29): generate p50 650 ms → 314 ms with `draftProposal`; chained districts stay flat (136–247 ms at load 19–20) from 1,591 to 9,158 world entities. Evidence: `benchmarks/phase-3/`.

### Stored recipe numbers are engine independent (defect found in Phase 3)

The cross-engine Genesis test found that Chromium, Firefox and WebKit gave **different catalog fingerprints**, so the same district had a different state hash on each. The plan, the placements and the solver decisions were identical. The cause predates Phase 3: `foldedNet` stored rest angles from `atan2` and, for P09, vertices posed with `sin` and `cos`, and those functions may differ in the last bits between engines. The Phase 2 golden corpus could not see it because the solver digest does not include the fingerprint.

- `foldedNet` now rounds every stored vertex coordinate and rest angle to a multiple of 1e-9 (`packages/foldon/src/geometry.ts`). Authored decimals with up to nine places are unchanged. `windFold` computes wind strength with `sqrt` instead of `hypot`.
- **Compatibility consequence, stated plainly:** the fingerprint of every catalog containing P03 or P09 changed (the preset catalog is now `e77d898a9014df16` on all three engines and Node). A snapshot or commit log written before this change is refused with `catalog-mismatch`, exactly as after any catalog change. No such data is stored in the repository. The hash format (FNV-1a 64 over canonical JSON) is unchanged. Pinned test values in `packages/world/test/golden.test.ts` and `packages/foldon/test/sockets.test.ts` were re-recorded once, with a comment.
- The rule is a rounding grid, not a proof: a value within about 1e-16 of a grid midpoint could still round differently. The engines job pins the fingerprint, so a regression fails in CI.
- Adding the ground presets in G0 also changed the preset catalog's fingerprint, as any catalog addition does.
- Provenance of the re-recorded golden hashes, restored by the closure audit: the pre-W3 commit path (`11d31d9`) with only this rounding patch applied produces exactly the re-recorded values, and without it produces the original W3 values. So the W3 promise ("the optimised commit path gives the hashes of the unoptimised one") still holds for the new values ([`../review/phase-3-closure-audit.md`](../review/phase-3-closure-audit.md) §3).

### Wind strength: compatibility disclosure (Phase 3 closure audit, 2026-11-26)

The sentence "`windFold` computes wind strength with `sqrt` instead of `hypot`" above was the whole record of a behaviour change. This is the missing disclosure, reproduced through public APIs. Evidence and commands: [`../review/phase-3-closure-audit.md`](../review/phase-3-closure-audit.md) §2.

- **What changed in `62cf1e3`.** `Math.hypot(x, y, z)` became `Math.sqrt(x*x + y*y + z*z)`. ECMAScript specifies `Math.hypot` only as an implementation-approximated value. `sqrt`, `*` and `+` are correctly rounded IEEE operations, so the new expression gives the same bits on every engine for the same input.
- **Measured difference.** On Node 24.20 (V8), 37.3 % of 100,000 seeded random winds with components in [0, 0.2) give a strength that differs in the last bit. Some of those reach the stored fold angles and the state hash. Example: wind [0.1, 0.1, 0.1] on the systems-test garden folds the leaf to 0.35749885235170975 with `hypot` and to 0.3574988523517096 with `sqrt`, and the state hashes differ (`5e3b3822b1e6836b` and `ea9906626dd9f97b`).
- **Not affected:**
  - Replay of recorded logs. A commit record stores the `fold` op with its angles, and replay re-applies them; it does not run `windFold` again (ADR 0011, "Determinism scope").
  - Winds along one axis. For a normal-range `x`, `sqrt(x*x)` is exactly `|x|`. The Studio only ever sends `[s, 0, 0]` with `s` in [0, 1].
  - The golden fixed history, whose wind is `[0.05, 0, 0]`.
- **Affected:** running `windFold` again with an off-axis wind on the same state gives a fold that can differ in the last bit from what V8 gave before `62cf1e3`. On other engines the old result was already engine-specific.
- **A regression the change introduced, fixed in the closure branch.** Squaring overflows above about 1.3e154. A finite wind such as `[1e200, 0, 0]` became an infinite strength, and `windFold` rejected it as "wind must be a finite vector". That is the strong-gust rejection PR #5 removed, and `hypot` had accepted it. The fix:
  - scales the components by a power of two only when the largest one is outside [2^-500, 2^500];
  - checks finiteness on the components;
  - clamps a norm above `Number.MAX_VALUE`, so a zero-drag crease cannot produce `NaN`.

  Inside that range the arithmetic is unchanged, so every result and every golden hash is bit-identical to `62cf1e3`. Tests: the finite gusts `[1e200,0,0]`, `[1e155,1e155,0]` and `[MAX,MAX,0]` flatten the leaf (red on `main`); infinite and `NaN` components are rejected.
- **Pinned.** The off-axis wind `[0.1, 0.1, 0.1]` fold angles are pinned in Node (`packages/world/test/systems.test.ts`) and on Chromium, Firefox and WebKit (`apps/studio/engines/determinism.spec.ts`). Putting `Math.hypot` back fails the Node pin; this was checked by mutation.
- **No version was raised.** ADR 0011's version policy ties `rules` to commit validation and derivation. `windFold` is a system that proposes a patch. Systems have no version field of their own, and replay uses their recorded outcomes. Whether system behaviour should be versioned is choice 9 below. Phase 4 makes the question sharper, because its tick runs systems continuously. The owner decided choice 9 as (a) on 2026-11-27, so no version is raised.

### Further choices to confirm at the Phase 3 gate

5. **`draftProposal` is a new public function of `@eschaton/world`.** It commits nothing and records nothing; it exists so a job can validate scratch steps without paying for a state hash.
6. **The scratch world holds copies of shell pieces under new ids.** The ids never leave the job.
7. **Stored recipe numbers lie on a 1e-9 grid**, with the fingerprint change described above.
8. **The Studio places the first district at a fixed origin and each later one to the east of the previous**, through `continueFrom`. Other layouts are not offered.
9. **Wind strength formula and system versioning** (closure audit, 2026-11-26; the disclosure is above). Alternatives:
   - (a) keep `sqrt` with power-of-two scaling and the disclosure, with no version change (**recommended**: logs record outcomes, and the Studio sends only axis winds);
   - (b) add a systems component to `versions.rules`, so a system behaviour change is versioned; every existing snapshot is then refused as `rules-mismatch`;
   - (c) return to `Math.hypot`, which is engine-dependent again and fails the three-engine pin.

   **Decided (a)** by the owner on 2026-11-27 (P3D-4). The current implementation stands unchanged, and neither `versions.rules` nor any other version changes. This decides only the Phase 3 formula and its versioning. How Phase 4 versions its systems is draft ADR 0018 §3, which is proposed, not accepted.
