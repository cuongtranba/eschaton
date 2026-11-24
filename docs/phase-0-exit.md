# Phase 0 exit report (draft for the owner's decision)

- Phase: 0 — research and geometry lab (master plan §11, §14)
- Branch: `phase-0` (commits P0.1–P0.7 plus this P0.8)
- Date: 2026-11-24
- Status: **DRAFT. Nothing in this document is an approval.** The go/no-go section is a recommendation; the decision belongs to the project owner. Phase 1 must not start until the owner decides.

## 1. Exit criteria (master plan §11, Phase 0 row)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Nine draft primitives or a justified reduced set | **Met** | Nine primitives P01–P09 in `packages/foldon/src/catalog.ts`. Tests: "catalog exposes primitives P01 to P09 in order", "every catalog primitive passes validation" (`packages/foldon/test/foldon.test.ts`). e2e: "selecting every catalog item updates the inspector title" expects nine `primitive:P0*` items. They are drafts: P06 and P07 expose an `empty` top profile and cannot carry anything ([ADR 0009](decisions/0009-socket-compatibility.md)). |
| 2 | Three distinct assemblies from shared pieces | **Met** | `watchtower`, `roof-house` and `ruined-gate` plus the nested `roof-module` in `packages/foldon/src/assemblies.ts`. Test: "watchtower, roof-house and ruined-gate reuse shared pieces but are distinct recipes" (at least two shared primitives, three distinct hashes). The 2×2 (`roof-module`) and 4×4 (`roof-house`) module contracts exist as footprints and tags (`module-2x2`, `module-4x4`), not as a separate typed contract. Screenshots: `screenshots/p0.4-watchtower-composition.png`, `screenshots/p0.4-roof-house-sockets.png`. |
| 3 | Socket and footprint overlays | **Met** | Toolbar overlay checkboxes for grid, footprint, sockets, crease axes, panel edges and scatter (`apps/studio/src/ui/Toolbar.tsx`; shortcuts `G`, `S`, `C`); socket legend by profile. e2e: "the sockets overlay shows a legend and adds a draw call". Screenshot: `screenshots/p0.4-roof-house-sockets.png`. Gap: no automated test targets the footprint overlay specifically. |
| 4 | Continuous fold demo | **Met** | Fold slider, play/reverse (`F`) and per-crease angle overrides in the Inspector. Hinge coincidence, sign convention, range refusal and rest-pose reproduction are tested at the entry point (`foldon.test.ts`). e2e: "moving the fold slider to zero flattens every crease readout to 0°". Screenshot: `screenshots/p0.4-p08-mid-fold-creases.png`. Limits: tree hinges only, no panel collision ([ADR 0003](decisions/0003-crease-representation.md)). |
| 5 | One visual reference scene approved | **Needs owner approval** | The scene exists (select "Reference composition"; `screenshots/p0.5-reference-composition.png`, seed variant `p0.5-reference-seed-2.png`). [`research/look-dev.md`](research/look-dev.md) lists where it falls short of `assets/reference/visual-direction.png`. I have not claimed approval and cannot. |
| 6 | Baseline metrics recorded | **Partially met** | Measured and recorded in [`../benchmarks/phase-0-2026-11-24.md`](../benchmarks/phase-0-2026-11-24.md) (+ `.json`). All Studio numbers come from headless Chromium on a software rasteriser with the WebGL2 fallback; none represents the §9.1 hardware targets, and **no §9.1 gate is claimed**. Two gates are partially assessed, four are not assessed (see section 3). |

Summary: criteria 1–4 met, criterion 5 awaits the owner, criterion 6 partially met.

## 2. Required outputs checklist (§14)

| Output | Status | Where |
|---|---|---|
| Runnable lab | Done | `pnpm dev` (`STUDIO_PORT` to change the port); README |
| Public behaviour tests | Done | `packages/foldon/test/` (31 tests), entry-point imports only |
| Primitive catalog | Done | `packages/foldon/src/catalog.ts` |
| Three shared-piece assemblies | Done | `packages/foldon/src/assemblies.ts` |
| Folding demo | Done | Studio fold slider and play |
| Visual comparison | Done | Compare split and `screenshots/p0.5-compare-*.png`; [`research/look-dev.md`](research/look-dev.md) |
| Research notes | Done | [`research/phase-0.md`](research/phase-0.md) (R1–R10, several partly unverified), [`research/look-dev.md`](research/look-dev.md) |
| Benchmark results | Done, with limits | [`../benchmarks/phase-0-2026-11-24.md`](../benchmarks/phase-0-2026-11-24.md) |
| Architecture diagram | Done | [`architecture/overview.md`](architecture/overview.md) |
| ADRs | Nine written, two pending | [`decisions/README.md`](decisions/README.md) |
| Phase gate report | This file | |
| AGENTS.md updated with §7 coding rules | Done in P0.1; updated here for new commands | `AGENTS.md` |
| Screenshots or video captures | Screenshots only; no video | `docs/screenshots/` |
| Throwaway WFC experiment | Done | `experiments/wfc-placement/README.md`; [ADR 0004](decisions/0004-multi-cell-encoding.md) |

