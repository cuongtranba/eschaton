# M0: frozen contract for O1 section transition, laboratory scope M1 (contract v1)

- Status: **M0 contract v1, written before any executable laboratory script.** It is authorized by owner decision D-3 (M0–M1 only, in isolation; [decision packet](../../review/art-1-raven-decision-packet.md) §0.3). It is research, not a production API (D-1). It changes no package, app, experiment, Foldon contract, gate or open question.
- Source it narrows: [`geometry-operators.md`](../geometry-operators.md) §3.1 and §3.4 as frozen at `8c2bd53`, with their errata (§9 there), and [`geometry-operator-lab.md`](../geometry-operator-lab.md) §2, §3 and §8. Those texts are not edited. Where this contract differs from them, the difference is listed in §9 with its reason.
- Rule of this file: **nothing below may change after the first implementation commit** except by a new contract version, appended in §11, which says what changed and which evidence it invalidates. Expected values in §7 are hand-derived (closed forms in the table). They are never tuned to an implementation result.

## 1. Scope of contract v1

**In scope (M1):**
1. Two **parallel, strictly separated** section planes, `z = z_A` and `z = z_B` with `z_A ≠ z_B`, sharing one in-plane frame `(s, u)`, written here as `(x, y)`. The normal is +z.
2. Each section is one of:
   - a **strictly convex polygon** with at least 3 vertices;
   - a **segment**: exactly 2 distinct vertices;
   - a **point**: exactly 1 vertex.

   A segment or a point is allowed for at most one of the two sections.
3. A **chain** of such sections at strictly monotone heights. It is used only to classify the rings between consecutive bands (§5).
4. A **cut-open net** of one band and its overlap classification (§6). These are floating-point diagnostics with stated bands. They are not exact results.

**Out of scope in v1 (rejected or deferred, never silently accepted):**

| Case | v1 behaviour | Reason |
|---|---|---|
| Non-parallel section planes (a bent spine, a tilted `kit.loft` ring) | rejected `unsupported-plane` | Results 2, 4, 6 and the error bound need parallel planes (operators §9 item 2). The plane condition for tilted planes is a separate contract |
| Non-convex sections, matched convex partitions (`partition-twist`) | non-convex rejected `non-convex-section`; partitions deferred | the partition rule has no worked proof or fixture yet |
| Collinear or duplicate vertices | rejected, never removed | the operator never repairs input (operators §3.0). With a collinear vertex, a face could have five vertices, so result 1 would fail |
| Hausdorff approximation bound against a design target | not tested | it needs a target family and its modulus. It is **NOT VERIFIED** in M1 |
| Folding motion, rigidity, collision, thickness, seam closure as a physical process | not claimed | §6.3 |
| O2, O3, M2–M5 | not implemented | D-3 |

## 2. Units, input schema and finite bounds

- **Unit.** A coordinate is an integer number of **quanta**, with `1 q = 1e-6 L`. L is the object's reference length. The convention follows operators §3.4: positions quantised to 1e-6 L.
- **Input.** A section is `{"z": int, "vertices": [[int, int], ...]}`, with an optional `"normal": [int, int, int]`. If `normal` is present, it must be exactly `[0, 0, 1]`.
- **Integers only.** Python `bool` is not accepted as an integer. Floats, strings, NaN, missing keys, extra nesting or a non-list are `malformed-input`.
- **Bounds:**
  - |x|, |y| ≤ 10⁹ q (1000 L);
  - |z| ≤ 10⁹ q;
  - 1 ≤ vertex count ≤ 1024 per section;
  - a chain has 2 to 64 stations.

  A violation is `out-of-bounds`. The bounds are chosen so that every intermediate exact product stays below about 2¹³⁰. They keep test run time bounded and are **not** a production budget.
- **Optional parameter** `min_altitude`: an integer in quanta, at least 1. When given, a face whose altitude (§3.4) is below it is rejected as `thin-panel`. The default is no threshold: the minimum altitude is then reported but never judged. M1 has no object, so it justifies no threshold value (GEO §1.9).

## 3. Definitions and exact results (with proofs or derivations)

Let A lie in `z = 0` and B in `z = h`, with `h > 0`. This is reached by a translation and, if `z_A > z_B`, by swapping the arguments (§4.2).

### 3.1 Support sets and edge directions

