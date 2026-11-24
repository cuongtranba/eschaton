# ADR 0012: Directional sockets

- Status: **Proposed — awaiting owner approval**
- Date: 2026-11-24
- Master plan: §4.2 (socket = local frame, profile, role, allowed mates; "match both directions, alignment, scale, geometry and occupancy"), §11 Phase 1 (roadmap v1.1)
- Amends, once approved: [ADR 0009](0009-socket-compatibility.md) (its tangent rule and its "no direct test" gap)
- Related: [ADR 0010](0010-runtime-identity-ownership-lineage.md), [ADR 0011](0011-atomic-transactions-and-revisions.md) (rules version in the snapshot header)

## Context

### What the code does today

A socket is one record per external unit face (`SocketDefinition`, `packages/foldon/src/definition.ts:34-44`) with a position, a unit normal, a **tangent**, a profile and a role. Compatibility is one function:

```ts
// definition.ts:159-167
socketsCompatible(a, b) =
  distance(a.position, b.position) <= tolerance &&
  dot(a.normal, b.normal) <= -1 + tolerance &&
  (a.normal[1] !== 0 || dot(a.tangent, b.tangent) >= 1 - tolerance) &&   // line 164
  profilesCompatible(a.profile, b.profile)
```

The tangent is canonical per face: `faceTangent(face)` returns +x for ±y faces and +y for side faces (`definition.ts:113-115`), and `validateFoldon` rejects any other tangent (`validate.ts:227-230`). Placement rotates the tangent with the piece (`placeSockets`, `transform.ts:84-93`, line 91) using yaw-only quarter turns that keep the Y component (`rotateDirection`, `transform.ts:35-46`).

### The gap, precisely

1. **Side faces: the tangent check can never fail.** A side face's tangent is +y. A yaw-only rotation preserves +y, so after any placement both tangents are still +y and `dot = 1`. The clause on line 164 is vacuously true for every validated socket. It would only start to matter if ADR 0002's option of all 24 orientations were adopted.
2. **±y faces: orientation is carried and then ignored.** After a quarter turn the tangent of a top or bottom socket is one of +x, −z, −x, +z (`transform.ts:35-46`): the piece's orientation is present in the frame. Line 164 skips the test whenever `normal[1] !== 0`, so two stacked pieces mate regardless of their relative turn. This was a deliberate fix: requiring equal tangents on ±y faces rejected a rotated beam sitting on a box shell in the watchtower recipe (ADR 0009, "The P0.3 change"; `packages/foldon/src/assemblies.ts`, part `band-beam`).
3. **Consequence: no orientation-sensitive mating.** Nothing can say "these two interfaces mate only when turned the same way" (a beam whose axis must continue along the beam below, a stair whose front must face a given direction, a roof ridge that must run along the wall below), or "this interface is asymmetric left to right". The current P01–P09 are all effectively fourfold symmetric on ±y faces: their profiles (`wall`, `deck`, `base`, `ground`, `eave`, `empty`, `open`) are chosen per face in `catalog.ts:200-254` and carry no turn.
4. **A door on a side face is partly expressible today, by face-specific profile, not by orientation.** A piece with a `door` profile on its +z face and `wall` elsewhere, mating only with a road-side profile, would be rejected when rotated to face away, because the adjacent faces would be `wall` and the road's profile. No catalog piece does this yet (P08 has `wall` on all four sides, `catalog.ts:247`) and there is no test of it. What cannot be expressed is anything that depends on how the two faces are turned or mirrored relative to each other.
5. **`open` is a wildcard** (`profilesCompatible`, `definition.ts:154-157`): every face of P01, P02, P05, P07 and P09 that uses `open` (`catalog.ts:200-254`) passes any check, so a wildcard face never produces a mismatch reason (ADR 0009 consequences).
6. **No test targets the rule.** ADR 0009 records that a search of `packages/foldon/test` for "tangent" finds nothing; the socket tests (`foldon.test.ts:308`, `:323`) exercise profile pairs.
7. **The compatibility answer is a boolean.** Callers (`facingIssues`, `assembly.ts:189-211`) cannot tell why a pair failed beyond the profile names.

### Why now

Roadmap v1.1 puts directional socket compatibility in Phase 1 because attach/detach (ADR 0010, 0011) must reject wrong-way attachment and Phase 2's solver compiles adjacency from these rules; changing the socket schema after the solver exists would invalidate its compiled tables.

