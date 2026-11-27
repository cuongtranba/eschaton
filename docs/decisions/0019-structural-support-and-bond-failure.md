# ADR 0019: Structural support, bond failure and detach (Phase 4)

- Status: **Proposed — draft for the owner's review. Not accepted. Phase 4 is not authorized.** It becomes binding only by an explicit owner decision at CL0 of [`../plans/phase-4-collapse-proposal.md`](../plans/phase-4-collapse-proposal.md). Where the two differ, the proposal's owner decisions win, and this ADR is amended.
- Date: 2026-11-26, written against `main` @ `6024a1b`. **Revised 2026-11-27** after a design review against `main` @ `03760d2`, which the owner asked for. The revision repairs the draft; it does not accept it. What changed and why is listed in "Review of 2026-11-27" at the end.
- Master plan: §6.2 ("a lightweight support graph … deterministic propagation and an explicit failure budget per tick … not engineering-grade"), §11 Phase 4 row ("damaged pieces detach", "local repair protects exterior", "no duplicate ownership").
- Amends, if accepted: ADR 0014 (invariant 2, broken bonds) and ADR 0016 (read-set content). Related: ADR 0010 (identity, ownership, conservation), 0013 (fragments are layer C), [0018](0018-clock-tick-and-system-order.md) (when these systems run), and the geometry quality gates ([`../governance/geometry-quality-gates.md`](../governance/geometry-quality-gates.md), GEO-7; see §9).

## Context

Facts in the code (`main` @ `03760d2`):
- A bond is stored per bond-eligible socket pair: `Bond = { a, b, strength }`, each end `{ entity, cell, face }` (`packages/world/src/state.ts`). Today stored bonds equal eligible contacts (ADR 0014 invariant 2).
- A commit removes and re-derives every bond of every entity a patch **touched**. It does that on two paths: the default incremental `settleTouched` (`packages/world/src/delta.ts`), and `settleBonds` (`packages/world/src/ops.ts`) as the fallback and full audit; `checkInvariants` then compares stored bonds with derived ones. That includes a `fold` op, because `update` marks the entity for an owner or fold change. Without broken-bond state, the next `windFold` commit on an entity would therefore re-create a bond that had just broken.
- A bond's `strength` is the **minimum of its two ends' `structural.strength`**, and 0 when either end has no `structural` component (`bondsFromContacts`, `packages/world/src/model.ts`). Definition strengths are **floats**, validated only as finite and ≥ 0 (`packages/foldon/src/validate.ts`). The catalog uses 0.3–1 (`packages/foldon/src/catalog.ts`).
- Pieces without a `structural` component are placed in generated districts: `P09` in the ruin and garden tile sets, and `leaf` in gardens (`packages/genesis/src/presets.ts`). The ground pieces `paving`, `water` and `bridge` have no `structural` component, and their top face is `empty`, so nothing ever bonds on top of them (`packages/foldon/src/presets.ts`, `groundPiece`).
- The ground level is a request parameter `ground: { y, profile }` (`packages/wave/src/region.ts`), not world state.
- The region digest covers only placed entities: their id, definition, anchor and rotation (`readRegion`, `packages/world/src/region.ts`). A neighbour that detaches therefore already changes the digest.
- Nothing carries damage, and no behaviour reads `strength`. The invariant audit only checks that a stored bond's strength equals the derived one (`packages/world/src/invariants.ts`).

Phase 4 needs:
- bonds that break while the pieces still touch;
- a support rule that decides what falls;
- a guarantee that a re-collapse touches nothing outside its region.

## Recommendations (each needs the owner's decision)

### 1. New world state (a rules bump: `invariants@3`, shared with ADR 0018's if they ship together)

