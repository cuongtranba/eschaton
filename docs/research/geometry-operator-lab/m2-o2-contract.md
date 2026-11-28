# M2: contract for O2 crease insertion (contract v1.1, frozen)

- Status: **M2 contract v1.1 (frozen), before any committed M2 script.** v1 (`fc646c7`) was reviewed by an independent mathematician: GO WITH AMENDMENTS (§14). v1.1 applies the amendments. Authorized by owner decision D-6 (research execution only, in isolation; [decision packet](../../review/art-1-raven-decision-packet.md) §0.4). It is research, not a production API (D-1), and it changes no package, app, experiment, Foldon contract, gate or open question.
- Source it narrows: [`geometry-operators.md`](../geometry-operators.md) §3.2 (O2) as frozen at `8c2bd53`, with its errata (§9 there), and [`geometry-operator-lab.md`](../geometry-operator-lab.md) §2 row M2, §3 and §7. Those texts are not edited. Where this contract differs from them, §11 lists the difference and its reason.
- Independent of O1. M2 takes planar convex panels as input and uses no result of O1 v1.1 or of the proposed O1 v2 (lab §10).
- Rule of this file: **nothing below may change after the first implementation commit** except by a new contract version, appended in §13, which says what changed and which evidence it invalidates. Expected values in §8 are hand-derived closed forms. They are never tuned to an implementation result.

## 1. Scope

**In scope (M2):**
1. A **sheet**: one strictly convex polygon S, the *outline*, in its rest plane z = 0, with front normal +z.
2. **Crease insertion** into one current face of the sheet along a straight line, giving two strictly convex faces joined by one crease. Repeated insertions give a sheet whose faces are the cells of non-crossing chords of S.
3. **Pose**: a fold angle per crease and a root face give every face a rigid motion. The posed sheet is reported in floating point with stated bands.

**Out of scope (rejected or not claimed):**

| Case | M2 behaviour | Reason |
|---|---|---|
| A line that would end inside an existing crease (a T-junction) or cross one | rejected `splits-crease` | it closes a cycle of faces (§3.3): the two new pieces X⁺ and X⁻ would both border the neighbour Y across the old crease, giving the 3-cycle X⁺–Y–X⁻. Insertion is face-local, so a true crossing cannot even be expressed: it appears as a T-junction seen from the other face. Closed crease networks are Q4 and excluded by D-8 |
| Splitting a face that was already split | rejected `not-a-leaf` | only current faces (the leaves of the lineage tree) exist as panels |
| Curved creases, holes, non-convex outlines, several outlines | not representable or rejected | operators §3.2 "Deferred"; holes are D-9 (M4) |
| Collision-free folding, a folding motion, contact at large angles, thickness, global self-intersection of the posed sheet | **not claimed**, NOT VERIFIED | §4.6 |
| O1, O3, M3–M5, seams between sheets | not implemented | D-6, D-8, D-9 |

## 2. Units, input schema and finite bounds

- **Unit.** As in O1 v1.1 §2: input coordinates are integers in quanta, `1 q = 1e-6 L`. Python `bool` is not an integer. A float, a string, NaN, a missing key or wrong nesting is `malformed-input`.
- **Outline.** A list of `[x, y]` integer pairs, any cyclic rotation, either orientation.
- **Line.** Two integer points `p`, `q` in quanta, `p ≠ q`. They need not lie in the face. The line is the set `{x : cross(q − p, x − p) = 0}`.
- **Assignment.** The string `"valley"` or `"mountain"` (anything else is `malformed-input`).
- **Angles.** Degrees, an `int` or a finite `float`; `bool`, NaN and ±∞ are `malformed-input`.
- **Bounds** (a violation is `out-of-bounds`):
  - |x|, |y| ≤ 10⁹ q for outline vertices and line points;
  - 3 ≤ outline vertex count ≤ 1024 (an empty list or fewer than 3 vertices is `out-of-bounds`);
  - at most 64 creases per sheet (the 65th insertion is `out-of-bounds`);
  - optional `min_altitude` as in O1 v1.1 §2: an integer, 1 ≤ t ≤ 4·10⁹ q (non-integer, `bool` or < 1 is `malformed-input`, > 4·10⁹ is `out-of-bounds`);
  - fold angles: |θ| < 180° (`angle-out-of-range` otherwise; §4.1 explains why ±180° is excluded).
- **Arithmetic bound (follows from E3).** Every face vertex is an outline vertex or the intersection of one input line with one outline edge line. Its coordinates are rationals whose denominator divides `cross(q − p, e)` for an outline edge vector e, so |den| ≤ 2·(2·10⁹)² = 8·10¹⁸ and |num| ≤ 10⁹ · 8·10¹⁸ = 8·10²⁷ < 2⁹³ (v1.1; v1 said 2⁸⁰, which the review exceeded at 2^91.7). **Denominators do not grow with the number of insertions.** These bounds keep run time bounded; they are not a production budget.

## 3. Definitions and exact results (flat state)

### 3.1 Sheet, faces, creases, lineage

