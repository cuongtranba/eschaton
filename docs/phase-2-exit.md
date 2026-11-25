# Phase 2 exit report: Wave

- Phase: **2 — Wave** (master plan v1.1 §11, amendment 1; plan in [`plans/phase-2-wave.md`](plans/phase-2-wave.md))
- Branch / PR: `phase-2`, PR #3 (draft, base `main` @ `940a50b`; not merged)
- Date: 2026-11-25
- Authorization: owner decision R7 ([`review/phase-1-owner-review.md`](review/phase-1-owner-review.md))
- Status: **AT THE PHASE 2 EXIT GATE, awaiting the owner.** Nothing in this report approves the gate. Phase 3 is not authorized and was not started. PR #3 is not to be merged without the owner's explicit approval.

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
