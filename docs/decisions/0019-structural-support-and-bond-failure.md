# ADR 0019: Structural support, bond failure and detach (Phase 4)

- Status: **Proposed — draft for the owner's review. Not accepted. Phase 4 is not authorized.** It becomes binding only by an explicit owner decision at CL0 of [`../plans/phase-4-collapse-proposal.md`](../plans/phase-4-collapse-proposal.md). Where the two differ, the proposal's owner decisions win, and this ADR is amended.
- Date: 2026-11-26. Written against `main` @ `6024a1b`.
- Master plan: §6.2 ("a lightweight support graph … deterministic propagation and an explicit failure budget per tick … not engineering-grade"), §11 Phase 4 row ("damaged pieces detach", "local repair protects exterior", "no duplicate ownership").
- Amends, if accepted: ADR 0014 (invariant 2, broken bonds) and ADR 0016 (read-set content). Related: ADR 0010 (identity, ownership, conservation), 0013 (fragments are layer C), [0018](0018-clock-tick-and-system-order.md) (when these systems run).

## Context

Bonds are stored per bond-eligible socket pair. Today stored bonds equal eligible contacts (ADR 0014 invariant 2). `settleBonds` (`packages/world/src/ops.ts`) re-derives the bonds of every entity a patch **touched**. That includes a `fold` op, because `update` marks the entity for an owner or fold change. Without broken-bond state, the next `windFold` commit on an entity would therefore re-create a bond that had just broken. Nothing carries damage, and nothing reads `strength`. Phase 4 needs:
- bonds that break while the pieces still touch;
- a support rule that decides what falls;
- a guarantee that a re-collapse touches nothing outside its region.

## Recommendations (each needs the owner's decision)

### 1. New world state (one rules bump: `invariants@3`)

- `Entity.damage`: an integer in [0, 1000]. It never decreases in Phase 4, because no repair op exists.
- `WorldState.broken`: a canonically ordered set of `BondKey` = `(a.entity, a.cell, a.face, b.entity, b.cell, b.face)`, the existing bond order. A key names a bond-eligible contact between two placed entities that has **no** stored bond.
- **New ops:**
  - `damage { entity, amount }`, with 0 < amount;
  - `break { bond }`;
  - `settle` (§5).

  All three are validated, recorded and replayed like every other op.
- **Hash encoding** (recommended): `damage` is encoded only when it is non-zero, and `broken` only when it is non-empty. The entity and bond encodings of a Phase 3 world then stay byte-identical.
  - The state hash still changes, because it covers the header, and the header carries `versions.rules` (`canonicalState`, `packages/world/src/world.ts`).
  - A P4-6 migration, if ever wanted, is therefore a header rewrite plus a new hash. It needs no content transformation.

### 2. Bond lifecycle and non-resurrection (amends ADR 0014 invariant 2)

- **Invariant 2 becomes:** every bond-eligible pair between placed entities is **either** stored **or** in `broken`, never both.
- **`settleBonds`** re-derives an entity's bonds from its mated pairs **minus `broken`**. An unrelated commit therefore never re-creates a broken bond. This is the ADR 0014 hazard, and it is the first test.
- **When an entity leaves `placed`** (`detach`, `store`, `consume`), its stored bonds are removed, as today, and its `broken` keys are removed with them. A broken key always refers to two placed entities.
- **The only way back is explicit.** A later `attach` of a detached entity is a new placement and forms fresh bonds. There is no `mend` in Phase 4.
- **New entities have new ids**, so a re-collapse piece placed where a broken partner used to be has a different `BondKey`. Its bond is new, not resurrected.

### 3. Support graph (derived each tick, never stored)

- **Nodes:** placed entities whose definition has a `structural` component.
- **Edges:** stored bonds whose `strength > 0`. Contact without a stored bond carries nothing.
- **Anchors** are data, given by the scenario:
  - nodes with a footprint cell on the ground level;
  - nodes whose definition is in the scenario's `anchors` list (for example `paving`, `bridge`).

  There is no geometric guessing in code.
- **Placed entities without a `structural` component** are outside the graph in Phase 4. They never carry load, and they are not detached by the structural pass. CL3 counts how many exist in the district corpus. If any would float after a collapse, the slice records it as a known limitation or, by owner decision, makes them follow their bonded node.
- **Fold angles are not read.** They never change occupancy (ADR 0003), so they stay outside support and outside the read set.

### 4. Load and failure (integer, order-independent, bounded)

1. **Depth.** Breadth-first search from all anchors at once over edges, in canonical node order. Nodes not reached are unsupported (§5).
2. **Load.** Every reached node carries `1 + the load passed to it`. A node passes its load to its *parents*, the neighbours one level closer to an anchor. The load is split by integer division, and the remainder goes to parents in canonical bond order. The bond to a parent carries the share sent through it.
3. **Capacity.**
   - A bond fails when `load × 1000 > strength × S × (1000 − max(damage of its ends))`.
   - `S` is a scale in the `schedule` (ADR 0018) chosen at CL3, so that an undamaged generated district has no failing bond. That test gates CL3.
