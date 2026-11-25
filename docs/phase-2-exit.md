# Phase 2 exit report: Wave

- Phase: **2 — Wave** (master plan v1.1 §11, amendment 1; plan in [`plans/phase-2-wave.md`](plans/phase-2-wave.md))
- Branch / PR: `phase-2`, PR #3 (draft, base `main` @ `940a50b`; not merged)
- Date: 2026-11-25
- Authorization: owner decision R7 ([`review/phase-1-owner-review.md`](review/phase-1-owner-review.md))
- Status: **CONDITIONALLY CLOSED by owner decision W6 (2026-11-25), subject to the evidence in §9.**
  - W6 closes the phase only after W1–W5 and green checks on the exact final PR #3 head. §9 records that evidence; the final-head CI run and the merge are recorded in the PR #3 description.
  - The owner's decisions W1–W7 are in [`review/phase-2-owner-review.md`](review/phase-2-owner-review.md). Sections 1–8 are the report as presented at the gate; where §5 and §7 were superseded, §9 says so.
  - The generated scenes are accepted as **prototype-level geometric-compatibility evidence only** (W6): not final art, not a meaningful district.
  - Phase 3 is authorized by W7 after the closure and the merge of PR #3. Phase 4 is not.

## 1. Exit criteria (master plan §11, Phase 2 row) mapped to evidence

Tests import only package entry points (`@eschaton/wave`, `@eschaton/world`, `@eschaton/foldon`) or drive the Studio in a real browser with a real worker. No mocks, spies or sleeps. Solved regions are checked by an independent implementation: they are committed into a world, whose invariants reject overlaps and illegal adjacencies.

| Criterion | Evidence |
|---|---|
| Same seed, version and input give the same logical result | `wave/solver`: "the same tiles, seed and region give the same placements"; "a fixed set of solves has the recorded golden digest". `wave/region`: "the same world, request and seed give the same committed state hash". Studio e2e: "the same wave seed gives the same world hash and another seed a different one" |
| Multi-cell atomicity; zero overlap | `wave/solver`: "every solved region of a seed corpus is accepted by the world as overlap-free and legally adjacent"; "a solved region uses multi-cell and irregular pieces and leaves explicit air"; "a search that must backtrack still ends in a valid, completely filled region" |
| Explicit unsatisfiable, budget and cancel results | `wave/solver`: "a cell that can hold neither a tile nor air makes the region unsatisfiable"; "a packing that propagation alone cannot refute is found unsatisfiable by exhausting the search"; "a budget too small for the region ends as budget-exceeded with no placements"; "a malformed problem is reported as invalid, not solved". `wave/host`: "a cancelled job ends as cancelled, returns no placements and stops working" |
| Fixed regression corpus | The seed corpora in `wave/solver` and `wave/region` (8, 6, 6, 5 and 10 seeds), the full-cover packing corpus, and the golden digest |
| No main-thread solver block | The solver runs in a Web Worker (`apps/studio/src/worker`). e2e: "while a large region is being solved the Studio stays responsive and the preview is not part of the world" (a click is handled while the status is still `solving`) |
| Solve inside a frozen boundary; pinned placements | `wave/solver`: "blocked cells stay empty and their sockets constrain the neighbours". `wave/region`: "a region solved around pinned and frozen entities commits as one revision and keeps every existing entity identical"; "a region that cannot support the entity pinned above it is unsatisfiable"; "a cleared entity is consumed and its cells are solved again, while a straddling entity cannot be cleared" |
| Cancellation observable | `wave/host` (above). e2e: "cancelling a solve ends it as cancelled and leaves the world revision and hash unchanged" |
| A proposal whose read region was untouched still commits (amendment 1) | `world/region`: "a proposal survives an unrelated commit elsewhere and commits at the new revision"; "an entity two cells outside the region does not conflict"; conflicts for a change in the region, in the one-cell shell (mutation-checked), an identical replacement with a new id, and a conservation change; "a region that changed and changed back to the same entities is not a conflict". `wave/region`: "a solve that raced with an unrelated commit still commits, and one that raced with a commit in its region is a conflict" |
| Cross-browser determinism scope documented | ADR 0015, "Determinism scope". Tested, not only argued: the golden digest is identical on V8 (Node, Chromium), SpiderMonkey (Firefox) and JavaScriptCore (WebKit); see §4 |