- For a horizontal direction `n ≠ 0`, the **support value** is `h_X(n) = max_{p ∈ X} n·p`, and the **support set** `F_X(n)` is the set of points of X attaining it.
- For a strictly convex polygon, `F_X(n)` is either one edge, when n is that edge's outward normal direction, or one vertex.
- **Direction sets:**
  - D_X is the set of outward edge-normal **directions** of X. Directions are compared exactly: two integer vectors are the same direction if their cross product is 0 and their dot product is positive.
  - A strictly convex m-gon has m distinct directions.
  - A segment `[b₀, b₁]` has the two opposite directions ±(b₁ − b₀)^⊥.
  - A point has none.

### 3.2 Lateral faces (results 1 and 2, parallel planes)

**Claim.** The faces of `conv(A ∪ B)` other than A and B are exactly:

`G(n) = conv(F_A(n) × {0} ∪ F_B(n) × {h})`, for each n ∈ D_A ∪ D_B.

Each is a planar polygon with 3 or 4 vertices.
- **Triangle:** exactly one of `F_A(n)` and `F_B(n)` is an edge.
- **Trapezoid** (two parallel section edges): both are edges. This includes the parallelogram and the rectangle.

There is no other lateral face, and **adjacent lateral faces are never coplanar**.

*Proof.*
1. **Every lateral facet contains points of both sections.** A facet is a maximal face of the hull. If it contained points of A only, its three affinely independent points would lie in `z = 0`, so it would be A itself. The same holds for B.
2. **Its outward normal.** Write the outward normal of a non-horizontal supporting plane as `ν = (n, c)` with `n ≠ 0`. On A it attains `n·a`, and on B it attains `n·b + c·h`. If the plane touches both sections, then `h_A(n) = h_B(n) + c·h`, so `c = (h_A(n) − h_B(n)) / h`. That value is unique for each n.
3. **The face itself.** The touched set is `F_A(n) × {0} ∪ F_B(n) × {h}`, and the face is its convex hull. It is 2-dimensional exactly when at least one of the two support sets is an edge. If both are vertices, the face is a segment: a lateral edge.
4. **Parallel edges in a trapezoid.** When both support sets are edges, both are perpendicular to n and horizontal, so they are parallel.
5. **No two lateral faces are coplanar.** The normal `(h·n, h_A(n) − h_B(n))` has horizontal part `h·n`. For distinct directions those horizontal parts point in different directions, because `h > 0`. So no two lateral faces are coplanar, and every lateral edge has a nonzero dihedral angle. ∎

**Count.** The number of faces is `|D_A ∪ D_B| ≤ m + n`, and they come out in angular order of n. A direction shared by A and B gives one trapezoid, never two faces. Opposite directions never merge.

**Altitude bound.** Measured in its own plane, every lateral face is at least h away from each of its section edges, because the other section lies at height h. A **sliver**, meaning a small altitude, can therefore arise only from a **short edge**. A triangle with base ℓ and opposite sides of length s has altitude `ℓ·d/s` to those sides, where d ≥ h. Near-parallel directions do **not** make slivers: they make two full-size faces that meet at a small dihedral angle (correction C4, §9).

### 3.3 Slices, volume and refinement (results 3, 4, 6)

1. **Slice.** For 0 < t < 1, the slice at height `t·h` is `(1 − t)A ⊕ tB`. The proof is operators §3.1 result 3, reproduced by the earlier independent review.
2. **Volume.** The slice area is quadratic in t, so Simpson's rule is exact: `V = h/6 · (|A| + 4|M| + |B|)`, with `M = ½A ⊕ ½B`. This holds for every polyhedron whose vertices lie in two parallel planes. A point or a segment has area 0.
3. **Refinement.** If K = (1 − s)A ⊕ sB is placed at height `s·h`, then `O1(A, K) ∪ O1(K, B) = O1(A, B)` as point sets.
   - For every K edge, the face below and the face above lie in one plane: the face of O1(A, B) for that direction. The edge has dihedral 0, so it is a **tessellation edge** (method §4.1).
   - Every K vertex is `(1 − s)a + s·b` for a lateral edge (a, b) of O1(A, B). It lies on that edge, so its total face angle is exactly 360°.
4. **Off-path keyframe.** A keyframe off the path gives a **seam between two sheets**, not a fold (operators §9 item 1). At a vertex whose total face angle differs from 360°, no fold can flatten the vertex into one sheet.
5. **Mixed ring (new).** Some ring edges can be coplanar, with dihedral 0, while the ring's vertices still carry angle defect. Dissolving those edges does **not** make the ring one developable sheet. Fixture F12 (§7) is such a ring.

