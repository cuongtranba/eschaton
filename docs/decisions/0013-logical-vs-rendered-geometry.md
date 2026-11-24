# ADR 0013: Logical versus rendered geometry

- Status: **Proposed — awaiting owner approval**
- Date: 2026-11-24
- Master plan: §2.2 (sky by a dedicated system, not WFC), §4 ("footprints represent logical occupancy, not visible geometry"; moving fragments are not forced onto the grid), §9 (separate logical cells, render instances, visible triangles), §11 Phase 1 and Phase 3 (roadmap v1.1), §13 ("cubic grid creates a toy-like world")
- Related: [ADR 0002](0002-cubic-grid-and-yaw-rotations.md) (grid and yaw-only rotations; its open risk), [ADR 0010](0010-runtime-identity-ownership-lineage.md) (fragments are entities), [ADR 0011](0011-atomic-transactions-and-revisions.md) (floating-point outcomes are recorded, not recomputed)

## Context

The look that the owner is reviewing at the Phase 0 gate is produced by code that bypasses the logical model.

- **The logical model is a cubic grid with four rotations.** A placement is `{ anchor: Cell, rotation: 0..3 }` (`packages/foldon/src/transform.ts:6-13`, `definition.ts:6`), validated for occupancy and sockets when an assembly is compiled (`assembly.ts:165-211`).
- **The reference composition does not use it.** Each Foldon is placed with `Placement3 = { position, yaw?, pitch?, roll?, scale?: Vec3 }` (`apps/studio/src/lab/composition/affine.ts:4-10`), applied as non-uniform scale, then roll, pitch and yaw (`linear`, `affine.ts:27-36`). Beams are built from two arbitrary end points and a thickness (`beamBasis`, `affine.ts:60-70`).
- **The deviations are large, not decorative.** The hero tower is the `watchtower` assembly (2×2×6 cells plus a roof band) scaled by `[4.4, 7.4, 4.4]` with a random yaw of ±0.15 rad (`district.ts:87`); ruined towers use scales up to 3.8 × 6.4 and yaw ±0.4 (`:91-98`); houses use uniform scale of about 3.35–5.43 and yaw ±0.25 around a corridor normal (`:136`); debris rotates with free yaw, pitch ±0.4 and roll ±0.5 (`:169`), dust with pitch and roll ±1 (`:229`); the tree is 4-level recursive beams at arbitrary directions (`tree`, `:183-203`); the distant skyline is P08 boxes with free width and height at z −196…−184 (`skyline`, `:205-219`).
- **None of it is validated.** The composition consumes `catalog.flatten` leaf placements only as shapes (`LeafPlacement`, `district.ts:5-8`). Occupancy, sockets and bonds are not checked; the footprint and socket overlays would show the unscaled grid cells, not what is drawn. ADR 0002 records the same fact ("not a logical placement and nothing validates sockets for it").
- **Offsets depend on enumeration order.** Each stream draws from one `Random` sequentially (`createRandom(seed, salt)`, `random.ts`; stream table `STREAM` in `referenceScene.ts:15`), so adding or reordering one tower changes every later tower's offset. They are not a function of the object.
- **Sky and ridges are separate procedural panels** (`skyBatch`, `cloudBatch`, `ridgeBatch`, `referenceScene.ts:32-36`). They are already effectively a backdrop, but nothing labels them or keeps them out of queries.
- Phase 3 (Genesis) must produce this look from a validated hierarchical world, and Phase 4 must simulate it. If the look depends on unvalidated affines, Genesis output can never equal what the owner approved.

## Decision drivers

1. One authoritative logical model; everything that affects occupancy, sockets, simulation or identity lives in it.
2. The look must stay reachable: the toy-cube risk (ADR 0002, §13) means pure cell-aligned rendering is not acceptable by itself.
3. Whatever the renderer adds on top must be bounded, deterministic per entity and removable without changing any logical result.
4. Fragments really move; their continuous transforms are authoritative state, not decoration.
5. Backdrop work (sky, ridges, distance) needs freedom but must not be mistaken for the world.
6. Floating-point values must not decide replay (ADR 0011).