Other requirements of the authorization (R7):

| Requirement | Where |
|---|---|
| Pure solver, no renderer, no world state of its own | `packages/wave/src/solver` imports foldon only; lint and 9 architecture tests |
| Worker result is an inert proposal, committed once through the world API | `proposalOf` → `applyProposal`. e2e "solving a region in the worker commits one revision…". Intermediate collapse is preview only |
| No partial writes on failure or cancel; exterior and identities protected | `applyProposal` refuses writes outside the region; "…keeps every existing entity identical"; cancel and conflict leave the hash unchanged |
| Replay | `world/region` and `wave/region`: rebased commits replay from the log to the same hash; e2e replay match after a solve |
| Generation versus closed conservation | Generation mints entities and is **refused before solving** when conservation is closed ("generation is refused before solving while conservation is closed"). Reconstruction from finite inventory with a search is **deferred to Phase 6** (ADR 0016); the Phase 1 greedy `assemble` is unchanged |
| Real catalog integration; novel arrangements | The tile set is the shipped catalog (P08, P03, P07, roof-module, roof-house) plus two preset assemblies (a 1×3×1 column and an irregular L block). Arrangements differ per seed and are not recipes: `screenshots/p2-wave-*.png` |
| Regular grid kept (R4) | No lattice change. The only new pieces are the column and the L block, added because a representative corpus needed a tall piece and an irregular mask |

## 2. Milestones

| Milestone | Commit (`phase-2`) |
|---|---|
| Plan, merge record, ADR 0015 and ADR 0016 | `7f2e703` |
| W0 socket table v3 (`needsMate`), `catalog.source()`, preset column and L block | `2f5f5ce` |
| W1/W2 solver core and constraints | `4fb7e53` |
| W3–W5 region-aware commit, region glue, job host, architecture rules | `beb7385` |
| W6 Studio worker, Wave panel, preview, atomic commit | `376212a` |
| W7 benchmarks, golden digest and three-engine check, screenshots, docs | `c1cb4cf` |
| W8 this report and recorded evidence | this commit and the one before it |

## 3. Solver outcomes and visual evidence

- **Screenshots (software-rendered, headless Chromium):**
  - `screenshots/p2-wave-medium-seed-1.png` and `p2-wave-medium-seed-2.png`: the same 10×5×10 region around the same pinned pieces, two seeds;
  - `screenshots/p2-wave-large-seed-5.png`: a 16×8×16 region (about 1,060 instances);
  - `screenshots/p2-wave-solving-preview.png`: a 28×8×28 region while the worker is still solving. The entity list holds only the four real entities; the structures drawn are the preview.
- **Agent observation, not a verdict.** The generated blocks are valid and varied (towers, roofs, pyramids, columns, L-shaped masses), and they are clearly not copies of recipes. They read as dense "toy block" massing with no streets, semantics or composition. That is expected: Phase 2 solves compatibility only; roles, networks and hierarchy are Phase 3, and fidelity is judged at the Genesis, Atmosphere and The Last District gates. **The visual review is the owner's.**

## 4. Validation

| Check | Result |
|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | exit 0 (local: macOS 26.5.1, Apple M5 Pro, Node v24.20.0, pnpm 10.33.4) |
| `pnpm test` | foldon 49, architecture 64, world 60, wave 23, WFC experiment 13: **209 passed** |
| `pnpm e2e` | **31 passed** (26 earlier + 5 Wave, real worker) |
| Cross-engine golden digest (`pnpm --filter @eschaton/studio engines`, local only) | Chromium 159, Firefox 159 and WebKit 27.2: 3 passed, same digest as Node |
| GitHub Actions `CI` | Run on the final head: see the PR #3 description (a commit cannot contain its own CI result) |

Test totals: 209 unit + 31 e2e = **240**.

Honest notes on local runs:
- Another project's test suite was running on this Mac for part of the session (load average up to about 55). Under that load the parallel e2e run failed on up to nine Phase 0 lab tests through timeouts; the Wave tests passed in the same run. On a quieter machine all 31 passed, and CI runs them on clean runners. No test was weakened, skipped or retried away.
- The Wave e2e tests poll the public status with an explicit 60 s limit instead of the 5 s local default, and run with reduced motion, because five software-rendered browsers in parallel make a one-second solve take several seconds to appear.