### 3.4 Panel altitude (exact)

For a face P and an edge (p, q) of P, the edge's height is `max over vertices r of P of dist(r, line pq)`. The **altitude of P** is the minimum of that height over its edges.

The comparison with `min_altitude = t` is exact. It uses `|(q − p) × (r − p)|² < t² |q − p|²`, on integers.

### 3.5 Chain

- The heights `z₀ < z₁ < … < z_k` are strictly increasing; a strictly decreasing input is reversed (§4.2).
- A point or a segment is allowed only at station 0 or station k.
- **Global non-intersection, in scope.** Band i lies in the closed slab `z_i ≤ z ≤ z_{i+1}`. Two bands whose slabs share no plane are therefore disjoint. Bands i and i+1 meet only in the plane `z_{i+1}`, where each band's intersection is exactly ∂K_{i+1}. So the chain has no intersection other than its shared rings. ∎
- **Outside scope.** This argument fails for non-parallel planes. There, consecutive pairs that each meet the plane condition do not make a chain globally non-intersecting: a spine that turns sharply can bring band i into band i + 2. v1 claims nothing there (correction C1).

## 4. Output, canonical form and determinism

### 4.1 Band result (exact)

The operator returns `{"ok": true, "band": …}` or `{"ok": false, "error": {"code": …, "detail": …}}`. **No exception is raised for an expected failure.**

A band has the following fields:

| Field | Content |
|---|---|
| `topology` | One of three values. `closed-band`: both sections are polygons, the surface is an annulus with boundary loops ∂A and ∂B, and Euler characteristic V − E + F = 0. `disc-cap`: one section is a point; the surface is a disc whose boundary is the polygon's loop, with χ = 1. `disc-wedge`: one section is a segment; the surface is a disc whose segment is an interior **ridge** edge, with χ = 1. A degenerate result is never labelled an annulus |
| `ring_a`, `ring_b` | Canonical vertex lists, in quanta, with their z |
| `faces` | In canonical order. Each face has: `kind` (`triangle` or `trapezoid`); `owner` (`A`, `B` or `AB`); `direction`, the primitive integer outward 2D normal n; `normal`, the primitive integer outward 3D normal; and `vertices`, a list of `[x, y, z]` integers |
| `lateral_edges` | `[i_a, i_b]` index pairs into the rings. Edge k is shared by face k and face k + 1, cyclically |
| `area_a`, `area_b`, `area_mid` | Exact rationals `[num, den]`, with den > 0 and the fraction in lowest terms, in q² |
| `volume` | The exact rational `h/6 · (|A| + 4|M| + |B|)`, in q³ |
| `min_altitude` | The smallest face altitude, as a float in q (reported only) |
| `min_dihedral_deg` | The smallest bend at a lateral edge: the angle between the outward normals of the two faces, as a float in degrees (reported only; 0 would mean coplanar, which is impossible by §3.2) |

### 4.2 Canonical form (representation only, never geometry)

- **Allowed input permutations:**
  - any cyclic rotation of a vertex list;
  - either orientation;
  - the order of the two sections.

  All of them give **byte-identical canonical JSON**. That is a representation choice, not a repair. No vertex is added, removed or moved.
- **Rings.** Each ring is counter-clockwise seen from +z, and starts at its lexicographically smallest `(x, y)` vertex.
- **Faces.** They are ordered by increasing angle of their direction in [0, 2π), measured counter-clockwise from (1, 0). The comparison is exact: first the half-plane (`y > 0`, or `y = 0` and `x > 0`, comes first), then the sign of the cross product.
- **Face vertices.** Each face is counter-clockwise seen from outside, starting at the first A vertex of its support set:
  - shared direction: `[a_i, a_{i+1}, b_{j+1}, b_j]`;
  - A owns the direction: `[a_i, a_{i+1}, b_j]`;
  - B owns the direction: `[a_i, b_{j+1}, b_j]`.
- **Serialization.** Canonical JSON uses sorted keys, no spaces and integers as JSON integers. Its SHA-256 is the result **digest**.

### 4.3 Determinism

