# ADR 0014: Bond model (Phase 1)

- Status: **Accepted with amendments** — owner decision R3 (2026-11-25, recorded in [`../review/phase-1-owner-review.md`](../review/phase-1-owner-review.md)). The amendments are applied in the section "Amendments (owner R3, 2026-11-25)" below, which overrides the text above it where they differ.
- Date: 2026-11-25
- Master plan: §4.2 (bonds as runtime constraints), §6 (collapse needs bonds), §11 Phase 1 ("placement, bonds")
- Related: [ADR 0010](0010-runtime-identity-ownership-lineage.md) (entities and owners), [ADR 0011](0011-atomic-transactions-and-revisions.md) (the commit that changes bonds), [ADR 0012](0012-directional-sockets.md) (what "mated" means), [ADR 0007](0007-component-data-and-system-order.md) (no tick in Phase 1)

## Context

Phase 1 adds `attach` and `detach` (plan milestone M4). The master plan treats bonds as the runtime constraint that Phase 4 (Collapse) will weaken and break. Phase 1 has no forces, no support graph and no damage. It needs a bond representation that:
- exists in authoritative state, so that Phase 4 can break a bond while two pieces still touch;
- is unambiguous in Phase 1;
- is checkable by the invariant suite.

## Options considered

1. **No stored bonds; derive contacts on demand.** One source of truth today, but Phase 4 could not represent a broken bond between two touching pieces without adding storage later and migrating every save.
2. **A bond record per mated socket pair, owned by the world state** (P1-D11, approved). Phase 1 keeps the stored set equal to the derived contact set; Phase 4 may make it a strict subset.
3. **A bond per entity pair**, aggregating all touching sockets. Fewer records, but it loses which faces carry the joint, which Phase 4 stress needs.

## Decision

Option 2.

```ts
type BondEnd = Readonly<{ entity: EntityId; cell: Cell; face: Face }>; // world cell and world face of the socket
type Bond = Readonly<{ a: BondEnd; b: BondEnd; strength: number }>;    // a.entity is created before b.entity
```

- **Mated socket pair:** two sockets of two different placed entities whose world positions coincide and whose normals are opposed, and that `socketMismatches(catalog.sockets(), a, b)` (ADR 0012) accepts.
- **Lifecycle:**
  - When an entity enters `placed`, the world adds one bond for each mated pair between it and the entities already placed.
  - When an entity leaves `placed` (`detach`, `store`, `consume`), the world removes exactly its bonds.
  - Bonds are created and removed only inside `applyPatch`, so they are atomic with the ownership change.
- **Canonical order:** bonds are stored sorted by `(a.entity, a.cell, a.face, b.entity, b.cell, b.face)`, where entities are ordered by creation stamp. A bond never appears twice.
- **Strength is data only.** It is the smaller `structural.strength` of the two definitions, or 0 when either has no `structural` component. Nothing reads it until Phase 4, which may redefine it.
- **Invariants checked at every commit:**
  1. Every bond joins two `placed` entities through a mated pair.
  2. (Phase 1 only) every mated pair between placed entities has a bond. Phase 4 relaxes this when bonds can break.
  3. No entity that is not placed has a bond.
  4. Bonds are unique and canonically ordered.

## Interpretations needing owner confirmation

1. **`instantiate` creates bonds too, not only `attach`.** P1-D11 names `attach`, but `instantiate` also puts entities into `placed`. If only `attach` created bonds, a structure built by `instantiate` would have no bonds while the same structure rebuilt by `attach` would have them. Phase 4 would then treat identical structures differently depending on how they were built. Applying the rule to every placement keeps invariant 2 true.
2. **Every accepted pair is a bond, including `empty–empty` contacts and wildcard (`open`) contacts.** The socket table accepts them, so under the literal rule they are mated. Whether such bonds carry load is a Phase 4 question about interpreting `strength`. Phase 1 does not filter them.

If the owner rejects either interpretation, the change is local to the bond derivation in `@eschaton/world` and to this ADR.

## Consequences

- Detaching then re-attaching an entity at the same pose recreates the same bonds (same ends, same strength). Its id is unchanged (ADR 0010).
- The state hash covers bonds, so replay checks them.
- Bond storage is O(contacts). For Phase 1 sizes this is negligible; it is measured with the commit benchmarks at M9.

## Tests (Phase 1, `@eschaton/world` entry point)

- "attach creates a bond for each mated socket pair and detach removes exactly those"
- "instantiating an assembly bonds its touching parts" (pins interpretation 1)
- "the invariant check finds no issue after every commit in the bond scenarios" (invariants 1–4)

## Implementation (Phase 1)