- `Entity.damage`: an integer in [0, 1000]. It never decreases in Phase 4, because no repair op exists.
- `WorldState.broken`: a canonically ordered set of `BondKey` = `(a.entity, a.cell, a.face, b.entity, b.cell, b.face)`, the existing bond order. A key names a bond-eligible contact between two placed entities that has **no** stored bond.
- **New ops**, validated, recorded and replayed like every other op:
  - `damage { entity, amount }`, for a **placed** entity, with an integer `0 < amount` and `damage + amount ≤ 1000`. An op that would pass 1000 is **rejected**, which under ADR 0018 §5 fails the session. The decay system therefore emits `min(a, 1000 − damage)` and emits nothing once an entity is at 1000 or when `a` is 0. Here `a = floor(rate × max(0, 1000 − r) / 1000)`: `rate` is the zone's integer rate per tick, and `r = Math.round(resistance × 1000)` converts the definition's float `decayable.resistance` exactly, as for strength (§4). Validation allows any finite resistance ≥ 0 (`validate.ts`), so the clamp makes a resistance of 1 or more mean immune, never a negative amount. Decay damages only entities with a `decayable` component;
  - `break { bond }`, valid only for a stored bond. It removes the bond and adds its key to `broken`;
  - `settle` (§5).
- **Hash encoding** (recommended): `damage` is encoded only when it is non-zero, and `broken` only when it is non-empty. The entity and bond encodings of a Phase 3 world then stay byte-identical.
  - The state hash still changes, because it covers the header, and the header carries `versions.rules` (`canonicalState`, `packages/world/src/world.ts`).
  - A P4-6 migration, if ever wanted, is therefore a header rewrite plus a new hash. It needs no content transformation.

### 2. Bond lifecycle and non-resurrection (amends ADR 0014 invariant 2)

- **Invariant 2 becomes:** every bond-eligible pair between placed entities is **either** stored **or** in `broken`, never both, and every key in `broken` is such a pair.
- **Both bond-settling paths** (`settleTouched` and `settleBonds`) re-derive an entity's bonds from its mated pairs **minus `broken`**, and `checkInvariants` derives the expected bonds the same way. An unrelated commit therefore never re-creates a broken bond, on either path. This is the ADR 0014 hazard, and it is the first test, run on both audit modes (`audit: "incremental"` and `"full"`).
- **When an entity leaves `placed`** (`detach`, `store`, `consume`; `split` and `merge` take only detached or stored entities, `ops.ts`), its stored bonds are removed, as today, and its `broken` keys are removed with them. A broken key always refers to two placed entities.
- **A key stays valid while both ends are placed.** No op moves a placed entity: a pose changes only by leaving `placed` and coming back through `attach` (`retrieve` yields a detached entity, not a placement). A key's cells and faces therefore cannot go stale. If a later phase adds an op that moves a placed entity, it must remove that entity's keys too.
- **The only way back is explicit.** A later `attach` is a new placement and forms fresh bonds. There is no `mend` in Phase 4, and no Phase 4 system emits `attach`. Ids are kept across detach and re-attach (ADR 0010), which is what GEO-7.8 asks of identity.
- **New entities have new ids**, so a re-collapse piece placed where a broken partner used to be has a different `BondKey`. Its bond is new, not resurrected.

### 3. Support graph (derived each tick, never stored)

- **Nodes:** placed entities whose definition has a `structural` component.
- **Edges:** stored bonds whose integer strength `s` (§4.3) is positive. Given how bonds are derived, that means a bond between two structural nodes. A float strength below 0.0005 converts to `s = 0` and is not an edge; otherwise it would have capacity 0 and fail under any load, whatever `S` is. Contact without a stored bond carries nothing.
- **Anchors** are data, given by the scenario:
  - structural nodes with a footprint cell on the scenario's ground level (`ground.y`);
  - structural entities the scenario pins by id.

  There is no geometric guessing in code. An anchor fails only through its bonds: a fully damaged anchor stays placed, as the stump of a ruin. Ground pieces cannot be anchors: they are not structural, and nothing bonds on top of them. (The earlier draft named `paving` and `bridge` as anchors; that could never have taken effect.)
- **Non-structural placed entities** are never load-bearing and never anchors. They follow what they are bonded to (§5). Whether to keep that rule, or to record floating non-structural pieces as a known limitation, is an **owner decision** (P4-11). CL3 counts them in the district corpus either way.
- **Fold angles are not read.** They never change occupancy (ADR 0003), so they stay outside support and outside the read set.
- **Every structural node of an undamaged generated district must be anchored at the first evaluation.** A node that rests on another only by contact, with no eligible socket pair between them, is unsupported and would detach on the first tick with no damage at all. The scale `S` cannot fix that. CL3 therefore tests it on the 12-seed corpus before anything else. If it fails, the fix belongs to the socket table or the tile sets (ADR 0012, 0014, 0017), which needs an owner decision, not a change of the support rule.

