# Benchmarks

Measured results and the harness that produces them. Numbers here are evidence for decisions, not targets; every report states the GPU class it was measured on.

## Commands

All commands run from the repository root. `pnpm bench` writes **only** to an untracked directory by default, so running it never changes `git status`.

| Command | What it does |
|---|---|
| `pnpm bench` | Creates one run directory, then runs the Foldon benchmark, the world benchmark and the WFC experiment **serially** (`--workspace-concurrency=1`; running them in parallel makes the timings noisy). Writes `foldon.json`, `world.json`, `wave.json`, `wfc.json`, `wfc.md`. |
| `STUDIO_PORT=5183 pnpm bench:studio` | `vite build`, serves the production bundle on `STUDIO_PORT` with `vite preview --strictPort`, measures it in headless Chromium, writes `studio.json` and `report.md`. It joins the newest scratch run for the same commit and dirty state, so run `pnpm bench` first for the report to include Foldon and WFC. Always set `STUDIO_PORT`. |

### Where output goes

| Mode | Directory | Tracked? |
|---|---|---|
| Default (scratch) | `benchmarks/runs/<UTC timestamp>-<short SHA>[-dirty]/` | No, gitignored |
| `BENCH_RECORD=1` | `benchmarks/phase-2/<commit date>-<short SHA>/` (earlier evidence is kept in `benchmarks/phase-0/` and `benchmarks/phase-1/`) | Yes, this is the recorded evidence |

`BENCH_RUN_DIR=<path>` overrides both; `pnpm bench` sets it for its children so Foldon and WFC share a directory.

### Recording evidence

1. Work from a **clean checkout of the SHA you want to record** (`git status` empty). every `benchmarks/phase-*/` directory and `benchmarks/runs/` are excluded from the dirty check, so the output of the first command does not make the second refuse.
2. `BENCH_RECORD=1 pnpm bench`
3. `BENCH_RECORD=1 STUDIO_PORT=5183 pnpm bench:studio`
4. Commit `benchmarks/phase-2/<date>-<sha>/` in a commit **after** the measured one (the files cannot be part of the SHA they describe), and link the report from the docs that cite it.

Recording from a dirty working tree is refused with exit code 1: the numbers would not match any commit. `BENCH_ALLOW_DIRTY=1` overrides this; the output is then still marked `"dirty": true` in every JSON file and in the report. Do not commit dirty evidence as the baseline.

### Provenance in every output

Each of `foldon.json`, `wfc.json`, `studio.json` carries `provenance` (`commit`, `shortCommit`, `commitDate`, `dirty`, `mode` = `scratch` or `record`, `generatedAt`) and the Node machine (`os`, `cpu`, `logicalCores`, `totalMemoryGiB`, `node`). `dirty` comes from `git status --porcelain --untracked-files=all` excluding every `benchmarks/phase-*/` directory. The Studio's `machine` block adds the browser, viewport, and the Studio's own GPU readout: `backend`, `gpu`, `gpuClass` (`physical`, `software` or `unknown`), `forceWebGL`, `gpuDetail` (every adapter field and where it came from), `userAgent`. `report.md` bases its banner on `gpuClass`.

## Methodology

### Foldon (`packages/foldon/bench/foldon.bench.ts`, Node, no browser)

- vitest bench (tinybench). Per case: 200 warm-up iterations and 300 ms of warm-up, then 800 ms of timed iterations (`OPTIONS` in the bench file).
- The recorded p50 and p99 are the latency percentiles tinybench computes over every timed iteration; `samples` is the iteration count. The runner keeps ops/s (mean throughput), p50, p99 and samples per case and discards vitest's raw report.
- No GC control: pure functions that allocate little; a GC pause shows up in p99, not p50.

### World (`packages/world/bench/world.bench.ts`, Node, no browser)

- Same vitest-bench runner as Foldon (`benchmarks/src/vitestBench.ts`). Per case: 20 warm-up iterations and 300 ms of warm-up, then 1,500 ms of timed iterations.
- Cases:
  - commits: a 27-entity watchtower into an empty world; one detach in 100- and 1,000-entity worlds of P08 boxes;
  - `hashState` of the 1,000-entity world;
  - `replay` of a 50-commit log;
  - `assemble` of a watchtower from inventory (27 patches);
  - `runSystem(windFold)` over a roof-module and a leaf.
- Every commit includes the full invariant check and the state hash. That is the Phase 1 contract, so the numbers are the cost of a validated commit, not of a raw mutation.

### Wave (`packages/wave/bench/wave.bench.ts`, Node, main thread)

- Same runner as Foldon and world. Per case: 5 warm-up iterations and 200 ms, then 1,500 ms timed.
- Solve cases use the seven-tile town set (1×1 boxes, 1×1×2 roofs, pyramids, a 2×2 roof module, a 1×3×1 column, an irregular L block and the 4×3×4 house) with air weight 8 on a ground plane. **Every iteration uses a new seed**, so the numbers cover a spread of arrangements, not one grid. A packing case (L blocks and columns that must fill 6×3×6 completely) exercises backtracking.
- Transaction cases apply one solved 8×4×8 proposal (about 100 placements) to worlds that already hold 100, 1,000 and 10,000 entities, and time `readRegion` on the same worlds.
- The solver runs on the main thread of Node here. In the Studio it runs in a worker, sliced 16 decisions at a time; that adds scheduling overhead not measured here.

### Wave in the production worker (`apps/studio/bench/wave.spec.ts`)