- **Code:** `packages/world/src/model.ts` (`contacts`, `bondsFromContacts`, `matedBonds`, `sortBonds`) and `ops.ts` (`settleBonds`).
- **Settling:** after all ops of a patch, the bonds of every entity whose placement changed are removed and re-derived from its mated pairs. This gives the same final bonds as per-op creation and removal, because Phase 1 bonds depend only on final placement, and it keeps large patches linear.
- **Tests:** `packages/world/test/bonds.test.ts`.
- **Status when this section was written:** Proposed; the two interpretations above awaited owner confirmation. Owner decision R3 (2026-11-25, [`../review/phase-1-owner-review.md`](../review/phase-1-owner-review.md)) later resolved them: interpretation 1 is confirmed and interpretation 2 is rejected and replaced (see "Amendments (owner R3, 2026-11-25)" below). The current status is the status line at the top.

## Amendments (owner R3, 2026-11-25)

The owner approved this ADR with three amendments. Interpretation 1 above is confirmed; interpretation 2 is **rejected** and replaced.

1. **`instantiate` creates bonds exactly like `attach`** when the pair is eligible (interpretation 1, confirmed).
2. **`empty–empty` adjacency is never a structural bond.**
3. **The `open` wildcard is non-bonding by default.** It bonds only where an explicit bonding rule lists the pair.

### Four distinct facts

| Fact | Definition | Where it is decided |
|---|---|---|
| Contact | Two sockets of two placed entities whose faces coincide | Geometry (`contacts`, `packages/world/src/model.ts`) |
| Legal adjacency | A contact that `socketMismatches(table, a, b)` accepts. An illegal contact rejects the commit | Socket table: profiles, mates, turn, hand, wildcard (ADR 0012) |
| Bond eligibility | A legal adjacency whose profile pair is **listed in the table with `bond: true`** (`bondEligible`, `packages/foldon/src/sockets.ts`) | Socket table: `MateSpec.bond`, `ProfileSpec.structural` |
| Strength | The smaller `structural.strength` of the two definitions (0 without the component). Data only until Phase 4 | Definition components |

### One versioned source of rules

- The socket table (version 2 when R3 landed, commit `1c05fce`; version 3 in code today) is the only source. There is no implicit heuristic in the world package.
- `ProfileSpec.structural` says whether a profile can carry a bond at all. `empty` is non-structural, and table validation rejects any `bond: true` rule that names a non-structural profile, so "empty never bonds" cannot be overridden by data.
- `MateSpec.bond` is required on every mate. In the default table `empty–empty` is `bond: false`; `deck–base`, `ground–base`, `wall–wall`, `eave–eave`, `beam–beam` and `beam–wall` are `bond: true`.
- A wildcard makes an adjacency legal without a mate entry, so it has no `bond: true` rule and does not bond. A catalog may add an explicit rule such as `{ a: "open", b: "wall", relation: 0, bond: true }`.
- The rules version in the world header is `sockets@<table version>+invariants@2`. The table is also part of the catalog fingerprint, so a world built under other bond rules is refused by `applyPatch`, `replay` and `parseSnapshot`.

### Invariants (replacing 1–2 above)

1. Every stored bond joins two placed entities through a **bond-eligible** pair.
2. (Phase 1–3) Every bond-eligible pair between placed entities has a stored bond.
3. No entity that is not placed has a bond.
4. Bonds are unique and canonically ordered.

### How a broken bond will differ from contact (Phase 4, not implemented)

Today "stored bonds" equals "bond-eligible contacts", so a bond adds no information beyond contact. Phase 4 relaxes invariant 2 to "stored ⊆ eligible":
- A **broken bond** is a bond-eligible contact with **no stored bond**: the two pieces still touch and the adjacency is still legal, but nothing holds them together.
- Breaking is an explicit op (for example `break { a, b }`) committed through `applyPatch` and recorded in the log, so replay reproduces which bonds are broken. It is never inferred from geometry.
- Re-forming a bond is likewise explicit (`attach`, or a future `mend`). Settling after an unrelated commit must not silently re-create a broken bond; the Phase 4 ADR has to carry "broken" state so that the per-patch settling of moved entities does not undo it.
- Force, damage, support and strength interpretation belong to the Phase 4 ADR. None of it exists now.

### Tests

`packages/world/test/bonds.test.ts`: "touching empty faces are a legal contact and never a structural bond"; "a wildcard open face against a wall is a legal contact and no bond by default"; "an explicit bonding rule for a wildcard pair creates the bond"; "a structure rebuilt by attach has exactly the bonds it had when instantiated"; "attach creates a bond for each mated socket pair and detach removes exactly those"; "instantiating an assembly bonds its touching parts". `packages/foldon/test/sockets.test.ts`: "a socket table that lets a non-structural profile carry a bond is rejected". Replay covers bonds through the state hash (`patch.test.ts`), and every committing test helper asserts the invariants.