- Every topological decision is an exact integer or rational predicate on the quantised inputs. No float decides a face, an order, a classification or an error.
- Floats appear only in reported measurements: `min_altitude`, `min_dihedral_deg`, net coordinates and angle sums.
- The canonical digest does not include those floats. It may be printed beside them.
- Determinism is tested as follows:
  - the same digest under every allowed permutation;
  - the same digest in two processes started with different `PYTHONHASHSEED` values.
- **Cross-engine determinism (P3D-6) is not claimed** unless a second implementation, on another engine, is actually compared (§8).

## 5. Ring classification in a chain

For each interior station K:

| Report | Rule | Exact? |
|---|---|---|
| Per K edge: `dissolvable` or `seam-dihedral` | `dissolvable` if the face below and the face above are coplanar, which is tested as a 4-point determinant equal to 0, and their outward normals agree | exact |
| Ring kind | `tessellation-ring` if every edge is dissolvable **and** every vertex is flat (next row); `seam-ring` if no edge is dissolvable; `mixed-ring` otherwise | exact for the edges; vertex flatness as in the next row |
| Per K vertex: the total face angle (below plus above) | flat if \|sum − 360°\| ≤ 1e-9°; otherwise defect, reported with its value | float, with the stated band. For an on-path K, flatness also follows exactly from §3.3 item 3 |

## 6. Cut-open net (floating-point diagnostic)

### 6.1 Construction

- **Cut.** The band is cut along the lateral edge between face f − 1 and face f, cyclically; the default is f = 0. Face f is placed first.
- **Placing faces.** Face f's edge from its vertex 0 to its vertex 1 (canonical order, §4.2) is placed on the positive x-axis from (0, 0), with the face on the +y side. Faces f + 1, f + 2, … follow. Each is unfolded across the lateral edge it shares with the previous face, to the side opposite that face.
- **Arithmetic.** float64, with L = 1. Quanta are converted by multiplying by 1e-6.

### 6.2 Checks and bands

`S = max(1, diameter of the band in L)`. The bands are `τ = 1e-9 · S`.

| Check | Rule |
|---|---|
| Congruence | For every face, every pairwise vertex distance in the net equals the same distance in 3D within τ. Reported: the worst residual |
| Seam copies | The cut edge appears twice in the net, once on the first face and once on the last. Both copies equal the 3D edge length within τ |
| Overlap | For every pair of faces, compute the separating-axis value σ: the largest gap over the edge normals of both convex polygons. Positive means a gap; negative means penetration depth. The classification follows the next table |

| σ | Pair shares a band edge or vertex at the same net position | Pair shares nothing |
|---|---|---|
| σ > τ | `disjoint` | `disjoint` |
| \|σ\| ≤ τ | `legal-contact` | `touching` (reported; not counted as overlap) |
| σ < −τ | `overlap` | `overlap` |

**Interior check for a shared-edge pair.** For a pair that shares an edge, the interiors are also checked: the two third vertices must lie strictly on opposite sides of the shared edge line, by more than τ. Otherwise the pair is `overlap` if they are on the same side by more than τ, and `inconclusive` if they are within τ.

### 6.3 What the net does not show

- A non-overlapping net is a **flat layout of one band cut open**. It does **not** show a collision-free folding motion from flat. It does not show that a chain of bands is one foldable sheet. It does not show that the cut seam can be re-closed by a physical process, that a closed band of creases is rigid or foldable, or anything about thickness.
- The planarity of the hull faces is **necessary, not sufficient**, for physical folding.
- The closed band itself would be a closed crease ring. Foldon creases form a tree, so the band needs a seam (Q1, Q2) or a decision on Q4 (operators §3.1).

## 7. Fixtures and frozen expected results

Coordinates are given in L, and the fixture files store them ×10⁶ as integers. h is the separation `z_B − z_A`.

