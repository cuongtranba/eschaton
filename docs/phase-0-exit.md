# Phase 0 exit report: Laboratory closure

- Phase: **0 — Laboratory closure** (master plan v1.1 §11; v1.0 "Research & geometry lab" plus closure tasks T0–T6)
- Branch / PR: `phase-0`, PR #1 (not merged)
- Date: 2026-11-24; owner decisions 2026-11-25
- Status: **CONDITIONALLY CLOSED by owner decision D6 (2026-11-25), subject to the evidence in §9.** D6 closes the phase only if the review amendments, the documentation sync, the required tests and CI are green at the exact final Phase 0 SHA. §9 records that evidence. If any item there is red or missing, the phase is not passed and Phase 1 does not start. The owner's decisions D1–D7 are recorded in [`review/phase-0-owner-review.md`](review/phase-0-owner-review.md) §0. Nothing here is inferred beyond them.
- Owner review package: [`review/phase-0-owner-review.md`](review/phase-0-owner-review.md)

## 1. Exit criteria (master plan §11, Phase 0 row)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Nine draft primitives or a justified reduced set | **Met (drafts)** | P01–P09 in `packages/foldon/src/catalog.ts`; test "every catalog primitive passes validation" (`packages/foldon/test/foldon.test.ts`). Draft limits: P06 and P07 expose an `empty` top so nothing can stack on them; sockets have no orientation (ADR 0009 correction). |
| 2 | Three distinct assemblies from shared pieces | **Met; typed 2×2/4×4 contracts approved by the owner (D2)** with the orientation-free limitation documented | `watchtower`, `roof-house`, `ruined-gate` and the nested `roof-module` (`packages/foldon/src/assemblies.ts`). Tests: "watchtower, roof-house and ruined-gate reuse shared pieces but are distinct recipes" and the nesting/flatten tests (`assembly.test.ts`). Typed module contracts `module-2x2` / `module-4x4` (commit `ffd2cc4`, ADR 0008 addendum) are validated by `createCatalog` against the compiled footprint and external sockets. Tests cover: the valid contract, a wrong footprint, an incompatible boundary, quarter-turn fits against symmetric and asymmetric contracts, nested 2×2 modules inside a 4×4, an unknown contract, and a JSON round trip (`packages/foldon/test/assembly.test.ts`). Contract boundaries are orientation-free, like sockets. |
| 3 | Socket and footprint overlays | **Met** | Studio overlay toggles and socket legend. e2e: "the sockets overlay shows a legend and adds a draw call"; "the footprint overlay of a multi-cell assembly adds one draw call and removes it again" (added in closure, commit `9595fef`). |
| 4 | Continuous fold demo | **Met** | Fold slider, Play fold (`F`), per-crease sliders. Domain: hinge coincidence, measured dihedral, range refusal, rest-pose reproduction (`foldon.test.ts`). e2e (closure, `9595fef`): "play fold animates through intermediate creases before reaching the flat end", "setting one crease angle moves only that crease", "moving the fold slider discards a per-crease override"; plus "moving the fold slider to zero flattens every crease readout to 0°" and the reduced-motion jump. Limits: tree hinges only, no panel collision (ADR 0003). |
| 5 | One visual reference scene approved | **Met under the narrowed criterion V1–V5, accepted by the owner (D1).** The scene is accepted **only** as a research and look-development prototype: not final art, not evidence of procedural generation. | Scene, side-by-side comparisons with the original artwork and a list of visible gaps: [`review/phase-0-owner-review.md`](review/phase-0-owner-review.md) §2. All views are software-rendered (SwiftShader). The original artwork stays the anchor; the Genesis, Atmosphere and The Last District visual gates remain. |
| 6 | Baseline metrics recorded | **Met for this environment; physical-GPU numbers pending** (the test is waived for this gate only, D5) | Recorded on clean commit `e9e50c5`: [`../benchmarks/phase-0/2026-11-24-e9e50c527/report.md`](../benchmarks/phase-0/2026-11-24-e9e50c527/report.md) with `foldon.json`, `wfc.json`, `studio.json` (each carries commit, `dirty: false`, machine). No §9.1 gate is claimed (software rasteriser). The physical WebGPU run is a pending manual test (§3). |

