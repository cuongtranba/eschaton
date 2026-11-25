# Independent review of ADRs 0001–0013

- Date: 2026-11-24
- Status: **Independent review — recommendations only; owner approval pending.** Nothing here approves, accepts or rejects an ADR. Every ADR stays "Proposed — awaiting owner approval" until the owner decides.
- Outcome (2026-11-25): owner decision D3 approved ADRs 0001–0013 on condition that these recommendations are applied. They are applied in each ADR's "Amendments" section (see [`phase-0-owner-review.md`](phase-0-owner-review.md) §0). This review is kept unchanged as the source of those amendments.
- Scope: `docs/decisions/0001`–`0013` against `docs/master-plan.md` (roadmap v1.1, §11), `AGENTS.md`, `packages/foldon/src` and `test`, `apps/studio/src`, `experiments/wfc-placement/src`.
- Tree reviewed: the ADRs were written at `ae696c5`. During this review, commits `ffd2cc4` ("A1 Typed module contracts") and `04bd36b` ("A2 Enforce dependency direction, entry points and no-inheritance across first-party sources", which rewrites `eslint.config.js` and adds `tools/architecture`) landed on `phase-0`. Both are reviewed as **in flux**. Line numbers for `assembly.ts` and `registry.ts` are given at `ae696c5` (A1 shifts them by a few lines). Line numbers for `eslint.config.js` are at `ae696c5` unless marked A2. All other cited files are unchanged by A1 and A2.
- Labels: **[fact]** = verified by reading code at the cited line; **[inference]** = reasoning from code or spec, not executed. No check (lint, test, build, bench) was run for this review, and none is claimed.

## Headline findings

1. **[fact] ADRs 0010, 0011, 0012 and 0013 cite wrong line numbers for `assembly.ts`, `registry.ts` and `state.ts`.** No commit ever had those lines (checked against `4afa9f0`, `279e8c8`, `ae696c5`; `assembly.ts` and `registry.ts` had a single version before A1). Examples: `createCatalog` is `registry.ts:74-161` (cited `:183-270`); its error gate is `:161` (cited `:270`); the `flatten` path is `registry.ts:171` (cited `:277-282`); `labReducer` is `state.ts:90-115` (cited `:130-155`); `compileAssembly` is `assembly.ts:239-269` (cited `:257-287`, past the end of a 269-line file). The claims themselves are right; the anchors are not. Full list per ADR below.
2. **[inference] ADR 0012's turn rule uses `gcd` where it needs `lcm` (equivalently `max`) of the two symmetry orders.** With `gcd`, a quarter-turn of a fourfold-symmetric piece, which looks identical, can flip a C2 or C1 mate from accepted to rejected. No current profile is affected (all are C4), but the first oriented profile would be.
3. **[fact] ADR 0008's depth bound can never fire.** Levels are `1|2|3` (`assembly.ts:30`) and a nested assembly must have a strictly lower level (`assembly.ts:145`), so the deepest chain is 3. `MAX_ASSEMBLY_DEPTH = 4` (`registry.ts:16`) is unreachable and untested. This is the same pattern as the inert tangent clause in ADR 0009.
4. **[inference] ADR 0013 lets the look leak into authoritative state.** A detached fragment's first transform is "pose plus its offset". The offset comes from the look preset, so after one detach the state hash depends on the preset. That contradicts 0013's own invariants 1 and 4.
5. **[inference] ADR 0011's strict base-revision equality will always starve solves once ticks commit (Phase 4).** At 30 Hz, a solve that takes 250 ms (§9.1) always finds a newer revision. ADR 0010 invariant 4 ("ids independent of proposal arrival order") is also stronger than the design delivers: ids are deterministic given the commit log, not given the wall-clock order in which workers finish.

---

## ADR 0001 — Phase 0 package layout

1. **Purpose.** One domain package (`@eschaton/foldon`, contracts + catalog + geometry) and a Studio that owns the renderer adapter. Defer the §8 packages until they have consumers.
2. **Options.** Considered: shells now, one package including the renderer, foldon + Studio. *Missing:* a contracts-only package now (cheap, and it is the boundary a worker would need), plus an import-boundary lint as the alternative to "checked by reading" (`docs/architecture/overview.md`, "Dependency direction").
3. **Compatibility.** ADR 0011 Q7 and ADR 0010 introduce `@eschaton/world` in Phase 1, earlier than this ADR anticipates. This is consistent with its rule ("needed"), but 0001 should point to it. A1 (`contract.ts`) adds module contracts to foldon, which fits "contracts merged into foldon".
4. **Invariants.** (1) `packages/foldon` imports no `three`, DOM or workspace package. (2) Only `apps/studio/src/renderer` imports `three`. (3) Nothing imports `experiments/`. (4) Package tests import only the entry point (lint-enforced, `eslint.config.js:46-61`).
5. **API shape.** `@eschaton/foldon` entry `src/index.ts` (80 lines at `ae696c5`, 83 after A1). `ViewModel` (`apps/studio/src/lab/viewModel.ts:37-52`) is the only renderer-facing type. Nothing speculative.
6. **Risks.** At `ae696c5`, invariants 1–3 were unenforced by tooling. A Phase 2 worker bundle will pull `primitiveCatalog` data with the contracts. That is fine at this size.
7. **Tests/evidence.** At `ae696c5`, lint covers only class `extends` (`eslint.config.js:43-45`) and the test import ban. **In flux (A2, `04bd36b`):** `eslint.config.js` now enforces entry-point-only imports, `three` only in `renderer`, React only in the UI shell, a pure `foldon` (no `three`/React/Node built-ins), and "nothing imports apps or experiments". `tools/architecture` adds dependency-rule tests. [fact, A2] The `foldon` restrictions forbid app, experiment, tool and benchmark package names but **not sibling `@eschaton/*` packages**, so a future `foldon → world` import (a cycle once world imports foldon) would not be caught.
8. **Accuracy.** Claims match the code [fact]: no `three` import in `packages/foldon/src`; renderer at `apps/studio/src/renderer/labRenderer.ts:127`. The ADR does not mention A2 yet.
9. **Owner questions.** (1) Should A2's rules forbid `@eschaton/foldon` from importing any other workspace package, before `@eschaton/world` exists? (yes/no)
10. **Recommendation: approve**, with two one-line amendments: "superseded in part by ADR 0011 Q7 if `@eschaton/world` is approved", and "import direction is lint-enforced (A2)" once A2 is accepted.