| ID | A (z = 0) | B (z = h) | h | Expected (exact unless marked ≈) |
|---|---|---|---|---|
| F1 | square (±1, ±1) | diamond (0, ±1), (±1, 0) | 1 | `closed-band`; 8 faces, all triangles, alternating owner A and B. The A-owned faces are right isosceles, with sides 2, √2, √2, and lie in x = ±1 and y = ±1. The B-owned faces are equilateral with side √2 and lie in the planes ±x ± y + z = 2. Face angle sums: 150° at each square vertex and 210° at each diamond vertex (≈, 1e-9°). \|M\| = 7/2. V = 10/3. Net with first face 0: no `overlap`, no `inconclusive`. Its 10 points, in order of first placement, are ≈ (0,0), (2,0), (1,1), (2.366,1.366), (3.732,1.0), (3.366,2.366), (4.732,2.732), (3.732,3.732), (4.732,4.732), (3.366,5.098), each within 5e-4 L. The order is the three vertices of face 0, then one new vertex per later face. Closed forms: (3+√3)/2 = 2.366 and 2+√3 = 3.732 |
| F2 | square (±1, ±1) | the same square | 1 | 4 faces, all trapezoids (rectangles 2 × 1), owner AB; V = 4; \|M\| = 4 |
| F3 | square (±1, ±1) | square + (0.5, 0.25) | 1 | 4 trapezoids (parallelograms); V = 4 (Cavalieri) |
| F4 | square (±1, ±1) | square (±0.5, ±0.5) | 1 | 4 trapezoids; \|M\| = 9/4; V = 7/3 |
| F5 | rectangle (±1, ±0.5) | rectangle (±1.5, ±0.5) | 1 | an aspect change with **4 trapezoids and no triangle** (correction C5); \|M\| = 5/2; V = 5/2 |
| F6 | v5 `PENT` at x = 0.322: `diag(0.068, 0.076)·PENT + (0, 0.037)` | v5 `PENT` at x = 0.268: `diag(0.056, 0.054)·PENT + (0, 0.011)` | 0.054 | Source: `c2f5_sumi_flight.py` @ `41c383f` (`build()`: `head` rows 3 and 4, with z + 0.035), SHA-256 `3bceb9c2…cae320`. The input is clockwise, as in the source. **Idealised**: parallel stations perpendicular to the spine. The real `kit.loft` rings are tilted by the spine tangent, which is out of scope. Expected: 9 faces, of which 1 trapezoid (direction (0, −1), owner AB) and 8 triangles. Reported, not frozen: the index-matched loft's quad warp in this idealised frame, by the named metric "distance between the two diagonals" (operators §9 item 5) |
| F7 | square (±1, ±1) | point (0, 0) | 1 | `disc-cap`; 4 triangles, owner A; χ = 1; \|M\| = 1; V = 4/3 |
| F8 | square (±1, ±1) | segment (−0.5, 0)–(0.5, 0) | 1 | `disc-wedge`; 4 faces: 2 trapezoids (±y, owner AB) and 2 triangles (±x, owner A); χ = 1; \|M\| = 3/2; V = 5/3 |
| F9 | square (±1, ±1) | segment (−0.5, −0.5)–(0.5, 0.5) | 1 | `disc-wedge`; 6 triangles; χ = 1 |
| F10 | chain: square (±1, ±1) at z = 0, octagon (±1, ±½), (±½, ±1) at z = 1, diamond at z = 2 | — | — | The octagon is ½A ⊕ ½B, on the path. Every K edge is `dissolvable`, every K vertex is flat (360°), and the ring is a `tessellation-ring`. Merging the coplanar faces across K gives exactly the faces of O1(square at 0, diamond at 2) |
| F11 | chain: square, diamond, square at z = 0, 1, 2 | — | — | `seam-ring`: 4 edges `seam-dihedral`; each diamond vertex 420° ≈ |
| F12 | chain: square (±1, ±1), rectangle (±1.5, ±1), square (±1, ±1) at z = 0, 1, 2 | — | — | `mixed-ring`: the ±y edges are `dissolvable` and the ±x edges are `seam-dihedral`. Each K vertex 2·(atan2(1, ½) + 90°) = 306.87° ≈ (0.01°) |
| F13 | chain: squares of side 2, 1, 2 (waist) | — | — | `seam-ring`; K vertices 4·(180° − atan2(√1.25, ½)) = 456.38° ≈ (0.01°) |
| F14 | chain: squares of side 1, 2, 1 (bulge) | — | — | `seam-ring`; K vertices 4·atan2(√1.25, ½) = 263.62° ≈ (0.01°) |
| F15 | A = square (±1, ±1); B = A with its (1, 1) corner chamfered by 1 q on each side | — | 1 | With `min_altitude` = 1000 q: `thin-panel`. Without a threshold: a band whose `min_altitude` is reported below 2 q ≈ |
| F16 | A = square (±1, ±1); B = A rotated 0.1° and rounded to quanta | — | 1 | 8 triangles; **not** `thin-panel` at `min_altitude` = 1000 q, because the faces are full size (C4). `min_dihedral_deg` ≈ 0.224° (between 0.20 and 0.25). Derivation: the outward normals of the A face at direction 0 and the B face at direction 0.1° are about (1, 0, −0.001745) and (cos 0.1°, sin 0.1°, +0.001745), which are 0.0039 rad apart |

