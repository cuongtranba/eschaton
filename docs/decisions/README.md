# Architecture decision records

Short MADR-style records. Each one states the context, the options considered, the decision, the consequences and the evidence in this repository. Every ADR here is **Proposed — awaiting owner approval**. For 0001–0009 the Phase 0 code already follows the proposal; 0010–0013 are Phase 1 designs with no code. None is accepted until the owner decides (independent review: [`../review/adr-review.md`](../review/adr-review.md)); the gate itself is open (see [`../phase-0-exit.md`](../phase-0-exit.md)).

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-package-layout.md) | Phase 0 package layout: contracts merged into `@eschaton/foldon`; the Studio owns the renderer adapter | Proposed — awaiting owner approval (Phase 0 code follows it) |
| [0002](0002-cubic-grid-and-yaw-rotations.md) | Cubic integer grid with yaw-only quarter-turn rotations | Proposed — awaiting owner approval; toy-like grid risk open |
| [0003](0003-crease-representation.md) | Folded-net panels authored in the rest pose, tree-only open hinges, FOLD as a future adapter | Proposed — awaiting owner approval (Phase 0 code follows it) |
| [0004](0004-multi-cell-encoding.md) | Placement-based public contract for multi-cell pieces | Proposed — awaiting owner approval (Phase 0 code follows it) |
| [0005](0005-renderer-webgpu-tsl-webgl2-fallback.md) | `WebGPURenderer` + TSL with automatic WebGL2 fallback | Proposed — awaiting owner approval; WebGPU on a physical GPU unverified |
| [0006](0006-ink-visual-strategy.md) | World-anchored tri-planar hatching, quantized light, haze; shadows deferred | Proposed — awaiting owner approval (aesthetic acceptance not given) |
| [0007](0007-component-data-and-system-order.md) | Phase 0 defines component data only; systems and their order are Phase 1 | Proposed — awaiting owner approval (Phase 0 code follows it) |
| [0008](0008-assembly-promotion-and-hashing.md) | Assembly catalog promotion and canonical recipe hashing | Proposed — awaiting owner approval (Phase 0 code follows it) |
| [0009](0009-socket-compatibility.md) | One symmetric socket-profile table; tangent alignment only on side faces | Proposed — awaiting owner approval (Phase 0 code follows it) |
| [0010](0010-runtime-identity-ownership-lineage.md) | Runtime entities with ids minted on commit, one ownership field, lineage and a conservation ledger (Phase 1 design) | Proposed — awaiting owner approval (Phase 1 design, no code) |
| [0011](0011-atomic-transactions-and-revisions.md) | Immutable snapshots, patches against a base revision, atomic commit and an outcome log for replay (Phase 1 design) | Proposed — awaiting owner approval (Phase 1 design, no code) |
| [0012](0012-directional-sockets.md) | Orientation-aware sockets: in-face turn, per-profile symmetry and side-face hand in one table (Phase 1 design) | Proposed — awaiting owner approval (Phase 1 design, no code) |
| [0013](0013-logical-vs-rendered-geometry.md) | Logical placements, bounded decorative offsets, dynamic fragments and a separate backdrop (Phase 1 design) | Proposed — awaiting owner approval (Phase 1 design, no code) |

## Pending (not written in Phase 0)

These come from the master plan §13 list and need evidence that Phase 0 did not produce.

| Topic | Why pending | Earliest phase |
|---|---|---|
| Tick pipeline and simulation replay semantics | The transaction and revision contract is drafted as [ADR 0011](0011-atomic-transactions-and-revisions.md); stepping, idle ticks and system order need the Phase 4 tick ADR | 4 |
| Local solve and seam ownership | Split by roadmap v1.1 ([master plan §11](../master-plan.md)): the frozen-boundary local solve is Phase 2 scope; seam ownership belongs to the Phase 8 research track. The WFC experiment is 2D, single-chunk and throwaway | 2 (local solve), 8 (seams) |
