# Eschaton

A web-based procedural world engine and laboratory: a small vocabulary of origami-inspired geometric pieces (**Foldons**) composed, folded and collapsed under explicit rules, rendered as a living woodcut print. See [`docs/master-plan.md`](docs/master-plan.md) for the full design and [`AGENTS.md`](AGENTS.md) for contributor rules.

Status: **Phase 2 — Wave is at its exit gate, awaiting the owner** ([`docs/phase-2-exit.md`](docs/phase-2-exit.md); branch `phase-2`, PR #3). Phases 0 and 1 are conditionally closed and merged into `main`. Phase 0 was conditionally closed by owner decision D6 on 2026-11-25 ([`docs/phase-0-exit.md`](docs/phase-0-exit.md) §9). Phase 3 is not authorized. The roadmap is in [`docs/master-plan.md`](docs/master-plan.md) §11.

## What Phase 0 delivers

- **Foldon library** (`@eschaton/foldon`): nine draft primitives P01–P09 with continuous hinge folding, external-face sockets, four assemblies built from shared pieces (watchtower, roof-house, ruined-gate and the nested roof-module), canonical recipe hashing and validation.
- **Studio laboratory** (`apps/studio`): catalog, inspector, fold slider and play, grid/footprint/socket/crease overlays, orbit and composition cameras, seed control, an ink look panel and the art-directed **Reference composition**.
- **Research and decisions**: reference notes, look-dev notes, a throwaway WFC placement experiment and nine ADRs.
- **Measurements**: benchmarks recorded with their limits. They come from a software-rendered WebGL2 fallback and are **not** the master plan's §9.1 targets.

Nothing here is final art or a passed performance gate. The owner accepted the reference composition only as a research and look-development prototype (D1). The original artwork stays the anchor, and the Genesis, Atmosphere and The Last District visual gates remain. Read [`docs/phase-0-exit.md`](docs/phase-0-exit.md).

## Run the lab

```sh
pnpm install
pnpm dev                 # http://localhost:5173
STUDIO_PORT=5183 pnpm dev   # if 5173 is taken by another project
```

Open the URL, pick items in the left catalog, drag the **Fold** slider or press `F`, and toggle overlays in the toolbar. Select **Reference composition** for the art-directed scene (press `O` for the composition camera).

## Where things are

| What | Where |
|---|---|
| Master plan (authoritative design) | [`docs/master-plan.md`](docs/master-plan.md) |
| Phase 2 exit report (at the gate, awaiting the owner) | [`docs/phase-2-exit.md`](docs/phase-2-exit.md) |
| Phase 1 exit report (conditional closure, owner R6) | [`docs/phase-1-exit.md`](docs/phase-1-exit.md) |
| Phase 0 exit report (conditional closure, owner D6) | [`docs/phase-0-exit.md`](docs/phase-0-exit.md) |
| Owner review package (Phase 0) | [`docs/review/phase-0-owner-review.md`](docs/review/phase-0-owner-review.md) |
| Physical WebGPU manual test (pending) | [`docs/testing/webgpu-manual-test.md`](docs/testing/webgpu-manual-test.md) |
| Architecture overview with data-flow diagram | [`docs/architecture/overview.md`](docs/architecture/overview.md) |
| Decision records and the pending list | [`docs/decisions/`](docs/decisions/README.md) |
| Research notes | [`docs/research/phase-0.md`](docs/research/phase-0.md), [`docs/research/look-dev.md`](docs/research/look-dev.md) |
| Benchmarks (recorded evidence, methodology) | [`benchmarks/README.md`](benchmarks/README.md); Phase 0 baseline [`benchmarks/phase-0/2026-11-24-e9e50c527/report.md`](benchmarks/phase-0/2026-11-24-e9e50c527/report.md) |
| Screenshots | [`docs/screenshots/`](docs/screenshots/) |
| WFC placement experiment | [`experiments/wfc-placement/`](experiments/wfc-placement/README.md) |

Benchmark-only URL flags: `?continuous=1` draws every frame; `?stress=N` adds N seeded primitives around the selected lab item (max 5,000).

## Requirements

Node ≥ 22.12, pnpm 10.

## Commands

```sh
pnpm install
pnpm dev        # Studio at http://localhost:5173 (STUDIO_PORT=5183 pnpm dev to use another port)
pnpm test       # Vitest (packages)
pnpm lint       # ESLint, type-aware
pnpm typecheck  # tsc per project
pnpm build      # production build
pnpm e2e        # Playwright specs against the Studio (starts the dev server itself)
pnpm screenshots # regenerate docs/screenshots/p0.4-*.png and p0.5-*.png
pnpm bench      # Foldon micro-benchmarks + the WFC experiment; scratch output in gitignored benchmarks/runs/
STUDIO_PORT=5183 pnpm bench:studio  # builds, serves the production bundle and measures the Studio in headless Chromium
# BENCH_RECORD=1 on both records tracked evidence from a clean tree (benchmarks/README.md)
```

The **Look** panel (right column) drives the ink look-dev: palette preset, quantized light, hatching strength, haze, sun elevation/azimuth, paper grain, outlines and a flat-versus-ink compare split. Select **Reference composition** in the catalog for the art-directed scene; research notes are in [`docs/research/look-dev.md`](docs/research/look-dev.md).

Studio shortcuts: `F` play fold · `G` grid · `S` sockets · `C` crease axes · `O` orbit/composition camera · `[` `]` previous/next catalog item. Add `?forceWebGL=1` to the URL to force the WebGL2 backend.

First-time Playwright setup: `pnpm --filter @eschaton/studio exec playwright install chromium` (a browser already installed under `~/.cache/ms-playwright` is reused).

## Layout

```
apps/studio/        Vite + React 19 Studio (laboratory UI)
packages/foldon/    @eschaton/foldon — geometry recipes, definitions, placement
experiments/        throwaway research code
docs/               master plan, research notes, ADRs
assets/reference/   art-direction reference
```

## Version pins

All versions are pinned exactly after checking the npm registry. **TypeScript is pinned to 6.0.3, not 7.x:** `typescript-eslint@8.74.0` declares peer `typescript >=4.8.4 <6.1.0`, so the native TypeScript 7 port cannot be used with the type-aware lint gate yet. Revisit when typescript-eslint adds TS 7 support.

## `@eschaton/foldon`

Immutable, serializable Foldon definitions: a folded-paper-net geometry recipe (panels + a crease tree authored in the rest pose), external-face sockets, components, and placement transforms. `poseGeometry` folds the recipe by rotating rigid sub-trees about hinges; targets outside a crease range are refused, never clamped. `primitiveCatalog` holds P01–P09. Fold-angle and coordinate conventions are documented in [`AGENTS.md`](AGENTS.md). Phase 0 limitation: crease networks must be trees (no closed loops).