**Negative controls**, one cause each. Each must return exactly its code.

| ID | Input | Code |
|---|---|---|
| N1 | dart quadrilateral (0,0), (2,0), (1,0.5), (1,2) | `non-convex-section` |
| N2 | pentagram: the five points of a regular pentagon taken in star order (all turns one way, winding 2) | `non-convex-section` |
| N3 | bow tie (0,0), (1,1), (1,0), (0,1) | `non-convex-section` |
| N4 | square with the midpoint (1, 0) of an edge inserted | `collinear-vertex` |
| N5 | three collinear points | `collinear-vertex` |
| N6 | square with a vertex repeated, consecutive | `duplicate-vertex` |
| N7 | square with a vertex repeated, non-consecutive | `duplicate-vertex` |
| N8 | z_A = z_B | `coincident-planes` |
| N9 | `normal` = [0, 1, 1] | `unsupported-plane` |
| N10 | point and point; point and segment; segment and segment | `degenerate-band` |
| N11 | a float coordinate, a `true` coordinate, a string, a missing key | `malformed-input` |
| N12 | coordinate 10⁹ + 1; 1025 vertices; 65 chain stations | `out-of-bounds` |
| N13 | chain with a degenerate interior station | `degenerate-interior-station` |
| N14 | chain with heights 0, 2, 1 | `non-monotone-stations` |

**Error precedence** (deterministic): `malformed-input` → `out-of-bounds` → `unsupported-plane` → `coincident-planes` → section A checks, then section B checks (`duplicate-vertex` → `collinear-vertex` → `non-convex-section`) → `degenerate-band` → `thin-panel`. Chains check `non-monotone-stations` and `degenerate-interior-station` before the per-band checks. The `detail` names the section and the vertex index.

**Randomized and metamorphic properties** (seeded with `random.Random(seed)`; never the global generator):

| ID | Property | Cases |
|---|---|---|
| R1 | O1 faces equal the brute-force hull oracle's lateral facets, as sets of vertex sets (exact) | seed 20261128, 300 pairs, m, n ∈ [3, 12], coordinates in ±10⁶ q, h ∈ [1, 2·10⁶] |
| R2 | Face count equals \|D_A ∪ D_B\|; all faces are triangles or trapezoids; every face plane supports all vertices (exact) | the same pairs, plus 20 pairs with m, n up to 1024 (points on a circle of radius 5·10⁸ q at seeded random angles, then an exact hull with collinear points dropped) for support only |
| R3 | The slice at t ∈ {1/7, 1/2, 5/6} equals the brute-force Minkowski hull `(1 − t)A ⊕ tB` (exact rational) | R1 pairs |
| R4 | Volume by the prismoidal formula equals the volume by signed tetrahedra over all faces including the caps (exact rational) | R1 pairs and all fixtures |
| R5 | Translation by an integer vector, a quarter turn about z, a mirror, and scaling by an integer k ≥ 2 give the transformed result (exact; volume × k³ under scaling) | R1 pairs, 50 each |
| R6 | Every allowed permutation (§4.2) gives an identical digest | R1 pairs |
| R7 | The digest does not change across `PYTHONHASHSEED` = 0 and 12345 | all fixtures |
| R8 | Net congruence and seam-copy residuals stay within τ; overlap classification is reported, not required to be empty | R1 pairs |

## 8. Oracles: independent of the implementation

The oracles live in `oracles.py`, which **must not import** the implementation module. A test checks this.

| Oracle | Algorithm (different from the implementation) | Exactness |
|---|---|---|
| H: hull facets | Brute force over every triple of input points: keep the planes with all points on one side, group the triples by their primitive integer plane, and take the extreme points of each group. Then drop the two section planes, when they are faces | exact integers, O(N⁴) |
| S: support | Every face plane, with all points on the inner side or on the plane; every face's vertices in that plane | exact |
| K: Minkowski slice | All pairwise sums `(1 − t)a + tb`, then an exact monotone-chain hull with collinear points removed | exact rationals |
| Vt: tetrahedral volume | The sum of `det(p₀, p₁, p₂)/6` over the fan triangles of every face, with A reversed | exact rationals |
| Ar: section area | Shoelace | exact rationals |
| C: net congruence | The pairwise distances of the 3D and 2D vertices | float, τ |
| X: overlap | The separating-axis test of §6.2, written independently of the net builder | float, τ |
| E: Euler characteristic | V − E + F, computed from the face vertex lists alone | exact |