## ADR 0002 — Cubic grid, yaw-only rotations

1. **Purpose.** An integer cubic lattice with four yaw rotations as the logical model. The geometry inside a cell is free.
2. **Options.** Considered: yaw-only, all 24 orientations, irregular lattice. *Missing:* a **non-cubic but regular** cell (for example a 1×k×1 tall cell or a half-height layer) and **larger-footprint primitives** (slab P08 variants). These are the cheapest levers against the toy-cube risk, and ADR 0013's experiment already lists "add or change primitives or cell size".
3. **Compatibility.** Foundation of 0004, 0009, 0012 (the turn arithmetic assumes yaw-only) and 0013 (layer A). Risk shared with 0006 and 0013.
4. **Invariants.** (1) A cell `[x,y,z]` occupies `[x,x+1]×…`. (2) `rotateDirection` preserves Y (`transform.ts:35-46`) [fact]. (3) `composePose` adds rotations mod 4 (`transform.ts:58-78`). (4) Placed footprints stay integral (`transformCell` rounds, `transform.ts:53-56`).
5. **API.** `Pose = { anchor: Cell; rotation: Rotation }` (`transform.ts:6`), `Rotation = 0|1|2|3` (`definition.ts:6`).
6. **Risks.** The toy-cube look (still open). The reference look depends on per-instance non-uniform scale, which this model forbids (see the cross-cutting section).
7. **Tests.** "every rotation keeps placed geometry inside the placed footprint", "every rotation keeps placed sockets on external face centres…", "a rotated nested assembly flattens to the same cells as placing its mask rotated". *Missing:* none for the logical contract. The silhouette comparison the plan asks for (§13) was not done.
8. **Accuracy.** Correct [fact]: `affine.ts:4-10,27-36` applies arbitrary yaw, pitch, roll and non-uniform scale.
9. **Owner questions.** (1) Accept that the toy-cube risk stays open until the ADR 0013 rebuild experiment reports? (yes/no) (2) Is a non-unit vertical cell size (for example 1×2×1) an allowed outcome of that experiment? (yes/no)
10. **Recommendation: approve** as the Phase 1 logical model, with the risk explicitly gated on the 0013 experiment.

## ADR 0003 — Crease representation

1. **Purpose.** Rigid convex panels authored in the rest pose, tree-only open hinges, explicit angle ranges, FOLD as a later adapter.
2. **Options.** Considered: crease pattern + solver, per-vertex animation, folded net with a hinge tree. *Missing:* **tree plus closure constraints checked only at the rest pose and at the flat pose** (no solver; reject poses that open a declared seam). This is a cheap middle ground for P07 and P08.
3. **Compatibility.** Fold state is runtime state (§4.3), but **neither 0010 (`Entity` has no crease angles) nor 0013 (layers A, B and C) says where fold angles live** or whether they are authoritative. 0006 hatching is world-anchored, so folding panels swim through the hatch (see 0006).
4. **Invariants.** (1) Creases form a tree; a cycle gives `crease-cycle` and an orphan gives `panel-disconnected` (`geometry.ts:167,178`). (2) An out-of-range target gives `angle-out-of-range` and is never clamped (`geometry.ts:204-232`). (3) `foldProgress` clamps only to each crease's range (`geometry.ts:266-271`). (4) Hinge edges stay coincident. (5) Validation checks vertices against footprint bounds **at the rest pose only** (`validate.ts:169-182`).
5. **API.** `poseGeometry(recipe, angles): Result<PosedGeometry, PoseError>`, `foldProgress(recipe, t)`. Nothing speculative.
6. **Risks.** (a) [inference from `catalog.ts` `boxShell` geometry, not executed] At `foldProgress = 0`, P08's walls lie flat outward about the floor edges, so the posed net spans about x ∈ [−0.94, 1.94]: about one cell beyond its footprint on four sides. Posed geometry can therefore overlap neighbours, and nothing checks it. (b) P08's four vertical seams open during the fold (stated). (c) No self-intersection checks.
7. **Tests.** `foldon.test.ts:129-216` (coincident hinges, measured dihedral angles, valley/mountain sign, refusal, flat/rest poses, rest-angle mismatch, cycle). e2e "moving the fold slider to zero flattens every crease readout to 0°". *Missing:* a test that posed geometry stays inside its footprint (or an explicit statement that it may leave it). FOLD M/V tests are deferred, correctly.
8. **Accuracy.** Matches code [fact]. The e2e title is quoted without its "to 0°" suffix (cosmetic).
9. **Owner questions.** (1) May a posed Foldon visually exceed its logical footprint (master plan §4: footprints are logical occupancy), or must poses stay within it? (2) Approve a closed-loop research gate (see the cross-cutting section) before Phase 6? (yes/no)
10. **Recommendation: approve**, amended with one consequence line: "posed geometry is not bounded by the footprint; only the rest pose is validated".

## ADR 0004 — Multi-cell encoding

1. **Purpose.** A placement-based public contract. Recommend the placement encoding for the Phase 2 solver, with offset-state as a fallback.
2. **Options.** Placement, offset-state, both. Complete for the question asked.
3. **Compatibility.** 0011 (solver output becomes a `Patch`), 0012 (adjacency compiled from the socket table), 0010 (pins and frozen exterior are entities), roadmap Phase 2 (frozen boundaries, pins, cancellation).
4. **Invariants.** (1) A committed placement covers its whole footprint or nothing. (2) Overlapping candidates die on commit. (3) Only external faces are checked. (4) Pins land exactly or the result is `unsatisfiable`.
5. **API.** `Placement` (`transform.ts:8-13`); solver contract `solved | unsatisfiable | budget-exceeded` (`experiments/wfc-placement/src/types.ts:67-70`). Nothing is public yet; correct for Phase 0.
6. **Risks.** [fact] Entropy uses `Math.log` (`util.ts:32`, `placement-solver.ts:247`) with a `1e-9` tie tolerance (`util.ts:26`). [inference] ECMAScript does not require `Math.log` to be correctly rounded, so tie sets, and therefore grids, may differ across JS engines. The 2–3 % of seeds where the two encodings disagree (README "Agreement") show that the solution is sensitive to small ordering effects.
7. **Tests.** `experiments/wfc-placement/test/wfc.test.ts` (same seed gives the same hash, corpus verifies, pinned 2×2, unsatisfiable pins and door-to-border, budget, L-courtyard rotations, checker rejects missing cell). *Missing:* 3D, workers, cancellation, local re-solve, 4×4, cross-engine determinism (all listed by the ADR).
8. **Accuracy.** Numbers match `experiments/wfc-placement/README.md` (47.21 vs 29.95 ms; 67.96 vs 39.07 ms; 97–100 identical grids) [fact].
9. **Owner questions.** (1) Must "same seed → same world" hold across browsers (then Phase 2 needs integer-only entropy), or only within one engine with replay covered by recorded patches (ADR 0011)?
10. **Recommendation: approve** (a recommendation, not a gate, as written).

