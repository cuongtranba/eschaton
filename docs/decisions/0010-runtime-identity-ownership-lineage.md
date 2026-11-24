# ADR 0010: Runtime identity, ownership and lineage

- Status: **Proposed — awaiting owner approval**
- Date: 2026-11-24
- Master plan: §4.1 (stable instance ids), §6.3 (rebirth, finite inventory, no duplicate ownership), §12 (stable identity, lifecycle ownership, material conservation), §11 Phase 1 (roadmap v1.1)
- Related: [ADR 0011](0011-atomic-transactions-and-revisions.md) (the commit that applies these changes), [ADR 0013](0013-logical-vs-rendered-geometry.md) (fragments carry continuous transforms)

## Context

Phase 0 has definitions and recipes but no runtime entities. Everything that looks like identity today is derived from recipe structure.

- **Definitions are immutable data.** `FoldonDefinition` and `AssemblyDefinition` are frozen and JSON-serializable (`packages/foldon/src/definition.ts:54-65`, `assembly.ts:59-67`, `define.ts`).
- **`Placement` is a recipe-space description, not a runtime entity.** It holds `{ id: PlacementId, definitionId, definitionVersion, anchor, rotation }` (`packages/foldon/src/transform.ts:8-13`). The id is only unique inside one recipe (`part-duplicate-id`, `assembly.ts:126-130`) and the constructor is an unchecked cast (`placementId`, `ids.ts:18`).
- **`FlatInstance.path` is the closest thing to an instance id, and it is not stable.** `catalog.flatten` builds `path = `${prefix}/${part.id}`` starting from the recipe id (`registry.ts:277-282`, root prefix at `registry.ts:298`). Two instances of the same assembly flatten to identical paths, so the path cannot tell them apart. Renaming a part in a new recipe version renames every instance. A piece that leaves its assembly has no path at all.
- **No state owns an entity.** The only mutable state is `LabState`, a UI reducer (`apps/studio/src/lab/state.ts:51-62`, `labReducer` at `:130-155`). It has no entity table, no revision and no notion of "who holds this piece".
- **Occupancy is only checked inside one recipe** (`overlapIssues`, `assembly.ts:183-203`). Nothing prevents the same piece from being placed twice in a larger structure, because nothing says which piece it is.
- The reference composition treats leaf placements as shapes to scale and scatter (`apps/studio/src/lab/composition/district.ts:80-110`); it creates no identities.

The plan requires: stable ids, a detached piece that cannot also occupy a static placement, no duplicate fragment ids, reassembly that reuses fragments, and conservation in conservation mode (§6.3, §12). Collapse and Rebirth (Phases 4 and 6) cannot be specified without a runtime entity model, so roadmap v1.1 pulls it into Phase 1.

## Decision drivers

1. One owner per entity at any time; duplicate ownership must be unrepresentable, not merely checked.
2. Ids must be deterministic from the command history, never reused, independent of recipe structure and independent of the order in which a worker happens to finish.
3. Definition data stays immutable and separate from runtime state (`AGENTS.md`, "Definition data is immutable... Runtime state is stored separately").
4. Occupancy and queries are derived from entities, not a second source of truth.
5. Conservation must be exact (integers, no float drift) and checkable at commit time.
6. Plain data and pure functions; no class hierarchy.

## Options considered

### Identity

1. **Recipe path as identity (status quo).** `${assembly}/${part}` strings.
   - Pros: exists, readable, no state.
   - Cons: not unique across instances, breaks on recipe edits, cannot represent split, merge or detach; encodes structure into identity.
2. **Sequential counter held in world state.** Entity id = `e` + next counter value.
   - Pros: simplest; compact; monotonic so never reused.
   - Cons: ids depend on the global count of earlier creations; a worker cannot pre-compute ids for a proposal; a counter is one more mutable value that a rollback must restore.
