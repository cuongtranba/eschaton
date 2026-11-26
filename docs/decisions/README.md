# Architecture decision records

Short MADR-style records. Each one states the context, the options considered, the decision, the consequences and the evidence in this repository.

**Owner decisions of 2026-11-25** (D1–D7 recorded in [`../review/phase-0-owner-review.md`](../review/phase-0-owner-review.md) §0; R1–R8 in [`../review/phase-1-owner-review.md`](../review/phase-1-owner-review.md); W1–W7 in [`../review/phase-2-owner-review.md`](../review/phase-2-owner-review.md)):
- **D3** approved ADRs 0001–0013 on condition that the independent-review amendments ([`../review/adr-review.md`](../review/adr-review.md)) are applied. Each ADR now ends with an "Amendments" section that applies them and traces every answer to its source.
- **D4** approved the Phase 1 plan recommendations that answer the open design questions.

Questions that were not answered by D3 or D4 are marked **open owner question** in the ADR concerned. None of them blocks Phase 1. For 0001–0009 the Phase 0 code follows the decision; 0010–0013 are Phase 1 designs, implemented on branch `phase-1` and merged to `main` with PR #2 (merge commit `940a50b`).

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-package-layout.md) | Phase 0 package layout: contracts merged into `@eschaton/foldon`; the Studio owns the renderer adapter; `@eschaton/world` added in Phase 1; `foldon` imports no workspace package | Accepted with amendments (D3) |
| [0002](0002-cubic-grid-and-yaw-rotations.md) | Cubic integer grid with yaw-only quarter-turn rotations | Accepted with amendments (D3); toy-like-grid risk accepted as open, gated on the ADR 0013 rebuild experiment |
| [0003](0003-crease-representation.md) | Folded-net panels authored in the rest pose, tree-only open hinges, FOLD as a future adapter; fold angles are runtime state and never change occupancy | Accepted with amendments (D3); closed-loop research gate before the Phase 4 gate |
| [0004](0004-multi-cell-encoding.md) | Placement-based public contract for multi-cell pieces | Accepted with amendments (D3); open owner question on cross-engine generation determinism (Phase 2 scope) |
| [0005](0005-renderer-webgpu-tsl-webgl2-fallback.md) | `WebGPURenderer` + TSL with automatic WebGL2 fallback | Accepted with amendments (D3); D5 waived the physical-WebGPU test for the Phase 0 gate only. Automated Apple M5 Pro run reported 2026-11-25; **the RTX 5070 test is not performed (pending)** |
| [0006](0006-ink-visual-strategy.md) | World-anchored tri-planar hatching, quantized light, haze; shadows deferred | Technical direction accepted (D3); aesthetics only as a look-dev prototype (D1); open owner question on hatching for moving pieces (Phase 5) |
| [0007](0007-component-data-and-system-order.md) | Component data only in Phase 0; Phase 1 systems run on explicit invocation; tick and system order in Phase 4; bonds in ADR 0014 | Accepted with amendments (D3, D4) |
| [0008](0008-assembly-promotion-and-hashing.md) | Assembly catalog promotion and canonical recipe hashing; depth implied by levels; versioned definitions fingerprinted in the world header | Accepted with amendments (D3) |
| [0009](0009-socket-compatibility.md) | One symmetric socket-profile table; tangent alignment inert (Phase 0 record) | Accepted with amendments (D3) as the Phase 0 record; amended by ADR 0012 |
| [0010](0010-runtime-identity-ownership-lineage.md) | Runtime entities with ids `(revision, ordinal)` minted on commit, one ownership field, lineage and conservation | Accepted with amendments (D3, D4); open owner questions Q5, Q9, Q10 |
| [0011](0011-atomic-transactions-and-revisions.md) | Immutable snapshots, patches against a base revision (strict in Phase 1; read-region rebase required in Phase 2), atomic commit and an outcome log for replay | Accepted with amendments (D3, D4) |
| [0012](0012-directional-sockets.md) | Orientation-aware sockets: in-face turn, per-profile symmetry (lcm rule) and side-face hand in one table | Accepted with amendments (D3, D4); the Q5 table placement is an interpretation for the owner to confirm |
| [0013](0013-logical-vs-rendered-geometry.md) | Logical placements, decorative offsets (zero in Phase 1), fragments starting from the logical pose, and a separate backdrop | Accepted with amendments (D3, D4); regular-lattice direction confirmed after the rebuild study (R4) |
| [0014](0014-bond-model.md) | Bond record per bond-eligible socket pair (explicit `bond` rule in the socket table; `empty` never bonds, the `open` wildcard only by explicit rule), created when an entity becomes placed and removed when it leaves; strength is data only until Phase 4 | Accepted with amendments (R3) |
| [0015](0015-wave-solver.md) | Wave solver: placement-based 3D multi-cell WFC, explicit air, MRV integer-only cell choice with weighted seeded placement, steppable with budgets; results verified independently before commit | Accepted with amendments (W4) |
| [0016](0016-region-proposals.md) | Region proposals: content-compared read set (region plus one-cell shell, local constraints only), write set, rebase through `applyProposal` | Accepted with amendments (W4); Phase 3 must extend the read set for nonlocal constraints |
| [0017](0017-hierarchical-generation.md) | Hierarchical district generation: seeded semantic plan with independent global validators, network pieces, per-lot local WFC in a private scratch world, one audited proposal with nonlocal read dependencies; stored recipe numbers on a 1e-9 grid for cross-engine fingerprints | Accepted for Phase 3 (W7); eight choices to confirm at the Phase 3 gate |
| [0018](0018-clock-tick-and-system-order.md) | Fixed 30 Hz clock owned by a session; idle ticks commit nothing; input log for re-simulation; fixed tick order; fail-stop; late worker results hold the cursor, bounded by a recorded stop | **Proposed (draft, not accepted).** Phase 4 not authorized |
| [0019](0019-structural-support-and-bond-failure.md) | `damage` and `broken` state; no bond resurrection; integer support graph on stored bonds with a per-tick failure budget; whole-component detach; structural read set; precise exterior protection | **Proposed (draft, not accepted).** Phase 4 not authorized |