## Decision drivers

1. One symmetric source of truth for compatibility; no hand-maintained mirror entries.
2. Existing P01–P09 and the four assemblies keep compiling with unchanged recipe hashes (ADR 0008).
3. Orientation must be data on the socket frame and the table, never a special case in code.
4. The answer must explain a mismatch (which rule failed) for the Studio overlay and for solver diagnostics.
5. Fit the current model: yaw-only quarter turns, cubic cells (ADR 0002). Do not design for 24 orientations yet, but do not block them.

## Options considered

1. **Oriented profile pairs with an in-face turn on the socket frame.** Each ±y socket's orientation is its tangent (already stored); a mate entry names the nominal relative turn of the pair.
   - Pros: uses data that already exists; one table; directional pairs (A mates B but not A) already exist as profile pairs such as `deck–base`.
   - Cons: authoring a turn per socket; profiles with natural symmetry would need a turn entry for each equivalent value unless symmetry is modelled.
2. **Asymmetric directional profiles only** ("male" and "female", or one profile name per facing: `rail-x`, `rail-z`).
   - Pros: no new frame data; fits the current table shape.
   - Cons: orientation is encoded in names, so each new orientation-sensitive piece multiplies profiles (four per feature on ±y); the table grows quadratically; rotating a piece must rename profiles, which `placeSockets` cannot do without a rotation-aware profile mapping; hands and turns cannot be tested generally.
3. **Symmetry groups per profile** (C1, C2, C4 rotation about the face normal) combined with the turn from option 1 (**proposed**).
   - Pros: a profile declares how symmetric it is once; stacking symmetric pieces stays free (all current profiles are C4, so no behaviour change); beam-like profiles are C2, and an axis-sensitive profile is C1; the check is one modular-arithmetic rule.
   - Cons: two concepts (turn and symmetry) instead of one; symmetry is a claim authors can get wrong (a wrongly C4 profile accepts bad stacks).
4. **Per-pair custom predicate functions.**
   - Pros: arbitrary expressiveness.
   - Cons: functions in definition data break serialisation and the "no functions in definitions" rule (`AGENTS.md`); untestable as a class; reject.

For horizontal asymmetry inside a side face, the alternatives are a `hand` flag on the socket (**proposed**), splitting the face into more unit sockets with different profiles (works but cannot express a one-cell asymmetric feature), or waiting for a wider rotation group. A hand flag is the smallest addition that makes a mirrored attachment fail.

## Proposed decision

Option 3 plus a side-face hand flag, expressed as a versioned data table.

### Socket frame

The frame stays `{ position, normal, tangent }` and the validated invariant changes from "tangent is canonical" to "tangent is one of the allowed in-face axes":

- **±y faces:** tangent ∈ {+x, −z, −x, +z}. Define `turnOf(tangent)` as the index in that list (0–3), which is exactly the sequence produced by applying rotations 0–3 to +x (`transform.ts:35-46`). A placement with rotation `k` adds `k` to the turn; no new stored field.
- **Side faces:** tangent stays +y (the in-face "up" is fixed under yaw-only rotation). A side socket may carry `hand: "left" | "right"`, meaning "the feature sits on the left (right) of the face as seen from outside". `hand` is invariant under yaw because the viewer rotates with the piece.

### Profile and mate table (single source of truth)

```ts
type Turn = 0 | 1 | 2 | 3;
type ProfileSpec = Readonly<{
  id: SocketProfile;
  symmetry: 1 | 2 | 4;      // order of rotational symmetry about the face normal (C1, C2, C4)
  handed: boolean;          // side faces of this profile carry a left or right hand
  wildcard: boolean;        // matches any profile (today's `open`), skipping turn and hand
}>;
type MateSpec = Readonly<{ a: SocketProfile; b: SocketProfile; relation: Turn }>; // unordered pair
type SocketTable = Readonly<{ version: number; profiles: readonly ProfileSpec[]; mates: readonly MateSpec[] }>;
```

Each unordered pair appears once. `relation` is the nominal turn from the lower (+y) socket's tangent to the upper (−y) socket's tangent; a lookup with the pair reversed negates it modulo 4. A pair `(a, a)` is valid only if `relation ∈ {0, 2}`; table validation rejects others.

### Matching rule

`socketMismatches(table, a, b)` returns an empty list when compatible, otherwise any of `position | normal | profile | turn | hand`:

1. **Geometry** (unchanged): positions coincide within the larger tolerance; normals are opposed.
2. **Profile:** the pair is in `mates`, or either profile is a wildcard (then the rule stops: compatible).
3. **±y faces:** let Δ = (turnOf(upper.tangent) − turnOf(lower.tangent)) mod 4, `r` the pair relation oriented from lower to upper, and `m = gcd(symmetry(a), symmetry(b))`. Compatible when `(Δ − r) mod 4` is a multiple of `4 / m`. So C4 pairs accept every Δ; C2 pairs accept `r` and `r + 2`; C1 pairs accept only `r`.
4. **Side faces:** if either profile is `handed`, both sockets must carry a hand and the hands must be complementary (`left` with `right`), because a feature at the left of one face coincides with the right of the face across; otherwise neither may carry a hand.

`socketsCompatible(a, b)` stays exported as `socketMismatches(...).length === 0` against the default table, so existing callers keep working.

### Validation

`validateFoldon` accepts the four allowed tangents on ±y faces, requires `hand` iff the face is a side face of a handed profile, and reports `socket-hand-invalid` or `socket-geometry-mismatch` otherwise. `createCatalog` validates the table itself (every profile used exists; pair relations legal).

### Migration of P01–P09 and the assemblies

- The table is created from the current data: profiles `empty, ground, deck, base, wall, eave, beam` get `symmetry: 4, handed: false, wildcard: false`; `open` becomes `wildcard: true`; the seven allowed pairs become `mates` with `relation: 0`.
- Every existing socket keeps its canonical tangent and no hand. All current profiles are C4, so the new rule accepts exactly what the old rule accepted: no behaviour change, no definition version bump, and recipe hashes stay equal (hashes cover part references, not sockets: `assembly.ts:82-92`).
- Assemblies need no recipe changes. Assembly external sockets inherit the placed tangent and hand of the part socket they expose (`assembly.ts:252-256`), so orientation survives nesting.
- New orientation-sensitive profiles (for example an axis-bound `rail`, C2) are **added**, not retrofitted. Whether P06's top, P07's top or P03/P04's eaves become oriented is a catalog decision for the owner (question 4); this ADR does not change them.
- `socketsCompatible` is replaced by the table lookup, and the `open` wildcard becomes data. Moving the table into `CatalogInput` (so adding a profile is a catalog change, answering a note in ADR 0009) is proposed but optional (question 5).

### Out of scope

Support direction (who carries whom), joint properties and load (Phase 4), and all 24 orientations. If ADR 0002's wider group is adopted later, the side-face up vector becomes a real degree of freedom and `turn` generalises to a full in-face frame; the table shape does not change.

## Invariants

1. **Symmetric.** For every pair of sockets, `socketMismatches(table, a, b)` is empty exactly when `socketMismatches(table, b, a)` is empty.
2. **Table has one entry per unordered pair.** Table validation rejects a pair listed twice or listed in both orders.
3. **C4 profiles ignore relative turn.** Two sockets whose pair symmetry is 4 are compatible at every Δ (this preserves all current behaviour).
4. **C2 profiles accept a half turn and reject a quarter turn.** For a pair with symmetry 2 and relation 0, Δ ∈ {0, 2} is compatible and Δ ∈ {1, 3} is not.
5. **C1 profiles accept only their relation.**
6. **Rotation of both pieces together never changes the answer.** Rotating a whole assembly by any yaw keeps every internal mate compatible.
7. **Hands are complementary.** A handed side pair is compatible for (`left`, `right`) and (`right`, `left`) and incompatible for (`left`, `left`), (`right`, `right`) and an unhanded partner.
8. **Wildcard skips orientation.** A wildcard profile mates with any profile at any turn and hand.
9. **Existing catalog is unchanged.** Every assembly in `assemblyCatalog` compiles with its current hash, and every previously compatible touching pair of P01–P09 stays compatible at every rotation.
10. **Mismatch reasons are reported.** An incompatible pair names at least one reason.

## Public API sketch

Illustrative TypeScript; data and pure functions only.

