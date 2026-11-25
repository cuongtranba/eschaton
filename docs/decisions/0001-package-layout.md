# ADR 0001: Phase 0 package layout

- Status: **Accepted with amendments** — owner decision D3 (2026-11-25, recorded in [`../review/phase-0-owner-review.md`](../review/phase-0-owner-review.md) §0) approved this ADR on condition that the independent-review amendments ([`../review/adr-review.md`](../review/adr-review.md)) are applied. They are applied in the section "Amendments (owner D3, 2026-11-25)" below; the Phase 0 code follows it.
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

## Amendments (owner D3, 2026-11-25)

- **Superseded in part for Phase 1: `@eschaton/world`.** Owner decision D4 approved plan decision P1-D2 (ADR 0011 question 7, option A): runtime state, transactions, revisions and systems live in a new package `packages/world` (`@eschaton/world`) that imports `@eschaton/foldon`. `foldon` stays definitions-only. This follows this ADR's own rule ("split when a second consumer needs it").
- **Import direction is lint-enforced, not "checked by reading".** Since commit `04bd36b` (A2), `eslint.config.js` enforces entry-point-only imports, `three` only in the Studio renderer, React only in the Studio UI shell, a pure `foldon`, and "nothing imports apps or experiments". `tools/architecture` proves every rule rejects a violation.
- **`foldon` imports no other workspace package** (review question 1 for this ADR; closure fix). The `packages/foldon` area forbids every `@eschaton/*` import except its own entry point, so a future `foldon → world` import, which would create a cycle, fails lint before `world` exists. Tests: "rejects foldon importing a sibling workspace package" and "rejects foldon tests importing a sibling workspace package" (`tools/architecture/test/architecture.test.ts`).
- **A contracts-only package is still not split out.** The review lists it as a missing option. It becomes worth doing when a worker bundle needs the contracts without the primitive data (Phase 2 at the earliest). Until then, contracts stay in `foldon`, including the typed module contracts from A1 (`contract.ts`).