4. **Budget.**
   - At most `K` breaks per tick (proposed 8). Bonds are ranked by overload ratio, compared by integer cross-multiplication, then by canonical key.
   - Loads are recomputed on the next tick, not within the tick, so a cascade takes several readable ticks and each tick's cost is bounded.
5. **Scope.** Only connected components that contain an entity damaged or a bond broken since their last evaluation are evaluated. An untouched district costs nothing.

### 5. Detach and fragments

- After the tick's breaks, each component of the support graph with no anchor detaches **whole in the same tick**:
  - one existing `detach` op per entity, in creation-stamp order;
  - each entity keeps its id, its owner becomes `detached`, and its `ContinuousTransform` starts at the logical pose (ADR 0010, 0013);
  - its bonds and `broken` keys are removed.
- Lineage records the detach. ADR 0010 Q10 (group on detach) keeps its provisional rule (P4-8).
- **Fragments occupy no cells** and cannot block placement.
- **Settle.** The rest pose is a closed-form function of `(entity id, scope seed)`, committed when reached. No existing op can move a detached entity: `detach` sets the logical pose, and `retrieve` accepts only stored entities. A new op is therefore added in the same rules bump: `settle { entity, transform }`, valid only for `detached` entities and checked by the existing `transformIssue`. In-between poses are render interpolation only.
- **Split into P09 fragments** (existing `split` op, with lineage) is optional milestone CL4b.

### 6. Read set for re-collapse (amends ADR 0016; owner decision P4-5)

The digest's canonical content gains, for every **read entity** (any placed entity with a cell in the region or its shell):
- its `damage`;
- every stored bond and every `broken` key with at least one end among the read entities, **including boundary-crossing ones** whose other end is outside the shell.

Fold angles are not added (§3). The digest stays a transient concurrency token and is never persisted. This needs **no hash-format change and no version bump of its own**: a job in flight across an upgrade simply conflicts and is re-dispatched (ADR 0018 §4).

Loads are not in the read set. They depend on whole components, which can reach beyond the shell. Safety does not depend on them: the commit re-validates the whole world, and the next tick's structural pass recomputes loads.

### 7. Exterior protection, precisely (replaces proposal invariant 4)

After a committed re-collapse of region `R`:
- every entity with no cell in `R` keeps its id, definition, anchor, rotation, owner, fold angles and damage;
- every stored bond and `broken` key with **both** ends outside `R` is unchanged;
- a bond or key with **one** end inside `R` changes only because the proposal consumed or instantiated that end. Its other, exterior end is otherwise untouched.

Later ticks may still break exterior bonds through the structural pass. Protection is a promise about the commit, not about future simulation.

### 8. Conservation

- `detach` and `split` conserve quantity (ADR 0010), so a collapse without re-collapse is valid in `closed` mode.
- Re-collapse mints new pieces and is refused in `closed` mode (ADR 0016). The slice runs with conservation `off`. In `closed` mode the session schedules no re-collapse and reports why.
- Q9 (conservation key) stays provisional until Phase 6 (P4-8).

## Options not recommended

- **Delete a bond without remembering it:** settling re-creates it on the next unrelated commit.
- **Contact-based support:** it contradicts ADR 0014's distinction between contact and bond.
- **Float stress, or recomputing within the tick until stable:** engine-dependent rounding, and an unbounded tick.
- **A rigid-body engine for fragments:** out of Phase 4 scope (master plan §6.2).

## Test-first cases (public seams; real districts and seeds; no mocks)

- "settling bonds after an unrelated commit does not re-create a broken bond" (the ADR 0014 hazard)
- "a broken key is removed when either end leaves placed"
- "a snapshot from before the broken-bond rules is refused as rules-mismatch"
- "an undamaged generated district breaks no bond over 300 ticks" (gates the choice of `S`)
- "a bond whose carried load exceeds its damaged strength breaks, and an unloaded one does not"
- "no more than K bonds break in one tick; the rest break in later ticks, in canonical order"
- "a component that loses its last anchor detaches whole in the same tick and keeps every entity id"
- "a detached entity owns no cell, has no bond and no broken key"
- "a re-collapse proposal conflicts when a bond in its read shell breaks after the read"
- "a re-collapse leaves every exterior entity, and every bond with both ends outside the region, identical"
- "collapse in closed conservation mode detaches with quantities preserved and schedules no re-collapse"

## Consequences

- One rules bump (`invariants@3`). Every Phase 3 snapshot is refused unless P4-6 (b) is chosen.
- `strength` gets its first reader. Its scale is calibrated once by `S`, so definition data does not change.
- Non-structural pieces are a known Phase 4 limitation, measured at CL3.