Summary: criteria 1–4 met; 5 met under the owner-accepted narrowed criterion (D1); 6 met with the stated limit. T0–T6 are each done, decided or explicitly waived (§2). The Phase 1 design ADRs were decided by the owner (D3, D4). The gate is conditionally closed by D6, subject to §9.

## 1a. Narrowed Phase 0 visual criterion (accepted by the owner, D1, 2026-11-25)

**Status: accepted by the owner (D1)** as the Phase 0 reading of "one visual reference scene approved". This is an acceptance of a narrower criterion. It is not an approval of the scene as art and does not waive any later visual gate. The text below is the proposal as accepted.

**What the existing reference scene is.** "Reference composition" in the Studio is a **look-development prototype**:
- It is not final art.
- It is not evidence of procedural generation. It is hand-composed: a seeded generator lays out Foldon instances with free yaw, pitch and roll and non-uniform scale (`apps/studio/src/lab/composition/affine.ts`, `district.ts`), and those placements bypass Foldon occupancy and socket validation.
- It is not an authoritative placement system and will not become one. ADR 0013 (proposed) keeps a single validated logical model, and the Genesis scene is to be rebuilt through it.

No further effort goes into polishing this scene in Phase 0.

**What Phase 0 must demonstrate visually (proposed reading of criterion 5):**

| # | Demonstration | Evidence today |
|---|---|---|
| V1 | The shared primitives read as folded paper | P01–P09 in the Studio; `screenshots/p0.4-p08-mid-fold-creases.png` |
| V2 | Valid assemblies are built from those shared pieces | Watchtower, roof-house, ruined-gate and roof-module, all validated by `createCatalog`; `screenshots/p0.4-*.png` |
| V3 | Folding is visible and continuous | Fold slider, Play fold and per-crease sliders; e2e "play fold animates through intermediate creases before reaching the flat end" |
| V4 | A basic ink-and-paper language exists and can be compared at a fixed camera and light: monochrome token palette, quantized light, world-anchored hatching, paper grain, ink outlines, haze; no colour accent in the baseline | `screenshots/p0.5-compare-{flat,quantized,hatching,full}.png`; ADR 0006; `research/look-dev.md` |
| V5 | Limitations and the gaps against the reference artwork are documented honestly | `review/phase-0-owner-review.md` §2; §5 below |

The owner judges V1–V5 by eye. Tests prove the behaviour behind V2 and V3, not the look.

**Deferred to the recurring visual gates.** Roadmap v1.1 already requires an owner visual review at every phase gate. Under this proposal, full visual fidelity is assessed there:

| Gap (review package §2) | Proposed gate |
|---|---|
| Composition: empty middle ground; missing pitched-roof massing, rubble and vehicles; mountain silhouettes; tree silhouette | Phase 3 Genesis (scene reached through validated placements, ADR 0013) |
| Value weight, engraved linework, per-cell outline "toy block" read, sky striping, grain reading as stone, cloud bar over the sun | Phase 5 Atmosphere (ink and effects fidelity) |
| Overall fidelity to the reference artwork; final visual approval | Phase 7 The Last District |
| How the look renders on a physical GPU with WebGPU | First gate after the owner's physical-GPU test; **still unverified**, see below |

The original artwork (`assets/reference/visual-direction.png`) stays the art-direction anchor. None of the listed gaps is closed by this proposal; it only schedules where each is judged.

**Physical WebGPU** remains unverified. The owner waived it for the Phase 0 gate only (D5) and deferred a real-GPU smoke test to the start of Phase 1 ([`testing/webgpu-manual-test.md`](testing/webgpu-manual-test.md)). No verification is claimed.

## 2. Closure tasks (owner-authorised T0–T6)

