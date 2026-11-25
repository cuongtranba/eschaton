# Architecture decision records

Short MADR-style records. Each one states the context, the options considered, the decision, the consequences and the evidence in this repository.

**Owner decisions of 2026-11-25** (recorded in [`../review/phase-0-owner-review.md`](../review/phase-0-owner-review.md) §0):
- **D3** approved ADRs 0001–0013 on condition that the independent-review amendments ([`../review/adr-review.md`](../review/adr-review.md)) are applied. Each ADR now ends with an "Amendments" section that applies them and traces every answer to its source.
- **D4** approved the Phase 1 plan recommendations that answer the open design questions.

Questions that were not answered by D3 or D4 are marked **open owner question** in the ADR concerned. None of them blocks Phase 1. For 0001–0009 the Phase 0 code follows the decision; 0010–0013 are Phase 1 designs, implemented on branch `phase-1`.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-package-layout.md) | Phase 0 package layout: contracts merged into `@eschaton/foldon`; the Studio owns the renderer adapter; `@eschaton/world` added in Phase 1; `foldon` imports no workspace package | Accepted with amendments (D3) |
| [0002](0002-cubic-grid-and-yaw-rotations.md) | Cubic integer grid with yaw-only quarter-turn rotations | Accepted with amendments (D3); toy-like-grid risk accepted as open, gated on the ADR 0013 rebuild experiment |
| [0003](0003-crease-representation.md) | Folded-net panels authored in the rest pose, tree-only open hinges, FOLD as a future adapter; fold angles are runtime state and never change occupancy | Accepted with amendments (D3); closed-loop research gate before the Phase 4 gate |
| [0004](0004-multi-cell-encoding.md) | Placement-based public contract for multi-cell pieces | Accepted (D3); open owner question on cross-engine generation determinism (Phase 2 scope) |
| [0005](0005-renderer-webgpu-tsl-webgl2-fallback.md) | `WebGPURenderer` + TSL with automatic WebGL2 fallback | Accepted conditionally (D3, D5); **WebGPU on a physical GPU unverified**, waived for the Phase 0 gate only, deferred to the start of Phase 1 |
| [0006](0006-ink-visual-strategy.md) | World-anchored tri-planar hatching, quantized light, haze; shadows deferred | Technical direction accepted (D3); aesthetics only as a look-dev prototype (D1); open owner question on hatching for moving pieces (Phase 5) |
| [0007](0007-component-data-and-system-order.md) | Component data only in Phase 0; Phase 1 systems run on explicit invocation; tick and system order in Phase 4; bonds in ADR 0014 | Accepted with amendments (D3, D4) |
| [0008](0008-assembly-promotion-and-hashing.md) | Assembly catalog promotion and canonical recipe hashing; depth implied by levels; versioned definitions fingerprinted in the world header | Accepted with amendments (D3) |
| [0009](0009-socket-compatibility.md) | One symmetric socket-profile table; tangent alignment inert (Phase 0 record) | Accepted (D3) as the Phase 0 record; amended by ADR 0012 |
| [0010](0010-runtime-identity-ownership-lineage.md) | Runtime entities with ids `(revision, ordinal)` minted on commit, one ownership field, lineage and conservation | Accepted with amendments (D3, D4); open owner questions Q5, Q9, Q10 |
| [0011](0011-atomic-transactions-and-revisions.md) | Immutable snapshots, patches against a base revision (strict in Phase 1; read-region rebase required in Phase 2), atomic commit and an outcome log for replay | Accepted with amendments (D3, D4) |
| [0012](0012-directional-sockets.md) | Orientation-aware sockets: in-face turn, per-profile symmetry (lcm rule) and side-face hand in one table | Accepted with amendments (D3, D4); the Q5 table placement is an interpretation for the owner to confirm |
| [0013](0013-logical-vs-rendered-geometry.md) | Logical placements, decorative offsets (zero in Phase 1), fragments starting from the logical pose, and a separate backdrop | Accepted with amendments (D3, D4) |
| [0014](0014-bond-model.md) | Bond record per mated socket pair, owned by the world, created when an entity becomes placed and removed when it leaves; strength is data only until Phase 4 | Proposed; core approved as P1-D11 (D4); two interpretations flagged for owner confirmation |

## Pending (not written in Phase 0)

These come from the master plan §13 list and need evidence that Phase 0 did not produce.

| Topic | Why pending | Earliest phase |
|---|---|---|
| Tick pipeline, system order and simulation replay semantics | The transaction and revision contract is [ADR 0011](0011-atomic-transactions-and-revisions.md); Phase 1 systems run only on explicit invocation ([ADR 0007](0007-component-data-and-system-order.md) amendment); stepping, idle ticks and system order need the Phase 4 tick ADR | 4 |
| Read-region rebase (region-aware frozen-boundary validation) | Strict base-revision equality in Phase 1 ([ADR 0011](0011-atomic-transactions-and-revisions.md) amendment); required by the Phase 2 exit criteria | 2 |
| Closed-loop crease networks | Research gate before the Phase 4 gate ([ADR 0003](0003-crease-representation.md) amendment) | before 4 |
| Local solve and seam ownership | Split by roadmap v1.1 ([master plan §11](../master-plan.md)): the frozen-boundary local solve is Phase 2 scope; seam ownership belongs to the Phase 8 research track. The WFC experiment is 2D, single-chunk and throwaway | 2 (local solve), 8 (seams) |