## 3. Baseline measurements (headline)

Source and method: [`../benchmarks/phase-0-2026-11-24.md`](../benchmarks/phase-0-2026-11-24.md). Machine: AMD Ryzen 7 7800X3D, 19.5 GiB, WSL2, Node v24.5.0, Chromium 159, 1440×860. Renderer: `ANGLE (SwiftShader)`; no WebGPU adapter. Measured at commit `0e34f55` plus the uncommitted P0.8 changes.

| Measure | Result |
|---|---|
| `createCatalog` (9 primitives + 4 assemblies) | 1.72 ms p50 (575 ops/s) |
| `poseGeometry` | P01 1.13 µs, P03 4.19 µs, P08 15.5 µs p50 |
| `foldProgress` + pose of P08 | 31.5 µs p50 |
| `flatten` roof-house / watchtower | 4.6 µs / 3.8 µs p50 |
| Time to first frame (cold, median of 5) | 143 ms |
| Frame time p50 / p95, software WebGL2 | P08: 50.0 / 50.1 ms; roof-house: 66.7 / 83.4 ms; watchtower: 66.7 / 83.4 ms; reference composition: 166.7 / 183.4 ms; lab with 1,000 pieces: 66.6 / 66.8 ms |
| Draw calls / triangles / instances | reference composition 15 / 5,154 / 543; lab with 1,000 pieces 13 / 5,444 / 1,036 |
| After 20 reset cycles | geometries 9→9, textures 2→2, instances 36→36 (GPU-side counters flat); **JS heap 12.1→24.9 MB (about +0.64 MB per cycle, rising in every cycle)** |

How far to trust these frame times:

- Headless frame times land on multiples of about 16.7 ms, so they cannot resolve smaller differences.
- A first run of the same script on the same tree gave a different result for the 1,000-piece scene (p50 100 ms, p95 200 ms, max 533 ms, 71 samples) than the final run above (66.6 / 66.8 ms, 128 samples). Treat frame times as order-of-magnitude only.
- The reference composition is slower than the 1,000-piece scene (166.7 against 66.6 ms p50). I did not isolate why; the likely cause is the large full-frame sky and ridge panels on a software rasteriser, not draw-call count.
- A second `pnpm bench` run of the WFC experiment matched the committed numbers within about 3 % for the `open` scenario but was 15–47 % faster for the `constrained` scenario (16×16 placement p50 36.3 ms against the committed 68.0 ms; `benchmarks/raw/wfc-rerun.json`). The committed file was kept and the rerun is stored beside it. The 1.0–1.7× placement-versus-offset p50 ratio in the experiment README held in both runs.

§9.1 gate status (full reasons in the benchmark file):

| Gate | Status |
|---|---|
| Lab, 100–1,000 pieces | **Partially assessed.** 1,036 instances rendered; "smooth interaction" not judged on a software rasteriser; JS heap grew across reset cycles, cause unidentified, so "no persistent resource growth" is **not** claimed. |
| District, 10k instances at 60 FPS | Not assessed |
| Stress, 100k static instances | Not assessed |
| Research, 1M logical pieces | Not assessed |
| Local WFC, 16×16×8 p95 ≤ 250 ms in a worker | **Partially assessed**: 2D 16×16 on the main thread only, worst p95 97.8 ms; not claimed |
| Interaction during worker solving | Not assessed (no worker) |

## 4. Test inventory

Counts from the commands run for this report on the final tree.