- `pnpm --filter @eschaton/studio bench:wave` builds the Studio, serves the production bundle and opens `bench.html`, which uses the same worker client and worker entry as the Studio. Set `STUDIO_PORT`. `BENCH_CHANNEL=chrome` runs installed Google Chrome instead of Playwright's Chromium.
- 10 unrecorded warm-up solves, then fixed seeds 1..120 per series (40 for the 28×8×28 stress case, 100 for each hard case). Every sample starts from the same world.
- Per sample it records: prepare (main thread), per-solve setup and search (measured inside the worker), transport and scheduling (round trip minus the two), world commit, and end to end. `wave-worker.json` holds every raw sample; `wave-worker.md` the p50 / p95 / p99 summary, the load average before and after, hardware and browser.
- The file is written as `wave-worker.{json,md}`; rename it per browser when recording more than one.

### Commit profile (`benchmarks/profile/commit.test.ts`)

- `pnpm --filter @eschaton/benchmarks profile:commit` runs world commits under `--cpu-prof` and writes timings to `benchmarks/runs/profile/commit-<n>.txt`; `node benchmarks/src/profileSummary.ts <dir> <function names>` prints inclusive and self time from the `.cpuprofile`. Recorded comparisons are in `benchmarks/phase-2/commit-profile/`.

### WFC placement experiment (`experiments/wfc-placement/bench/run.ts`)

- Corpus: seeds 1..100 for each scenario (`open`, `constrained`), size (8, 12, 16) and encoding (`placement`, `offset-state`): 1,200 timed solves. Five untimed warm-up solves per cell (seeds 100000..100004) before timing.
- Each solve is timed with `performance.now()` on the main thread; times include unsolved runs.
- Percentiles: nearest rank, `sorted[ceil(q·n) − 1]`, over the 100 per-seed times of a cell. With n = 100, p95 is the 95th smallest value and is a weak estimate.
- **Raw samples are not stored.** The script computes p50, p95, max, means and the per-cell worst backtracking case in memory and writes only those (`wfc.json` is about 6 KB instead of 14,600 lines). Everything the report and the experiment README cite is in the summary. Node counts and backtracks are deterministic per seed (reproduce them by re-running the seed); only milliseconds are noisy, and a rerun is the right check for those, not the stored samples.
- Differences below about 10% between runs are noise on this machine.

### Studio (`apps/studio/bench/studio.spec.ts`, headless Chromium)

- Production bundle (`vite build` + `vite preview`), viewport 1440×860, device scale factor 1, `?continuous=1` so every animation frame renders.
- Frame time: `requestAnimationFrame` deltas after 20 warm-up frames; at least 15 and up to 400 samples within an 8 s window per scene. Percentiles are nearest rank as above. Headless frames are quantised to the compositor tick (about 16.7 ms), so differences below one tick are not resolvable.
- Time to first frame: five cold browser contexts; the median is reported.
- Resource lifetime: 20 cycles of "select Reference composition, select roof-house". Per cycle: `renderer.info` geometries and textures, the instance count, and the JS heap.
- **Heap and GC handling.** Chromium is started with `--enable-precise-memory-info --js-flags=--expose-gc`; the benchmark calls `gc()` once and then reads `performance.memory.usedJSHeapSize`. A single `gc()` still leaves some retained garbage, so this heap figure is context, not a gate. The gate for retained scene content is the e2e test `apps/studio/e2e/heap.spec.ts`, which runs six `HeapProfiler.collectGarbage` passes through the DevTools protocol before each `Runtime.getHeapUsage` reading and compares against a baseline taken after 10 warm-up cycles.

## Caveats

- **Headless numbers are software rendering.** In this repository's environment (WSL2, no GPU reachable) Chromium renders with SwiftShader on the CPU, WebGL2 backend. Frame times, draw-call timings and time to first frame say nothing about the master plan §9.1 targets, and the WebGPU backend was never exercised. The Studio labels this itself (`GPU class: software`) and `report.md` repeats it in its first paragraph. A physical-GPU run is a manual test: [`docs/testing/webgpu-manual-test.md`](../docs/testing/webgpu-manual-test.md) (PENDING).
- One machine, one run per directory. Compare runs only with the same GPU class, browser and Node versions.
- The Foldon and WFC numbers are CPU-only and valid on any machine, but they share a machine with whatever else is running; keep it idle.

## Layout

| Path | Contents |
|---|---|
| `src/harness.ts` | Provenance, run directory resolution, record/dirty guard, machine capture (the one place these rules live) |
| `src/cli.ts` | `pnpm bench` orchestrator |
| `src/foldon.ts` | Foldon runner (invoked by `packages/foldon`'s `bench` script) |
| `runs/` | Scratch output (gitignored) |
| `phase-0/<date>-<sha>/` | Recorded evidence (`foldon.json`, `wfc.json`, `wfc.md`, `studio.json`, `report.md`) |

## Recorded evidence

| Directory | Commit | Notes |
|---|---|---|
| [`phase-0/2026-11-24-e9e50c527/`](phase-0/2026-11-24-e9e50c527/report.md) | `e9e50c5` (clean) | Phase 0 closure baseline (C-T1). Recorded from a detached clean checkout with `BENCH_RECORD=1 pnpm bench` and `BENCH_RECORD=1 STUDIO_PORT=5190 pnpm bench:studio`. Software rasteriser (SwiftShader, WebGL2); no §9.1 gate claimed. |

The files written by the old scripts (`benchmarks/raw/*.json`, `benchmarks/phase-0-2026-11-24.{md,json}`, `experiments/wfc-placement/results/bench-2026-11-24.{md,json}`, measured at `0e34f55` with a dirty tree) were removed in the re-record commit; they remain in git history (e.g. `git show 4cecd5b:benchmarks/phase-0-2026-11-24.md`).
