# Eschaton — agent rules

Procedural origami-inspired world engine (TypeScript + Three.js). Authoritative design: `docs/master-plan.md`. Visual anchor: `assets/reference/visual-direction.png`. Current phase: **Phase 3 — Genesis**, authorized by owner decision W7 (2026-11-25) after the conditional closure of Phase 2 (W6; evidence in `docs/phase-2-exit.md` §9). Scope: roadmap v1.1 (`docs/master-plan.md` §11) and the Phase 3 plan in `docs/plans/`. Phase 3 was merged into `main` as PR #4 (`870ef62`, 2026-11-26) on the owner's explicit merge-only instruction; the Phase 3 exit gate (not decided; it stays open), its visual review and ADR 0017 choices 1–8 are **not** decided. On 2026-11-27 the owner decided P3D-4 (choice 9 as (a)), P3D-5 (RTX 5070 C1–C6 due before any Phase 5 work, not waived), P3D-6 (cross-engine determinism is a tested property) and GOV-1 (merge, gate, ADR, visual, next-phase and release decisions are separate; a merge implies none of the others), recorded in `docs/review/phase-3-owner-decision-packet.md` §0. The same day the owner adopted the geometry gates (below) and decided ART-D1, ART-D2, ART-D3a and ART-D3b (art direction, below; later ART-D3b rulings did not approve B-2 v5 or v7). On 2026-11-28 the owner decided D-1…D-5 (`docs/review/art-1-raven-decision-packet.md` §0.3): O1–O3 accepted as a research direction only, one bounded method revision M3.1, Geometry Operator Laboratory M0–M1 only, the Visual Bible clarifications D-4a (justified prismatic forms) and D-4b (asymmetry not mandatory), and reproducible diagnostic scripts under `docs/`. Later the same day the owner decided D-6…D-10 and an independent laboratory CI job (§0.4 there): research execution only for laboratory M2 (O2), an O1 v2 contract for tilted sections, modular seams preferred over closed crease networks (design only), multi-host attachments, holes and seam topology deferred to M4, and a bounded correction of method errata R1–R4; M3–M5 stay locked. These are recorded on draft PR #14 and are not in force on `main` until a merge is authorized. No other phase, gate or ADR decision was made. ADR 0018 and 0019 are Proposed, not accepted. Phase 4 is **not** authorized; no PR is merged without the owner's explicit approval.

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

## Geometry acceptance

New or changed object geometry is judged only under [`docs/governance/geometry-quality-gates.md`](docs/governance/geometry-quality-gates.md) (GEO-0…GEO-7, adopted rules; no model is approved by them): verdicts PASS/FAIL/NOT VERIFIED at an exact evidence SHA, the design brief committed before the implementing commit, and owner sign-off for GEO-2, GEO-5 and GEO-7. Experiments may report partial results but claim no acceptance.

## Art direction

Visible object design (creatures, vehicles, architecture, plants, props) follows the [Visual Bible](docs/art/visual-bible.md) (below the master plan and accepted ADRs; artistic, not a feasibility claim) and is judged under [`docs/governance/art-quality-gates.md`](docs/governance/art-quality-gates.md) (ART-0…ART-5, adopted 2026-11-27). ART applies alongside GEO, never replaces or weakens it, and GEO wins on any conflict. An owner ART-1 concept approval, naming exact sheet digests, precedes any object implementation. Selecting an artistic direction (as ART-D3a did for the Raven) does not meet that precondition, and a new sheet version or material change inherits no earlier decision. Owner decisions: [`docs/review/art-1-raven-decision-packet.md`](docs/review/art-1-raven-decision-packet.md) §0.

## Tests

- Vitest; TDD at public seams. Behavioral tests import **only** package entry points (`@eschaton/foldon`, `@eschaton/world`, `@eschaton/wave`, `@eschaton/genesis`), never internal modules (lint-enforced via relative-import ban).
- No mocks/spies (`vi.*`), no sleeps. Real lightweight inputs, seeds, explicit clocks.
- Flat `test("does x")` titles that state behavior; one cause → one decisive outcome. Regression tests name the original defect. Cover promises, not lines; delete tests that would not catch a realistic bug.
- Never weaken, skip or delete a valid test to make code pass.

## Git

Work on a task branch/worktree per phase (`phase-0` for Phase 0 closure, `phase-1` for Phase 1, stacked on `phase-0`). Never commit on the default branch; never merge a PR without the owner's explicit merge authorization; never stash, reset, rebase or force-push shared work. One commit per plan step.

## Fold-angle convention (Foldon geometry)

Y up; cell `[x,y,z]` occupies `[x,x+1]×[y,y+1]×[z,z+1]`. Rotation = quarter turns about +Y through the XZ centre of the anchor cell, then translation by the anchor. Each panel is a planar convex polygon, CCW seen from its front; front normal by Newell's method. For a crease with parent front normal `nP`, child front normal `nC`, and `a = normalize(nP × uP)` where `uP` is the in-plane unit vector perpendicular to the hinge edge pointing into the parent (toward its centroid): `θ = atan2(dot(nP × nC, a), dot(nP, nC))`. `θ = 0` is flat; **θ > 0 is valley** (fronts turn toward each other), **θ < 0 is mountain**. Creases form a tree rooted at a root panel; closed crease networks are out of scope for Phase 0.