### 4. Load and failure (integer, order-independent, bounded)

1. **Depth.** Breadth-first search from all anchors at once over edges, in canonical node order (creation stamp). Nodes not reached are unsupported (§5).
2. **Load.** Every reached node carries `1 + the shares passed to it`. A node passes its load to its *parents*, the neighbours one level closer to an anchor. The load is split by integer division, and the remainder goes to parents in canonical bond order. The bond to a parent carries the share sent through it. A bond between two nodes at the same depth carries nothing and never fails.
3. **Integer capacity.**
   - `strength` is a float in the catalog. It is converted once per bond to an integer: `s = Math.round(strength × 1000)`. `×` is correctly rounded and `Math.round` is exact, so `s` is the same on every engine.
   - `capacity = s × S × (1000 − max(damage of its ends))`, where `S` is a positive integer in the `schedule` (ADR 0018), chosen at CL3 so that an undamaged generated district has no failing bond. That test gates CL3.
   - A bond **fails** when `load × 1000 > capacity`. A fully damaged end gives a capacity of 0, so any bond carrying load fails, and an unloaded one does not.
   - **Numeric safety.** Loads are bounded by the node count (about 10⁴ for six districts), so `load × 1000` is about 10⁷. Catalog validation bounds `strength` only as finite and ≥ 0 (`validate.ts`), so `s` is unbounded. With the catalog's `s ≤ 1000`, a capacity reaches `1000 × S × 1000`, and the ranking's cross product passes 2⁵³ for `S` above about 900. **The capacity product, the failure test and the ranking are therefore computed in `BigInt`**, from integer-valued inputs (`BigInt(s)` is exact for any integral double). That is exact on every engine for any catalog, needs no bound and has no failure path. The cost is a few thousand `BigInt` operations per evaluated tick, measured at CL3. When the schedule is created it checks that `S` is a positive safe integer and that every structural strength in the catalog gives a finite `s` (a strength above about 1.8 × 10³⁰⁵ overflows `× 1000`). A failed check refuses the schedule before any session starts.
4. **Budget.**
   - At most `K` breaks per tick (proposed 8).
   - Failing bonds are ranked by overload `load × 1000 / capacity`, highest first. Bonds with capacity 0 rank above every other, ordered by load, highest first. The others are compared by cross-multiplication. Ties are broken by canonical key. There is no seeded choice.
   - Loads are recomputed on the next tick, not within the tick, so a cascade takes several readable ticks and each tick's cost is bounded.
5. **Scope.** The pass evaluates the whole support graph. It is skipped only when its input is the same as at its last evaluation: the same world revision, no op drafted earlier in this tick, and the same anchors and `schedule`. That skip cannot change an outcome, because the pass is a pure function of that input.
   - Per-component evaluation (only components with a damaged entity or a broken bond) is **not** recommended. It misses components that gain a node (a re-collapse piece adds load), a split component, an attach, and an anchor change.
   - It may come back as an optimization only if CL3 measures the whole-graph pass as too slow, and then only with a test that it gives the same breaks as the whole graph.

### 5. Detach and fragments

- After the tick's breaks, detaching runs in two steps, both in the same tick:
  1. **Structural:** each component of the support graph with no anchor detaches whole.
  2. **Non-structural (P4-11, recommended):** a breadth-first search over **all** stored bonds, of any strength, starts from every structural node still placed and every entity with a footprint cell on the ground level. A non-structural placed entity that it does not reach detaches. A non-structural piece never connects two structural components for support, because step 1 ignores it.