| Task | Status | Evidence |
|---|---|---|
| T0 Owner review package | **Done; owner decisions D1–D7 recorded (§0 of the package)** | [`review/phase-0-owner-review.md`](review/phase-0-owner-review.md); comparisons `review/p0-reference-vs-scene-*.png`; screenshots regenerated in `d3e7c8e`. No public tunnel started for it. |
| T1 Clean-SHA benchmarks | **Done** | Recorded from a detached clean checkout of `e9e50c5` (`BENCH_RECORD=1 pnpm bench`, `BENCH_RECORD=1 STUDIO_PORT=5190 pnpm bench:studio`); evidence committed in `af863be`. Scripts no longer touch tracked files by default (`9ec0527`): output goes to gitignored `benchmarks/runs/`, record mode refuses a dirty tree. Superseded dirty-tree files and the 14.6k-line duplicate WFC JSON removed (`af863be`; history keeps them). Methodology and commands: [`../benchmarks/README.md`](../benchmarks/README.md). |
| T2 Heap growth | **Root cause fixed and verified** | Lines (`LineSegments`) were never disposed, so three r187 kept one `RenderObject` per drawn line, retaining every old scene group (retainer path and constructor deltas in [`research/heap-investigation.md`](research/heap-investigation.md)). Fix `e72e4c2` (4 lines in `labRenderer.ts`). Regression test `apps/studio/e2e/heap.spec.ts` fails without the fix (2.69–2.86 MB growth, re-verified by the orchestrator twice) and passes with it. Recorded heap after 20 reset cycles: 11.2 → 11.9 MB (was 12.1 → 24.9 MB). |
| T3 Doc corrections and missing tests | **Done** | ADR 0009 records the inert side-face tangent check (`756945a`); ADRs 0001–0009 relabelled "Proposed — awaiting owner approval" (they had said "Accepted" without an owner decision). Footprint overlay, animated fold and per-crease tests added (`9595fef`). This report rewritten. |
| T4 CI | **Done; remote green** | `.github/workflows/ci.yml` (`04d93e8`): lint, typecheck, unit, build, Playwright e2e on `ubuntu-24.04`. The first runs failed on two motion-dependent e2e specs and the heap spec timing out on the slow software-rendered runner; fixed by isolating tests that are not about motion with reduced motion and giving the animation test a software-rendering timeout (`9595fef`, `e9e50c5`). Run 45374198783 on `e9e50c5`: success, 21/21 e2e. Status of the final head is reported in the PR. |
| T5 Physical WebGPU | **Waived for this gate by the owner (D5, conditional); deferred to the start of Phase 1; not verified** | WSL2 probe: Chrome's only WebGPU adapter is SwiftShader (`isFallbackAdapter: true`); no Vulkan driver reaches the GPU. Studio now reports backend, GPU name and GPU class (`physical`/`software`/`unknown`), with an e2e guard that SwiftShader is never labelled physical (`cf4fb67`). Owner instructions for Windows Chrome + RTX 5070: [`testing/webgpu-manual-test.md`](testing/webgpu-manual-test.md). ADR 0005 has the capability matrix. |
| T6 Phase 1 design ADRs | **Decided: accepted with the independent-review amendments (D3, D4)** | [ADR 0010](decisions/0010-runtime-identity-ownership-lineage.md) identity/ownership/lineage, [0011](decisions/0011-atomic-transactions-and-revisions.md) atomic transactions and revisions, [0012](decisions/0012-directional-sockets.md) directional sockets, [0013](decisions/0013-logical-vs-rendered-geometry.md) logical vs rendered geometry. Design only at Phase 0; amendments applied in each ADR's "Amendments" section. Roadmap v1.1 (owner-approved) adopted in [`master-plan.md`](master-plan.md) §11 with a change log; amendment 1 (Phase 2 read-set rebase) recorded on 2026-11-25. |

## 3. Baseline measurements (headline)

Source: [`../benchmarks/phase-0/2026-11-24-e9e50c527/report.md`](../benchmarks/phase-0/2026-11-24-e9e50c527/report.md). Commit `e9e50c5`, clean tree. Machine: AMD Ryzen 7 7800X3D, 19.5 GiB, WSL2 (Linux 6.18), Node v24.5.0, Chromium 159 headless, 1440×860 at DPR 1. **GPU class: software** (ANGLE / SwiftShader, WebGL2 backend).

| Measure | Result |
|---|---|
| `createCatalog` (9 primitives + 4 assemblies) | 1.71 ms p50 |
| `poseGeometry` P01 / P03 / P08 | 1.09 / 4.21 / 15.9 µs p50 |
| `foldProgress` + pose of P08 | 31.9 µs p50 |
| `flatten` roof-house / watchtower | 4.5 / 3.7 µs p50 |
| Time to first frame (cold, median of 5) | 138 ms |
| Frame p50 / p95 (software WebGL2) | P08 50.0 / 66.6 ms; roof-house 66.7 / 99.9 ms; watchtower 83.3 / 83.4 ms; reference composition 183.3 / 216.5 ms; lab with 1,000 pieces 66.7 / 83.4 ms |
| Draw calls / triangles / instances | reference composition 15 / 5,154 / 543; 1,000-piece lab 13 / 5,444 / 1,036 |
| 20 reset cycles | geometries 9→9, textures 2→2, instances 36→36; JS heap after `gc()` 11.2 → 11.9 MB |
| WFC experiment (2D, main thread) | all 1,200 runs solved; worst 16×16 p95 59.7 ms; offset-state 1.06–1.59× faster at p50 |

