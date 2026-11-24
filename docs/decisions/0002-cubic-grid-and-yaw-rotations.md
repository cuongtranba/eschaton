# ADR 0002: Cubic integer grid with yaw-only quarter-turn rotations

- Status: Proposed — awaiting owner approval (Phase 0 code already follows it); the "toy-like world" risk from master plan §13 is **not retired**
- Date: 2026-11-24
- Master plan: §4, §13 ("Cubic grid creates a toy-like world")

## Context

WFC needs a discrete lattice. The plan asks for a comparison between a cubic grid and irregular topology or off-grid continuous geometry. Phase 0 did not build an irregular lattice.

## Options considered

1. **Cubic integer cells, rotation about +Y in quarter turns.** Footprints are sets of integer cells, adjacency is face-to-face, rotations form a group of four.
2. **Cubic cells with all 24 orientations.** Allows tipped and rolled pieces. Sockets and footprints would need orientation-aware tables for every piece, and no Phase 0 piece needs it.
3. **Irregular lattice** (Voronoi, triangulated or graph-based). Breaks the straight-line silhouettes the reference avoids. Needs a different neighbour model, a different solver encoding and different footprint semantics. Not attempted.

## Decision

Option 1. A cell `[x,y,z]` occupies `[x,x+1]×[y,y+1]×[z,z+1]`. A placement is an anchor cell plus `rotation ∈ {0,1,2,3}` quarter turns about +Y through the XZ centre of the anchor cell (`packages/foldon/src/transform.ts`, convention in `AGENTS.md`). Roll and pitch are not part of the logical model.

Geometry inside a cell is not restricted to the cube. Panels may be any planar convex polygon inside the footprint bounds; P03–P07 and P09 are gables, a valley channel, a prism, a pyramid and an irregular fragment.

## Consequences

- Sockets exist only on the six axis-aligned external faces of the footprint (ADR 0009).
- The composition generator (`apps/studio/src/lab/composition/affine.ts`) deliberately places Foldon instances **off-grid**, with arbitrary yaw/pitch/roll and non-uniform scale, to get slab towers, long corridor strips and beams. That is a rendering-side affine on top of the same definitions. It is not a logical placement and nothing validates sockets for it. It shows that the definitions survive being used off-grid; it does not show that a solver could generate such layouts.
- Look-dev notes record that stacked P08 boxes with outlines read as window grids and carry the "toy cube" risk ([`../research/look-dev.md`](../research/look-dev.md), technique 5). The composition's foreground reads as crumpled paper rather than layered debris.
- Risk left open: an actual comparison of silhouette quality between the grid and an irregular lattice was not done. The plan's mitigation ("compare silhouette quality with off-grid continuous geometry and sparse multi-cell footprints") was only partly exercised through the affine scene and the sparse 3×2 courtyard in the WFC experiment.

## Evidence

- `packages/foldon/src/transform.ts`, `packages/foldon/src/definition.ts` (`externalFaces`, `allRotations`).
- `apps/studio/src/lab/composition/affine.ts`, `district.ts`; screenshots `docs/screenshots/p0.5-reference-composition.png`, `p0.4-watchtower-composition.png`.
- WFC experiment tiles with sparse footprints: `experiments/wfc-placement/src/tiles.ts`.