## ADR 0005 — Renderer: WebGPURenderer + TSL, WebGL2 fallback

1. **Purpose.** One TSL material graph for both backends; automatic fallback; capability reporting.
2. **Options.** WebGL + `ShaderMaterial`, WebGPU + TSL, raw WebGPU. Complete.
3. **Compatibility.** 0006 (material); 0013 (an `authority` tag per batch would be added to `ViewModel`).
4. **Invariants.** (1) `renderer.init()` is awaited before the first draw (`labRenderer.ts:127-128`) [fact]. (2) A software rasteriser is never labelled physical (`gpuCapability.ts`). (3) `?forceWebGL=1` forces WebGL2 (`lab/flags.ts:9`) [fact]. (4) One `InstancedMesh` per batch (`labRenderer.ts:190`).
5. **API.** `ViewModel` in, stats out. Nothing speculative.
6. **Risks.** The WebGPU path is unexercised on a physical GPU (stated). Shader parity is unknown.
7. **Tests.** e2e "renders a non-blank scene on a reported backend", "falls back to the WebGL2 backend when forced", "never labels a software rasteriser as a physical GPU". *Missing:* any physical-GPU row (manual test pending).
8. **Accuracy.** Matches code [fact]. Capability-probe details were not re-run.
9. **Owner questions.** (1) Run the manual WebGPU test before the Phase 0 gate, or waive it to the start of Phase 1 (review package D5)?
10. **Recommendation: approve**, conditional on D5. It does not block Phase 1 domain code.

## ADR 0006 — Ink visual strategy

1. **Purpose.** World-anchored tri-planar hatching, quantized light, grain, haze; shadows deferred.
2. **Options.** Screen-space, UV, world tri-planar, shadow maps. *Missing:* **object-space (instance-local) anchoring**, which the plan allows ("world/object anchored", §2.1). It is the natural choice for moving fragments and folding panels.
3. **Compatibility.** [fact] Hatching and grain sample `positionWorld` (`materials.ts:114-115,139-141`). [inference] On geometry that moves relative to the world (folding panels per 0003, fragments per 0013 layer C, `dust` motion), the pattern slides across the surface. The projection plane also switches abruptly when a folding panel's dominant normal axis changes (`materials.ts:98-115`). This tension with 0003 and 0013 is not recorded.
4. **Invariants.** (1) Tone bands avoid multiples of 0.2 (bias `BOUNDARY_BIAS = 0.003`, `materials.ts:45`). (2) Reduced motion gives pixel-identical frames (e2e).
5. **API.** `LookSettings`, `InkScale` (`viewModel.ts:30-35`). Per-scene constants (`scene.ts:58-59`) [fact].
6. **Risks.** Hatch swimming on moving geometry (above); 1-px lines; no numeric stability metric.
7. **Tests.** e2e value split, reduced-motion pixel identity, compare mode. *Missing:* a motion-stability metric (§12 "stable hatching across motion"; Phase 5 exit).
8. **Accuracy.** "Sky factor 0.16" is at `materials.ts:123` [fact]. The other claims match.
9. **Owner questions.** (1) Aesthetic acceptance: decided through review package D1 (the narrower V1–V5 criterion), not through this ADR? (2) Hatching on moving pieces: world-anchored (slides) or object-anchored (moves with the piece)?
10. **Recommendation: approve** as a technical direction only, amended with the moving-geometry consequence. **Defer** aesthetic acceptance to D1.

## ADR 0007 — Component data and system order

1. **Purpose.** Components are plain discriminated-union data. No systems in Phase 0; class `extends` is banned by lint in `packages/**`.
2. **Options.** Class hierarchy, generic ECS, data plus later systems. Complete.
3. **Compatibility. Conflict:** 0007 says "Phase 1 should add the first systems (attachment/bonds and composition) and record the order in a new ADR". The decisions README "Pending" table and ADR 0011 ("Tick… system order are decided in the Phase 4 ADR", Q5) put system order in **Phase 4**. Also, **no Phase 1 ADR (0010–0013) covers bonds**, although bonds are a Phase 1 deliverable (§11) and a runtime constraint (§4.2).
4. **Invariants.** (1) Definitions contain no functions and round-trip through JSON. (2) Unknown crease refs give `component-unknown-crease` (`validate.ts:248-253`). (3) No class `extends` in `packages/**`.
5. **API.** `ComponentSpec` union (`definition.ts:46-52`) [fact]. Factories `foldable`, … (`:80-88`).
6. **Risks.** [fact] `renderable.material` values are appearance names (`"paper"`, `"ink-paper"`, `"ash-paper"`, `"charcoal-paper"`; `catalog.ts:200-256`), and ADR 0010 reuses `MaterialId` as the conservation key (see 0010).
7. **Tests.** "definitions round-trip through JSON to deep-equal values" (both suites). *Missing:* the Phase 1 exit test "roof and leaf share behaviour without inheritance" needs at least one system.
8. **Accuracy.** Correct at `ae696c5` [fact]: `eslint.config.js:5-14,43-45`. **In flux (A2):** the ban now applies to every first-party `.ts`/`.tsx` (`eslint.config.js:134-135` after A2; `AGENTS.md` updated). The consequence "the lint gate only covers `packages/**`" is therefore stale once A2 stands.
9. **Owner questions.** (1) Does Phase 1 add systems (bonds/attachment, composition) **without** a tick, with system order fixed in Phase 4, or must Phase 1 decide the order? (2) Should bonds get their own Phase 1 ADR before code? (yes/no)
10. **Recommendation: amend.** Replace "record the order in a new ADR" with the owner's answer to Q1 and align the README Pending table and ADR 0011 Q5 with it.

