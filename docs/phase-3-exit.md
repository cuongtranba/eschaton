# Phase 3 exit report: Genesis

- Phase: **3 — Genesis** (master plan v1.1 §11, amendments 1–2, and §5.3; plan in [`plans/phase-3-genesis.md`](plans/phase-3-genesis.md))
- Branch / PR: `phase-3`, draft PR against `main` @ `d673f84`. **Not merged.** The PR description records the final head and its CI run.
- Date: 2026-11-25
- Authorization: owner decision W7 ([`review/phase-2-owner-review.md`](review/phase-2-owner-review.md)): implement Phase 3 and stop at this gate. No Phase 3 merge and no Phase 4 work without a separate decision.
- Status: **WAITING AT THE PHASE 3 EXIT GATE for the owner's review.** Nothing here is approved yet.

## 1. Exit criteria (master plan §11, Phase 3 row) mapped to evidence

Tests import only package entry points (`@eschaton/genesis`, `@eschaton/world`, `@eschaton/foldon`) or drive the Studio in a real browser with a real worker. No mocks, spies or sleeps.

| Criterion | Evidence |
|---|---|
| Road and river contracts and boundaries valid | `genesis/plan`: "a plan has a river, connected roads, a plaza and lots of several roles"; "twelve seeds give twelve different plans that satisfy every global constraint"; "the validators catch a road that was cut and a lot placed on the river". `genesis/district`: the audit re-derives road connectivity from every gate to the plaza **in the committed world**, and checks that no structure stands on a road, the river or outside its lot: "ten seeds give ten distinct districts that all pass the plan validators, the world invariants and the audit"; "a result whose world would not match its plan is refused by the audit" |
| Recognisable architecture and terrain | For the owner to judge: `screenshots/p3-genesis-*.png`. Towers stand at the plaza, houses along the roads, ruins and gardens further out. Terrain is land and water only (ADR 0017, choice 1) |
| At least 10 distinct valid seeds for one preset | Unit test above (10 seeds, 10 distinct hashes, zero invariant or audit issues). Recorded corpus of 12 seeds with metrics: [`../benchmarks/phase-3/2026-11-25-62cf1e36a/genesis-district.md`](../benchmarks/phase-3/2026-11-25-62cf1e36a/genesis-district.md) |
| No finished building meshes in the core catalog | The only new definitions are three flat single-cell ground presets (`paving`, `water`, `bridge`). Structures are composed by the solver from the Phase 0–2 catalog and presets |
| Look reached through validated logical placements, bounded decorative offsets and a separate backdrop (ADR 0013) | Every generated piece is a logical placement committed through `applyProposal`. Decorative offsets are the existing look-dev toggle and apply to generated districts (`p3-genesis-district-offsets.png`). The backdrop stays separate and labelled; **it is hidden once the camera reframes on a district** (limitation, §7) |
| Every proposal declares and is checked against its nonlocal dependencies (ADR 0016 amendment) | `world/region`: a change inside a declared dependency is a conflict, an unrelated one is not. `genesis/district`: "a district that continues a neighbour's road conflicts when that road changes and commits when an unrelated piece does" |

Other requirements of the authorization (W7):

