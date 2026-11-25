# ADR 0016: Region proposals — read-set validation and rebase

- Status: **Accepted for Phase 2** under owner decision R7 (2026-11-25). It implements the Phase 2 requirement recorded in ADR 0011 (read-set rebase) and master plan §11 (roadmap v1.1, amendment 1).
- Date: 2026-11-25
- Related: ADR 0010 (identity), 0011 (atomic commit, strict base revision), 0015 (solver).

## Context

`applyPatch` rejects any patch whose base revision is not the current one. A solve takes time; any commit elsewhere in the meantime would make its result stale, although nothing it relied on changed. Phase 2 must let such a result commit, and must still reject it when something it relied on did change.

## Decision

### Region, read set, write set

- **Region:** an inclusive box of cells.
- **Read set:** the region plus a one-cell shell around it. It consists of:
  - every placed entity with at least one cell in that volume: its id, definition, anchor and rotation;
  - which cells of the volume are empty (implied by the above);
  - the conservation mode;
  - the catalog fingerprint and rules version.
- **Write set:** the region. A proposal may only `instantiate` items whose cells all lie inside the region, and may only `consume` entities whose cells all lie inside the region.

### API (`@eschaton/world`)

```ts
type Region = Readonly<{ min: Cell; max: Cell }>;
type RegionRead = Readonly<{ region: Region; revision: Revision; digest: string; entities: readonly RegionEntity[]; closed: boolean }>;
type Proposal = Readonly<{ region: Region; read: Readonly<{ revision: Revision; digest: string }>; ops: readonly WorldOp[]; origin: Origin }>;
readRegion(catalog, state, region): RegionRead
applyProposal(catalog, state, proposal): Result<Committed, ProposalRejection>
```

`applyProposal`:
1. refuses a catalog or rules mismatch (as `applyPatch` does);
2. refuses ops outside the write set (`write-outside-region`);
3. recomputes the read digest on the **current** state and refuses a difference (`conflict`);
4. otherwise rebases: it applies the ops as one patch at the current revision through `applyPatch`, which runs every invariant on the whole world.

A proposal is inert data. Creating, queuing or dropping it changes nothing. `applyPatch` keeps strict base-revision equality; only `applyProposal` rebases.

### What invalidates a proposal

| Intervening change | Result |
|---|---|
| A commit that touches nothing in the region or its shell | **Commits** (rebased) |
| An entity placed, removed, moved or replaced in the region or shell | `conflict` |
| Conservation mode changed | `conflict` |
| Catalog or rules changed | `catalog-mismatch` / `rules-mismatch` |
| Fold angles or bonds of entities in the read set | Not part of the read set: occupancy and sockets do not depend on them |

### ABA and version semantics

The read set is compared **by content, not by revision**. If the region changes and changes back to the same entities at the same poses (A → B → A), the proposal is valid again and commits: everything the solver relied on is true at commit time. Entity ids are content, so removing a piece and putting an identical new piece in its place is a change (the id differs). The digest is FNV-1a 64 over canonical JSON, a divergence detector, not an integrity boundary. Safety never depends on the digest: step 4 re-validates the whole world.

### Identity and conservation

- Entities outside the write set are never named by a proposal, so they keep their ids and state.
- Placed entities inside the region are **pins** unless the request lists them for clearing. Pins keep their ids.
- **Generation mints entities**, so it is refused when conservation is closed, before any solving. Rebuilding from finite inventory with a search is deferred to Phase 6.
- Cleared entities are `consume`d (reason `destroyed`). Clearing is likewise refused in closed mode.

## Consequences

- Phase 4 local re-solves can commit while ticks commit elsewhere.
- The read set is geometric. A constraint that reaches further than one cell (for example connectivity) needs a larger read set; Phase 3 must extend it when it adds such constraints.
- Computing the digest scans the entity table once per proposal, the same order of cost as a commit.

## Implementation (Phase 2)

- **World:** `packages/world/src/region.ts` (`readRegion`, `applyProposal`, `cellInRegion`). Tests: `packages/world/test/region.test.ts` (10), including the shell rule (mutation-checked), the A → B → A case and replay of a rebased commit.
- **Glue:** `packages/wave/src/region.ts` (`prepareRegion`, `proposalOf`). Tests: `packages/wave/test/region.test.ts` (8).
- **Proposal ops** are `annotate` (an audit note with the region and solve seed), `consume` for cleared entities and `instantiate` for placements. Anything else is refused.
- **Solve seed** is derived from the world seed, the request seed and the region, not from the revision, so a rebased result is the same result.
- **Cost:** see the transaction profile in [`../phase-2-exit.md`](../phase-2-exit.md). `readRegion` and `applyProposal` scan the entity table once each; the commit itself is still O(world) (ADR 0011).
