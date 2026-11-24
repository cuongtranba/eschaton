# Phase 0 benchmarks — 2026-11-24

> **These numbers are not representative of the master plan §9.1 targets.** The Studio was measured in headless Chromium on a **software rasteriser**: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) (class software, backend WebGL2). A physical GPU was never exercised in this run, so no §9.1 gate is claimed as passed. Headless frame times are quantised to multiples of about 16.7 ms by the compositor's 60 Hz tick, so differences below one tick are not resolvable.

## Environment

| Item | Value |
|---|---|
| Commit | `e9e50c52794812cc553b70df378d4a6ddadfcbb9` (clean working tree) |
| Mode | record |
| Seed | 20261124 (lab default; also seeds the 1,000-piece stress layout) |
| Generated | 2026-11-24T10:23:27.304Z |
| os | Linux 6.18.58.1-microsoft-standard-WSL2 (linux x64) |
| cpu | AMD Ryzen 7 7800X3D 8-Core Processor |
| logicalCores | 8 |
| totalMemoryGiB | 19.5 |
| node | v24.5.0 |
| browser | chromium 159.0.8154.6 |
| viewport | 1440×860 CSS px at devicePixelRatio 1 |
| backend | WebGL2 |
| gpu | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) |
| gpuClass | software |
| forceWebGL | off |
| gpuDetail | renderer=ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) vendor=Google Inc. (Google) unmasked=true source=webgl-debug-renderer-info |
| userAgent | Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/159.0.8154.6 Safari/537.36 |

The Foldon benchmarks (section 1) ran on the same machine and Node version, outside a browser. Methodology: `benchmarks/README.md`.

## Method

- **warmupFrames:** 20
- **sampleWindowMs:** 8000
- **minSamples:** 15
- **maxSamples:** 400
- **frameTime:** requestAnimationFrame deltas with ?continuous=1 (every frame renders)
- **build:** vite build + vite preview (production bundle)
- **resetCycle:** select Reference composition, then select roof-house (content disposed and rebuilt twice per cycle)
- **Stress scene:** `?stress=1000` places 1,000 seeded primitives on a 3-cell lattice around the selected assembly; `?continuous=1` makes the renderer draw every animation frame (the lab otherwise draws only when something changed).
- **Frame time:** requestAnimationFrame deltas after 20 warm-up frames, at least 15 samples, up to 8 s. The sample count is in the table; p95 over fewer than 100 samples is weak.
- **Reproduce:** `pnpm bench` (Foldon and the WFC experiment, serially), then `STUDIO_PORT=5183 pnpm bench:studio`; add `BENCH_RECORD=1` to both to write the tracked evidence directory.

## 1. Foldon package (Node)

Source: `foldon.json` in this run directory (vitest bench run started 2026-11-24T10:22:41.106Z). Warm-up 200 iterations / 300 ms, then 800 ms of timed samples per case.

| Case | ops/s | p50 µs | p99 µs | samples |
|---|---:|---:|---:|---:|
| createCatalog(default inputs) | 578 | 1705.05 | 2208.32 | 461 |
| flatten roof-house | 217,319 | 4.52 | 8.53 | 169,311 |
| flatten watchtower | 265,223 | 3.69 | 7.30 | 205,475 |
| foldProgress(P08, 0.5) + poseGeometry | 30,402 | 31.86 | 61.04 | 23,777 |
| poseGeometry P01 Planar panel | 888,760 | 1.09 | 2.04 | 685,361 |
| poseGeometry P02 Triangular facet | 934,600 | 1.03 | 2.73 | 707,190 |
| poseGeometry P03 Hinged two-panel crease | 232,989 | 4.21 | 8.02 | 180,853 |
| poseGeometry P04 Mountain fold | 222,042 | 4.27 | 12.58 | 164,932 |
| poseGeometry P05 Valley fold | 230,475 | 4.22 | 8.85 | 177,919 |
| poseGeometry P06 Triangular prism | 78,870 | 12.38 | 26.28 | 61,580 |
| poseGeometry P07 Pyramid | 80,986 | 12.10 | 25.53 | 63,422 |
| poseGeometry P08 Box shell | 61,145 | 15.90 | 31.18 | 47,723 |
| poseGeometry P09 Irregular fragment | 97,789 | 9.72 | 24.50 | 74,284 |

## 2. Studio scenes