| Requirement | Where |
|---|---|
| Pipeline: coarse plan → network contracts → lot rules → local WFC → validated atomic proposal → derived renderer | ADR 0017; `packages/genesis/src/`; architecture overview, "Phase 3: district generation data flow" |
| WFC stays local; global constraints are separate code | The solver gets one lot and its role's tiles. River continuity, road connectivity, frontage and boundaries are in `plan.ts` and re-checked by `validate.ts` and `audit.ts`, which share no code with the planner |
| No competing world state, no hidden manual geometry | The job works on a private scratch world that is discarded; the world changes once through `applyProposal`. The plan is inspection data and is not stored in the world |
| Deterministic, seeded, hierarchical, stable scoped sub-seeds | "the same request gives the same plan"; "a scope seed does not depend on the order in which scopes are used"; "the same seed gives the same committed state hash". Same state hash on Chromium, Firefox and WebKit through a real worker (§4) |
| Retries, bounded failure, diagnostics, cancellation | Up to 6 plan attempts and 3 attempts per lot, each a new scoped seed, counted in the metrics; an empty lot is reported. "a cancelled job posts one cancelled result without a proposal and stops working"; e2e "cancelling a generation ends it as cancelled and leaves the world revision and hash unchanged" |
| Explicit failure when global constraints are impossible | "a road contract that needs a bridge fails explicitly when the rules allow none"; "a gate placed in the river fails explicitly"; "a district that cannot meet its road contract fails explicitly and commits nothing" |
| Pinned and exterior identities preserved | "a generated district commits as one revision … and keeps existing entities identical"; generation is refused on occupied ground and while conservation is closed |
| Batched commit; worker where appropriate | One proposal per district (about 1,200–1,600 placements, one revision). Generation runs in a Web Worker, sliced at 12 ms; the Studio stays interactive |
| Studio inspection: semantic layers, routes, seed, progress, diagnostics; renders the authoritative world | `ui/GenesisPanel.tsx`; e2e `genesis.spec.ts` (5 tests) |
| Profile district workloads including commits and memory | §5 |
| Replay | "a committed district replays from the log to the same state hash"; e2e replay match after generation |

## 2. Milestones

| | Scope | Commit |
|---|---|---|
| G0 | Proposal dependencies in the world; `paving`, `water`, `bridge` presets | `384ecef` |
| G1 | Scoped seeds; semantic planner; independent validators | `734d768` |
| G2–G3 | District job, audit, single settlement, neighbour continuation, lint area | `5c7b372` |
| G4 | Job host: snapshot in, sliced steps, progress, cancellation | `298d572` |
| G5 | Studio Genesis panel, worker client, e2e, screenshots | `4a073c0` |
| G6 | District workload benchmark; small scratch world; `draftProposal` | `5ab709e`, `4589217` |
| — | Cross-engine determinism fix and three-engine Genesis tests | `62cf1e3` |
| G7 | Documentation and this report | the commits after `62cf1e3` |

## 3. Outcomes and visual evidence

- One district is 40×40 cells: a river from the north edge to the south edge, three road gates joined to a central plaza (with a bridge where a road crosses the river), side streets, and 70–90 rectangular lots with the roles tower, house, ruin and garden.
- 12-seed corpus: 12 distinct state hashes; 1,372–2,117 entities per district; no plan retry, no lot retry and no empty lot was needed; zero invariant issues.
- Screenshots (headless Chromium, software WebGL2): `screenshots/p3-genesis-district-seed-{1,2,3}.png`, `p3-genesis-two-districts.png`, `p3-genesis-district-offsets.png`.
- These are prototype scenes. They show that the pipeline produces a valid, legible district layout. They are not final art.

## 4. Validation

Local run on the final code (machine under load, 14–20):

| Check | Result |
|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | Pass |
| `pnpm test` | 259 passed: foldon 50, architecture 70, world 67, wave 37, genesis 22, wfc experiment 13 |
| `pnpm e2e` (Chromium) | 34 passed, 2 failed. The two failures are the Phase 0 lab tests "selecting every catalog item updates the inspector title" and "switching items repeatedly does not grow GPU resources", which time out on this machine under load and passed in CI on every earlier head. All 5 Genesis, 5 Wave and the World tests pass |
| `pnpm --filter @eschaton/studio engines` | 18 passed: 6 tests on each of Chromium 159, Firefox 159 and WebKit 27.2 |

CI on the exact final head is the arbiter and is recorded in the PR description.

Cross-engine results (real worker, same seed):

- The Last District, seed 1, commits to state hash `5dc9053d2e6bd656` on all three engines and on Node.
- The preset catalog fingerprint is `e77d898a9014df16` on all three engines and on Node.
- **A defect was found and fixed here.** Before the fix the three engines gave three different catalog fingerprints, and so three different state hashes for the same district, because stored recipe numbers came from `atan2`, `sin` and `cos`. The defect predates Phase 3. The fix and its compatibility consequence are in ADR 0017, "Stored recipe numbers are engine independent"; it is decision 3 in §6.