- A **face** is a strictly convex polygon with rational vertices, counter-clockwise seen from +z (front).
- The **lineage** is a binary tree of face ids. The outline is face `F`. Splitting face `X` retires it and creates `X.a` and `X.b`. The **current faces** are the leaves.
- A **crease** is created by splitting a face X; its id is the id of X. It has two endpoints (rational points), an assignment, and the two current faces it separates.
- The **crease graph** has the current faces as nodes and the creases as edges.

### 3.2 Splitting one face (results E1, E2)

Let X be a current face with vertices v₀ … v_{m−1} and let `s_i = sign(cross(q − p, v_i − p))`, computed exactly.
- If every `s_i` is the same nonzero sign: `line-misses-panel`.
- Else if no two vertices have opposite strict signs (some `s_i = 0`): the line meets X only in its boundary, at one vertex or along one edge: `line-touches-boundary`.
- Otherwise the line meets the interior of X, and `X ∩ line` is a **chord** with two distinct endpoints, each either a vertex with `s_i = 0` or the exact intersection of the line with an edge whose endpoints have opposite strict signs. By convexity there are exactly two.

**E1 (pieces).** `X⁺ = X ∩ {s ≥ 0}` and `X⁻ = X ∩ {s ≤ 0}` are strictly convex polygons with positive area and at least 3 vertices.
*Proof.* Each is the intersection of convex sets and contains a strict-side vertex and the chord, so it has interior. Its vertices are the strict-side vertices of X, in their order, and the two chord endpoints. At a chord endpoint inside an edge, the piece's angle lies strictly between 0° and 180°, because the chord is not along that edge (the line has strict vertices on both sides). At a chord endpoint that is a vertex of X, the piece's angle is a proper part of X's angle there, so it is below 180° and positive. No three consecutive piece vertices are collinear: two old consecutive vertices and a chord endpoint are collinear only if the old vertex lies on the line, which it does not. ∎

**E2 (area).** `|X⁺| + |X⁻| = |X|` exactly, in rationals (the pieces meet only along the chord).

### 3.3 The splits-crease rule and the boundary invariant (results E3, E4)

**Rule.** If a chord endpoint lies in the **relative interior of an edge of X that is a crease**, the insertion is rejected `splits-crease`. A chord endpoint at a vertex of X is allowed, even if a crease ends there.

**E3 (boundary invariant).** After any sequence of accepted insertions, every vertex of every current face lies on ∂S, and every crease is a chord of S whose endpoints lie on ∂S.
*Proof by induction.* It holds for S. A chord endpoint is either a vertex of X (on ∂S by hypothesis) or interior to an edge of X. That edge is not a crease (the rule), so it lies on an outline edge, and the endpoint lies on ∂S. ∎
*Consequence.* A crease is never subdivided. A later chord can end only at its endpoints, which are vertices. So every crease is one full edge of each face it separates.

**E4 (tree).** The crease graph is a tree with k + 1 faces and k creases after k insertions. No face cycle and no interior vertex exist.
*Proof by induction.* Splitting X replaces node X with two nodes joined by the new crease. Each old crease of X is a full edge of X (E3). Its endpoints cannot have opposite strict signs, since the chord would then end inside it (rejected). Both endpoints cannot have sign 0, since the line would contain an edge of X and miss the interior. So each old crease goes, whole, to exactly one piece, and so does its neighbour. Replacing a node by an edge and distributing its neighbours keeps a tree. Every vertex lies on ∂S (E3), so no vertex is interior. ∎

**`closed-network` is unreachable (correction K3).** Operators §3.2 lists `closed-network` for two creases that cross inside a panel. In this domain, a crossing or touching crease is always first seen as a chord endpoint inside an existing crease, which is `splits-crease`. E4 shows that no other cycle can arise. The code is therefore not emitted, and its negative control (a crossing pair) must return `splits-crease`.

### 3.4 Order of insertion (result E5)

**E5.** Let c₁ and c₂ be chords of a current face X that do not meet inside X, except possibly at a common endpoint on ∂X. Inserting c₁ and then c₂ (into the piece that contains c₂) gives the same faces and creases, as geometry, as inserting c₂ and then c₁. Ids and lineage may differ; geometry does not.
*Proof.* Both give the three cells of the two chords in X, with the same two crease segments and assignments. ∎
If c₁ and c₂ cross or touch inside X, **both** orders are rejected `splits-crease` at the second insertion.

### 3.5 Naming (representation, never geometry)

- Of the two pieces, `X.a` is the one that contains the lexicographically smallest `(x, y)` vertex of X that is **not** on the line. It exists, because at most two vertices of X lie on the line and X has at least 3. The other piece is `X.b`.
- So the names do not depend on the orientation of the line or on which two points name it.

## 4. Pose

### 4.1 Rest and fold angle