- Each detach is one existing `detach` op per entity, in creation-stamp order. The entity keeps its id, its owner becomes `detached`, and its `ContinuousTransform` starts at the logical pose (ADR 0010, 0013). Its bonds and `broken` keys are removed.
- Lineage records the detach. ADR 0010 Q10 (group on detach) keeps its provisional rule (P4-8).
- **Fragments occupy no cells** and cannot block placement.
- **Settle.** The rest pose and the fall duration are closed-form functions of `(entity id, scope seed, start pose)`. A fragment detached at tick `d` settles at `d + fall ticks`. The session tracks falling fragments (ADR 0018 §2), because once another commit lands, the detach tick can no longer be read from the world. No existing op can move a detached entity: `detach` sets the logical pose, and `retrieve` accepts only stored entities. A new op is therefore added in the same rules bump: `settle { entity, transform }`, valid only for `detached` entities and checked by the existing `transformIssue`. In-between poses are render interpolation only.
- **Split into P09 fragments** (existing `split` op, with lineage) is optional milestone CL4b.

### 6. Read set for re-collapse (amends ADR 0016; owner decision P4-5)

- **What the digest gains.** For every **read entity** (any placed entity with a cell in the region or its shell), the digest's canonical content gains every stored bond and every `broken` key with at least one end among the read entities. That **includes boundary-crossing ones** whose other end is outside the shell.
- **What it does not gain:**
  - **Damage.** Decay raises damage on every tick while a zone is active, so a damage digest would make every re-collapse near a decay zone conflict until it is abandoned. Damage does not affect whether the proposal is valid. It affects only future support, which the next tick's structural pass reads from the committed state. (The earlier draft added damage.)
  - **Fold angles** (§3).
  - **Loads.** They depend on whole components, which can reach beyond the shell. Safety does not depend on them: the commit re-validates the whole world, and the next tick's structural pass recomputes loads.
- **What the current digest already covers.** A read entity that detaches leaves the read set, which already changes the digest, because the digest covers only placed entities.
- **No version of its own.** The digest stays a transient concurrency token and is never persisted, so this needs no hash-format change and no version bump of its own. A rules upgrade cannot happen inside one session. A result computed under older `versions.rules` is refused by the version check before the digest is compared (`region.ts`), so it is `invalid` and abandoned (ADR 0018 §4 step 3).
- **Anchoring check on settlement.** Before a re-collapse result commits, the session drafts it and runs the anchoring part of the structural pass on the draft. If any entity the proposal instantiates would be unsupported (§3) or, under P4-11, unreached (§5), the result is abandoned with a diagnostic. The check is deterministic and costs one breadth-first search on the draft. It covers anchoring at commit time only. It reads no load, and it runs before the tick's systems, so a new piece can still fall in the same tick or later, when a bond it depends on breaks.
- **Loop bound.** A re-collapse whose instantiated pieces detach within `L` ticks of its commit marks its region **exhausted**. No later job is dispatched for a dirty region that overlaps an exhausted region; the ruin stays, and a diagnostic is published. Together with the anchoring check, this bounds re-collapse to one further attempt per region after a failed one. The exhausted set is session state, reproduced by re-simulation.
- **When a job is dispatched (P4-12, recommended).** A dirty region's job is dispatched at the first tick after its detach in which the structural pass breaks nothing and detaches nothing anywhere. Its region covers every cell vacated since the cascade began, merged as in proposal §2.7. A job dispatched during a cascade would read a shell that the cascade keeps changing, and it would conflict until it is abandoned after two retries. This rule is deterministic, because it depends only on committed outcomes.
  - The trade-off: the quiet condition is global, so an unrelated cascade, or a decay zone that keeps breaking bonds, delays every dispatch. That is acceptable for a one-district slice. A per-component quiet condition is the alternative, if CL5 shows the delay matters.

### 7. Exterior protection, precisely (replaces proposal invariant 4)

After a committed re-collapse of region `R`:
- **Entities.** Every entity the proposal does **not consume** keeps its id, definition, owner (anchor and rotation, or transform), fold angles and damage. That includes detached fragments, and entities with some cells in `R`, which a proposal cannot consume (ADR 0016).
- **Bonds.** Every stored bond and every `broken` key with **neither** end consumed by the proposal is unchanged. The only bond changes are:
  - removal of those with a consumed end;
  - addition of those with an instantiated end.