| Scope | Command | Result line |
|---|---|---|
| `@eschaton/foldon` | `pnpm test` | `packages/foldon test:       Tests  31 passed (31)` (2 files: `foldon.test.ts` 18, `assembly.test.ts` 13) |
| `@eschaton/exp-wfc-placement` | `pnpm test` | `experiments/wfc-placement test:       Tests  13 passed (13)` (1 file) |
| Studio Playwright | `STUDIO_PORT=5183 pnpm e2e` | `15 passed (15.1s)` (14 existing specs plus one for the new `?stress=N` flag) |
| Lint | `pnpm lint` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 (3 projects) |
| Build | `pnpm build` | exit 0 (`apps/studio build: ✓ built in 245ms`); bundle 1,148 kB, a 500 kB chunk-size warning remains |
| Benchmarks | `pnpm bench`, `STUDIO_PORT=5183 pnpm bench:studio` | both exit 0 |

Not counted: the seven screenshot specs under `apps/studio/screenshots` (`pnpm screenshots`, regenerate images, not assertions) and the benchmark specs. The Studio has no unit tests; its logic is covered through the browser only. The composition generators have no direct assertions beyond the layout-hash determinism spec.

## 5. Known limitations and risks (candid)

**Rendering and performance**
- **The WebGPU backend was never exercised.** Every run, screenshot and number is from the WebGL2 fallback. TSL graph compilation on WebGPU, backend parity and a capability matrix are unknown ([ADR 0005](decisions/0005-renderer-webgpu-tsl-webgl2-fallback.md)).
- **Headless timings are non-representative** and quantised; see section 3. No discrete-GPU or iGPU measurement exists.
- **JS heap grows across reset cycles** (about 0.64 MB per cycle over 20 cycles, every cycle). Probing outside the benchmark showed growth also for watchtower↔roof-house (about 0.2–0.5 MB per cycle, slowing but not stopping within 12 cycles) and P08↔roof-house. GPU-side counters stay flat, which is all the existing e2e test checks. The cause is unidentified; it could be application code, three.js internals or Chromium. This is an open item.
- Shadows are not implemented ([ADR 0006](decisions/0006-ink-visual-strategy.md)). Outlines are one device pixel wide.
- The bundle is 1.1 MB with no code splitting.

**Visual and composition** (from [`research/look-dev.md`](research/look-dev.md))
- Empty pale plain between the towers and the mountains; ridges look like soft tents rather than engraved mountains; no vehicles; foreground reads as crumpled paper.
- Grain reads as mottled stone on near-black masses. Hatch frequency and the sky factor are hand-tuned per scene. Seed 77 puts a large dark mound over the corridor entrance; only two seeds were looked at.
- Hatching stability across motion was judged by eye on two images; there is no pixel metric.

**Geometry and grid**
- **The toy-like cubic grid risk is not retired.** No irregular-lattice comparison was made. The composition gets its silhouettes from off-grid, scaled and rotated placements that are not logical placements and are not socket-validated ([ADR 0002](decisions/0002-cubic-grid-and-yaw-rotations.md)).
- **P06 and P07 have empty tops**, so nothing can nest on them; that limits stacking and assembly variety. `open` sockets are wildcards and weaken checks wherever used.
- Creases must form a tree; no closed networks, no panel collision, no FOLD adapter ([ADR 0003](decisions/0003-crease-representation.md)).
- The socket tangent rule has no direct test ([ADR 0009](decisions/0009-socket-compatibility.md)).
- Assembly hashes cover part references (`id@version`), not the geometry of referenced primitives ([ADR 0008](decisions/0008-assembly-promotion-and-hashing.md)).

**Generation**
- The WFC experiment is 2D, height 1, main thread, with a catalog on which filling with `ground` always works; no benchmark run was unsatisfiable or out of budget. It says nothing about hard catalogs, 3D support rules, workers or local re-collapse ([ADR 0004](decisions/0004-multi-cell-encoding.md)).

**Process and evidence**
- Research notes: R2 and R4 are metadata-only because the publisher blocked the fetch, and the R3 PDF came back as binary; several others were summarised by a small model and are flagged "not verified" in [`research/phase-0.md`](research/phase-0.md). Licences of R3, R4 and R8–R10 were not verified as code licences.
- The reference artwork's usage rights are unknown (§13); the reference is internal only.
- No automated dependency-direction gate exists; the acyclic claim in the overview comes from reading imports.
- Aesthetic acceptance has not been given.

## 6. Failed or changed assumptions