| Scene | Backend | Frame p50 ms | Frame p95 ms | Frame max ms | Samples | Draw calls | Triangles | Instances | Geometries | Textures |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Single primitive (P08 box shell) | WebGL2 | 50.0 | 66.6 | 66.8 | 157 | 6 | 43 | 6 | 6 | 2 |
| Assembly roof-house | WebGL2 | 66.7 | 99.9 | 100.1 | 109 | 10 | 275 | 36 | 10 | 2 |
| Assembly watchtower | WebGL2 | 83.3 | 83.4 | 100.1 | 103 | 8 | 339 | 32 | 8 | 2 |
| Reference composition (seed 20261124) | WebGL2 | 183.3 | 216.5 | 233.4 | 46 | 15 | 5,154 | 543 | 15 | 2 |
| Lab with 1,000 seeded pieces (roof-house + ?stress=1000) | WebGL2 | 66.7 | 83.4 | 116.7 | 119 | 13 | 5,444 | 1,036 | 13 | 2 |

Draw calls, triangles and instances come from `renderer.info` and the status bar of the last frame; with outlines on, two extra line batches are drawn.

## 3. Time to first frame

Cold browser context, production bundle on a local preview server. Runs (ms): 142.4, 138, 142.1, 135.3, 136.2. **Median 138.0 ms.** page timeOrigin to first rendered frame, cold context, preview server on localhost. Includes backend init and building the default scene; excludes network latency beyond localhost.

## 4. Resource lifetime after reset cycles

| | Instances | Geometries | Textures | JS heap after GC (MB) |
|---|---:|---:|---:|---:|
| Baseline (roof-house) | 36 | 9 | 2 | 11.2 |
| After 20 reset cycles | 36 | 9 | 2 | 11.9 |

Mean JS heap change: 0.04 MB per cycle; the heap rose in 18 of 19 consecutive cycle pairs. `renderer.info` counters (geometries, textures) and the instance count returned exactly to the baseline every cycle, so GPU-side resource counts did not leak. The JS heap figure is a single `gc()` before reading `usedJSHeapSize`; the e2e heap test (`apps/studio/e2e/heap.spec.ts`) is the gate for retained content, this table is context.

## 5. WFC placement experiment

Source: `wfc.json` in this run directory (method in `experiments/wfc-placement/README.md`). 2D, height 1, main thread, 100 seeds per row; p50 and p95 are computed from the per-run times of the whole corpus before the raw samples are discarded.

| Scenario | Size | Encoding | Solved / 100 | p50 ms | p95 ms |
|---|---:|---|---:|---:|---:|
| open | 8×8 | placement | 100 | 5.43 | 9.77 |
| open | 8×8 | offset-state | 100 | 4.33 | 4.76 |
| open | 12×12 | placement | 100 | 18.78 | 24.60 |
| open | 12×12 | offset-state | 100 | 13.24 | 14.82 |
| open | 16×16 | placement | 100 | 47.32 | 59.69 |
| open | 16×16 | offset-state | 100 | 29.69 | 31.26 |
| constrained | 8×8 | placement | 100 | 3.40 | 4.30 |
| constrained | 8×8 | offset-state | 100 | 3.21 | 3.66 |
| constrained | 12×12 | placement | 100 | 14.31 | 16.08 |
| constrained | 12×12 | offset-state | 100 | 10.78 | 11.46 |
| constrained | 16×16 | placement | 100 | 36.54 | 47.64 |
| constrained | 16×16 | offset-state | 100 | 25.32 | 30.92 |

## 6. §9.1 gate status

| §9.1 scene | Target | Status | What was measured | Why not a pass |
|---|---|---|---|---|
| Lab | 100–1,000 pieces; smooth interaction; no persistent resource growth after reset | **partially assessed** | 1,036 instances, 13 draws, p50 66.7 ms / p95 83.4 ms (software GPU, WebGL2); GPU-side counters flat over 20 cycles (geometries 9→9, textures 2→2); JS heap 11.2 → 11.9 MB over 20 cycles after forced GC | Software rasteriser, not a target GPU, so "smooth interaction" is not judged. |
| District | 10k visible logical instances; p95 frame ≤ 16.7 ms on a discrete GPU | **not assessed** | none | No District scene exists. The largest Phase 0 scene is the reference composition and it was measured on software GPU class only. |
| Stress | 100k static logical instances | **not assessed** | none | The largest measured scene has about 1,000 instances. No chunking or 100k placement exists. |
| Research | 1M logical pieces across streamed chunks | **not assessed** | none | No streaming or chunk model in Phase 0. |
| Local WFC | 16×16×8 region, bounded catalog, p95 ≤ 250 ms worker solve | **partially assessed** | 2D 16×16 (height 1), placement encoding, main thread: worst p95 59.7 ms over open and constrained corpora of 100 seeds | No third dimension, no worker, an easy tile set, and a throwaway solver, so the gate is not claimed. |
| Interaction | No solver-caused main-thread long tasks during worker solving; cancellation observable | **not assessed** | none | There is no worker and no cancellation in Phase 0. |