- This follows from the write set: a proposal may only `instantiate`, `consume` and `annotate` (`writeIssue`, `packages/world/src/region.ts`). It is still tested, because it is a promise of the slice.
- Protection is a promise about the re-collapse commit, not about what follows. The system patch of the **same tick** is a separate commit (ADR 0018 §5), and its structural pass may already break exterior bonds under the new pieces' load. Later ticks may too.

### 8. Conservation

- `detach` and `split` conserve quantity (ADR 0010), so a collapse without re-collapse is valid in `closed` mode.
- Re-collapse mints new pieces and is refused in `closed` mode (ADR 0016). The slice runs with conservation `off`. In `closed` mode the session schedules no re-collapse and reports why.
- Q9 (conservation key) stays provisional until Phase 6 (P4-8).

### 9. Dependency on the geometry track (GEO-7; open questions Q1–Q6)

- **This ADR assumes the bond model of ADR 0012 and 0014.** The only authoritative attachment between two entities is a stored bond on a bond-eligible socket pair of the cubic grid. Load travels only through such bonds.
- **The geometry quality gates** (adopted 2026-11-27 as rules only) require "connection contracts" between modules: declared ports with typed compatibility (GEO-7.2). The contract itself, and the open questions Q1–Q6 (non-axis seams, a `join` edge kind, parameterised families in Foldon, closed crease networks, object grammar in Genesis, catalog versioning), remain owner decisions. Two consequences follow:
  - A join **inside one Foldon definition** (modules of one object composed into one definition) is geometry, not a world bond. Phase 4 never breaks it, and the whole definition fails or falls as one entity.
  - A geometry-track connection meant to **carry load between entities** must be expressed as a bond-eligible socket pair in the socket table. Otherwise this ADR must be amended before it can rely on it. Contact without a bond still carries nothing.
- **A catalog change moves `S`.** The CL3 calibration of `S` and the anchoring test of §3 hold for the catalog fingerprint they were measured on. A new or richer module catalog (Q3, Q6) needs both repeated.
- **Not blocking this draft, but blocking CL3** if the owner adopts a new module catalog or connection contract before Phase 4 runs. This is listed for the owner (§10).

### 10. Decisions this ADR asks for

- Acceptance of §1–§9 as a whole, at CL0.
- The owner decisions it depends on are listed, with options and defaults, only in the proposal §7: P4-5 (read set), P4-6 (older snapshots), P4-11 (non-structural pieces) and P4-12 (dispatch).
- No decision on GEO-7 or Q1–Q6 is needed to accept this draft. A decision there that changes the catalog or the bond contract re-opens §3 and §9 before CL3.

## Options not recommended

- **Delete a bond without remembering it:** settling re-creates it on the next unrelated commit.
- **Contact-based support:** it contradicts ADR 0014's distinction between contact and bond.
- **Float stress, or recomputing within the tick until stable:** engine-dependent rounding, and an unbounded tick.
- **Comparing overloads in plain `number` arithmetic:** exact only below 2⁵³, which realistic `S` values pass.
- **Damage in the read set:** it starves re-collapse inside decay zones (§6).
- **Per-component dirty tracking as the default:** it misses components that change without damage or a break (§4).
- **A rigid-body engine for fragments:** out of Phase 4 scope (master plan §6.2).

## Test-first cases (public seams; real districts and seeds; no mocks)

