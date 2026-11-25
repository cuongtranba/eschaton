# ADR 0007: Component data and system order

- Status: **Accepted with amendments** — owner decision D3 (2026-11-25, recorded in [`../review/phase-0-owner-review.md`](../review/phase-0-owner-review.md) §0) approved this ADR on condition that the independent-review amendments ([`../review/adr-review.md`](../review/adr-review.md)) are applied. They are applied in the section "Amendments (owner D3, 2026-11-25)" below; the Phase 0 code follows it (data only).
- Date: 2026-11-24
- Master plan: §7 (composition over inheritance), §6.1, §13 ("Composition turns into generic framework")

## Context

The plan requires behaviours to be composed, not inherited, and wants explicit capabilities and systems rather than hidden behaviour chains. Phase 0 has no tick, no world and no simulation, so there is nothing for a system to run on.

## Options considered

1. **Class hierarchy** (`Roof extends Piece`). Banned by the plan.
2. **Generic entity-component-system framework now.** Premature: no second system exists to justify the abstraction.
3. **Plain component data on immutable definitions; systems added when a phase needs them.**

## Decision

Option 3.

- `FoldonDefinition.components` is a list of a discriminated union `ComponentSpec` with six kinds: `foldable`, `structural`, `wind-responsive`, `decayable`, `thermal` and `renderable` (`packages/foldon/src/definition.ts`). They are data only: no functions, no renderer objects. Definitions round-trip through JSON (tests: "definitions round-trip through JSON to deep-equal values" and the assembly equivalent).
- Components are validated at the boundary (`component-unknown-crease`, `component-invalid`).
- The `renderable` component carries a `MaterialId`; nothing in the package maps it to a renderer. Phase 0 materials in the Studio are tone values.
- **No system reads components yet.** The `foldable` component duplicates information that is also in the geometry recipe's creases; the lab reads the recipe.
- Composition over inheritance is enforced by lint: `ClassDeclaration[superClass]` and `ClassExpression[superClass]` are banned in every first-party `.ts`/`.tsx` file (since A2, `04bd36b`; originally `packages/**` only) via `no-restricted-syntax` in `eslint.config.js`. Interface `extends` is allowed.
- **System order and tick pipeline are not decided here.** As amended below: Phase 1 adds systems that run only on explicit invocation, with no tick and no engine-wide order. The tick, idle-tick semantics and system order belong to the Phase 4 ADR.

## Consequences

- The Phase 1 exit criterion "roof and leaf share behaviour without inheritance" has no test yet; it cannot be tested until a system exists.
- The component list is a first guess. `windResponsive.drag`, `decayable.resistance` and `thermal.capacity` are unvalidated numbers; no field model has consumed them.
- The lint gate covers every first-party source file since A2 (`04bd36b`); `tools/architecture` has a rejection test for each area.

## Evidence

- `packages/foldon/src/definition.ts`, `catalog.ts` (components per primitive), `eslint.config.js`.
- `pnpm lint` result in the exit report.

## Amendments (owner D3 and D4, 2026-11-25)

Resolves the conflict between this ADR, ADR 0011 (question 5) and the README "Pending" table.

- **Explicit system invocation in Phase 1** (plan decision P1-D10, approved by D4). A system is plain data plus a pure planning function, `{ id, reads: ComponentKind[], plan(view, input) }`. It reads only entities that carry its declared components and returns a patch or a rejection. `runSystem(world, system, input)` commits that patch through `applyPatch` (ADR 0011), the only write path. There is no tick, scheduler, registry or engine-wide system order in Phase 1.
- **Tick and system order are Phase 4.** The Phase 4 (Collapse) ADR decides the fixed tick, idle-tick semantics and the order of systems. Until then the header's `tick` stays 0.
- **Bonds get their own ADR (0014)** before the Phase 1 bond milestone (M4). It is written on the Phase 1 branch and scoped by plan decision P1-D11.
- **First consumer of component data:** the Phase 1 `windFold` system reads `foldable` and `wind-responsive` to set fold angles. It provides the test for the exit criterion "roof and leaf share behaviour without inheritance".

## Implementation (Phase 1)

- `runSystem(catalog, state, system, input)`, `systemView` and `windFold` live in `packages/world/src/systems.ts`.
- A system that emits an op for an entity outside its view is rejected.
- The roof is the shipped `roof-module` (two P03). The leaf is the `leaf` preset (`packages/foldon/src/presets.ts`), built with `foldedNet`; it is not a primitive.
- **Tests:** `packages/world/test/systems.test.ts`. "wind folds both a roof and a leaf through the same system" is the Phase 1 exit criterion "roof/leaf share behaviour without inheritance".