§9.1 gates: Lab and Local WFC **partially assessed**; District, Stress, Research and Interaction **not assessed**. Headless frames are quantised to ≈16.7 ms; treat them as order-of-magnitude. On the 2-vCPU GitHub runner the reference composition renders well under 1 frame per second, which makes input sluggish while motion is on: a capability limitation of software rendering, recorded here, not fixed.

## 4. Test inventory

| Scope | Command | Result (final tree, see §9) |
|---|---|---|
| `@eschaton/foldon` | `pnpm test` | 39 passed (`foldon.test.ts` 18, `assembly.test.ts` 21) |
| Architecture rules | `pnpm test` (`tools/architecture`) | 43 passed |
| WFC experiment | `pnpm test` | 13 passed |
| Studio Playwright | `pnpm e2e` | 21 passed (incl. heap regression, footprint overlay, animated fold, per-crease control, GPU-class guard) |
| Lint / typecheck / build | `pnpm lint`, `pnpm typecheck`, `pnpm build` | exit 0 |
| CI | GitHub Actions `CI` | on the closure SHA: see §9 |

All behavioural tests go through public seams (`@eschaton/foldon` entry point, the experiment entry point, or the Studio UI in a real browser); no mocks, spies or sleeps. The Studio has no unit tests. Tests prove behaviour, not visual quality.

## 5. Known limitations and risks

**Rendering**
- WebGPU has never rendered on a physical GPU; every image and number is SwiftShader. Pending owner manual test (T5).
- The GPU-class e2e guard fails on a machine whose class reads `unknown` (it requires `software` unless the class is `physical`).
- Outlines are 1 px; no shadow maps; bundle 1.1 MB without code splitting.
- Software rendering of the reference composition is slow enough to make input sluggish while motion is allowed.

**Visual** (detail in the review package §2)
- Lighter, emptier value structure than the reference; uniform per-cell outlines read as toy blocks; mechanical sky stripes; missing pitched-roof massing, rubble and vehicles; soft ridges; a cloud bar crosses the sun; grain reads as stone.

**Geometry and sockets**
- Sockets have **no orientation sensitivity**: the remaining side-face tangent check is inert (ADR 0009 correction). Proposed fix: ADR 0012.
- P06/P07 empty tops limit stacking; `open` wildcard profiles weaken checks.
- Creases are tree-only; no closed networks or panel collision (ADR 0003).
- Assembly hashes cover `id@version` references, not referenced geometry (ADR 0008). In Phase 1 the world's catalog fingerprint covers definition content, so an unversioned edit is detected (ADR 0008 amendment).
- **Logical vs rendered divergence:** the reference composition places Foldons with free yaw/pitch/roll and non-uniform scale outside Foldon validation (`apps/studio/src/lab/composition/affine.ts`, `district.ts`). Proposed resolution: ADR 0013.
- Inheritance ban and dependency direction are lint-enforced in every first-party source (A2, `04bd36b`); `foldon` may import no other workspace package (closure). Dynamic `import()` and intra-folder cycles are not covered (`architecture/overview.md`).

**Generation**
- The WFC experiment is 2D, main thread, no worker or cancellation, on a catalog where `ground` always fills; no unsatisfiable or budget case in the benchmark corpus. Cross-browser determinism (`Math.log` in entropy) untested.

**Runtime model (Phase 1 scope)**
- No runtime entities, ownership, bonds, transactions, revisions or replay exist; flattened instance ids are recipe paths, not world identities. Designed in ADRs 0010–0013 (accepted with amendments) and implemented in Phase 1.

**Process**
- Research notes R2–R4 partly unverified (publisher blocks, binary PDF). Reference artwork usage rights unknown; internal only.

## 6. Failed or changed assumptions

