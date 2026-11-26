# Eschaton — agent rules

Procedural origami-inspired world engine (TypeScript + Three.js). Authoritative design: `docs/master-plan.md`. Visual anchor: `assets/reference/visual-direction.png`. Current phase: **Phase 3 — Genesis**, authorized by owner decision W7 (2026-11-25) after the conditional closure of Phase 2 (W6; evidence in `docs/phase-2-exit.md` §9). Scope: roadmap v1.1 (`docs/master-plan.md` §11) and the Phase 3 plan in `docs/plans/`. Phase 3 was merged into `main` as PR #4 (`870ef62`, 2026-11-26) on the owner's explicit merge-only instruction; the Phase 3 exit gate, its visual review and the ADR 0017 choices are **not** decided. Phase 4 is **not** authorized; no PR is merged without the owner's explicit approval.

## Commands (pnpm only)

| Command | Purpose |
|---|---|
| `pnpm dev` | Studio dev server on http://localhost:5173 (set `STUDIO_PORT` to use another port; `pnpm e2e` and `pnpm screenshots` honour it too) |
| `pnpm test` | Vitest across packages |
| `pnpm lint` | ESLint (type-aware, strict) |
| `pnpm typecheck` | `tsc` per workspace project |
| `pnpm build` | Production build of every buildable project |
| `pnpm e2e` | Playwright against the Studio |
| `pnpm --filter @eschaton/studio engines` | Solver golden digest and real-worker solve/cancel on Chromium, Firefox and WebKit (needs `playwright install firefox webkit`; a CI job) |
| `pnpm --filter @eschaton/benchmarks profile:genesis` | District workload: 12-seed corpus and a six-district chain, with generate, commit, settle, snapshot and heap figures (`GENESIS_SEEDS`, `GENESIS_CHAIN`) |
| `pnpm --filter @eschaton/studio bench:wave` | Wave solver through the production worker: raw samples and p50/p95/p99 per phase. `BENCH_CHANNEL=chrome` uses installed Chrome |
| `pnpm --filter @eschaton/benchmarks profile:commit` | CPU profile of world commits (`PROFILE_ENTITIES`, default 10000); summarise with `node benchmarks/src/profileSummary.ts` |
| `pnpm bench` | Foldon and world micro-benchmarks, then the WFC experiment (serially). Writes only to gitignored `benchmarks/runs/`; never changes `git status`. `BENCH_RECORD=1` writes tracked evidence to `benchmarks/phase-2/<date>-<sha>/` (earlier evidence stays in `benchmarks/phase-0/` and `phase-1/`) and refuses a dirty tree. See `benchmarks/README.md` |
| `pnpm bench:studio` | Builds the Studio, serves the production bundle on `STUDIO_PORT`, measures it in headless Chromium (software rendering here) and joins the latest `pnpm bench` run directory. Same record/dirty rules; always set `STUDIO_PORT` |
| `pnpm screenshots` | Regenerate `docs/screenshots/p0.4-*`, `p0.5-*`, `p1-world-*` and the ADR 0013 rebuild study `p1-rebuild-*` (plus `docs/review/p1-rebuild-study.json`) via Playwright (not part of `pnpm e2e`). The study opens with `?study=rebuild` |

Run lint, typecheck, test and build before declaring work done. Never report a check as passed unless you ran it.

## Layout

`apps/studio` (Vite + React UI) · `packages/foldon` (`@eschaton/foldon`, geometry/definitions/placement/socket table) · `packages/world` (`@eschaton/world`, runtime state: entities, patches, region proposals, replay, bonds, lineage, systems, self-assembly; imports only foldon) · `packages/wave` (`@eschaton/wave`, generation: pure WFC solver in `src/solver` importing only foldon, region glue using world, job host; no renderer, no world state of its own) · `packages/genesis` (`@eschaton/genesis`, hierarchical district generation: semantic plan, validators, district job, audit, settlement, job host; imports foldon, world and wave; no world state of its own) · `tools/architecture` (dependency-rule tests) · `experiments/` (throwaway) · `docs/` (plan, research, `decisions/` ADRs, `architecture/`, `phase-0-exit.md`) · `benchmarks/` (measured results). Do not scaffold future packages before they are needed. Packages are consumed as TypeScript source (`exports` → `src/index.ts`); no build step.

## Coding rules (master-plan §7.3)

- Strict TypeScript. No `any`, no unchecked `as` casts to bypass validation. Prefer discriminated unions, exhaustive switches, branded IDs.
- **Composition over inheritance.** No class `extends` in any first-party `.ts`/`.tsx` (ESLint-enforced). Prefer plain data + pure functions; classes only to encapsulate state behind a small API. Interface `extends` is fine.
- **Dependency direction (ESLint-enforced, `docs/architecture/overview.md`):** `foldon` is pure (no three/react/Node); Studio `ui → renderer → lab → packages`, `three` only in `renderer`, React only in `ui`/`App`/`main`, the solver worker code in `src/worker` may not import `three`, React, the UI or the renderer (the rule that `new Worker` appears only there is a convention, not lint-enforced); `genesis → wave → world → foldon`, and the wave solver core imports foldon only; packages are imported only through their entry point; nothing imports `apps/` or `experiments/`.
- Definition data is immutable, versioned, serializable (no functions or renderer objects inside). Runtime state is stored separately.
- One authoritative state; derived caches are not truth. UI sends commands, never mutates domain state. Acyclic, one-way dependencies.
- Deep modules with behavior-level APIs; no shallow pass-through layers or premature abstractions. Avoid explanatory inline comments; record rationale in docs/ADRs.
- Never use global randomness; seed everything. Fixed explicit clocks.
- Validate at boundaries and return `Result<T, E>` rather than throwing for expected failures.

## Tests

- Vitest; TDD at public seams. Behavioral tests import **only** package entry points (`@eschaton/foldon`, `@eschaton/world`, `@eschaton/wave`, `@eschaton/genesis`), never internal modules (lint-enforced via relative-import ban).
- No mocks/spies (`vi.*`), no sleeps. Real lightweight inputs, seeds, explicit clocks.
- Flat `test("does x")` titles that state behavior; one cause → one decisive outcome. Regression tests name the original defect. Cover promises, not lines; delete tests that would not catch a realistic bug.
- Never weaken, skip or delete a valid test to make code pass.

## Git

Work on a task branch/worktree per phase (`phase-0` for Phase 0 closure, `phase-1` for Phase 1, stacked on `phase-0`). Never commit on the default branch; never merge a PR without the owner's explicit merge authorization; never stash, reset, rebase or force-push shared work. One commit per plan step.

## Fold-angle convention (Foldon geometry)

Y up; cell `[x,y,z]` occupies `[x,x+1]×[y,y+1]×[z,z+1]`. Rotation = quarter turns about +Y through the XZ centre of the anchor cell, then translation by the anchor. Each panel is a planar convex polygon, CCW seen from its front; front normal by Newell's method. For a crease with parent front normal `nP`, child front normal `nC`, and `a = normalize(nP × uP)` where `uP` is the in-plane unit vector perpendicular to the hinge edge pointing into the parent (toward its centroid): `θ = atan2(dot(nP × nC, a), dot(nP, nC))`. `θ = 0` is flat; **θ > 0 is valley** (fronts turn toward each other), **θ < 0 is mountain**. Creases form a tree rooted at a root panel; closed crease networks are out of scope for Phase 0.