| Assumption | What happened | Where recorded |
|---|---|---|
| TypeScript 7 could be used | Not possible with the type-aware lint gate; pinned to 6.0.3 | `README.md` "Version pins" |
| Socket tangents must match on all faces | Failed for rotated pieces on vertical contacts; changed to side faces only in P0.3 | [ADR 0009](decisions/0009-socket-compatibility.md) |
| Stripe hatching draws nothing when line width is 0 | It drew half-intensity lines, causing cross-hatching on pale faces; fixed | `research/look-dev.md`, technique 2 |
| Quantized light bands are stable for any tone | Values at band edges speckled; 0.003 bias added; generators must avoid band edges | `research/look-dev.md`, technique 1 |
| `vitest bench` works as in earlier majors | In Vitest 5 `bench` is a test-context fixture, needs at least two benchmarks per `compare`, and `--outputJson` is gone; the bench uses the JSON reporter | `packages/foldon/bench/foldon.bench.ts` |
| The lab renders every frame, so rAF deltas measure rendering | The renderer draws only when something changed; benchmarks use `?continuous=1` | `apps/studio/src/lab/flags.ts` |
| Resource lifetime can be checked from renderer counters | Counters were flat while the JS heap grew | section 3 |
| Encoding choice would change solver search | It did not; only constant factors differed | [ADR 0004](decisions/0004-multi-cell-encoding.md) |
| A capability-tested WebGPU run was possible here | No adapter in this environment | [ADR 0005](decisions/0005-renderer-webgpu-tsl-webgl2-fallback.md) |

## 7. Recommendation for Phase 1 (pending the owner's decision)

**Recommendation: conditional GO to Phase 1.** This is my recommendation, not a decision. The Phase 1 goals (versioned catalog, placement, bonds, composition systems) rest on the parts of Phase 0 that are tested and stable: the geometry contract, sockets, assemblies and hashing. The unresolved Phase 0 items are visual and performance questions, and Phase 1 does not depend on them.

Conditions I would attach:

1. **The owner reviews the reference scene** (criterion 5) and either approves it or lists changes. Rendering work beyond bug fixes stays out of Phase 1 until then.
2. **A WebGPU smoke run** on any machine with a WebGPU adapter: one render of the reference scene and the compare split on the WebGPU backend, plus the capability matrix TODO from ADR 0005. The same machine should produce the first real §9.1 numbers. This should happen early in Phase 1, not in Phase 5.
3. **The JS heap growth is explained or ruled out** (a heap-snapshot comparison between cycle 1 and cycle 20) before any "no persistent resource growth" claim.
4. **A decision on the grid risk**: either accept the cubic grid with off-grid rendering affines as a permanent split (and say so in ADR 0002), or schedule a small irregular-lattice silhouette study before Phase 3.
5. **The owner approves or amends the nine ADRs**, especially 0001 (package layout), 0004 (placement as the public contract) and 0009 (socket rule).

**No-go triggers**: the owner rejects the look direction in a way that changes the material approach (that would reopen ADR 0006), or a WebGPU smoke run fails in a way the TSL material cannot absorb (that would reopen ADR 0005).

### Proposed Phase 1 scope adjustments

Additions:
- A regression test for "a rotated piece on a vertical contact is accepted" and a direct test of the tangent rule.
- Decide the P06/P07 tops (profile and nesting) and add a primitive or variant if a ridge-cap is needed.
- Make the assembly hash include the content hash of referenced definitions, or enforce version bumps in validation.
- A dependency-direction check (for example `dependency-cruiser`) in `pnpm lint`.
- An e2e or script check of JS heap after reset cycles, once the growth is understood.
- Define support direction on sockets (who carries whom) before bonds.
- Add the first two systems (attach/detach and composition) and write the system-order ADR from them, with the roof-and-leaf-share-behaviour test.

Deferrals:
- FOLD import/export adapter (no consumer yet).
- Moving the renderer out of the Studio (one consumer).
- Closed crease networks and panel-collision checks.
- Shadow maps and quad-based outline lines (wait for owner look decision).
- The transaction/replay and seam-ownership ADRs stay pending until a world exists.

Keep as is:
- `@eschaton/foldon` as the only library package until the world model needs a second consumer.
- Placement as the public multi-cell contract; do not build the offset-state encoding.

## 8. What the owner needs to decide

1. Approve, change or reject the visual reference scene.
2. Go, conditional go or no-go for Phase 1, and which of the five conditions apply.
3. Whether to accept the cubic grid with off-grid rendering affines.
4. Whether to run a hardware benchmark session before Phase 1 or early within it.