| Assumption | What happened | Where recorded |
|---|---|---|
| TypeScript 7 usable | Blocked by the type-aware lint gate; pinned 6.0.3 | `README.md` |
| Socket tangents protect orientation | Relaxed to side faces in P0.3; the remaining side check can never fail | ADR 0009 |
| GPU-side counters prove no resource growth | Counters were flat while disposed scenes stayed reachable through three's `RenderObject` map | `research/heap-investigation.md` |
| Phase 0 ADRs could be marked "Accepted" | Not without the owner; relabelled Proposed, then accepted with amendments by owner decision D3 on 2026-11-25 | ADRs 0001–0013 |
| Defensive guards protect the catalog | Two guards (assembly depth, contract boundary holes) could never fire; removed at closure | ADR 0008 amendments |
| Local e2e timings transfer to CI | Motion-dependent specs starved on a 2-vCPU software-rendered runner | `9595fef`, `e9e50c5` |
| Benchmarks can write tracked files | Produced a dirty-tree baseline; now scratch by default with a record guard | `benchmarks/README.md` |
| A WebGPU run is possible in this environment | Only SwiftShader adapters | ADR 0005, `testing/webgpu-manual-test.md` |
| Encoding choice would change solver search | It did not; constant factors only | ADR 0004 |

## 7. Decision (owner, 2026-11-25)

The recommendation in the previous revision (conditional GO once D1–D5 are answered) was decided by the owner as follows:
- D1–D5 are answered (review package §0).
- D6 conditionally closes Phase 0, subject to §9.
- D7 authorizes Phase 1 milestones M0–M9 from that point, without a further general go/no-go.

The no-go triggers listed before did not occur:
- D1 did not reject the look direction.
- D5 waived, rather than failed, the physical-GPU run.
- D3 approved placement as the public contract (ADR 0004).

## 8. Owner decisions

D1–D7 are recorded with their conditions in [`review/phase-0-owner-review.md`](review/phase-0-owner-review.md) §0. The questions still open after them are not Phase 1 blockers:
- cross-engine generation determinism (ADR 0004, Phase 2 scope);
- hatching on moving pieces (ADR 0006, Phase 5 scope);
- tombstone compaction, the conservation key and the group on detach (ADR 0010 Q5, Q9, Q10);
- the socket-table placement interpretation (ADR 0012 Q5), to be confirmed at the Phase 1 gate.

## 9. Validation of this report's tree (D6 evidence)

**Closure content SHA: `20d4e39`.** It is `831c5dd` plus two closure commits:
- `af1e09d`: code fixes (ADR 0008 unreachable checks removed; `foldon` may not import other workspace packages).
- `20d4e39`: owner decisions recorded, review amendments applied, documentation synchronised.

Before any write, the remote `phase-0` was fetched and was still `831c5dd`, the last verified head, so the closure is a fast-forward with no competing remote changes. Work done on the Home machine that was never pushed is unknown and was not inspected (Home was unreachable). Nothing here claims it.

| Check | Where | Result on `20d4e39` |
|---|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | local (macOS 26.5.1, Apple M5 Pro, Node v24.20.0, pnpm 10.33.4) | exit 0 |
| `pnpm test` | local | `@eschaton/foldon` 39 passed, `tools/architecture` 43 passed, WFC experiment 13 passed |
| `pnpm e2e` | local, Playwright headless Chromium (chrome-headless-shell 159, build 1255) | 21 passed |
| GitHub Actions `CI`, job "lint · typecheck · unit · build · e2e" | [run 45545455009](https://github.com/cuongtranba/eschaton/actions/runs/45545455009), job 138973860633 | **success**: unit 39 + 43 + 13 = 95 passed; e2e 21 passed (2.6 min); 116 tests in total |
| GitGuardian Security Checks | PR #1 | pass |

**Condition verdict (D6):**
- The review amendments are applied (each ADR's "Amendments" section, ADR 0008 code fixes).
- The documentation is synchronised: index, overview, master plan, owner review §0, this report, the Phase 1 plan, `AGENTS.md`, `README.md`.
- The required tests and CI are green on `20d4e39`.

The commit that adds this section changes only this section. Its own CI run on the final `phase-0` head is recorded in the PR #1 description. **Phase 0 counts as conditionally closed only once that final-head run is green.** Physical WebGPU is still unverified: it is waived for this gate (D5), not passed.