## Options considered

1. **Keep the split as is** (status quo): a free-form scene composition outside validation.
   - Pros: fastest route to the reference look; already built.
   - Cons: the approved look cannot be produced by Genesis; nothing is testable; overlays lie about what is drawn; Phase 3 and Phase 4 would have to bridge the gap later.
2. **Render exactly the logical placements** (no offsets, no backdrop beyond the sky).
   - Pros: no divergence; the overlay is the scene.
   - Cons: the toy-cube look; it is the very risk the plan flags. It cannot produce leaning towers, scattered debris or the winding corridor.
3. **Logical placements, plus bounded decorative offsets, plus separate backdrop systems** (**proposed**).
   - Pros: the validated model produces the scene; offsets add hand-made irregularity inside an explicit envelope; fragments and backdrop each have a stated authority.
   - Cons: the envelope may be too small for the look (that is what the experiment measures); more concepts for the renderer.
4. **Store a continuous transform in every authoritative placement** and validate by tolerance.
   - Pros: one transform per object.
   - Cons: occupancy and socket checks become tolerance-based; floating-point values enter the hash and replay; ADR 0011's integer-state determinism scope is lost. Reject.
5. **Move to an irregular lattice** (ADR 0002 option 3).
   - Pros: the model matches the look.
   - Cons: a new solver encoding, neighbour model and footprint semantics; far larger than this decision. It stays a separate study.

## Proposed decision

Option 3. Three layers, one authority each.

### Layer A — logical placements (authoritative)

Entities with `owner.kind === "placed"` (ADR 0010) at integer anchors with rotations 0–3, validated for occupancy, sockets (ADR 0012) and bonds. Occupancy, selection, queries, hashing and simulation read only this layer (and fragments below). A world-wide uniform **cell size** is a render parameter (one number); there is no per-instance non-uniform scale in the model.

### Layer B — decorative offsets (derived, bounded)

A pure function derives a small transform for each placed entity from `(seed, entityId)`, never from enumeration order:

```ts
type Envelope = Readonly<{
  maxTranslation: Vec3;          // per axis, in cells
  maxYaw: number;                // radians
  maxTilt: number;               // radians, pitch and roll
  scale: Readonly<{ min: Vec3; max: Vec3 }>;
}>;
```

- The offset is **not stored** in world state or snapshots and does not enter the state hash; it is recomputed on demand. Removing it changes only the drawing.
- Envelope bounds are data in a scenario or look preset (the §8 "presets" module), keyed by definition id or tag with a default, and are capped by a global hard limit in the engine so a preset cannot exceed it.
- Illustrative values, to be set by the experiment and the owner, not by this ADR: translation ≤ 0.15 cell, yaw ≤ 4°, tilt ≤ 3°, scale within ±8 % per axis. The current scene would need much more (for example a 7.4× vertical stretch); the experiment shows how much of that logical placement and cell size can absorb instead.
- A rendered bound check keeps every vertex of an entity within `margin` of its logical footprint bounds, so neighbouring pieces never visibly separate or interpenetrate beyond a known amount.

### Layer C — dynamic fragments (authoritative, continuous)

Detached fragments are separate runtime entities (`owner.kind === "detached"`, ADR 0010) with a continuous transform (position, orientation, optional velocity), free of the grid and of the envelope. Their initial transform at the moment of detaching equals the rendered transform of the placed entity (pose plus its offset), recorded in the patch, so nothing visibly jumps. Their settled transform is an **authoritative outcome** stored by the commit and not recomputed on replay (ADR 0011). Reassembly is an `attach` with a logical pose; the continuous transform is dropped because the owner field changes (one owner). Debris, rubble, loose beams and dust-like pieces in the current scene (free-angle P09, P02, P06) belong to this layer when they matter to simulation, and to the backdrop when they are only decoration (see C′ below).

### Layer C′ — backdrop systems (non-authoritative, labelled)

