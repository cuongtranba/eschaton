# ADR 0017: Hierarchical district generation (Genesis)

- Status: **Accepted for Phase 3** under owner decision W7 (2026-11-25), which authorizes the Phase 3 design within its stated scope. Choices that go beyond the master plan's wording are listed under "Choices to confirm at the Phase 3 gate".
- Date: 2026-11-25
- Master plan: §5.3, §11 Phase 3. Builds on ADR 0013, 0015, 0016.

## Context

Phase 2 fills a box with compatible Foldons. It has no notion of a road, a river or a house, so its output is valid and meaningless. Phase 3 must produce a district: connected roads, a river and boundaries that hold as contracts, lots with roles, and recognisable structures, from a seed, as one atomic change to the world.

## Decision

### Layers and who enforces what

| Layer | Decides | Enforced by |
|---|---|---|
| Request | Preset, seed, district box, boundary contract (road gates, river inlet and outlet) | Request validation |
| Semantic plan (2D) | River course, road network, plaza, lots and their roles | The planner, then **independent validators**: river continuous between its terminals; every gate connected to the plaza through road, bridge or plaza cells; built lots have road frontage; nothing overlaps |
| Network pieces | One ground Foldon per road, plaza, water and bridge cell | Derived mechanically from the plan |
| Structures | Which Foldons fill each lot | The wave solver, per lot, with the role's tile set, around frozen neighbours |
| World | Occupancy, legal adjacency, bonds, identity | `applyProposal` and the world invariants |

The solver handles local compatibility only. Connectivity and boundaries are graph problems solved and checked by separate code. A failure at any layer is an explicit result with a stage and a reason.

### Determinism and seeds

- Everything is integer arithmetic over seeded streams, as in ADR 0015.
- **Scoped sub-seeds:** `seed(scope) = hash(world seed, district seed, preset id, scope name, attempt)`. Scopes are named (`river`, `roads`, `lots`, `lot:<id>`), so adding or reordering one stage does not change the others.
- Retries are bounded and explicit: a new attempt is a new scope value, recorded in the diagnostics.

### One atomic change, no second world

- The generator works on a **scratch state**: an immutable value of the ordinary world type, advanced with the ordinary `applyProposal`, never published. Each lot is solved against it, so it sees the network pieces and earlier lots as frozen neighbours.
- The result is **one proposal** for the whole district box, read against the real state the job started from. The world applies it once or rejects it. Intermediate scratch states, previews and the plan are not world state.
- The plan is kept beside the result for inspection (semantic layers, routes, diagnostics). It is derived data: the world does not store it.

### Nonlocal read dependencies (ADR 0016 amendment)

- `Proposal.depends` lists further regions with the digest each had when the job started. `applyProposal` compares them like the main read set.
- A district that **continues a neighbour's network** depends on more than its one-cell shell: its claim "this gate leads somewhere" rests on the neighbour's road. It declares the cells of the connected road it attaches to (bounded in length) as dependencies. A change to that road conflicts; an unrelated change in the neighbour does not.

### Results are audited independently

`settleDistrict` is the only way a district reaches the world. It applies the proposal to get a **candidate** state (a value, not yet adopted) and audits it from scratch against the plan: every road, plaza, bridge and water cell holds the right ground piece; no structure stands on the network; every structure lies in its lot; no piece that needs support stands on air; roads in the candidate world are connected to every gate. Only a clean candidate is adopted.

### Pieces

- New ground Foldons are flat presets built with the shared net helpers: `paving`, `water`, `bridge`. They are single cells, not building meshes.
- Structures reuse the catalog and the Phase 2 presets. The regular lattice is unchanged.

## Choices to confirm at the Phase 3 gate

1. **Terrain is land and water only.** No elevation. The ground plane stays a request parameter (ADR 0015 amendment).
2. **Roles and their tile sets are preset data** (`tower`, `house`, `ruin`, `garden`), chosen by distance to the plaza and road frontage with seeded variation.
3. **Lots are solved in a fixed order against earlier lots**, not jointly. A later lot adapts to an earlier one, never the reverse.
4. **The semantic plan is not stored in the world.** A reloaded world has its entities but not its plan.

## Consequences

- Hierarchical backtracking (revising the plan when a lot cannot be filled) is not implemented. A lot that stays empty is reported.
- Multi-district worlds need a persistent semantic layer and seam ownership; that is beyond this phase.