## ADR 0008 — Assembly promotion and canonical hashing

1. **Purpose.** Named, versioned recipes; FNV-1a 64 canonical hash for duplicate detection; level ordering; depth bound; cycle rejection.
2. **Options.** Free nesting, content-addressed only, named + hash. Complete.
3. **Compatibility.** 0011 reuses FNV-1a for state hashes and 0010 cites the sort key. **A1 (in flux)** adds `contract?: ContractRef` to recipes and deliberately keeps it **out** of the hash (commit `ffd2cc4` message). That decision is recorded in no ADR. 0012 relies on "hashes cover part references, not sockets", which is true (`assembly.ts:82-92`).
4. **Invariants.** (1) The hash ignores part ids, order and name but not rotation. (2) Different ids with an equal hash give `duplicate-recipe` (`registry.ts:148-159`). (3) A nested level is strictly below its parent. (4) Cycles give `assembly-cycle`. (5) [fact] **Depth ≤ 3 follows from (3) with levels `1|2|3`, so `depth-exceeded` is unreachable** (`registry.ts:128-141`). (6) A declared contract (A1) holds at rotation 0 or the recipe fails.
5. **API.** `createCatalog(input): Result<Catalog, ValidationIssue[]>`, `recipeHash`, `Catalog.flatten(id, version?)`. A1 adds `Catalog.satisfiesContract(assembly, contract, rotation, versions?)`. `flatten` has **no pose parameter** (`registry.ts:186-191`), which matters for ADR 0010's `instantiate`.
6. **Risks.** False duplicates from FNV collisions (stated). Versioning discipline is unenforced (stated). The inert depth guard gives false assurance.
7. **Tests.** `assembly.test.ts` (cycle, level, duplicate, overlap, incompatible sockets, flatten = mask, JSON round trip, hash invariance). A1 adds eight contract tests (`assembly.test.ts:213-293` after A1). *Missing:* any depth test, which cannot be written while the bound is unreachable.
8. **Accuracy.** "Depth bound: `MAX_ASSEMBLY_DEPTH = 4`" is true in code but **misleading**: it never constrains anything. Other claims match.
9. **Owner questions.** (1) Make the depth bound meaningful (raise the levels to L1–L5 per §4.1, where depth 4 can bind) or drop `MAX_ASSEMBLY_DEPTH` and state "depth ≤ 3 by level ordering"? (2) Record A1's "contract is not hashed" decision in this ADR? (yes/no)
10. **Recommendation: amend.** Add "the depth bound is implied by levels and is currently inert" and a paragraph recording A1's contract and hash decision.

## ADR 0009 — Socket compatibility (Phase 0 record)

1. **Purpose.** A symmetric profile-pair table plus geometric face agreement. It records that the tangent clause is inert.
2. **Options.** Per-pair lists, directional table, symmetric table. Complete.
3. **Compatibility.** Amended by 0012 once approved. A1 contracts constrain boundary **profile sets** only.
4. **Invariants.** (1) One socket per external face (`validate.ts:200-240`). (2) Compatible means coincident positions, opposed normals and an allowed pair (`definition.ts:159-167`). (3) `open` matches anything (`definition.ts:154-157`).
5. **API.** `socketsCompatible(a, b): boolean`, `faceSockets(footprint, profiles)`.
6. **Risks.** `open` wildcard; no orientation (stated). [fact] `validateFoldon` does not check that `profile` is one of `socketProfiles` at runtime; a JSON-loaded unknown profile is just never compatible.
7. **Tests.** "two box shells stacked vertically…", "a box shell beside a roof's eave side…", "touching parts with incompatible sockets…", "every rotation keeps placed sockets…". No tangent test (correct; [fact] `grep -i tangent packages/foldon/test` is empty).
8. **Accuracy.** Verified [fact]: `faceTangent` (`definition.ts:113-115`) gives +y on side faces; yaw preserves Y (`transform.ts:35-46`); so `definition.ts:164` never rejects a pair. The watchtower `band-beam` P06 at rotation 1 (`assemblies.ts:46`) has −z tangents on its −y faces against the shaft's +x, which is why the ±y exemption exists. Minor: "nothing but `empty` can sit on" P06/P07 should read "nothing but `empty` or `open`" (moot today: every −y is `base`).
9. **Owner questions.** None beyond 0012.
10. **Recommendation: approve** as an accurate record of Phase 0 behaviour, to be amended by 0012.

## ADR 0010 — Runtime identity, ownership, lineage (Phase 1 design)

