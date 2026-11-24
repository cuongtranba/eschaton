# Architecture decision records

Short MADR-style records. Each one states the context, the options considered, the decision, the consequences and the evidence in this repository. A decision is **Accepted for Phase 0** when the code already follows it; none of them is final until the owner signs the Phase 0 gate (see [`../phase-0-exit.md`](../phase-0-exit.md)).

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-package-layout.md) | Phase 0 package layout: contracts merged into `@eschaton/foldon`; the Studio owns the renderer adapter | Accepted for Phase 0 |
| [0002](0002-cubic-grid-and-yaw-rotations.md) | Cubic integer grid with yaw-only quarter-turn rotations | Accepted for Phase 0, risk open |
| [0003](0003-crease-representation.md) | Folded-net panels authored in the rest pose, tree-only open hinges, FOLD as a future adapter | Accepted for Phase 0 |
| [0004](0004-multi-cell-encoding.md) | Placement-based public contract for multi-cell pieces | Accepted for Phase 0 |
| [0005](0005-renderer-webgpu-tsl-webgl2-fallback.md) | `WebGPURenderer` + TSL with automatic WebGL2 fallback | Accepted, WebGPU path unverified |
| [0006](0006-ink-visual-strategy.md) | World-anchored tri-planar hatching, quantized light, haze; shadows deferred | Proposed, needs owner approval |
| [0007](0007-component-data-and-system-order.md) | Phase 0 defines component data only; systems and their order are Phase 1 | Accepted for Phase 0 |
| [0008](0008-assembly-promotion-and-hashing.md) | Assembly catalog promotion and canonical recipe hashing | Accepted for Phase 0 |
| [0009](0009-socket-compatibility.md) | One symmetric socket-profile table; tangent alignment only on side faces | Accepted for Phase 0 |

## Pending (not written in Phase 0)

These come from the master plan §13 list and need evidence that Phase 0 did not produce.

| Topic | Why pending | Earliest phase |
|---|---|---|
| World transaction and replay semantics | No authoritative world state exists yet; Phase 0 has one reducer for lab UI state only | 1 (contracts), 4 (replay) |
| Local solve and seam ownership | Needs a solver, chunks and a world to own seams; the WFC experiment is 2D, single-chunk and throwaway | 4 and 6 |
