# ADR 0001: Phase 0 package layout

- Status: Proposed — awaiting owner approval (Phase 0 code already follows it)
- Date: 2026-11-24
- Master plan: §8 (architecture and ownership), §14 step 1 ("do not scaffold every future package")

## Context

Master plan §8 proposes a module table: contracts, catalog, generation, simulation, renderer adapter, persistence and Studio. Phase 0 has to prove geometry, assemblies and a look. It has no world engine, solver, simulation or persistence. Splitting packages that have no second consumer would add build wiring and public surfaces that Phase 1 would then have to change.

## Options considered

1. **All §8 packages as empty or thin shells now.** Names are stable early. Every shell is a public API with no caller, so the boundaries would be guesses.
2. **One package for everything, including the renderer.** Least wiring. Puts `three` into the domain package and makes the headless tests import a renderer.
3. **`@eschaton/foldon` for contracts + catalog + geometry, and the renderer inside the Studio app.** Two projects, one dependency direction.

## Decision

Option 3.

- `packages/foldon` (`@eschaton/foldon`) holds the contracts (ids, `Result`, definitions, validation issues), the geometry recipe and hinge posing, placement transforms, the primitive catalog, assembly recipes, the catalog registry and canonical hashing. It has no runtime dependencies and no DOM or three.js imports.
- `apps/studio` holds the lab state reducer, the view-model builders, the composition generators and the renderer adapter (`src/renderer/`). The renderer is the only code that imports `three`.
- `experiments/wfc-placement` is throwaway and nothing imports it.
- Packages are consumed as TypeScript source through `exports`; there is no build step for libraries.

## Consequences

- The package that Phase 1 will extend (placement, bonds, composition systems) is already the one with the public-seam tests.
- The renderer adapter is not reusable outside the Studio yet. Extracting it is cheap while it has one consumer and `ViewModel` is the only type that crosses the boundary (`apps/studio/src/lab/viewModel.ts`).
- "Contracts" and "catalog" will have to be split if a second package (for example a worker-side solver) needs the contracts without the primitive data. Not needed in Phase 0.
- The composition generators (`apps/studio/src/lab/composition/`) live in the Studio, so the reference scene is not testable through the `@eschaton/foldon` entry point. They are covered by the Playwright specs only.

## Evidence

- Layout and import direction: [`../architecture/overview.md`](../architecture/overview.md).
- Bootstrap commit `e6f45fe`; core `5a94304`; assemblies `45576a8`; Studio `4afa9f0`; look-dev `279e8c8`.
- `AGENTS.md` records the "do not scaffold future packages" rule.