1. **Purpose.** An entity table with one `owner` union, ids `(revision, ordinal)` minted on commit, an append-only lineage, and integer conservation.
2. **Options.** Identity: path, counter, hash `(seed, revision, parent, counter)`, `(revision, ordinal)`. Ownership: union, separate collections, fragment type. Conservation: count, integer quantity, float mass. *Missing:* **a per-entity creation counter inside the world state combined with recorded patches** (counter restoration is free when rollback is "do not swap", per ADR 0011, so the counter con is weak). Also **split that keeps the parent id for one child** ("chip off").
3. **Compatibility.** Depends on 0011 (revision and commit). 0013 needs `ContinuousTransform` (undefined here). 0012 sockets are checked at commit. **Gaps:** no fold state (0003); no bonds (0007); `instantiate` takes a `FlatInstance`, which carries no world pose because `flatten` has no pose parameter (`registry.ts:186-191`).
4. **Invariants.** The ADR's 1–9 are testable. Amend #4 to: "deterministic given the same initial state and the same **committed patch sequence**". Add: (10) a minted child's stamp is strictly greater than every parent's stamp, including parents created in the same patch.
5. **API.** `Entity`, `Owner`, `EntityOp`, `LineageRecord`, `applyEntityOps`, `cellOccupant`, `checkEntityInvariants`. Speculative or underspecified: `GroupId` minting (who mints it, when), `group` on `detach`/`attach` (kept? cleared? set?), `SplitChild`/`MergeResult` shapes, and `ContinuousTransform` (rigid only, or with scale? see 0013).
6. **Risks.** (a) **Ordinal canon:** the sort key `(group, anchor, rotation, definition)` is undefined for creations with no anchor (split or merge children, inventory). It can also order a child before a parent created in the same patch, which breaks the "strictly later stamp" acyclicity argument [inference]. (b) **Conservation key:** [fact] `MaterialId` values are appearance names (`catalog.ts:200-256`), while §4.2 separates appearance from mechanics. (c) Branching (stated). (d) Tombstones (stated).
7. **Tests.** The 15 planned tests are good. *Add:* "a split child created in the same patch as its parent gets a later stamp"; "detaching keeps (or clears) the group as decided"; "instantiating the same assembly at two world poses yields disjoint occupied cells".
8. **Accuracy.** [fact] Wrong anchors: `assembly.ts:59-67` → `41-49`; `:126-130` → `108-112`; `:80-86` → `62-68`; `overlapIssues :183-203` → `165-185`; `recipeHash :100-110` → `82-92`; `registry.ts:277-282` → `168-179` (path at `171`); `:298` → `189`; `state.ts:51-62` → `11-22`; `labReducer :130-155` → `90-115`. Option 4 con "workers cannot mint ids" is **inaccurate under 0011's strict equality**: a proposal can only commit at `baseRevision + 1`, so a worker could pre-compute `(base+1, ordinal)` [inference]. World minting is still the better choice because it survives a future rebase.
9. **Owner questions.** The ADR's Q1–Q7, plus: (8) Does a split always consume the parent (all children new ids), or may one child keep the parent id? (9) Conservation key: appearance `MaterialId`, definition id (piece count per type), or a separate matter class? (10) On `detach`, is `group` kept, cleared, or kept until reattached elsewhere? (11) Who mints `GroupId`: the world on commit, like `EntityId`?
10. **Recommendation: amend, then approve.** Fix the anchors; reword invariant 4; define the ordinal as "position in the committed patch's op list, then child index", with `plan` and solvers responsible for canonical op order; add a world pose to `instantiate`; answer Q8–Q11. **Blocks Phase 1 code.**

## ADR 0011 — Atomic transactions and revisions (Phase 1 design)

1. **Purpose.** Frozen snapshot truth; `applyPatch` validates on a draft and swaps on success; strict stale rejection; a commit log of outcomes for replay; a header carrying versions.
2. **Options.** Immutable + pure commit, mutable + undo, event sourcing, snapshot + outcome log. Complete. *Missing as a recorded alternative:* optimistic concurrency by **region read-set** from day one, since the Phase 2 frozen boundary is already a read-set.
3. **Compatibility.** Wraps 0010 ops; checks 0012 sockets; records 0013 fragment floats. The tick question conflicts with 0007 (see 0007). The roadmap Phase 2 frozen-boundary solve depends on its stale rule.
4. **Invariants.** The ADR's 1–9. Add: (10) **op preconditions are checked in order against the draft; invariants are checked on the final state only**, so a swap of two pieces in one patch is legal. (11) **Replay validates with the rules and catalog versions in the snapshot header and refuses a mismatch.**
5. **API.** `applyPatch`, `plan`, `replay`, `hashState`, `serializeSnapshot`, `parseSnapshot`, `createWorld`. `Rules` and `Command` are undefined; `Rejection` lacks job-level outcomes (`cancelled`, `unsatisfiable`, `budget`, §8.1). That is acceptable if those stay job results, not commit results; say so.
6. **Risks.** (a) [inference] **Starvation is certain, not possible,** once anything commits per tick: §6.1 runs 30 Hz ticks and §9.1 allows 250 ms solves. (b) O(n) copy and hash per commit (stated). (c) Replay hides `plan` bugs (stated). (d) Float canonicalisation: `Number#toString` is fully specified by ECMAScript, so hashing recorded floats is portable [inference]. Reject `NaN`/`-0` (stated; `canonicalizeAndFreeze` already folds `-0`, `define.ts:5-20`).
7. **Tests.** The 13 planned tests are good. *Add:* "a patch that swaps two placed entities commits"; "replay against a different rules version is refused"; "a proposal whose read region was untouched by an intervening commit is still rejected under strict equality" (pins the Phase 1 rule so Phase 2 can change it deliberately).
8. **Accuracy.** [fact] Wrong anchors: `labReducer state.ts:130-155` → `90-115`; `clampUnit :95` → `:55`; seed normalised `:97` → `normalizeSeed :57-59`; `registry.ts:183-270` → `74-161`, gate `:270` → `:161`; `compileAssembly assembly.ts:257-287` → `239-269`; freeze `:285` → `:267`; FNV `assembly.ts:80-110` → `62-92`.
9. **Owner questions.** The ADR's Q1–Q7, plus: (8) Do ticks that change nothing consume a revision? If ticks commit every tick, is read-set rebase a **Phase 2 exit requirement** rather than "if livelock appears"? (9) Must replay refuse a log recorded under different rules or catalog versions? (yes/no)
10. **Recommendation: amend, then approve.** Fix the anchors; add invariants 10–11; make rebase a Phase 2 requirement conditional on Q8. **Blocks Phase 1 code.**

## ADR 0012 — Directional sockets (Phase 1 design)

