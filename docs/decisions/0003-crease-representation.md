# ADR 0003: Crease representation

- Status: **Accepted with amendments** — owner decision D3 (2026-11-25, recorded in [`../review/phase-0-owner-review.md`](../review/phase-0-owner-review.md) §0) approved this ADR on condition that the independent-review amendments ([`../review/adr-review.md`](../review/adr-review.md)) are applied. They are applied in the section "Amendments (owner D3, 2026-11-25)" below; the Phase 0 code follows it.
- Date: 2026-11-24
- Master plan: §4.2, §9 (origami MVP), §13 ("Closed crease system cannot fold"); research R5, R6

## Context

A Foldon must fold continuously, validate that hinges stay shared, and stay serializable. The plan warns that closed crease networks need simultaneous constraint solving and self-intersection tests.

## Options considered

1. **Crease pattern + solver** (FOLD-style vertices/edges/faces, folded by an iterative solver as in Origami Simulator). General, but needs a solver, collision handling and stable convergence. Out of scope for Phase 0.
2. **Mesh with per-vertex animation targets.** Easy to render. Hinge edges are not guaranteed to stay coincident, and fold angles are not data.
3. **Folded net authored in the rest pose, with a tree of open hinges.** Rigid panels rotate about shared edges. Angles are explicit data with a range.

## Decision

Option 3.

- `GeometryRecipe` is a list of convex planar `Panel`s plus a list of `CreaseDefinition`s that join two panels along a shared edge. The panels are authored in the **rest pose** (the fully folded shape the primitive is meant to have), and `poseGeometry` computes any other pose by rotating each rigid sub-tree about its hinge (`packages/foldon/src/geometry.ts`).
- Creases form a **tree** rooted at one panel. A cycle or a disconnected panel is a validation error (`crease-cycle`, `panel-disconnected`).
- Each crease has a `restAngle`, an angle `range`, a stiffness and an assignment. A target outside the range is **refused with a `PoseError`, never clamped**. `foldProgress(recipe, t)` linearly scales rest angles and clamps only to each crease's own range, for the lab slider.
- **Sign convention:** `θ = 0` flat, `θ > 0` valley, `θ < 0` mountain, defined by a formula in `AGENTS.md`. This matches the FOLD specification (`edges_foldAngle` positive for valley, negative for mountain), checked in R5.
- **FOLD is a future import/export adapter**, not the world format. The tests R5 asks for (M ↔ negative angle, V ↔ positive, reject missing vertex ids) are not written because no adapter exists.

## Consequences

- Continuous folding works and keeps shared hinge edges coincident: `packages/foldon/test/foldon.test.ts` has "hinge edges stay coincident under arbitrary in-range poses of a roof and a box", "fold progress zero lays every panel flat in the root plane" and "fold progress one reproduces the authored rest pose of every primitive".
- P08 (`boxShell`) has six panels and five hinges: four wall hinges to the floor and one lid hinge on the east wall. The four vertical wall–wall edges are not hinges, so the closed box is a rest-pose property and the engine does not enforce those seams while the box is partly folded.
- Origami that needs closed crease networks (a real flat-foldable bird, rigid-foldable twist folds) cannot be expressed. The README says "no arbitrary physically foldable origami" and that stays true.
- Performance: `poseGeometry` takes about 16 µs for P08 and about 1.1–1.2 µs for P01/P02 on the benchmark machine ([`../../benchmarks/`](../../benchmarks/)). Posing is cheap enough to do on every slider tick.
- Collision and self-intersection between panels during a fold are not checked.

## Evidence

- `packages/foldon/src/geometry.ts`, `validate.ts`; tests `packages/foldon/test/foldon.test.ts`.
- Studio crease readouts and fold slider: `apps/studio/e2e/lab.spec.ts` ("moving the fold slider to zero flattens every crease readout"); screenshot `docs/screenshots/p0.4-p08-mid-fold-creases.png`.
- R5, R6 in [`../research/phase-0.md`](../research/phase-0.md).

## Amendments (owner D3, 2026-11-25)

- **Posed geometry is not bounded by the footprint; only the rest pose is validated** (`validate.ts`, `vertex-outside-footprint`, checked on the authored rest pose). Measured on 2026-11-25 by posing at `foldProgress = 0`: P08 (one cell, `[0,1]³`) lays flat over x ∈ [−0.94, 2.90], z ∈ [−0.94, 1.94], and P07 over x, z ∈ [−1.05, 2.05]. So posed panels can overlap neighbouring cells, and nothing checks that.
- **Fold pose versus occupancy** (owner D4, plan decision P1-D8): fold angles are per-entity runtime state of the world (ADR 0010 amendment). They are authoritative: committed by a patch, validated against each crease's range with `poseGeometry`, and included in the state hash. **Logical occupancy is always the definition footprint, whatever the pose.** Collisions between posed panels are a later, separate check. Phase 1 test: "folding never changes occupancy".
- **Closed-loop research gate.** A throwaway experiment runs before the Phase 4 (Collapse) gate and no later than Phase 5. It folds one closed-loop mechanism (a degree-4 rigid-foldable vertex, and P08 with its four seams treated as loop constraints) with an iterative constraint solver. It reports convergence rate, determinism on one engine, cost per pose against the 16 µs P08 tree pose, and seam gap. The owner then decides from screenshots whether closed folding is needed for the look. Until then, "tree-only" stands, and so does the §1.2 non-goal ("fully general origami solver").
- Cosmetic: the e2e title is "moving the fold slider to zero flattens every crease readout to 0°".