3. **Hash of `(seed, revision, parent id, counter)`.** The owner's suggested shape.
   - Pros: ids can be computed without reading a counter; parent and seed are visible in the derivation.
   - Cons: a hash can collide (the repo's only hash is FNV-1a 64, `assembly.ts:80-86`, explicitly not collision-resistant per ADR 0008); ids are opaque; the parent is already recorded by lineage.
4. **Structured id `(revision, ordinal)` minted by the world on commit** (proposed).
   - Pros: unique by construction because revisions increase by one per commit (ADR 0011) and ordinals are assigned in a canonical order inside one commit; no counter to restore on rollback (a rejected patch consumes no revision); readable and sortable; gives a total creation order that makes lineage acyclicity checkable.
   - Cons: unique only inside one append-only history (branching a log would reuse revision numbers); workers cannot mint ids and must refer to new entities by proposal-local references.

### Ownership

A. **One `owner` field holding a tagged union** (placed / detached / inventory / consumed) on a single entity table (proposed).
B. **Separate collections** (`placements`, `fragments`, `inventory`) with an entity id appearing in at most one, enforced by a validator.
   - Cons: duplicate ownership is representable, so every transition needs a cross-collection check, and each new collection adds a place to forget.
C. **Fragments as a different entity type** that is converted to a placement entity on attach (new id).
   - Cons: reassembly then loses identity, which defeats "the same fragments create, collapse and reconstruct" (§11.1) and makes conservation counting depend on conversion bookkeeping.

### Conservation unit

- (a) **Entity count**: conserve how many pieces exist. Exact and simple; forbids split and merge in conservation mode.
- (b) **Integer material quantity per `MaterialId`**: every entity carries an integer `quantity`; split divides it, merge sums it. Default quantity is 1, so (a) is the special case with no split or merge. Needs an authored unit only when splitting is used.
- (c) **Material quantity as a float mass** from geometry area. Rejected: floating-point drift breaks an exact conservation equation, and area depends on the pose.

## Proposed decision

**Identity.** Option 4: `EntityId` is minted by the world while committing a patch, from `(revision, ordinal)`. The ordinal order inside a patch is canonical: creations are ordered by `(group, anchor cell, rotation, definition key)`, the same kind of sort the recipe hash already uses (`recipeHash`, `assembly.ts:100-110`), and never by recipe part id. Parent, seed and cause are recorded in lineage, not in the id string. `FlatInstance.path` stays as a recipe-structural path used at instantiation time and is documented as **not identity**.

**Ownership.** Option A. The runtime model is one table of entities, each with one `owner`:

| Owner state | Meaning | Carries |
|---|---|---|
| `placed` | Occupies cells of the logical grid | `pose` (anchor, rotation 0–3) |
| `detached` | A free fragment in the world | continuous `transform` (ADR 0013), optional velocity |
| `inventory` | Held in a finite inventory | `store` id |
| `consumed` | Retired by a split, merge or destruction | `by` revision, `reason` |

`consumed` is terminal; the entity stays as a tombstone so lineage references remain valid. Cell occupancy is **derived** from the `placed` entities and is never stored as a second truth.

**Groups.** An assembly instance is a `GroupId` recorded on each leaf (`entity.group`, one value or none). Group membership is derived from that field; there is no separate member list.

**Lineage.** An append-only list of records: `instantiated`, `detached`, `reattached`, `split`, `merged`, `consumed`. Every edge goes from an entity to an entity with a strictly later `(revision, ordinal)` stamp, so the graph is acyclic by construction and checkable.

**Conservation.** Option (b) with default `quantity = 1`. A world has `conservation: "off" | { mode: "closed", baseline }`, where `baseline` maps each `MaterialId` to the integer total at the commit that switched the mode on. In `closed` mode a patch is valid only if, after applying it, the sum of `quantity` over non-consumed entities equals the baseline for every material. Reassembly moves an existing entity and keeps its id, so it is conservation-neutral.

Entity state lives in a new `@eschaton/world` package that imports `@eschaton/foldon`; definitions stay in foldon (see ADR 0011, owner question 7).

## Invariants

Each is checked by a pure `checkEntityInvariants(state)` at every commit (ADR 0011) and by the tests below.

1. **Single owner.** Every entity has exactly one `owner`; there is no other structure that lists the same entity as placed, detached or in an inventory.
2. **No double occupancy.** For every cell, at most one `placed` entity covers it.
3. **Ids never reused.** An `EntityId` is created once; no later commit mints an equal id, including after the entity is consumed.
4. **Ids are deterministic.** The same initial state and the same patch sequence mint the same ids, independent of recipe part ids and of proposal arrival order.
5. **Stable across ownership change.** `placed → detached → placed` and moves through inventory keep the same id.
6. **Consumed is terminal.** A `consumed` entity never changes owner again.
7. **Lineage is acyclic and forward-only.** Every lineage edge points from a smaller `(revision, ordinal)` to a larger one; every `consumed` entity with reason `split` or `merged` has a lineage record naming its children or result.
8. **Conservation (closed mode).** After every commit, for each material, the sum of `quantity` over non-consumed entities equals the baseline; a patch that creates or destroys quantity outside a quantity-preserving split or merge is rejected.
9. **Definitions are not mutated.** Creating, moving or consuming entities leaves every `FoldonDefinition` and `AssemblyDefinition` deep-equal to its previous value.

## Public API sketch

Illustrative TypeScript: data plus pure functions, no class inheritance. Names are not final.

```ts
type EntityId = Brand<"EntityId">;
type GroupId = Brand<"GroupId">;
type StoreId = Brand<"StoreId">;
type Revision = number; // integer >= 0
type Stamp = Readonly<{ revision: Revision; ordinal: number }>;

type Owner =
  | Readonly<{ kind: "placed"; pose: Pose }>
  | Readonly<{ kind: "detached"; transform: ContinuousTransform }>
  | Readonly<{ kind: "inventory"; store: StoreId }>
  | Readonly<{ kind: "consumed"; by: Revision; reason: "split" | "merged" | "destroyed" }>;

type Entity = Readonly<{
  id: EntityId;
  definition: Readonly<{ id: FoldonId; version: number }>;
  material: MaterialId;
  quantity: number; // integer >= 1
  group: GroupId | null;
  created: Stamp;
  owner: Owner;
}>;

type EntityOp =
  | Readonly<{ op: "instantiate"; source: FlatInstance; group: GroupId | null }>
  | Readonly<{ op: "detach"; entity: EntityId; transform: ContinuousTransform }>
  | Readonly<{ op: "attach"; entity: EntityId; pose: Pose }>
  | Readonly<{ op: "store"; entity: EntityId; store: StoreId }>
  | Readonly<{ op: "split"; entity: EntityId; children: readonly SplitChild[] }>
  | Readonly<{ op: "merge"; entities: readonly EntityId[]; into: MergeResult }>;

type LineageRecord =
  | Readonly<{ kind: "instantiated"; at: Revision; entity: EntityId; source: string }>
  | Readonly<{ kind: "split"; at: Revision; parent: EntityId; children: readonly EntityId[] }>
  | Readonly<{ kind: "merged"; at: Revision; parents: readonly EntityId[]; child: EntityId }>
  | Readonly<{ kind: "detached" | "reattached"; at: Revision; entity: EntityId }>;

type Conservation = "off" | Readonly<{ mode: "closed"; baseline: Readonly<Record<string, number>> }>;

type EntityState = Readonly<{
  entities: ReadonlyMap<EntityId, Entity>;
  lineage: readonly LineageRecord[];
  conservation: Conservation;
}>;

declare function mintEntityId(stamp: Stamp): EntityId;
declare function applyEntityOps(
  state: EntityState,
  ops: readonly EntityOp[],
  revision: Revision,
): Result<EntityState, readonly OwnershipIssue[]>;
declare function cellOccupant(state: EntityState, catalog: Catalog, cell: Cell): EntityId | undefined;
declare function checkEntityInvariants(state: EntityState, catalog: Catalog): readonly OwnershipIssue[];
```

`applyEntityOps` is a pure function that returns a new state or issues; it never mutates. ADR 0011 defines the patch that wraps these ops and the commit that publishes the result.

## Behavioural tests to write in Phase 1

Public seam: the `@eschaton/world` entry point (and `@eschaton/foldon` for catalogs). Real catalogs and seeds, explicit revisions, no mocks, no sleeps.

```ts
test("instantiating the same assembly twice yields two entity sets with disjoint ids")
test("the same seed and patch sequence mint identical entity ids on every run")
test("entity ids do not depend on recipe part ids")
test("an id is never minted again after its entity is consumed")
test("attaching an entity that is already placed is rejected")
test("two entities cannot occupy the same cell")
test("detaching a placed entity frees its cells and keeps its id")
test("reattaching a detached fragment restores a placement under the same id")
test("a consumed entity cannot be revived")
test("splitting an entity records lineage from the parent to every child")
test("lineage stays acyclic after a seeded sequence of random splits and merges")
test("closed conservation rejects a patch that creates an entity")
test("closed conservation accepts a split whose child quantities sum to the parent quantity")
test("closed conservation rejects a merge that loses quantity")
test("entity state survives a JSON round trip with identical ids and owners")
```

## Consequences

- Phase 1 gains a new package, an entity table and a small set of pure entity operations; Collapse and Rebirth become specifiable (what detaches, who owns rubble, what a rebirth may reuse).
- `FlatInstance.path` keeps its role in `catalog.flatten` but must no longer be displayed or stored as an id. The Studio inspector's "stable ID" (master plan §10) will show the `EntityId`.
- Tombstones keep memory growing until snapshots are compacted (see Risks).
- Conservation mode needs integer quantities on entities. Definitions do not carry mass today; Phase 1 sets quantity 1 on instantiation and defers authored units until a split needs them (a definition version bump when it happens, per ADR 0008's versioning discipline).
- The cell-occupancy index becomes a derived structure that must be rebuilt or incrementally maintained; it is a cache, not truth.

## Risks

- **History branching.** Undo or "what if" branches that rewind a revision and then commit again would re-mint ids from earlier revisions. Phase 1 forbids branching (append-only log); a later feature needs a branch id in the stamp.
- **Tombstone growth** in long simulations. Mitigation: compact `consumed` entities that no live lineage record needs, keeping the high-water stamp; the owner decides the retention rule (question 5).
- **Ordinal canon.** If the canonical creation order is under-specified, two correct implementations mint different ids. The sort key must be fixed in the contract and covered by the determinism test.
- **Group semantics are minimal.** A single `group` per leaf does not model assemblies that share a leaf or nested group moves. Nested assemblies flatten to leaves with the outer instance as the group; richer structure waits for a real need.
- **Quantity model under-tested.** Only the all-ones case is exercised until Phase 6.

## Owner approval questions

1. Entity id: approve `(revision, ordinal)` minted by the world on commit with parent and seed kept in lineage (**A**, recommended), or the suggested hash of `(seed, revision, parent id, counter)` (**B**)?
2. Approve a single `owner` union with exactly the four states placed / detached / inventory / consumed? (yes/no)
3. Conservation unit: integer `quantity` per material with default 1 (**a**, recommended), plain entity count with split and merge forbidden in conservation mode (**b**), or defer the choice to Phase 6 (**c**)?
4. Group membership as a single `group` field on each leaf, with no separate member list? (yes/no)
5. Keep `consumed` entities as tombstones until snapshot compaction? (yes/no) If yes, may compaction drop tombstones that no lineage record needs? (yes/no)
6. Document `FlatInstance.path` as recipe-structural only and forbid using it as identity? (yes/no)
7. Is it acceptable that Phase 1 forbids history branching (append-only log)? (yes/no)