- **Rest state.** Every crease at θ = 0: the flat sheet in z = 0.
- **Fold angle** θ of a crease is the repository's convention (`AGENTS.md`, "Fold-angle convention"): for parent front normal `nP`, child front normal `nC`, and `a = normalize(nP × uP)`, where `uP` is the in-plane unit vector perpendicular to the hinge pointing into the parent, `θ = atan2(dot(nP × nC, a), dot(nP, nC))`. **θ > 0 is valley** (fronts turn toward each other), **θ < 0 is mountain**.
- **Assignment check.** A valley crease accepts θ ≥ 0, a mountain crease θ ≤ 0. θ = 0 is allowed for both. A violation is `assignment-mismatch`.
- **Why |θ| = 180° is excluded.** At ±180° the two faces lie on each other, and the measured angle is +180° or −180° according to the sign of a rounding residue, so the sign cannot be recovered from the geometry.
- **Near the limits (v1.1).** The input θ is checked against the assignment exactly (its sign). The **measured** angle is compared with θ by the wrapped difference `((m − θ + 180) mod 360) − 180`, because near ±180° its sign comes from rounding (the review saw 80 of 200 wrap at `nextafter(180, 0)`). The measured sign is never used for the assignment check. Folding flat (a hem) is contact, which is GEO-1.11's subject. Angles strictly inside (−180°, 180°) are accepted, including values within 10⁻³° of the limits.

### 4.2 Rigid motion about the crease

For a crease with endpoints P and Q, let the **parent** be its face on the side of the root and the **child** the other face. Orient the axis direction `u = (Q − P)/|Q − P|` so that the parent lies to the **right** of u, seen from +z in the rest plane. The child's motion relative to the parent is the rotation `R(P, u, θ)`: by angle θ, right-handed about the line through P with direction u.

**Derivation of the sign.** Place the crease on the y-axis with the parent at x < 0. Facing −ŷ, the right-hand side is −x̂, so u = −ŷ. By Rodrigues' formula, `R(u, θ)v = v cos θ + (u × v) sin θ + u (u · v)(1 − cos θ)`.
- A child point `r x̂` (r > 0) has `u × r x̂ = r ẑ`, so it goes to `r x̂ cos θ + r ẑ sin θ`: it rises toward the front for θ > 0. For the unit square split at x = ½ with the parent on the left, θ = +90° takes (1, 0, 0) to (½, 0, ½).
- The child's front normal goes to `nC = ẑ cos θ + (u × ẑ) sin θ = ẑ cos θ − x̂ sin θ`, which tilts toward the parent: the fronts turn toward each other.
- With `nP = ẑ`, `uP = −x̂` and `a = ẑ × (−x̂) = −ŷ`: `nP × nC = −ŷ sin θ`, so `dot(nP × nC, a) = sin θ` and `dot(nP, nC) = cos θ`. The convention gives `atan2(sin θ, cos θ) = θ` for |θ| < 180°.

So `R(P, u, θ)`, with the parent on the right of u, realizes exactly the convention's θ, and θ > 0 is valley.

**Axis in floats (v1.1).** The base point is P = the first endpoint of the crease record (endpoints sorted by exact value), and the direction is `u = normalize(float(Fraction(Q − P) / 10⁶))`, from the **exact** difference. Taking u from `float(Q) − float(P)` can differ by more than τ for a short crease far from the origin (the review measured 6.2e-9 L for a 4.4 q crease at 998 L). The implementation and the oracle PO both use this rule.

**Composition.** With a root face r, each current face f has the unique crease path r = f₀, f₁, …, f_m = f in the tree (E4), and `T_f = T_{f_{m−1}} ∘ R(e_m)`, with `T_r` the identity. All axes are taken in rest coordinates.

### 4.3 Exact results of the pose (mathematics; the floats are checked against bands)

- **(P1) Rigidity.** Each face moves by one rigid motion, so every pairwise distance within a face, every edge length and planarity are preserved.
- **(P2) Shared axis.** `R(e)` fixes every point of its axis, so the two posed copies of each crease coincide, and so does every vertex shared by several faces at a fan.
- **(P3) Independence of the parent side.** If the roles of parent and child are swapped, the axis reverses (the new parent is on the right of −u), and the new relative motion is `R(u, θ)⁻¹ = R(u, −θ) = R(−u, θ)`. So the same θ describes the same geometry, valley stays valley, and the measured θ of §4.1 is the same from either side.
- **(P4) Rerooting.** By P3, every pair of faces has the same relative motion whatever the root. Two roots give posed sheets that differ by one rigid motion: every pairwise distance between all posed vertices of the sheet is equal.
- **(P5) Fold order.** The pose is a function of the final angle assignment and the root only. Fold order is not an input, and no claim is made about a path between poses.
- **(P6) Zero.** θ = 0 for every crease gives the rest sheet.

### 4.4 Exact against approximate

- **Exact:** faces, creases, lineage, assignments, the tree, areas, ids, error codes and the digest. They are integer and rational computations, independent of floats.
- **Approximate:** the posed coordinates. They are float64, in L, from `math.cos` and `math.sin` of `math.radians(θ)`. At ±90°, `cos` is about 6.1e-17, not 0. Checks use bands:
  - `S = max(1, diameter of the outline in L)`, `τ = 1e-9 · S`;
  - distances and coincidences: within τ;
  - the measured fold angle (the convention of §4.1, from the posed parent and child normals) equals θ within **1e-7°**, by the wrapped difference of §4.1, for every crease whose **two** faces both have altitude ≥ `1e-3 · max(1, M)` L, where M is the largest |coordinate| of the outline in L (v1.1: the angle error grows with the distance from the origin). Other creases are reported, not judged.