## 5. Benchmarks and transaction profile

**Recorded evidence:** [`../benchmarks/phase-2/2026-11-25-2d83d97c8/`](../benchmarks/phase-2/2026-11-25-2d83d97c8/) (`wave.json`, `world.json`, `foldon.json`, `wfc.json`), clean commit `2d83d97`, Apple M5 Pro, Node v24.20.0, solver on the main thread of Node.

**The machine was not quiet when this was recorded.** Another project's test suite kept the load average at 23–33 during the run. A scratch run of the same benchmarks about 40 minutes earlier, at a load average near 10, was roughly twice as fast. Both are shown; only the first column is recorded evidence. A re-record on an idle machine is still owed.

| Measure (a new seed each iteration for solves) | Recorded p50 / p99 (load 23–33) | Scratch p50 / p99 (load ≈ 10, not recorded) |
|---|---|---|
| Compile the town tile set (7 tiles) | 1.05 / 1.49 ms | 0.60 / 1.34 ms |
| Solve town 8×4×8 (256 cells) | 22.7 / 76.3 ms | 4.3 / 6.6 ms |
| Solve town 16×8×16 (2,048 cells) | 127 / 500 ms | 64 / 85 ms |
| Solve town 28×8×28 (6,272 cells) | 481 / 1,305 ms | 263 / 390 ms |
| Pack 6×3×6 completely (backtracking) | 0.73 / 4.33 ms | 0.50 / 3.16 ms |
| `readRegion` 8×4×8, world of 100 / 1,000 / 10,000 entities | 0.05 / 0.37 / 6.0 ms (p50) | 0.03 / 0.29 / 2.9 ms (p50) |
| `applyProposal` of one solved 8×4×8 region into a world of 100 entities | 12.5 / 17.0 ms | 7.1 / 9.1 ms |
| … into a world of 1,000 entities | 35.7 / 54.4 ms | 20.8 / 33.3 ms |
| … into a world of 10,000 entities | 262 / 362 ms | 176 / 245 ms |

- **§9.1 "Local WFC" target** (16×16×8 region, p95 ≤ 250 ms in a worker): the median is inside the target in both runs. The tail is inside it only in the quieter run. **The target is therefore not established**: it needs a recording on an idle machine, and a measurement inside the worker rather than on Node's main thread. The first propagation design took about 2.5 s for this size; the rewrite (ADR 0015) is what brought it here.
- **Transaction profile.** Reading a region is cheap at every size. Committing is dominated by the O(world) commit path of ADR 0011 (copy, invariants, hash): about 7–13 ms at 100 entities, 21–36 ms at 1,000 and 176–262 ms at 10,000. That is fine for Lab-sized worlds and too slow for a district-sized world that commits often. **Nothing was optimised here on purpose:** the instruction was to profile first. The numbers say the next step, before Phase 3 builds districts, is incremental validation and hashing or structural sharing, chosen on a profile of where the 10,000-entity commit spends its time.
- **Search behaviour.** With the town set and air available, solves almost never backtrack (0 backtracks in the recorded sizes); the packing case backtracks on most seeds and still finishes in under a millisecond at this size. No hard-catalog benchmark exists yet.

## 6. GPU and hardware

- All CI and screenshot rendering is software WebGL2 (SwiftShader).
- Phase 2 adds no shader or renderer code. Generated worlds use the same instanced batches as Phase 1.
- **Unchanged from Phase 1:** Mac physical-GPU checks C1–C4 were verified at the start of Phase 1. The Windows RTX 5070 run and the human checks (hatching stability under orbit, frame feel) are still **pending, not waived**. Wave results were not re-checked on a physical GPU in this phase.
- The worker was exercised in Chromium only. The three-engine check covers the solver's arithmetic, not the worker transport.

## 7. Decisions for the owner at this gate

1. **Phase 2 gate:** pass, pass with conditions, or keep open. Merging PR #3 needs your explicit approval.
2. **Visual review** of the generated structures (§3).
3. **ADR 0015, three flagged choices:**
   - cell choice by fewest live options instead of the Shannon entropy named in master plan §5.1 (integer-only, which is what made the three-engine determinism result possible);
   - `needsMate` in the socket table as a generation-only rule (the world still accepts a base over nothing);
   - the ground plane as a parameter of a solve request, not world state.