1. **Purpose.** An in-face turn on ±y sockets, per-profile rotational symmetry (C1, C2, C4), a side-face `hand`, one versioned table, and mismatch reasons.
2. **Options.** Turn + pairs, per-orientation profile names, symmetry + turn, predicate functions; hand flag vs splitting faces vs a wider group. Complete. [fact] The WFC experiment already used face-specific profiles that rotate with the tile (`door`/`road`, `tiles.ts:25-34,59`), which is evidence for gap item 4.
3. **Compatibility.** Amends 0009. The `rules` version goes into the 0011 header. **A1 contracts (in flux)** list allowed boundary **profiles** per side and include `open`/`empty` (`assemblies.ts` `moduleContracts`, after A1); they would need turn and hand semantics or an explicit "orientation-free" statement. Phase 2 solver variant de-duplication by symmetry depends on the declared symmetry.
4. **Invariants.** The ADR's 1–10, with #3 restated: "if either profile of a pair is C4, every Δ is accepted". Add: (11) **rotating one piece by an element of its profile's symmetry group never changes compatibility.**
5. **API.** `SocketTable`, `socketMismatches`, `turnOf`, `validateSocketTable`, `socketsCompatible` (wrapper). `SocketOrientation` in the sketch duplicates information already carried by `face` and `tangent`; drop it unless a caller needs it.
6. **Risks.** [inference] **The turn rule uses `m = gcd(sym(a), sym(b))`. It must be `lcm` (= `max` for divisors of 4).** Relative turns that are indistinguishable form the subgroup generated by both symmetry groups, which has order lcm. Example: `deck` (C4) under a new `rail` (C2) with relation 0. A box at rotation 0 under a beam at rotation 1 gives Δ = 1, which is rejected. Turn the identical-looking box to rotation 1 and Δ = 0, which is accepted. With `gcd` the answer depends on an invisible rotation. Other risks as stated.
7. **Tests.** The 13 planned tests are good. *Add:* "a quarter-turned fourfold-symmetric piece never changes whether an oriented piece mates with it" (catches the gcd bug).
8. **Accuracy.** [fact] Correct: `definition.ts:30-31,34-44,113-115,154-157,159-167`; `validate.ts:227-230`; `transform.ts:35-46,84-93`; `catalog.ts:200-254,247`. Wrong: `facingIssues assembly.ts:207-229` → `189-211`; external sockets `:270-275` → `252-256`; hash `:100-110` → `82-92`. `foldon.test.ts:308,:323` point inside the tests that start at `297` and `311` (acceptable).
9. **Owner questions.** The ADR's Q1–Q7, plus: (8) Approve correcting the symmetry rule to lcm/max? (yes/no) (9) Should module contracts (A1) carry turn and hand per boundary side? (yes/no/later)
10. **Recommendation: amend, then approve.** Fix the formula and anchors. **Blocks Phase 1 socket code.**

## ADR 0013 — Logical vs rendered geometry (Phase 1 design)

1. **Purpose.** Layer A logical placements (authority), B bounded per-entity decorative offsets (derived), C fragments (authoritative continuous transforms), C′ backdrop (no authority). Plus a rebuild experiment.
2. **Options.** Status quo, render logical only, three layers, continuous transform per placement, irregular lattice. *Missing:* **group-level offsets** (one transform per assembly instance, which is how the current scene leans towers: `district.ts:87,98`). Also **outline suppression on internal faces** inside a group, against the "window grid" look (ADR 0002 consequences).
3. **Compatibility.** Uses 0010 (`EntityId`, `GroupId`), 0011 (floats recorded), 0002 (grid). **Conflicts:** (a) layer C's initial transform equals pose **plus offset**, but invariants 1 and 4 say offsets never affect state; (b) the envelope includes non-uniform scale while the fragment transform is "position, orientation, optional velocity", so scale jumps at detach; (c) invariant 5 ("every vertex within margin of the footprint") is violated by fold poses (0003 risk (a)); (d) 0006 world-anchored hatching on moving fragments.
4. **Invariants.** The ADR's 1–9. Amend #5 to "at the rest pose". Add: (10) a fragment's initial transform is computed from the logical pose only, never from a look preset.
5. **API.** `deriveOffset(seed, id, envelope)`, `Envelope`, `RenderLayer` (`authority` tag), `buildRenderLayers`, `generateBackdrop`. `renderedBounds` is speculative until the margin rule is settled.
6. **Risks.** As stated, plus: per-entity offsets on a 24-box tower give jitter, not lean. A 4° whole-tower lean moves the top of a 6-high tower by about 0.42 cells, beyond the illustrative 0.15 margin [inference].
7. **Tests.** The 11 planned tests are good. *Add:* "detaching an entity yields the same state hash with and without a look preset" (catches conflict a).
8. **Accuracy.** [fact] Correct: `affine.ts:4-10,27-36,60-70`; `district.ts:5-8,87,91-98,169,183-203,205-219,229`; `referenceScene.ts:15,32-36`; `transform.ts:6-13`. **Wrong:** `assembly.ts:183-229` → `165-211`. House scale "about 3.1–6.2" is about **3.35–5.43** (`lerp(5.4,3.4,t)·[0.9,1.15]`, t ∈ [0.34,0.84], `district.ts:135`). **Omitted:** the largest deviations, eight P08 slabs of about 8–14 × 34–62 units (`district.ts:102-113`), ground slabs 620 units wide (`:41-50`), and P04 mounds (`:173-179`). The rebuild experiment must cover them.
9. **Owner questions.** The ADR's Q1–Q8, plus: (9) Are offsets keyed per group (assembly instance) as well as per entity? (yes/no) (10) Does a fragment start from the logical transform (recommended) or the rendered one? (11) Does `ContinuousTransform` carry scale? (yes/no)
10. **Recommendation: amend, then approve.** Resolve conflicts (a)–(c), fix the context list and the anchor. **Blocks Phase 1 code** (layer model) but not the rest of Phase 1.

---

## Cross-cutting findings

### Cubic grid vs origami aesthetic (0002, 0006, 0013)
- [fact] The look under review depends on per-instance non-uniform scale (`district.ts:87` 4.4×7.4×4.4; slabs `:102-113`), arbitrary pitch and roll (`:169,229`) and free beams (`beamBasis`, `affine.ts:60-70`). The logical model has none of these (0002).
- [fact] Look-dev already records that stacked outlined P08s read as window grids. So rebuilding slabs from unit cells will look worse unless something changes.
- **Recommended position:** keep the cubic yaw-only grid for Phase 1. Run the 0013 rebuild experiment **before the Phase 2 solver fixes cell size and catalog**, as proposed. Allow these levers in the experiment: group-level offsets, internal-edge outline suppression per group, larger-footprint primitives and non-unit vertical cell size. All are data or render choices, not new abstractions. The owner's visual verdict on that experiment is the gate for §13's "toy-like world" risk.

