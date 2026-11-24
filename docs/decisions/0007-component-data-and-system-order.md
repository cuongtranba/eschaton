# ADR 0007: Component data and system order

- Status: Proposed — awaiting owner approval (Phase 0 code already follows it) (data only); system order is deferred to Phase 1
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
- Composition over inheritance is enforced by lint: `ClassDeclaration[superClass]` and `ClassExpression[superClass]` are banned in `packages/**` via `no-restricted-syntax` in `eslint.config.js`. Interface `extends` is allowed.
- **System order and tick pipeline are not decided here.** Phase 1 should add the first systems (attachment/bonds and composition) and record the order in a new ADR.

## Consequences

- The Phase 1 exit criterion "roof and leaf share behaviour without inheritance" has no test yet; it cannot be tested until a system exists.
- The component list is a first guess. `windResponsive.drag`, `decayable.resistance` and `thermal.capacity` are unvalidated numbers; no field model has consumed them.
- The lint gate only covers `packages/**`. The Studio app has no class `extends` today, but the rule does not cover it.

## Evidence

- `packages/foldon/src/definition.ts`, `catalog.ts` (components per primitive), `eslint.config.js`.
- `pnpm lint` result in the exit report.
