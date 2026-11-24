# Eschaton — agent rules

Procedural origami-inspired world engine (TypeScript + Three.js). Authoritative design: `docs/master-plan.md`. Visual anchor: `assets/reference/visual-direction.png`. Current phase: **Phase 0 — research & geometry lab**; do not start later phases without approval.

## Commands (pnpm only)

| Command | Purpose |
|---|---|
| `pnpm dev` | Studio dev server on http://localhost:5173 |
| `pnpm test` | Vitest across packages |
| `pnpm lint` | ESLint (type-aware, strict) |
| `pnpm typecheck` | `tsc` per workspace project |
| `pnpm build` | Production build of every buildable project |
| `pnpm e2e` | Playwright against the Studio |
| `pnpm bench` | Benchmarks (where defined) |

Run lint, typecheck, test and build before declaring work done. Never report a check as passed unless you ran it.

## Layout

`apps/studio` (Vite + React UI) · `packages/foldon` (`@eschaton/foldon`, geometry/definitions/placement) · `experiments/` (throwaway) · `docs/` (plan, research, ADRs). Do not scaffold future packages before they are needed. Packages are consumed as TypeScript source (`exports` → `src/index.ts`); no build step.

## Coding rules (master-plan §7.3)

- Strict TypeScript. No `any`, no unchecked `as` casts to bypass validation. Prefer discriminated unions, exhaustive switches, branded IDs.
- **Composition over inheritance.** No class `extends` in `packages/**` (ESLint-enforced). Prefer plain data + pure functions; classes only to encapsulate state behind a small API. Interface `extends` is fine.
- Definition data is immutable, versioned, serializable (no functions or renderer objects inside). Runtime state is stored separately.
- One authoritative state; derived caches are not truth. UI sends commands, never mutates domain state. Acyclic, one-way dependencies.
- Deep modules with behavior-level APIs; no shallow pass-through layers or premature abstractions. Avoid explanatory inline comments; record rationale in docs/ADRs.
- Never use global randomness; seed everything. Fixed explicit clocks.
- Validate at boundaries and return `Result<T, E>` rather than throwing for expected failures.

## Tests

- Vitest; TDD at public seams. Behavioral tests import **only** the package entry point (`@eschaton/foldon`), never internal modules (lint-enforced via relative-import ban).
- No mocks/spies (`vi.*`), no sleeps. Real lightweight inputs, seeds, explicit clocks.
- Flat `test("does x")` titles that state behavior; one cause → one decisive outcome. Regression tests name the original defect. Cover promises, not lines; delete tests that would not catch a realistic bug.
- Never weaken, skip or delete a valid test to make code pass.

## Git

Work on a task branch/worktree (`.worktrees/phase-0`, branch `phase-0`). Never commit on the default branch; never stash, reset, rebase or force-push shared work. One commit per plan step.

## Fold-angle convention (Foldon geometry)

Y up; cell `[x,y,z]` occupies `[x,x+1]×[y,y+1]×[z,z+1]`. Rotation = quarter turns about +Y through the XZ centre of the anchor cell, then translation by the anchor. Each panel is a planar convex polygon, CCW seen from its front; front normal by Newell's method. For a crease with parent front normal `nP`, child front normal `nC`, and `a = normalize(nP × uP)` where `uP` is the in-plane unit vector perpendicular to the hinge edge pointing into the parent (toward its centroid): `θ = atan2(dot(nP × nC, a), dot(nP, nC))`. `θ = 0` is flat; **θ > 0 is valley** (fronts turn toward each other), **θ < 0 is mountain**. Creases form a tree rooted at a root panel; closed crease networks are out of scope for Phase 0.