Sky disk, clouds, mountain ridges and distant skyline are generated by **separate, non-catalog generators** that return render layers, never entities. Each layer is tagged `authority: "none"` in the view model, is excluded from picking, occupancy, socket overlays, queries and hashes, and is deterministic from `(seed, stream)` through its own streams. The Studio labels them ("Backdrop — not part of the world"). A backdrop generator may reuse Foldon geometry as a shape, but it creates no catalog entry and no id.

### Experiment: rebuild the reference composition from validated placements

A throwaway study to run **at the end of Phase 1** (once placement, occupancy and sockets are validated, before the Phase 2 solver fixes its catalog and cell size), not as part of this documentation task:

1. Hand-author or script a layout of the reference scene as validated placements: towers and houses on grid cells along the corridor, the gate, ground and corridor strips as placed panels, a barren tree from placed beams, loose debris as detached fragments.
2. Apply envelope offsets; draw sky and ridges (and skyline) as backdrop layers, reusing the existing generators as backdrop code.
3. Render the old scene and the rebuilt scene from the same seed and composition camera, with the Studio compare split, and place both screenshots in `docs/screenshots/`.
4. Report counts (logical, fragment and backdrop instances), the largest offset used as a fraction of the envelope, and which parts of the old scene could not be reproduced and why.
5. **The owner compares** against the reference and the old scene and records one of: accept as the Phase 3 baseline; widen the envelope; add or change primitives or cell size; or take up the irregular-lattice study (option 5).

Visual approval is the owner's alone and is not inferred from the counts (master plan §11, visual review at every gate).

## Invariants

1. **Offsets are removable.** With every decorative offset removed, every logical query is unchanged: occupancy, entity ownership, socket validation, selection by id, state hash.
2. **Offsets are bounded.** For any seed and entity id, every component of the derived offset lies inside the envelope for that entity's definition and inside the global hard limit.
3. **Offsets are pure.** The offset for `(seed, entityId)` is identical on every call and does not depend on the other entities or on enumeration order.
4. **Offsets are not state.** A snapshot and a state hash are identical with and without a look preset.
5. **Rendered shape stays near the logical shape.** Every vertex of a placed entity, after its offset, is within `margin` of the logical footprint bounds.
6. **No non-uniform per-instance scale outside the envelope.** The renderer accepts no instance transform that is not (pose × cell size × offset within the envelope), or a fragment transform, or a backdrop layer.
7. **Fragments never occupy cells.** A detached entity contributes nothing to occupancy and has no pose; a placed entity has no continuous transform.
8. **Backdrop is outside the world.** Backdrop layers have no entity id; deleting them changes no state hash and no query; generating them twice from the same seed gives identical layers.
9. **Picking returns logical ids.** Selecting a rendered instance returns an `EntityId` or nothing, never a render-instance index.

## Public API sketch

Illustrative TypeScript; data and pure functions.

```ts
type DecorativeOffset = Readonly<{
  translation: Vec3; // cells
  yaw: number;
  pitch: number;
  roll: number;
  scale: Vec3;
}>;

declare function deriveOffset(seed: number, id: EntityId, envelope: Envelope): DecorativeOffset;
declare function withinEnvelope(offset: DecorativeOffset, envelope: Envelope): boolean;
declare function envelopeFor(preset: LookPreset, definition: FoldonDefinition): Envelope;

type RenderLayer =
  | Readonly<{ authority: "logical"; entity: EntityId; basis: Basis }>   // pose + cell size + offset
  | Readonly<{ authority: "fragment"; entity: EntityId; basis: Basis }>  // continuous transform
  | Readonly<{ authority: "none"; layer: "sky" | "ridge" | "skyline"; panels: readonly Panel[] }>;

declare function buildRenderLayers(
  state: WorldState,
  catalog: Catalog,
  look: Readonly<{ seed: number; preset: LookPreset; cellSize: number; offsets: boolean }>,
): readonly RenderLayer[];

declare function generateBackdrop(seed: number, view: ViewPreset): readonly RenderLayer[]; // authority: "none"
declare function renderedBounds(layer: Extract<RenderLayer, { authority: "logical" }>, catalog: Catalog): Bounds;
```