- **Determinism.** The canonical JSON and its digest contain no float. Float outputs are deterministic for one Python build on one platform only. **No cross-engine or cross-platform agreement of the floats is claimed** (P3D-6 is not claimed for them).

### 4.5 Float conversion

A rational coordinate in quanta is converted to L as `float(Fraction(x) / 10**6)` (correctly rounded).

### 4.6 What the pose does not show

- Not that the posed sheet is free of self-intersection: faces that are not neighbours may pass through each other at large angles. **NOT VERIFIED.**
- Not that a folding motion from flat exists without collision, nor anything about thickness, contact at |θ| near 180°, rigidity of a closed network (none exists here), or material behaviour.
- A local split and a local hinge are **not** a global folding result.

## 5. Public functions, output and canonical form

Module `o2.py` (Python 3 standard library). Every function returns a value; **no exception is raised for an expected failure**.

| Function | Returns |
|---|---|
| `make_sheet(outline)` | `{"ok": true, "sheet": …}` or `{"ok": false, "error": {"code", "detail"}}` |
| `insert_crease(sheet, face_id, p, q, assignment, min_altitude=None)` | `{"ok": true, "sheet": …}`, a **new** sheet (the input's canonical JSON is unchanged), or an error |
| `pose(sheet, angles, root)` | `{"ok": true, "pose": {"root": id, "faces": [{"id", "vertices": [[x, y, z], …]}, …]}}` in L, or an error. `angles` maps every crease id to a degree value |
| `canonical_json(obj)`, `digest(sheet)`, `geometry_digest(sheet)` | strings |

**Sheet value** (all exact; a rational is `[num, den]` in lowest terms with den > 0; a point is `[[xn, xd], [yn, yd]]` in quanta):

| Field | Content |
|---|---|
| `version` | `"o2-contract-v1"` |
| `outline` | the outline, canonical ring of **integer** pairs `[x, y]` (not rationals) |
| `faces` | every face ever created, sorted by id: `{"id", "parent", "children", "crease", "vertices", "area"}`. `parent` is null for `F`; `children` is null for a current face, else `[X.a, X.b]`; `crease` is the id of the crease that split it, or null; `vertices` is the canonical ring; `area` a rational in q² |
| `creases` | sorted by id: `{"id", "endpoints", "assignment", "faces"}`. `endpoints` sorted lexicographically; `faces` the two **current** faces it separates, sorted |

- **Canonical ring:** counter-clockwise seen from +z, starting at the lexicographically smallest `(x, y)` vertex; rationals compared exactly.
- **Sort keys (v1.1).** Points sort by exact value, x first, then y (never by their `[num, den]` lists). Rings sort lexicographically by their points in order. Ids sort by Unicode code point. Crease endpoints sort as points. In `geometry_digest`, faces sort as rings, and creases sort by their endpoint pair, then their assignment.
- **Pose output order (v1.1).** Each posed face lists its vertices in the order of that face's canonical ring in the sheet.
- **Canonical JSON:** `json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)`, as in O1 v1.1 §4.2.
- **`digest`:** SHA-256 of the canonical JSON of the sheet.
- **`geometry_digest`:** SHA-256 of the canonical JSON of `{"outline", "faces": sorted list of current face rings, "creases": sorted list of [endpoints, assignment]}`, with every id and all lineage removed. It is the equality used by E5 and by the metamorphic checks.
- **Allowed input permutations:** for `make_sheet`, any cyclic rotation and either orientation of the outline; for `insert_crease`, swapping p and q, or replacing them by any two distinct integer points on the same line **within the bounds**. All give a **byte-identical canonical JSON**. For an error they give the same `code`; `detail` is informative only.
- **Root face** of `pose` is a required argument; the pose output lists the current faces sorted by id.

## 6. Error codes and precedence

**`make_sheet`**, in this order: `malformed-input` → `out-of-bounds` → `duplicate-vertex` → `collinear-vertex` → `non-convex-panel`. The three panel checks use the predicates of O1 v1.1 §3.1 (a zero cross product of consecutive edges is `collinear-vertex`; one sign and exactly one cyclic half-plane transition is strictly convex), on the outline.

**`insert_crease`**, in this order:
1. `malformed-input` (the sheet's structure or `version`, the face id type, p, q, the assignment, `min_altitude`). The sheet's geometry is not re-validated: it is trusted output of this module;
2. `out-of-bounds` (coordinates, a 65th crease, `min_altitude` > 4·10⁹);
3. `unknown-face` (the id never existed), then `not-a-leaf` (it was split);
4. `degenerate-line` (p = q);
5. `line-misses-panel`;
6. `line-touches-boundary`;
7. `splits-crease`;
8. `thin-panel` (if `min_altitude` is given: either piece's altitude, defined as in O1 v1.1 §3.4 and compared exactly with rationals, is below it; piece `.a` first).

**`pose`**, in this order:
1. `malformed-input` (a malformed sheet, a root that is not a string, non-dict angles, a non-string key, a non-number, `bool`, NaN, ±∞). The assignment check is numeric: −0.0 and 0.0 pass for both assignments;
2. `unknown-face`, then `not-a-leaf` (the root);
3. `unknown-crease` (a key that is not a crease id), then `missing-angle` (a crease without a value), by crease id order;
4. `angle-out-of-range` (|θ| ≥ 180), by crease id order;
5. `assignment-mismatch`, by crease id order.

## 7. Fixed source checks before the freeze (operators §3.2)

The camber table of operators §3.2 was re-derived for this contract. **It is correct; no derivation changes.**
- c = 1 L and s = 0.1 L give `R = (c²/4 + s²)/(2s) = 1.3 L` and `Φ = 2 asin(c/(2R)) = 45.2397°`.
- n = k + 1 equal chords inscribed in the arc each subtend Φ/n, so each fold turns the surface by **Φ/n** (exterior angle of an inscribed polygon), and the largest distance between the polyline and the arc is the sagitta of one sub-arc, **R(1 − cos(Φ/(2n)))**. That is the one-sided and the two-sided Hausdorff distance, both attained at a segment midpoint.
- Values: k = 1: 0.025245 L, 22.6199°; k = 2: 0.011240 L, 15.0799°; k = 3: 0.006327 L, 11.3099°; k = 5: 0.002813 L, 7.5400°.
- **Two statements the source omits (added, not changed):**
  - The **developed width** of the cambered sheet is `n · 2R sin(Φ/(2n))`: 1.019804, 1.023497, 1.024791 and 1.025716 L. It is **not** c. A fixed sheet width gives a different chord.
  - The 8° in the trade-off sentence is the method's **unmeasured assumption** (form method §6.0), not data.

## 8. Fixtures and frozen expected results

Coordinates in L; the fixture file stores them ×10⁶ as integers. "Square" is the unit square (0, 0), (1, 0), (1, 1), (0, 1). Expected flat values are exact; posed values hold within τ unless marked.

| ID | Input | Expected |
|---|---|---|
| G1 | square; insert into `F` the line x = ½ (p = (½, 0), q = (½, 1)), valley | current faces `F.a` = (0, 0), (½, 0), (½, 1), (0, 1) and `F.b` = (½, 0), (1, 0), (1, 1), (½, 1); areas ½ each (5·10¹¹ q²); crease `F` with endpoints (½, 0), (½, 1), faces [`F.a`, `F.b`]. Pose root `F.a`, θ = +90°: `F.b` → (½, 0, 0), (½, 0, ½), (½, 1, ½), (½, 1, 0). Root `F.b`, θ = +90°: `F.a` → (0, 0) goes to (½, 0, ½) and (0, 1) to (½, 1, ½). Measured θ = 90° from either root |
| G1m | as G1 but mountain, θ = −90°, root `F.a` | `F.b` → (½, 0, 0), (½, 0, −½), (½, 1, −½), (½, 1, 0); measured θ = −90° |
| G2 | G1 with p and q swapped; and with p = (½, −7), q = (½, 3) | canonical JSON byte-identical to G1 |
| G3 | square; line through (0, 0) and (1, 1), valley | two triangles: `F.a` = (0, 0), (1, 1), (0, 1) (it holds (0, 1), the smallest vertex off the line) and `F.b` = (0, 0), (1, 0), (1, 1); no new vertex; areas ½ |
| G4 | square; line through (0, 0) and (1, ½) | `F.a` = (0, 0), (1, ½), (1, 1), (0, 1), area ¾; `F.b` = (0, 0), (1, 0), (1, ½), area ¼; one new vertex (1, ½) |
| G5 | G1, then insert into `F.a` the line through (0, 0) and (½, 1), valley | legal (a fan at the crease endpoint (½, 1)). `F.a.a` = (0, 0), (½, 1), (0, 1); `F.a.b` = (0, 0), (½, 0), (½, 1); areas ¼, ¼, ½; creases `F` [`F.a.b`, `F.b`] and `F.a` [`F.a.a`, `F.a.b`]; tree with 3 faces and 2 creases |
| G6 | square; lines x = ⅓ then x = ⅔, both valley, as quanta 333333 and 666667 | `F.a` = [0, 333333] strip, `F.b.a` = [333333, 666667], `F.b.b` = [666667, 10⁶]; creases `F` [`F.a`, `F.b.a`] and `F.b` [`F.b.a`, `F.b.b`]. Pose root `F.b.a`, both +90°: (0, 0) → (0.333333, 0, 0.333333), (1, 0) → (0.666667, 0, 0.333333). The same lines in the other order give the same `geometry_digest` (E5) |
| G7 | camber: rectangle of height 0.2 L and width Σ wᵢ, with n = k + 1 strips of width `w = round(2R sin(Φ/(2n)) · 10⁶)` q, creases between strips, all valley at Φ/n, root the first strip; k = 1, 2, 3, 5 | the posed cross-section polyline (the vertices at y = 0, in order): chord length 1 L within 1e-5 L; every vertex at distance R = 1.3 L from the circle centre within 1e-5 L (the centre lies on the chord's perpendicular bisector, at R − s = 1.2 L on the concave side); its largest deviation from the arc, `R − min over segments of the distance from the centre to the segment midpoint`, equals 0.025245, 0.011240, 0.006327, 0.002813 L within 1e-5 L. (1e-5 L covers the rounding of each width to a quantum) |
| G8 | G1 pose at θ = +179.999° (valley) and, with a mountain crease, at −179.999° | measured θ within 1e-7°; every edge length within τ |
| G9 | G1 pose at θ = 0 | the rest coordinates within τ (P6) |
| G10 | square split by x = ½ (crease `F`, valley) then `F.b` split by the line through (½, 0) and (1, 1) (crease `F.b`, mountain); angles `F` = +30°, `F.b` = −45°; roots `F.a` and `F.b.b` | all pairwise distances between all posed vertices equal between the two roots within τ (P4); every crease's two posed copies coincide within τ (P2) |
| G11 (v1.1) | G10 translated by (998, 998) L | as G10, with τ from the same diameter; the angle roundtrip judged under the `max(1, M)` threshold |
| G12 (v1.1) | a chain of 64 strips of width 15625 q (1/64 L) and height 1 L at x ∈ [998, 999] L, y ∈ [0, 1] L, all valley at 2.8125°; and G1 at θ = `nextafter(180, 0)` | P1 and P2 within τ, and the pose equals oracle PO within τ; the G1 roundtrip judged by the wrapped difference |
| G13 (v1.1) | G1 valley posed at θ = −0.0, and a mountain G1 at θ = 0.0 | both `ok`, each equal to the rest sheet within τ |
| G14 (v1.1) | the square split at x = 1000 q | `ok` with `min_altitude` 1000 (the strip's altitude equals it); `thin-panel` with 1001 |
| G15 (v1.1) | G1, then the canonical JSON of the **input** sheet | unchanged after `insert_crease` |

**Negative controls**, one cause each. Each must return exactly its code.

| ID | Input | Code |
|---|---|---|
| X1 | outline dart (0,0), (2,0), (1,0.5), (1,2) L; the pentagram with the vertices `[int(10⁶ cos(2πk/5)), int(10⁶ sin(2πk/5))]` q for k = 0…4, taken in the order 0, 2, 4, 1, 3; the bow tie (0,0), (1,1), (1,0), (0,1) L | `non-convex-panel` |
| X2 | the square with the midpoint (½, 0) inserted after (0, 0); the three points (0,0), (1,0), (2,0) L | `collinear-vertex` |
| X3 | outline square with a vertex repeated (consecutive; non-consecutive) | `duplicate-vertex` |
| X4 | a float coordinate, a `true` coordinate, a string, a missing point; assignment `"flat"` | `malformed-input` |
| X5 | coordinate 10⁹ + 1; 1025 outline vertices; 2 outline vertices; a 65th crease; `min_altitude` 4·10⁹ + 1 | `out-of-bounds` |
| X6 | face id `"Z"` | `unknown-face` |
| X7 | G1, then insert into `F` | `not-a-leaf` |
| X8 | p = q | `degenerate-line` |
| X9 | square, line x = 2 | `line-misses-panel` |
| X10 | square, line x = 1 (along an edge); line through (1, 1) and (2, 0) (touching one vertex) | `line-touches-boundary` |
| X11 | G1, then insert into `F.a` the line y = ½ (a T-junction on crease `F`); G1, then insert into `F.b` the line y = ½ (the crossing pair of operators §3.2) | `splits-crease` |
| X12 | the unit square (10⁶ q side), line through (0, 1) q and (1, 0) q, `min_altitude` 1000 | `thin-panel` (the corner triangle has altitude 1/√2 q). Without `min_altitude` the same insertion is `ok` |
| X13 | G1 pose with θ = 180, −180, 200 | `angle-out-of-range` |
| X14 | G1 (valley) pose with θ = −10 | `assignment-mismatch` |
| X15 | G1 pose with an extra key `"Q"`; with no key for `F` | `unknown-crease`; `missing-angle` |
| X16 | G1 pose with θ = NaN, `true`, `"90"` | `malformed-input` |
| X17 | G1 pose with root `F` (split) and root `"Z"` | `not-a-leaf`; `unknown-face` |
| X18 | precedence: an out-of-bounds p **and** an unknown face → `out-of-bounds`; a not-a-leaf face **and** p = q → `not-a-leaf`; on G10's sheet, angles `{"F.b": −200}` (`F` missing, `F.b` out of range) → `missing-angle` | as stated |

**Randomized and metamorphic properties** (seeded with `random.Random(seed)`, never the global generator):

| ID | Property | Cases |
|---|---|---|
| Q1 | Each split equals the clip oracle's two pieces exactly (vertex sets and canonical rings); the pieces are strictly convex; E2 holds exactly; every rejection's code equals the oracle's classification | seed 20261130: 300 cases. Outline: the exact hull of `randint(3, 36)` random integer points in ±10⁶ q, kept if it has 3–12 vertices. Line, by case index i mod 10: 0–4 random (two distinct random points in the outline's bounding box, enlarged to twice its size about its centre); 5 through a random outline vertex and a random point; 6 through two distinct random outline vertices; 7 along a random outline edge; 8 through a random outline vertex shifted by (1, 0) q, with a random direction; 9 through a random outline vertex and the outline's bounding-box centre |
| Q2 | After every accepted insertion of a random sequence: E3 (every vertex on ∂S), E4 (oracle adjacency from the face rings alone is a tree and equals the crease records), cover (Σ areas = \|S\| and pairwise face interiors disjoint, exact), naming rule, no subdivided crease; every rejected insertion's code equals the oracle's classification of the line against the face (misses, touches; and `splits-crease` when a chord endpoint is inside a crease) | seed 20261131: 100 sheets (outlines as Q1, up to 10 vertices), 16 attempted insertions each on a random current face. Line, by attempt index j mod 4: 0–1 random in that face's bounding box enlarged to twice its size; 2 through a random **integer** vertex of that face (outline vertices and integer crease endpoints, so fans occur) and a random point; 3 through two random integer vertices of that face |
| Q3 | Pose P1, P2, P4 and the angle roundtrip within the bands of §4.4, and the pose equals the independent oracle's pose within τ | the final sheet of each Q2 sequence; 3 angle assignments each from seed 20261136, uniform in (−179, 179) with signs that match the assignments, and a random root |
| Q4 | Allowed permutations (§5) give byte-identical canonical JSON | seed 20261132: 150 accepted cases (as Q1, random lines): a random rotation of the outline in both orientations, crossed with [p, q], [q, p] and [p + 3(q − p), p] when that point is within the bounds |
| Q5 | E5: non-crossing chord pairs commute (equal `geometry_digest`); crossing pairs are `splits-crease` in both orders | seed 20261133, on the unit square: four distinct boundary points are drawn as sorted perimeter parameters t₁ < t₂ < t₃ < t₄ in (0, 4·10⁶) q; the non-crossing pair is (t₁t₂, t₃t₄) and the crossing pair (t₁t₃, t₂t₄). **Fans** (v1.1): in every third draw, t₃ is replaced by t₂, so the non-crossing chords share an endpoint and must commute. "Touching" means meeting at a point of int X, which for two chords is the same as crossing. Identical chords are excluded. At least 100 of each class, and at least 30 fans |
| Q6 | Translation by an integer vector, a quarter turn about z, and a mirror x → −x map the result to the transformed result (`geometry_digest` of the transformed sheet; a mirror keeps assignments) | 50 accepted cases from seed 20261130 (as Q1, random lines), each under all three maps |
| Q7 | The digest does not change across `PYTHONHASHSEED` = 0 and 12345 | all fixtures |

## 9. Oracles, independent of the implementation

The oracles live in `oracles_o2.py`, which **must not import** `o2.py`; a test checks that.

| Oracle | Algorithm (different from the implementation) | Exactness |
|---|---|---|
| CL: clip | All face vertices on the closed side, plus every exact edge–line intersection; then an exact monotone-chain hull with collinear points removed | exact rationals |
| AR: area | Shoelace | exact |
| ADJ: adjacency | From the current face rings only: two faces are adjacent if they share a boundary segment of positive length (collinear edges with overlapping interiors). A partial overlap (one edge longer than the other) is reported as a subdivided crease. The graph must be connected with \|faces\| − 1 edges | exact |
| BD: boundary | Every vertex lies on a closed outline edge | exact |
| CV: cover | Σ areas = \|S\|, and every pair of faces has a separating axis among their edge normals with gap ≥ 0 | exact |
| PO: pose | Quaternion composition along a breadth-first search of the crease records from the root, with the axis orientation and sign of §4.2 recomputed from the face rings, and the float axis rule of §4.2 | float, τ |
| ANG: measured angle | The convention of §4.1 from the posed Newell normals of parent and child and the posed hinge | float, 1e-7° |
| CN: canonical form | Rings counter-clockwise from the smallest vertex, rationals in lowest terms, the naming rule of §3.5, sorted ids, crease face pairs equal to ADJ | exact |

## 10. Go / no-go for the M2 implementation

- **GO** if this contract, after one independent mathematical review, has no unresolved item. The freeze is then a new commit (v1.1 if amended) **before** any executable M2 script.
- **NO-GO** if any proof, fixture value, band or oracle stays disputed. Then nothing is implemented, and the disputed items are reported.
- **Verdict rules**, as in O1 v1.1 §10: an exact oracle that disagrees in one case is a FAIL; a float check outside its band is a FAIL; no oracle, fixture or band changes after a failure; one bounded revision of the implementation is allowed; a contract change is a new version that names the evidence it invalidates.

## 11. Corrections to the source texts (in the scope of M2)

| # | Source | Correction |
|---|---|---|
| K1 | Operators §3.2: "a rest angle θ ∈ [−π, π], whose sign fixes the assignment" | The assignment is recorded at insertion; θ is a pose parameter checked against it; ±180° is excluded (§4.1) |
| K2 | Operators §3.2: "`thin-panel` when ℓ passes within δ of a vertex" | `thin-panel` is the exact altitude test of O1 v1.1 §3.4 on each piece, only when `min_altitude` is given; no default threshold, because M2 has no object to justify one (GEO §1.9) |
| K3 | Operators §3.2 and lab §3: `closed-network` for "a crossing pair" | Unreachable in this domain (§3.3): a crossing pair returns `splits-crease` |
| K4 | Operators §3.2: "two insertions along lines that do not cross inside one panel commute" | Stated for chords within one face (E5); "posed states agree up to one rigid motion whichever root" is P4 |
| K5 | Lab M2 row: "a posed edge length changes beyond 1e-9" | The band is τ = 1e-9 · S in L (§4.4), the same scale as O1's net band |
| K6 | Operators §3.2: "a line ℓ ⊂ Π that meets the interior of P" | Touching the boundary only is a separate code, `line-touches-boundary`, so vertex and edge contacts are never confused with a miss |
| K7 | Lab §7: determinism "on two engines (P3D-6)" | Claimed only for exact outputs actually compared by a second implementation; never for floats (§4.4) |

## 12. Not verified in M2

Collision-free folding and global self-intersection; any folding motion; contact and thickness; physical crease behaviour; cross-engine float agreement; any visual reading of creases (P4's 8° is an assumption); composition with O1 (M3); seams (D-8); holes and multi-host attachments (D-9).

## 13. Versions

| Version | Commit | Change |
|---|---|---|
| v1 | `fc646c7` | first contract, before any M2 script |
| v1.1 | this commit | the review's amendments (§14), before any committed M2 script; no fixture value changed; fixtures G11–G15 added; generators frozen; the float axis rule, the wrapped roundtrip and the coordinate-scaled angle threshold added |

## 14. Independent review of v1 (2026-11-28)

**Reviewer.** A separate agent that wrote none of the contract. It worked on v1 (`fc646c7`) with its own implementation, quaternion oracle, clip oracle and generators, in Python, outside the repository.
- **Verdict: GO WITH AMENDMENTS.** Under §10 that meant no implementation until the amendments are written in, which v1.1 does.
- **Disclosure.** While the review ran, draft test, fixture and oracle files and a stub existed **uncommitted** in the worktree. No implementation existed. They are committed only after this freeze, in the red commit, updated to v1.1.

**Held:** E1–E5, the splits-crease rule, the boundary invariant, the tree, `closed-network` unreachable, the naming rule, the hinge sign derivation and P1–P6, including the parent swap, rerooting and the assignment checks at 0 and −0.0.

**Reproduced, with no mismatch:**
- G1–G10, including G6's equal `geometry_digest` and different full digest across the two orders.
- G7: R, Φ, the widths, the developed widths and the deviations. Posed chord error ≤ 1.55e-6 L, radius error ≤ 3.0e-7 L, deviation error ≤ 1.6e-7 L.
- X1–X18, with its own choices where inputs were not frozen.
- 1200 forced-mode splits; 150 random sheets for E3, E4 and the cover; 412 commuting pairs (269 fans) and 100 crossing pairs; 264 metamorphic cases.
- The pose against its quaternion oracle to 1e-6·τ, with a worst angle error of 8e-12°.

| # | Severity | Finding | Applied in v1.1 |
|---|---|---|---|
| 1 | major | near ±180° the measured sign comes from rounding (80 of 200 wraps at `nextafter(180, 0)`) | wrapped difference; the measured sign is never assignment-checked; G12 |
| 2 | major | the float axis direction was unspecified (6.2e-9 L > τ between two correct rules); the angle error grows with the distance from the origin, untested beyond ±2 L | exact-difference axis rule for both implementation and oracle; threshold `1e-3·max(1, M)` L; G11 and G12 |
| 3 | major | random lines never reach the degenerate paths; Q5 "touching" undefined; generators not frozen | forced modes in Q1 and Q2; Q5 defined, with fans; generators frozen |
| 4 | minor | numerator bound 2⁸⁰ wrong; label collision with E3 | 8·10²⁷ < 2⁹³; label renamed |
| 5 | minor | sort keys, outline storage, return shape and pose order undefined | §5 sort keys and output order |
| 6 | minor | pose malformed list incomplete; −0.0 not stated | completed; G13 |
| 7 | minor | some inputs not frozen; X18c not buildable on G1; G10 angles unassigned | X1, X2, X12, X18 and G10 made exact |
| 8 | minor | §1 cited §3.4 for the cycle; the 3-cycle and crossings were not explained | fixed |
| 9 | minor | no thin-panel boundary fixture and no immutability test | G14, G15 |
| 10 | minor | the altitude threshold was ambiguous for a crease; permutations could leave the bounds | both faces must meet it; permutations within the bounds |

**Freeze decision: GO** for the M2 implementation on v1.1. Every finding is applied, no fixture value changed, and no item stays disputed. Not verified by the review, left to M2 and its review: the real implementation and oracles, digest bytes, Q7, other platforms and engines, and exhaustive 1024-vertex and 64-crease behaviour at the coordinate bound.