4. **ADR 0016:** read set = region plus a one-cell shell, compared by content (A → B → A commits; a new id conflicts).
5. **Still open from earlier phases** (none decided here): conservation key (ADR 0010 Q9); group on detach (Q10); tombstone compaction (Q5); socket-table placement interpretation (ADR 0012 Q5); Studio offset toggle details and the UI-only `homes` map; hatching on moving pieces (ADR 0006); the RTX 5070 manual test.
6. **Cross-engine determinism (ADR 0004's open question):** the solver is now deterministic across the three engines tested. Whether to make that a product promise, and for which browsers, is yours to decide.

## 8. Risks and known limitations

- **Transaction cost grows with the world** (§5): a commit is O(entities). At 10,000 entities one region commit costs well over a frame. Nothing was optimised for this; the profile is the input for a measured decision (structural sharing, incremental hashing, or spatial indexing of invariants) before Phase 3 produces district-sized worlds.
- **Chronological backtracking.** Hard catalogs can thrash; the budget turns that into `budget-exceeded`. The shipped tile set rarely backtracks because air is almost always available.
- **Arc consistency is not complete.** The solver can commit to a choice that only later proves impossible; that is what backtracking is for.
- **Weights are per candidate**, so large tiles are favoured more than their weight suggests.
- **Region read set is geometric and one cell deep.** Constraints with a longer reach (connectivity, roads) need a wider read set in Phase 3.
- **Clearing uses `consume`.** Rubble policy (detach instead of destroy) is Phase 4.
- **Generation ignores fold state and bonds of pins** (not part of the read set, by design).
- **Studio:** the Wave panel solves box regions on the ground plane only; previews are throttled to about seven per second; the fixed-camera backdrop is hidden after the first solve because the camera reframes.
- **Home machine:** any unpushed work there is unknown and was not inspected.

## 9. Closure evidence (W1–W6)

Sections 5 and 7 above are superseded where they disagree with this section: the §5 numbers were Node main-thread timings on a loaded machine, and the §7 choices were decided by W4.

### 9.1 W1: the Local WFC target, measured in the production worker

- **Method.** `pnpm --filter @eschaton/studio bench:wave`: the production bundle (`vite build` + `vite preview`), the same worker client and worker entry as the Studio, driven from a bench page. 10 unrecorded warm-up solves, then fixed seeds 1..120 per series; each sample starts from the same world. Raw samples are in the JSON files.
- **Clean SHA** `fd6aaec` (the final solver code). **Hardware:** Apple M5 Pro, 18 cores, 48 GiB, macOS 26.5.1.
- **The machine was not idle.** Another project's test suite ran on it throughout the session. The load average during the two recordings was 8–11 (it was 30–80 earlier, when no claim could be made). Contention can only make these numbers worse, so the result is conservative; a recording on an idle machine is still worth having.
- **Evidence:** [`../benchmarks/phase-2/2026-11-25-fd6aaec31/`](../benchmarks/phase-2/2026-11-25-fd6aaec31/): `wave-worker-chromium-headless.{json,md}` (Playwright Chromium 159) and `wave-worker-chrome.{json,md}` (installed Google Chrome 158).

Times in ms, p50 / p95 / p99.

| Series (n) | Browser | Solve in worker | Worker round trip (setup + solve + transport) | World commit | End to end |
|---|---|---|---|---|---|
| **16×8×16 with pins, canonical (120)** | Chromium 159 | 22.4 / 53.2 / 153.4 | **51.1 / 189.2 / 346.9** | 25.2 / 89.5 / 145.7 | 80.5 / 279.1 / 572.6 |
| | Chrome 158 | 25.2 / 52.9 / 66.9 | **53.7 / 108.1 / 161.6** | 24.7 / 41.6 / 75.2 | 77.7 / 159.5 / 187.3 |
| 16×8×16, empty world (120) | Chromium 159 | 20.9 / 41.7 / 77.7 | 40.2 / 74.7 / 116.3 | 31.8 / 58.6 / 100.1 | 71.0 / 162.6 / 210.4 |
| | Chrome 158 | 21.1 / 28.5 / 33.3 | 42.2 / 59.9 / 72.2 | 31.1 / 41.5 / 48.9 | 73.5 / 97.0 / 127.2 |
| 8×4×8 with pins (120) | Chromium 159 | 0.8 / 1.9 / 7.7 | 3.0 / 6.2 / 25.5 | 1.4 / 3.2 / 10.5 | 4.6 / 9.6 / 37.0 |
| 28×8×28 with pins, stress (40) | Chromium 159 | 132.5 / 289.0 / 340.9 | 252.5 / 461.5 / 726.4 | 121.5 / 312.1 / 441.2 | 378 / 768 / 1,039 |
| | Chrome 158 | 88.5 / 97.1 / 123.9 | 163.0 / 200.4 / 233.9 | 81.4 / 99.0 / 115.3 | 240.9 / 296.0 / 313.3 |

- **Breakdown of the canonical case (Chrome 158, p50 / p95):** prepare 0.2 / 0.4; per-solve setup 26.5 / 40.6; search 25.2 / 52.9; transport and scheduling 1.1 / 3.4; world commit 24.7 / 41.6.
- **Gate verdict (16×16×8, p95 ≤ 250 ms in worker): met in both recordings.** The worker round trip p95 was 189 ms and 108 ms; the search alone 53 ms. The Chromium run's p99 (347 ms) is above 250; the target is a p95. With n = 120 the p99 is the second-largest sample and is a weak estimate.
- **The stress case is separate and is not the gate.** 28×8×28 is about three times the canonical region; its round trip p95 was 462 ms and 200 ms. n = 40, so only p50 and p95 are meaningful.
- **Hard cases (100 seeds each, through the worker):**

| Case | Outcomes | Mean decisions / backtracks | Solve p50 / p95 / p99 |
|---|---|---|---|
| Full-cover packing, 9×3×9 with L blocks and columns (satisfiable, needs backtracking) | 93 solved, **7 budget-exceeded** | 1,846 / 1,766 | 0.8 / 117 / 137 |
| Unsatisfiable only by search, 4×1×4 with L blocks | 100 unsatisfiable | 9 / 9 | 0.1 / 0.1 / 0.2 |
| Unsatisfiable by propagation | 100 unsatisfiable | 0 / 0 | 0 |

  Seven packing seeds hit the 20,000-backtrack budget and ended as an explicit `budget-exceeded`. That is the known weakness of chronological backtracking on hard catalogs, not a wrong answer.
- **What was profiled and fixed on the way** (results identical, golden digest unchanged): incremental per-cell weights; candidate enumeration by bounding box; per-face candidate lists with a per-signature memo; no per-candidate arrays; worker slices bounded by time and scheduled through a message channel instead of 16 decisions per nested timer; compiled tiles cached in the worker.

### 9.2 W2: independent review and fixes

- **Review.** A separate read-only reviewer audited the solver, region glue, world proposals, job host and Studio wiring on `0dead22`, with its own brute-force oracle: 7,100 tiny instances, 2,839 solvable and 4,039 unsolvable verdicts agreed, 222 over the oracle's cap, **0 disagreements, 0 invalid solutions**.
- **Findings and fixes** (each reproduced by a failing public test first; commit `fd6aaec`):

| Severity | Finding | Fix |
|---|---|---|
| Major (latent) | An assembly was offered at quarter turns a leaf foldon forbids; the world rejected the "solved" result | Assemblies turn only by rotations every leaf allows |
| Minor | `applyProposal` threw on malformed ops; an unknown op tag committed an empty revision | Every op is shape-checked before it is interpreted |
| Minor | The job host threw on malformed requests, could hang after a throwing slice, and sent two `done` messages for a duplicate id | Exactly one `done` per accepted job; duplicates ignored; ids freed |
| Minor | The Studio reducer crashed on malformed worker results and committed a solve that finished after a cancel request | `settleJob`: shape check, cancel wins, independent verification, then `applyProposal` |
| Minor | `prepareRegion` accepted inverted or fractional regions, bad seeds and unknown ground profiles | Refused before solving |
| Minor | Weights of 2^32 or more broke the weighted draw | Weights limited to 1–65,535 |
| Notes | Self-check shared the compile tables; `step(0)` never progressed; previews were built every slice | `verifyPlacements` is independent of the solver's tables; `step` clamps; previews throttled in the host |

- **Permanent oracle test** (`packages/wave/test/oracle.test.ts`): 300 seeded tiny problems against an exhaustive search written from the rules: 143 solvable and 72 unsolvable agree, 85 over the cap, 0 disagreements, every solution verifies.
- **Remaining risks:** setup is one synchronous step and cannot be cancelled mid-way; chronological backtracking; `needsMate` is checked by the solver and by `verifyPlacements` but is not a world invariant (by decision); worker death without an error event would leave the Studio waiting (unconfirmed, no timeout).

### 9.3 W3: commit profile and optimisation

Same workload, baseline and optimised trees run back to back on the same machine with the CPU profiler attached (so absolute times are higher than benchmark times). Dense grid world; times in ms, p50 / p95 / p99.

| World | One detach, before | after | Apply one solved 8×4×8 proposal, before | after |
|---|---|---|---|---|
| 100 entities | 2.41 / 3.20 / 4.94 | 0.34 / 0.54 / 0.78 | 9.59 / 12.82 / 19.60 | 6.07 / 8.22 / 10.94 |
| 1,000 | 28.99 / 40.06 / 50.83 | 2.45 / 4.45 / 19.72 | 40.23 / 56.43 / 124.65 | 7.90 / 13.87 / 18.56 |
| 10,000 | 456 / 789 / 1,479 | 41.6 / 58.2 / 60.9 | 484 / 764 / 1,134 | 59.7 / 82.4 / 93.8 |

- **CPU before, at 10,000:** canonical JSON and FNV about 30%, the whole-world contact scan (done twice) 22%, `structuredClone` 13%, GC 11%. **After:** FNV-1a over the whole state is 62% of what is left; incremental validation 10%.
- **Heap:** `heapUsed` deltas without a forced GC were noisy (3–16 MiB per retained state in both trees) and are not a usable measurement. By construction a retained state now shares every untouched entity, bond and lineage record with its predecessor.
- **Unchanged:** every logical outcome, every hash (a fixed history keeps its recorded hashes), replay, immutability, catalog binding, rollback. `applyPatch(..., { audit: "full" })` is the reference; 600 seeded patches give deep-equal results on both paths.
- **Residual limit and realistic budgets.** A commit is now roughly 4 ms per 1,000 entities, almost all of it the O(world) hash. That gives about 8 ms at 2,000 entities, 40 ms at 10,000 and 200 ms at 50,000. Occasional commits (one per generated district, one per user action) are fine at 10,000; committing every simulation tick at 30 Hz is not, beyond roughly 5,000 entities. Removing the limit needs an incremental hash, which changes the hash format and is a new owner decision (ADR 0011).

### 9.4 W5: engines in CI

- **Job** "solver determinism and worker transport · chromium · firefox · webkit" (`.github/workflows/ci.yml`): installs the three Playwright browsers (cached by Playwright version) and runs `apps/studio/engines/`:
  - `determinism.spec.ts`: the golden digest, the same as the Node unit test;
  - `worker.spec.ts`: a real module worker solves an 8×4×8 region and the result commits; a cancelled job reports `cancelled`.
- **Local result (macOS arm64):** Chromium 159.0.8154.6, Firefox 159.0, WebKit 27.2: 9 passed. The CI result on the final head, with the engine versions it printed, is in the PR #3 description.
- **Limits:** these are Playwright's browser builds, not branded Safari or Firefox releases; worker performance is measured only in Chromium and Chrome.

### 9.5 Tests, checks and GPU at closure

| Scope | Count |
|---|---|
| `@eschaton/foldon` | 49 |
| `tools/architecture` | 64 |
| `@eschaton/world` | 65 |
| `@eschaton/wave` | 37 |
| WFC experiment | 13 |
| Studio e2e (Chromium) | 31 |
| Engines (3 browsers × 3) | 9 |
| **Total** | **268** |

- Local: lint, typecheck and build exit 0; 228 unit tests passed. e2e: all Wave specs passed; two long Phase 0 lab specs timed out locally under the other project's load, as they did on untouched trees earlier, and pass in CI. Nothing was weakened or skipped.
- **GPU:** Mac physical-GPU checks C1–C4 are from Phase 1. In addition, a Wave solve of 16×8×16 was run in installed Chrome 158 on this Mac's physical GPU: backend WebGPU, adapter `apple metal-3`, class `physical`, 1,068 instances, no shader errors (`screenshots/p2-webgpu-m5pro-wave.png`). **Still outstanding, not waived:** the Windows RTX 5070 run and the human checks C5 (hatching stability) and C6 (frame feel).