```ts
type SocketOrientation =
  | Readonly<{ face: "side"; hand?: "left" | "right" }>
  | Readonly<{ face: "axial" }>; // turn is read from `tangent`

type SocketMismatch = "position" | "normal" | "profile" | "turn" | "hand";

declare const defaultSocketTable: SocketTable;
declare function validateSocketTable(table: SocketTable): Result<SocketTable, readonly ValidationIssue[]>;
declare function turnOf(tangent: Vec3): Turn | undefined; // undefined for non-axis tangents
declare function socketMismatches(table: SocketTable, a: SocketDefinition, b: SocketDefinition): readonly SocketMismatch[];
declare function socketsCompatible(a: SocketDefinition, b: SocketDefinition): boolean; // default table

declare function faceSockets(
  footprint: readonly Cell[],
  profiles: FaceProfiles, // each entry: "wall" or { profile: "rail", turn: 1 } or { profile: "door", hand: "left" }
): readonly SocketDefinition[];
```

## Behavioural tests to write in Phase 1

Public seam: the `@eschaton/foldon` entry point. Test fixtures define their own foldons and a test table through the public `defineFoldon`, `faceSockets` and `createCatalog`; no piece is added to the shipped catalog just for a test. Today `SocketProfile` is a closed union (`definition.ts:30-31`), so fixture profiles such as `rail` or `door` need either the table to be catalog input with profile ids as branded strings (question 5, option A) or the profiles to be added to the default table (option B).

```ts
test("a quarter-turned piece resting on a fourfold-symmetric profile is accepted")  // regression for the P0.3 tangent defect
test("two boxes stacked with one rotated by a quarter turn have compatible touching sockets")
test("stacking two axis-bound beams with parallel axes is accepted")
test("stacking two axis-bound beams at a quarter turn is rejected with a turn mismatch")
test("a half-turned twofold-symmetric piece is accepted and a quarter-turned one is rejected")
test("a piece whose door faces the road mates with the road side")
test("rotating the door piece so its door faces away from the road is rejected")
test("a left-handed side socket mates with a right-handed one and not with another left-handed one")
test("a wildcard profile mates with an oriented profile at any turn")
test("compatibility is the same when the two sockets are swapped")
test("rotating a whole assembly keeps every internal mate compatible")
test("every shipped assembly still compiles with its previous hash")
test("an incompatible pair reports which rule failed")
```

The first test also closes the gap ADR 0009 records (no direct test of the tangent rule).

## Consequences

- Orientation-sensitive pieces become authorable and testable; the Phase 2 solver compiles adjacency from one table that already carries turn and hand.
- The overlay can show why a socket pair fails (turn, hand, profile).
- Authors take on the symmetry claim for each profile; a wrong C4 silently accepts bad stacks. The default table keeps today's behaviour, so wrong claims can only come from new profiles, and each new profile needs a must-mate and a must-not-mate test.
- `SocketDefinition` gains an optional `hand`; `validate.ts` rules change. The snapshot header's `rules` version (ADR 0011) includes the table version so old saves are not silently reinterpreted.
- Side-face "up" remains a constant until the rotation group widens; documenting that prevents the vacuous check from being mistaken for a working one.

## Risks

- **Symmetry misdeclared** by authors (see above).
- **Table drift:** if the table stays in package code, adding a profile requires a code change (ADR 0009 noted this). Question 5 addresses it.
- **Hand semantics are subtle** (mirror across a face). Mitigation: the test above and an inspector overlay that draws the hand.
- **Orientation of large boundaries:** unit segments each carry their own turn; a multi-cell face whose segments are turned inconsistently by an author would be accepted by the rule but is probably a modelling error. Mitigation: a validation warning on uniform-turn expectations later; not decided here.
- **Possible future conflict** with the 24-orientation group; the table shape survives, but `turnOf` and the side-face rule would change.

## Owner approval questions

1. Adopt in-face turn plus per-profile symmetry (C1, C2, C4) as the orientation model, rather than per-orientation profile names? (yes/no)
2. Add a `hand` flag for side faces with complementary matching (left mates right)? (yes/no)
3. Keep every current profile at fourfold symmetry so existing behaviour does not change? (yes/no)
4. Which existing pieces, if any, should become orientation-sensitive in Phase 1: **none** (recommended), P06 top and bottom only, or other (name them)?
5. Move the socket table into `CatalogInput` so profiles are catalog data (**A**), or keep it in package code for Phase 1 (**B**)?
6. Return mismatch reasons from the matcher and keep `socketsCompatible` as a boolean wrapper? (yes/no)
7. Is the `open` wildcard to stay as a documented wildcard profile in Phase 1, or should it be replaced piece by piece with explicit profiles (**keep** / **replace**)?