## 5. District workload

Node main thread, Apple M5 Pro, clean tree at `62cf1e3`, load average 19–20 (not idle). Full tables: [`../benchmarks/phase-3/`](../benchmarks/phase-3/README.md).

| Measure (12-seed corpus, one district into an empty world) | p50 | p95 |
|---|---:|---:|
| Generate (plan, network, about 80 lot solves) | 144.6 ms | 250.3 ms |
| World commit alone (`applyProposal`) | 37.3 ms | 49.9 ms |
| Settle (plan re-validation, commit, audit) | 41.4 ms | 57.2 ms |

Six districts chained to the east in one world:

| District | World entities | Generate | Commit | Settle | State hash | Snapshot parse | Heap after GC |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1,591 | 136 ms | 25 ms | 30 ms | 3 ms | 0 ms | 18.9 MiB |
| 3 | 4,724 | 223 ms | 89 ms | 89 ms | 15 ms | 65 ms | 25.5 MiB |
| 6 | 9,158 | 247 ms | 111 ms | 123 ms | 28 ms | 126 ms | 34.4 MiB |

- **Generation does not grow with the world.** The first implementation did (474 → 2,959 ms over three districts). The profile showed that the per-lot scratch commits read and hashed the whole world; the scratch world and `draftProposal` removed that (ADR 0017).
- **What still grows with the world:** the one real commit, the audit, the state hash and the snapshot handed to the worker. All are linear. At about 9,000 entities a district costs roughly 250 ms of main-thread work at settle time under this load.
- Through the real worker in a browser, one district round trip was 311 ms (WebKit), 779 ms (Firefox) and 1,432 ms (Chromium) with settle at 42–219 ms, in the engines run on the dev server under load. These are single samples from a functional test, not a benchmark.

## 6. Decisions for the owner at this gate

1. **Phase 3 gate:** pass, pass with conditions, or keep open. Merging the Phase 3 PR needs your explicit approval. Phase 4 needs its own authorization.
2. **Visual review** of the generated districts (§3): is this "recognisable architecture and terrain" at prototype level?
3. **Cross-engine catalog fix (ADR 0017):** stored recipe numbers are rounded to a 1e-9 grid. This changed the fingerprint of every catalog containing P03 or P09, so snapshots and logs written before it are refused as `catalog-mismatch`. None are stored in the repository. Confirm, or direct a different fix.
4. **ADR 0017, choices 1–8:** terrain is land and water only; roles and tile sets are preset data; lots are solved in a fixed order; the plan is not stored in the world; `draftProposal` is a new public world function; the scratch world holds copies of shell pieces; the 1e-9 grid; the Studio lays districts out in a row to the east.
5. **Cross-engine determinism as a product promise.** It now holds for the catalog fingerprint, the solver and a generated district on the three engines tested. Whether to promise it, and for which browsers, is yours to decide (carried over from Phase 2).
6. **Still open from earlier phases, not decided here:** conservation key (ADR 0010 Q9); group on detach (Q10); tombstone compaction (Q5); socket-table placement interpretation (ADR 0012 Q5); Studio offset toggle details and the UI-only `homes` map; hatching on moving pieces (ADR 0006); an incremental state hash (a hash-format change, ADR 0011).
7. **Outstanding manual checks, not waived:** the Windows RTX 5070 test and the human checks C5 and C6.

## 7. Risks and known limitations