**Cross-implementation check.** The independent reviewer writes their own oracle, in a language and engine of their choice. They compare canonical results on the fixtures. That is agreement between implementations. It is P3D-6 evidence only for the cases actually compared.

## 9. Corrections to the frozen operator text (in scope of v1)

| # | Frozen text (operators §3.1 or lab) | Correction |
|---|---|---|
| C1 | Plane condition "so neighbouring sections never cross" | For parallel, strictly monotone stations, the chain is globally non-intersecting (§3.5 proof). For non-parallel planes, the pairwise condition does not give global non-intersection. Not claimed |
| C2 | Codomain "a polyhedral annulus" | Only when both sections are polygons. A cap is a disc, and a wedge is a disc with an interior ridge (`topology`) |
| C3 | Result 1 "every lateral face is a triangle or a quadrilateral" | Needs strictly convex input. With a collinear vertex, a face can have 5 vertices. v1 rejects collinear vertices (`collinear-vertex`) |
| C4 | Adversarial row: near-parallel directions give "a sliver triangle with an angle of about α" | For parallel planes, faces always reach h from their section edge (§3.2). Near-parallel directions give two full-size faces at a small dihedral angle, below line visibility. Slivers come from **short edges** (F15, F16) |
| C5 | "An aspect-only family … is not a frustum … the hull gains triangles" | Correct for edges off the axes. It does not generalize: an axis-aligned rectangle under `diag(a, b)` keeps every direction, which gives 4 trapezoids and no triangle (F5). The lateral edges are then not concurrent, so it is not a pyramid frustum either |
| C6 | Result 5 "lays out uniquely, up to a rigid motion" | It is unique up to a rigid motion **including a reflection**, for a fixed cut. A non-overlapping net shows nothing about folding motion, single-sheet foldability, physical seam closure or rigidity (§6.3) |
| C7 | Result 6 "must be dissolved" | Correct for on-path rings: every ring edge has dihedral 0 and every ring vertex totals 360°. Dihedral-0 edges alone do not make a ring a tessellation ring when its vertices carry defect (§3.3 item 5, F12) |
| C8 | §3.4 "ties broken by exact comparison on the quantised inputs" | Implemented as exact integer and rational predicates throughout. Quantisation alone was not enough (operators §9 item 4) |
| C9 | "O(m + n) per band"; lab §5 "time linear in panels per band" | The edge merge is O(m + n) on sorted, validated input. Validation is O(m log m) with full duplicate detection. Exact arithmetic is bounded by the input bounds. The net overlap test is O(F²), and oracle H is O(N⁴). Time is **measured and reported**; no linear-time promise is made beyond the merge |
| C10 | Lab M1: "v5 `PENT` pair … matched loft warps 0.0039 L" | Replaced by the idealised parallel-station fixture F6 with the named metric. The actual tilted `kit.loft` frames are out of scope (the reviewer's values: 0.0089 L corner-to-plane, 0.0032 L between the diagonals) |
| C11 | Lab M1: "cap (B a point), wedge (B a segment)" | Either section may be the degenerate one; the arguments are symmetric under the swap. Both degenerate is `degenerate-band` |

## 10. Go / no-go for M1

- **GO** if this contract, after one independent mathematical review, has no unresolved item. Then M1 implements exactly §1–§8 with tests written first.
- **NO-GO** if any proof, fixture value or oracle definition stays disputed. Then M1 is not implemented, and the disputed items are reported.
- **M1 verdict rules** (per contract item, PASS, FAIL or NOT VERIFIED):
  - an exact oracle that disagrees in even one case is a **FAIL**;
  - a float check outside its band is a **FAIL**;
  - neither an oracle nor a band is changed after a failure;
  - one bounded revision of the implementation is allowed; a revision of the contract is a new version (§11) that invalidates the evidence it affects.

## 11. Versions

| Version | Commit | Change |
|---|---|---|
| v1 | this commit | first contract, before any laboratory script |