### Socket orientation and the inert tangent gap (0009 vs 0012)
- [fact] `socketsCompatible` (`definition.ts:159-167`) checks position, opposed normals and profiles only. Line 164 is vacuous for side faces (+y tangent preserved by yaw) and skipped for ±y faces. `faceTangent` is at `:113-115`.
- 0012 correctly reuses the stored tangent as the turn (`rotateDirection` maps +x → −z → −x → +z for rotations 0–3, `transform.ts:39-44`) [fact]. Hand semantics (left mates right across a face) check out [inference: the two outside viewers face opposite directions, so lateral sides swap].
- **Position:** adopt 0012 after the lcm fix. Keep all current profiles C4 so behaviour is unchanged. Make the first oriented profile a test-only fixture.

### Typed module boundaries (0001, 0008, A1 in flux)
- [fact, in flux] A1 (`ffd2cc4`) adds `ModuleContract { size: 2|4 × 2|4, height?, boundary: per-side allowed profiles }`, `recipe.contract?`, validation at `createCatalog` (rotation 0) and `satisfiesContract(…, rotation)`. The contract is not hashed. It replaces the old `module-2x2`/`module-4x4` tags.
- Observations: (1) the decision is not in any ADR (0008 is the natural home); (2) allowing `open` in a contract boundary means the contract guarantees nothing on that side; (3) contracts are orientation-free and will need a decision once 0012 lands; (4) `ModuleSpan = 2|4` hard-codes the §14 sizes, which is fine for Phase 0 but should be stated as provisional.
- Package import boundaries were unenforced at `ae696c5` (`docs/architecture/overview.md`). **In flux (A2, `04bd36b`):** they are now ESLint-enforced, with dependency-rule tests in `tools/architecture`. The remaining gap is sibling-package imports from `foldon` (see 0001). **Position:** extend A2 so `foldon` imports no workspace package before `@eschaton/world` exists (0001 Q1). Record A1 in 0008 and A2 in 0001 and 0007.

### Stable entity identity on detach vs newly minted ids (0010)
- **Keep the id** through every ownership change (`placed ↔ detached ↔ inventory`, reattach into a different structure). §11.1 ("the same fragments … reconstruct") and 0013's offset stability both require it. Agree with 0010.
- **Mint new ids** only for: `instantiate` (new matter under a source policy), every `split` child, and every `merge` result. Parents become `consumed` tombstones. Whether one split child may keep the parent id is an owner choice (0010 Q8). Recommendation: no, because it keeps lineage edges uniform.
- **Determinism:** `(revision, ordinal)` is unique and replay-stable because replay re-applies recorded patches. Under async workers it is deterministic **given the commit order**, which is itself decided by arrival unless the scheduler commits job results at tick boundaries in job-id order (§6.1). Reword 0010 invariant 4 accordingly and leave live-run determinism to the Phase 2/4 scheduler.
- **Hash `(seed, revision, parent, counter)`** has the same revision dependence, adds collision risk (FNV-1a), and its only advantage (worker pre-minting) is already available under strict equality. Recommendation: 0010 option A.
- **Ordinal:** define it as op position in the committed patch plus child index. Put the canonical-order obligation on `plan` and the solvers. This covers creations with no anchor and keeps stamps parent-before-child.

### Conservation and lineage (0010; Phase 6 rebirth)
- Conserved quantity: integer `quantity` per key, with the total **derived** by summation at commit against a stored `baseline`. There is no running ledger, so there is one truth (correct per AGENTS.md "derived caches are not truth"). An incremental counter is allowed only as a cache verified by `checkEntityInvariants`.
- The key is the open issue: appearance `MaterialId` is the wrong axis (§4.2) [fact for the values; inference for the conflation]. For the §6.3 "finite inventory demo", conserving **live entity count per definition id** is enough, because rebirth reuses the same entities. Material quantities are only needed once splits or merges change piece types.
- Acyclicity holds by stamp order only if children are minted after parents within a patch (see ordinal).
- Closed mode must forbid `consumed: destroyed` and any `instantiate`. That follows from invariant 8, but state it. Backdrop debris (0013 C′) is never counted or reusable. A Phase 2/6 WFC re-solve in closed mode cannot instantiate, so it needs inventory-bounded candidates. Flag this as a Phase 6 research item, not a Phase 1 change.

### Atomic revisions and stale proposals (0011)
- Base-revision check: strict equality is fine for Phase 1, where only UI commands commit. Workers: a proposal is a `Patch` with a frozen base, which is inert until `submit`. Ordering: whichever valid patch arrives first wins; the loser is `stale` and consumes nothing.
- Partial failure: none by construction (draft + swap). Specify op-sequential preconditions and final-state invariants (amend 0011).
- **Position:** keep strict equality for Phase 1. Make read-set (frozen-region) rebase a Phase 2 deliverable if ticks will commit revisions (0011 Q8), because otherwise Phase 4 local re-solves can never commit.

### Rollback and replay determinism (0011 + 0004 + `Math.log`)
- Rollback means not swapping the reference, which is exact.
- Replay applies recorded patches and never re-runs WFC or physics, so it is engine-independent provided the canonical serialisation is (it is, per the ECMAScript `Number#toString` specification; integers dominate the state).
- Generation determinism ("same seed → same world", §12, Phase 2 exit) is **not** covered by replay. [fact] Entropy uses `Math.log` with a `1e-9` tie tolerance (`experiments/wfc-placement/src/util.ts:26,32`). Weighted choice uses only IEEE basic operations, which are correctly rounded everywhere. **Position:** the Phase 2 determinism scope should say either "within one JS engine version; cross-engine reproduction via the commit log", or require integer-only entropy (for example integer weights and a fixed log table). This is the owner's call (0004 Q1).
- Replay across engine or rules versions: add 0011 invariant 11 (refuse on mismatch).

### Logical grid vs dynamic poses and decorative offsets (0013 vs 0003 vs 0002)
- Three kinds of dynamic geometry exist and only two are placed: decorative offsets (0013 B), fragment transforms (0013 C), and **fold poses (0003): unplaced.** [fact] `Entity` has no crease angles and validation bounds only the rest pose (`validate.ts:169-182`).
- **Position:** fold angles are per-entity runtime state. Either (i) authoritative, stored as integers or recorded floats in the commit and included in the hash, or (ii) decorative, derived like offsets. Occupancy always uses the footprint regardless of pose (§4). Record this in 0013 (or 0010) and scope 0013 invariant 5 to the rest pose.
- Offsets must never feed state (0013 conflict a). Fragments start from the logical transform; the renderer may ease the visual offset out.