- **One preset, one size.** `lastDistrict` is 40×40 with a fixed boundary contract. The planner takes other sizes and gates, but only this preset is tested as a corpus.
- **No hierarchical backtracking.** A lot that cannot be filled is retried with new seeds and then reported empty; the plan is not revised. It did not occur in the corpus because air is always allowed.
- **Lots are solved in order.** A later lot adapts to earlier ones, never the reverse.
- **The plan is not persisted.** A world reloaded from a snapshot has its entities but not its plan, so the plan map and `continueFrom` are unavailable for it.
- **Continuation is one direction in the Studio** (east), and a continued district depends on the first 12 cells of each road it attaches to, not on the neighbour's whole network.
- **Only empty ground.** Generation is refused when the district box holds any entity; generating around pins is Phase 2's region solve, not Phase 3's district.
- **Terrain is flat.** Land and water only; a bridge is a ground piece at the same level.
- **Settle cost grows with the world** (§5). Nothing was done about the commit, hash or snapshot cost beyond what Phase 2 did.
- **The backdrop is hidden after generation** because the camera reframes on the district. The plan map legend and the metrics are plain; the entity list in the inspector becomes long (one row per entity).
- **The 1e-9 grid is a rounding rule**, not a proof of cross-engine equality; the engines job pins the fingerprint so a regression fails in CI.
- **Benchmarks were recorded on a busy machine.** Loads are stated with every number.
- **Home machine:** any unpushed work there is unknown and was not inspected.

## 8. Addendum: merge and closure audit (2026-11-26)

Sections 1–7 are the report as written at the gate on 2026-11-25 and are left unchanged. This section records what happened after it.

- **Merge.** PR #4 was merged into `main` on 2026-11-26 as `870ef62`, on the owner's explicit merge-only instruction. Main CI run 45757095399 was green on both jobs. That instruction authorized the merge only. It was **not** a gate pass, a visual approval, an ADR 0017 approval or a waiver of the manual checks. The header line "Not merged" above describes the report at the time it was written.
- **Closure audit:** [`review/phase-3-closure-audit.md`](review/phase-3-closure-audit.md), on branch `phase-3-closure`.
  - A defect fixed test-first: finite winds above about 1.3e154 were rejected after `62cf1e3`.
  - The wind-formula change is disclosed in ADR 0017, and its versioning is offered to the owner as choice 9.
  - The golden-hash provenance to the pre-W3 commit path is restored by reproduction.
  - Full-catalog coverage is back in Node unit tests through a value that was already recorded.
  - A second defect fixed test-first: `settleDistrict` trusted the result's district box and declared dependencies, so a continuation whose result had lost its `depends` committed without the neighbour-road check.
  - A second review closed two gaps in settlement, test-first: a malformed result could make it throw, and a plan for other road gates or another river than the request was accepted (audit §4.13).
  - Unit tests: 280 on the branch, against 269 on `main`. Engines: 21, against 18.
- **Visual walkthrough** on a physical Apple GPU (WebGPU on Metal, not the RTX 5070): [`review/phase-3-visual-walkthrough.md`](review/phase-3-visual-walkthrough.md). Observations only; not an approval.
- **Still pending for the owner:**
  - the gate decision (§6.1) and the visual review (§6.2);
  - ADR 0017 choices 1–9;
  - cross-engine determinism as a promise (§6.5);
  - the RTX 5070 test C1–C6;
  - the carried-over questions (§6.6).

## 9. Addendum: owner decisions of 2026-11-27

Sections 1–8 are left unchanged. The owner decided four items by explicit instruction on 2026-11-27. They are recorded, with their source and limits, in [`review/phase-3-owner-decision-packet.md`](review/phase-3-owner-decision-packet.md) §0; that table is the canonical record and is not restated here.

- **Decided:** ADR 0017 choice 9 as (a), the wind formula kept with no version change (P3D-4); the RTX 5070 test C1–C6 due before any Phase 5 work, **not waived** (P3D-5); cross-engine determinism kept as a tested property over a finite pinned corpus, not a product promise (P3D-6, answers §6.5); GOV-1, separate decision kinds, adopted as policy only.
- **Phase 3 stays open** (§6.1). The owner's instruction keeps P3D-1 open; no gate decision of any kind has been made.
- **Still pending:** the visual review (§6.2), ADR 0017 choices 1–8 (§6.3–6.4), the carried-over questions (§6.6), and the C1–C6 run itself.