## Pending (not written yet)

These come from the master plan §13 list and need evidence that Phase 0 did not produce.

| Topic | Why pending | Earliest phase |
|---|---|---|
| Tick pipeline, system order and simulation replay semantics | The transaction and revision contract is [ADR 0011](0011-atomic-transactions-and-revisions.md); Phase 1 systems run only on explicit invocation ([ADR 0007](0007-component-data-and-system-order.md) amendment); stepping, idle ticks and system order need the Phase 4 tick ADR; draft [0018](0018-clock-tick-and-system-order.md) is proposed, not accepted | 4 |
| Incremental state hash | The O(world) FNV hash is the dominant commit cost after the W3 work ([ADR 0011](0011-atomic-transactions-and-revisions.md)). An incremental hash is a format change and needs an owner decision and a migration rule | owner decision |
| Generic undo | Deferred (R5). Future undo is a compensating transaction, never history branching ([ADR 0011](0011-atomic-transactions-and-revisions.md)); semantics for `split`, `merge` and `consume` need an owner decision | not scheduled |
| Broken bonds, force and damage | [ADR 0014](0014-bond-model.md) records how a broken bond will differ from contact; the model itself is the Phase 4 ADR; draft [0019](0019-structural-support-and-bond-failure.md) is proposed, not accepted | 4 |
| Closed-loop crease networks | Research gate before the Phase 4 gate ([ADR 0003](0003-crease-representation.md) amendment) | before 4 |
| Local solve and seam ownership | Split by roadmap v1.1 ([master plan §11](../master-plan.md)): the frozen-boundary local solve is Phase 2 scope; seam ownership belongs to the Phase 8 research track. The WFC experiment is 2D, single-chunk and throwaway | 2 (local solve), 8 (seams) |