`buildRenderLayers` with `offsets: false` must return layers that differ only in their transforms. The Studio's `ViewModel` batches would be split by `authority`.

## Behavioural tests to write in Phase 1

Public seam: `@eschaton/world` and `@eschaton/foldon` entry points (and the Studio's Playwright suite for the compare study). No mocks; seeded fixtures.

```ts
test("removing every decorative offset leaves occupancy, ownership and the state hash unchanged")
test("every derived offset stays inside its envelope for a seeded range of entity ids")
test("the offset for a seed and entity id is the same regardless of which other entities exist")
test("a snapshot saved with and without a look preset is identical")
test("no vertex of an offset entity moves further than the margin from its logical footprint")
test("a detached fragment contributes no occupied cell")
test("attaching a fragment drops its continuous transform and gives it a logical pose")
test("a fragment detached from a placed entity starts at that entity's rendered transform")
test("generating the backdrop twice from one seed yields identical layers with no entity ids")
test("removing the backdrop changes no query result and no state hash")
test("picking a rendered instance returns the logical entity id")
```

The rebuild experiment is not a unit test: its acceptance is the owner's recorded verdict.

## Consequences

- The overlay (footprint, sockets) finally describes what is drawn, up to the bounded envelope.
- Genesis can aim at the approved look without a bridging step, if the experiment shows the envelope plus cell size and catalog can reach it. If not, the finding drives a catalog or lattice change early, while it is cheap.
- The Studio's reference composition (`apps/studio/src/lab/composition/`) remains as the old-look baseline for comparison and as backdrop code; its logical-placement parts are eventually replaced by Genesis output.
- A fragment's transform becomes an authoritative output that ADR 0011 records, so animation and physics need a settle step that commits a value.
- The renderer gains an `authority` tag per batch; the metrics stay separate (logical cells, render instances, triangles).

## Risks

- **The envelope may be too tight for the look.** The current scene uses stretches and rotations far beyond any reasonable decoration. The experiment is built to find out; the fallbacks are a wider envelope, new primitives (slabs, long pieces), a different cell size, or an irregular lattice study.
- **Visual drift between old and rebuilt scenes** may be mistaken for a defect when it is the point of the study; the owner judges it.
- **Offsets and fragments can disagree visually** at detach time if the initial transform is not taken from the rendered pose. The test above guards that.
- **Per-entity offsets change when an entity is re-minted** (split children get new ids). That is acceptable for children (new pieces) but visible if a surviving piece were given a new id; ADR 0010 keeps ids stable across ownership changes, which avoids it.
- **Backdrop creep:** if distant architecture grows detailed and interactive, it should become a logical region. The rule is that anything selectable, collapsible or simulated is not backdrop.
- **Performance:** per-entity offset derivation at 10k–100k instances must be cheap or cached; it is a pure function and can be batched in a typed array, but it is unmeasured.

## Owner approval questions

1. Adopt the three-layer model: logical placements, bounded decorative offsets, and separate backdrop systems? (yes/no)
2. Decorative offsets are derived from `(seed, entity id)`, never stored in world state or snapshots? (yes/no)
3. Envelope source: a scenario or look preset with a global engine cap (**A**, recommended), or data on each Foldon definition (**B**)?
4. Choose the envelope bounds now (state the numbers), or leave them to the rebuild experiment (**recommended**)?
5. A single world-wide uniform cell size is a render parameter, and per-instance non-uniform scale is not allowed outside the envelope? (yes/no)
6. Debris, loose beams and rubble that matter to simulation are detached fragment entities with authoritative transforms, and purely decorative scatter is backdrop? (yes/no)
7. Distant skyline buildings are backdrop layers that reuse Foldon shapes (**A**, recommended) or logical entities in a far region (**B**)?
8. Run the rebuild experiment at the end of Phase 1 (**recommended**) or at the start of Phase 3?