### Closed-loop hinges (0003): risk to the origami goal and a research gate
- [fact] Tree-only hinges: P08 has 5 hinges and 4 free seams (`catalog.ts` `boxShell`). P07 has 4 base hinges and 4 free side seams (`pyramid`). Closed shells open like nets when they fold. That reads as "unfolding a box net", which may be acceptable, but it is not origami with closed vertices (Miura, waterbomb, twist).
- Who needs it: Phase 4 collapse animation ("folded debris"), Phase 6 rebirth ("fragments gather, unfold and connect", §6.2). Phase 1 does not.
- **Proposed gate (before the Phase 4 gate, no later than Phase 5):** a throwaway experiment that folds one closed-loop mechanism (a degree-4 rigid-foldable vertex, and P08 with its seams as loop constraints) with an iterative constraint solver. Report convergence rate, determinism (same input gives the same angles on one engine), cost per pose against the 16 µs P08 tree pose, and seam gap. The owner decides from screenshots whether closed folding is required for the look. Until then, 0003's "tree-only" stands, and the §1.2 non-goal ("fully general origami solver") stays.

### WFC integration (0004 + 0011 + 0012 + roadmap Phase 2)
- The solver compiles adjacency from the **same** `SocketTable` and matcher as the commit (0012), versioned in the header `rules` (0011). There is no second compatibility implementation.
- Symmetric-variant de-duplication (the experiment de-duplicates symmetric 1×1 tiles, README) must derive from the declared symmetry and footprint. A wrong C4 claim then also prunes legitimate variants.
- **Frozen boundary** = placed entities outside the region plus their sockets facing it. **Pins** = placed entities inside the region that must survive. Output = a `Patch` against `baseRevision`. Unchanged placements must **keep their `EntityId`** (§5.4). Specify that the solver emits "keep" for an identical `(definition, anchor, rotation)` rather than consume-and-reinstantiate. This is missing from 0010, 0011 and the roadmap text.
- Removed placements become `detach` (rubble) or `consume`, by scenario policy. In closed conservation they cannot be consumed.
- Module contracts (A1) are the natural slot test for hierarchical solving (§5.3 step 4) once they carry orientation (0012 Q9).

---

## Summary table

| ADR | Recommendation | Blocking owner question | Blocks Phase 1 code? |
|---|---|---|---|
| 0001 | Approve (note 0011 Q7) | 0011 Q7 (`@eschaton/world` package) | yes (package placement only) |
| 0002 | Approve; risk gated on 0013 experiment | Q1 accept open toy-cube risk | no |
| 0003 | Approve + one consequence line | Q1 may poses exceed footprint | no |
| 0004 | Approve | Q1 cross-engine generation determinism | no (Phase 2) |
| 0005 | Approve, conditional on D5 | D5 physical WebGPU test or waiver | no |
| 0006 | Approve technically; defer aesthetics to D1 | Q2 hatching on moving pieces | no |
| 0007 | Amend (system-order phase conflict, bonds) | Q1 systems in Phase 1 without tick? Q2 bonds ADR? | yes (systems and bonds) |
| 0008 | Amend (inert depth bound; record A1 contract/hash) | Q1 depth bound vs levels | no |
| 0009 | Approve as Phase 0 record | none | no |
| 0010 | Amend, then approve | Q1 id scheme; Q8 split semantics; Q9 conservation key | **yes** |
| 0011 | Amend, then approve | Q1 architecture; Q8 tick revisions / rebase | **yes** |
| 0012 | Amend (lcm), then approve | Q8 symmetry rule fix | **yes** (socket code) |
| 0013 | Amend (state leak, groups, scale, poses), then approve | Q10 fragment start transform; Q9 group offsets | **yes** (layer model) |

## ADR pairs needing edits for consistency

- **0007 ↔ 0011 ↔ README Pending:** the phase in which system order is decided (Phase 1 vs Phase 4).
- **0010 ↔ 0013:** `ContinuousTransform` contents (scale?); fragment initial transform (logical, not rendered); group offsets need a minted `GroupId`.
- **0010 ↔ 0011:** id determinism wording (commit log vs arrival); the option 4 con contradicts strict equality; ordinal defined by committed op order.
- **0010 ↔ 0008:** `instantiate` needs a world pose; `catalog.flatten` has none.
- **0012 ↔ 0008 / A1:** contract boundaries are orientation-free; record A1's hash decision in 0008.
- **0012 ↔ 0009:** once 0012 is approved, 0009 should carry "amended by 0012".
- **0003 ↔ 0010 ↔ 0013:** where fold angles live; 0013 invariant 5 scoped to the rest pose.
- **0006 ↔ 0003 / 0013:** world-anchored hatching on moving and folding geometry.
- **0011 ↔ 0001:** `@eschaton/world` creation noted in 0001.
- **0001 / 0007 ↔ A2 (in flux):** lint scope statements ("only `packages/**`", "checked by reading") become stale once A2 is accepted.
- **0010, 0011, 0012, 0013 ↔ code:** line anchors (see each ADR's section 8).

## Things I could not verify

- WebGPU on a physical GPU, and TSL graph parity (0005): no hardware here. Capability probes were not re-run.
- Cross-engine `Math.log` differences: inferred from the ECMAScript specification (implementation-approximated), not measured.
- That P08's flat net exceeds its footprint by about one cell: derived from `catalog.ts` `boxShell` hinge placement, not executed.
- The gcd → lcm correction for 0012: a group-theory argument plus a worked example, not executed (no code exists yet).
- All benchmark and timing numbers (0003, 0004, 0008): read from the README and the ADRs, not re-run.
- Screenshots and all visual claims (0002, 0006, 0013): not viewed for this review. Visual approval is the owner's alone.
- The motive of the P0.3 tangent change (0009): its commit has no body.
- Research claims R3, R5, R6, R8–R10: sources not re-read.
- Lint, typecheck, test and build: **not run** for this review. Nothing here claims they pass. A1 (`ffd2cc4`) and A2 (`04bd36b`, `eslint.config.js` and `tools/architecture`) are in flux and were reviewed only as far as described above. The `tools/architecture` tests were not read.