- "settling bonds after an unrelated commit does not re-create a broken bond, on the incremental and the full audit path" (the ADR 0014 hazard)
- "a broken key is removed when either end leaves placed"
- "a snapshot from before the broken-bond rules is refused as rules-mismatch"
- "a damage op that would raise damage above 1000 is refused, and decay stops emitting at 1000"
- "every structural entity of an undamaged generated district is anchored at the first evaluation" (12-seed corpus; gates CL3 before `S`)
- "an undamaged generated district breaks no bond over 300 ticks" (gates the choice of `S`)
- "a bond whose carried load exceeds its damaged strength breaks, and an unloaded one does not"
- "a bond with a fully damaged end breaks when it carries load and ranks above every bond with capacity"
- "overload ranking is exact for loads and capacities whose cross product exceeds 2^53"
- "no more than K bonds break in one tick; the rest break in later ticks, in canonical order"
- "a re-collapse piece bonded to a damaged component is included in that component's next evaluation" (the per-component counterexample)
- "a component that loses its last anchor detaches whole in the same tick and keeps every entity id"
- "a non-structural piece bonded only to a detached component detaches in the same tick, and one bonded to an anchored node stays" (if P4-11 is decided as recommended)
- "a detached entity owns no cell, has no bond and no broken key"
- "a re-collapse proposal conflicts when a bond in its read shell breaks after the read"
- "a re-collapse inside an active decay zone settles without a conflict" (damage is not in the digest)
- "a re-collapse result that would leave an instantiated piece unanchored is abandoned with a diagnostic"
- "a re-collapse whose pieces detach within L ticks marks its region exhausted, and no later job is dispatched over it"
- "a bond whose float strength converts to zero is not an edge"
- "a re-collapse is dispatched only at the first tick in which the structural pass breaks and detaches nothing"
- "a re-collapse leaves every entity it does not consume, and every bond with neither end consumed, identical"
- "collapse in closed conservation mode detaches with quantities preserved and schedules no re-collapse"

## Consequences

- A rules bump (`invariants@3`, shared with ADR 0018's if they ship together) and a snapshot schema bump for the new fields (`SNAPSHOT_SCHEMA`, `packages/world/src/state.ts`). Every Phase 3 snapshot is refused unless P4-6 (b) is chosen.
- `strength` gets its first reader, through an integer conversion. Its scale is calibrated once by `S`, so definition data does not change.
- Non-structural pieces either follow their bonds (P4-11) or are a known Phase 4 limitation, measured at CL3.
- The support rule depends on the bond contract of ADR 0012 and 0014. A geometry-track change to that contract re-opens this ADR (§9).

## Review of 2026-11-27 (what changed in this draft, and why)

The owner asked for the draft's design issues to be reviewed and repaired. That request is not an acceptance; every recommendation above still needs the owner's decision.

| Issue in the 2026-11-26 draft | Repair |
|---|---|
| "Integer" capacity used `strength`, which is a float in the catalog | §4.3: one exact conversion to milli-units |
| Cross-multiplied overloads can pass 2⁵³ | §4.3: `BigInt` comparisons |
| Capacity 0 (fully damaged end) had no defined ranking | §4.3–4.4: it fails under any load and ranks first |
| A damage op past 1000 was undefined, and would have failed the session at the cap | §1: refused; decay clamps and stops at 1000 |
| Anchors named `paving` and `bridge`, which are not structural and bond nothing on top | §3: structural nodes at the ground level and pinned structural entities |
| Per-component dirty tracking missed new nodes, splits, attaches and anchor changes | §4.5: the whole graph, skipped only when the input is unchanged |
| Non-structural pieces (`P09`, `leaf` in districts) could float after a collapse | §5 step 2 and P4-11 |
| Contact-only stacking would detach undamaged pieces on the first tick | §3: an anchoring test on the corpus before `S` |
| Damage in the read set would starve re-collapse in decay zones | §6: bonds and broken keys only; dispatch after the cascade (P4-12) |
| Exterior protection was stated by "no cell in R", which leaves out entities partly in R and detached fragments | §7: stated by what the proposal consumes and instantiates |
| The dependency on the geometry track's connection contracts was not stated | §9 |
| Only `settleBonds` was named; the default commit path is `settleTouched`, and `checkInvariants` derives bonds too | §2: all three exclude `broken` |
| A re-collapse result could place unanchored pieces that detach and re-trigger re-collapse without bound | §6: an anchoring check on settlement and exhausted regions |
| Float strengths below 0.0005 would be edges of capacity 0 | §3: an edge needs `s > 0` |
| `strength` is unbounded by validation, so plain-number products could overflow | §4.3: `BigInt` throughout; the schedule checks only that `S` is valid and every `s` is finite |
| A job "in flight across an upgrade" was said to conflict; the version check makes it invalid | §6 |
| `split`, `merge` and `retrieve` were misdescribed | §2 |
| The float `decayable.resistance` had no integer conversion, and a resistance above 1 would give a negative amount | §1: exact conversion and a clamp |
