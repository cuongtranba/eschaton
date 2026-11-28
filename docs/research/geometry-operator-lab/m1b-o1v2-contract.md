# M1b: contract for O1 v2, tilted section planes (contract v2.0, draft for review)

- Status: **O1 contract v2.0, written before any executable v2 script.** Authorized by owner decision D-7 (research the tilted case; freeze before any experiment; [decision packet](../../review/art-1-raven-decision-packet.md) §0.4). Milestone label **M1b is proposed** (lab §10). Research, not a production API (D-1).
- **O1 v1.1 is unchanged.** [`m0-o1-contract.md`](m0-o1-contract.md), `o1.py`, its fixtures, oracles, tests and evidence stay exactly as frozen, and the v1.1 suite must keep passing. v2 is a separate contract with a separate module (`o1v2.py`), separate fixtures and separate oracles. v2 does not replace v1.1 on parallel planes: it rejects them (§6).
- Rule of this file: as for v1.1, nothing below changes after the first v2 implementation commit except by a new version appended in §13. Expected values are derived by hand (with the derivation stated), never tuned to an implementation.

## 1. Use cases, and where tilted sections are not needed

Tilted sections are **not** needed by every spine. They are needed when the two stations of one band are not parallel:

| Use | Example | Without v2 |
|---|---|---|
| U1. A curved spine whose stations are perpendicular to its tangent | the real `kit.loft` rings of the v5 head (v1.1 C10: the F6 fixture had to be idealised to parallel stations) | approximate by parallel stations, with the proven bound of §10, or not at all |
| U2. An oblique end cut | a wing root or a roof meeting a wall at an angle; an extrusion cut by a slanted plane (fixture T1) | not representable by v1.1 |
| U3. Two sections that approach their planes' common line | a hinge-like "book" (fixture T3) | not representable by v1.1 |

**Not needed:** a straight spine with stations perpendicular to it, which v1.1 covers in its frame. Also not needed: a spine whose tilt keeps the §10 bound within a tolerance the brief accepts. The brief must state that tolerance and its source; v2 sets none.

## 2. Scope

**In scope (one band):**
1. Two sections A and B, each a **strictly convex planar polygon** with at least 3 vertices, given by integer 3D vertices in quanta (`1 q = 1e-6 L`).
2. Their planes are **distinct and not parallel**. Their common line is called **L**.
3. **Mutual strict separation (the admissibility condition).** Every vertex of B lies strictly on one side of plane(A), and every vertex of A lies strictly on one side of plane(B).
4. The cut-open net of the band, by the unchanged v1.1 net builder (§5.3).

**Out of scope (rejected or not claimed):**

| Case | v2 behaviour | Reason |
|---|---|---|
| Parallel or coincident planes | `parallel-planes`, `coincident-planes` | v1.1's domain (for `z = const` planes) or out of scope; v2 makes no claim there |
| A point or a segment as a section (caps, wedges) | `degenerate-section` | a point or a segment has no plane, so the tilt is undefined; the v1.1 cap and wedge results are not extended without proof |
| Sections that touch or cross the other's plane | `sections-not-separated` | §3.1: then A or B is not a face of the hull, or they meet |
| Chains of tilted bands | **no function; not claimed** | §7: pairwise admissibility does not give global non-intersection |
| Non-convex sections, matched partitions | `non-convex-section`; partitions deferred | as in v1.1 |
| Folding motion, collision, seams as a physical process | not claimed | as v1.1 §6.3 |

## 3. Exact results (with proofs)

### 3.1 The hull is a closed band

Let `P = conv(A ∪ B)`.
- **A and B are facets.** All of B lies strictly on one side of plane(A), so plane(A) supports P and `P ∩ plane(A) = A`. The same holds for B.
- **A and B are disjoint.** A lies strictly on one side of plane(B), so no point of A is in B.
- **Every other facet is lateral.** It contains points of both sections. If it contained points of one section only, three affinely independent points of that section would span its plane, so it would be that section's facet.
- **The lateral surface is an annulus.** ∂P is a topological sphere, and removing the two disjoint open discs int A and int B leaves an annulus with boundary loops ∂A and ∂B. Every vertex of the hull is a vertex of A or of B, so the lateral surface has **no interior vertex** (χ = 0).

### 3.2 Lateral faces: triangles, trapezoids and quadrilaterals

For an outward normal ν of a lateral facet G, `G = conv(F_A(ν) ∪ F_B(ν))`, where `F_X(ν)` is the set of points of X that maximise `ν · x`.
- Because X is planar and ν is not normal to X (G is not X), `F_X(ν)` is one vertex or one edge of X.
- G is 2-dimensional, so at least one of the two support sets is an edge.

So G has 3 or 4 vertices:

| Kind | Support sets | Note |
|---|---|---|
| `triangle` | one edge, one vertex | owner `A` or `B` (the section that gives the edge) |
| `trapezoid` | two edges, **parallel** | owner `AB`. G is parallel to L. This is the only kind of quadrilateral v1.1 has |
| `quadrilateral` | two edges, **not parallel** | owner `AB`. **New in v2.** The two edge lines both lie in plane(G); one lies in plane(A) and one in plane(B), so they meet at the point `plane(G) ∩ L` |

- **No degenerate face.** No three vertices of a face are collinear, and a B vertex never lies on an A edge line, because that would put a B vertex in plane(A).
- **Adjacent lateral faces are never coplanar,** because they are distinct facets.
- **Count.** Every section edge belongs to exactly one lateral facet (it is shared by its section's facet and one other facet). Every lateral facet holds one or two section edges. So the number of lateral faces is **m + n − (number of two-edge faces)**. That replaces v1.1's `|D_A ∪ D_B|`: there is no common set of 2D directions.

### 3.3 Volume

- The volume is the exact signed tetrahedral sum over all faces, A and B included, oriented outward: `V = Σ_faces Σ_fan det(p₀, p₁, p₂) / 6`, an exact rational in q³.
- **The prismoidal formula is not used.** There is no family of parallel slices, and no mid-height section exists (§4).

### 3.4 Altitude: no bound from a separation

- v1.1's bound (every lateral face reaches h above its section edge) needs a uniform separation h. Tilted planes have none: the gap between A and B closes toward L.
- Fixture T3 with ε = 1 q has section edges of length 2 L, and still has a lateral strip of altitude √2 q. So a sliver needs neither a short **section** edge nor a small **global** separation. It is enough for the sections to come close to L.
- The minimum altitude is reported, and `thin-panel` is judged only when `min_altitude` is given, exactly as in v1.1 §3.4.

### 3.5 Intrinsic flatness and the net

- The lateral surface has no interior vertex (§3.1), so cut along one lateral edge it develops into the plane, uniquely up to a rigid motion including a reflection. This argument uses no parallel plane.
- The v1.1 net builder (contract v1.1 §6) uses only face vertices, outward face normals and the shared lateral edges. So it is applied **unchanged** to v2 bands, with the same τ and the same overlap classes. As in v1.1, **non-overlap is not a property** of the net; it is reported.

## 4. Results of v1.1 that do not apply to tilted inputs

These formulas are **not** reused for v2. They are not tested in v2, and nothing in v2 relies on them.

| v1.1 result | Why it fails or has no meaning for tilted planes |
|---|---|
| Slices `(1 − t)A ⊕ tB` (result 3) | there is no family of parallel planes between A and B. A pencil of planes through L does not give Minkowski combinations in general |
| Prismoidal volume `h/6 (|A| + 4|M| + |B|)` | needs parallel planes and a mid-height section; replaced by the tetrahedral sum (§3.3) |
| Face set by the sorted merge of 2D outward edge normals; count `|D_A ∪ D_B|` | there is no shared 2D direction space; replaced by §3.2 and its count |
| "Adjacent faces never coplanar" via the horizontal part `h·n` of the normals | still true, by a different reason (distinct facets) |
| Altitude bound from h (§3.2 of v1.1) | fails (§3.4, T3) |
| Refinement and `on_path` (results 6; v1.1 §3.5 and §5) | no Minkowski path is defined, so `on_path`, tessellation rings and their ring classes are undefined for tilted rings |
| Global non-intersection of a chain (v1.1 §3.5) | fails (§7, counterexamples CE1 and CE2) |
| Complexity "O(m + n) merge" | not claimed; the time is measured (§9) |

## 5. Frames, orientation and canonical form

### 5.1 Planes and frames

- **Plane of a section.** The primitive integer normal of the Newell vector of its ring, with the integer offset `d = n · v₀`. Exact.
- **Oriented normals.** `n_A` is oriented **toward B** (`n_A · b > d_A` for every vertex b of B) and `n_B` **away from A`. On parallel planes with A below, both would be +z, which is v1.1's convention.
- **2D predicates in a plane.** A section's plane is never re-parameterised by floats. Convexity is tested on the projection that drops the coordinate axis k with the largest `|n_k|` (ties to the smallest k). That projection is an affine bijection of the plane, so it preserves convexity, collinearity and the winding number; the orientation sign is multiplied by `sign(n_k)`.
- **Local frames for reports** (min altitude, dihedral, net) are float, exactly as in v1.1, and decide nothing.

### 5.2 Predicates (all exact)

- **Planarity:** every vertex satisfies `n · v = d` (`non-planar-section` otherwise).
- **Strictly convex:** in the projection above, the v1.1 §3.1 predicate (nonzero consecutive cross products of one sign and exactly one half-plane transition).
- **Parallel:** `n_A × n_B = 0`. Coincident: parallel and the same offset.
- **Separation:** the signs of `n_A · b − d_A` over all b are all strictly positive or all strictly negative, and likewise for A against plane(B).

### 5.3 Canonical form

- **Which section is A.** The section whose lexicographically smallest vertex `(x, y, z)` is smaller. The vertices of A and B are distinct (§3.1), so this is a total rule, independent of the argument order.
- **Rings.** Each ring is counter-clockwise about its oriented normal (§5.1), starting at its lexicographically smallest vertex.
- **Faces.** Face 0 holds ring A's edge from `a₀` to `a₁`. The faces follow in the order of ring A, so face k and face k + 1 share lateral edge k (cyclically). Each face's vertices are counter-clockwise seen from outside, starting at its first A vertex, in v1.1's patterns: `[a_i, a_{i+1}, b_{j+1}, b_j]` (two edges), `[a_i, a_{i+1}, b_j]` (A owns), `[a_i, b_{j+1}, b_j]` (B owns).
- **Serialization and digest** as in v1.1 §4.2. The float fields (`min_altitude`, `min_dihedral_deg`) are removed before hashing.
- **Allowed permutations:** any cyclic rotation and either orientation of each ring, and either argument order. For `ok`, all of them give byte-identical canonical JSON; for an error, the same code.

### 5.4 Band result

`section_transition_v2(a, b, min_altitude=None)`, where a section is `{"vertices": [[x, y, z], …]}`, returns `{"ok": true, "band": …}` or `{"ok": false, "error": {"code", "detail"}}`. No exception for an expected failure. The band has:

| Field | Content |
|---|---|
| `version` | `"o1-contract-v2.0"` |
| `topology` | `"closed-band"` |
| `ring_a`, `ring_b` | `{"vertices": [[x, y, z], …], "plane": [n_x, n_y, n_z, d]}`, oriented as §5.1 |
| `axis_direction` | the primitive integer direction of L, `prim(n_A × n_B)` |
| `faces` | `{"kind", "owner", "normal", "vertices"}`, with `normal` the primitive integer outward normal |
| `lateral_edges` | `[i_a, i_b]` index pairs into the rings |
| `newell_a`, `newell_b` | the Newell vectors of the rings (integers; twice the vector area) |
| `volume` | exact rational `[num, den]` in q³ |
| `min_altitude`, `min_dihedral_deg` | floats, reported only |

`cut_open_net` is v1.1's function, called on the v2 band unchanged.

## 6. Bounds, error codes and precedence

- **Bounds** (`out-of-bounds`): |x|, |y|, |z| ≤ 10⁹ q; 1 ≤ vertex count ≤ 1024 per section (0 is `out-of-bounds`); `min_altitude` as in v1.1. Every exact product stays below about 2²⁰⁰: Newell components ≤ 2⁶⁵ and tetrahedral determinants ≤ 2⁹⁵. These keep run time bounded and are not a budget.
- **Precedence (total):**
  1. `malformed-input` (as v1.1, for 3D vertices; any extra key is ignored, a `"z"` or `"normal"` key is not part of v2 and is `malformed-input`);
  2. `out-of-bounds`;
  3. `degenerate-section` (1 or 2 vertices);
  4. per section, the section with the smaller lexicographically smallest vertex first: `duplicate-vertex` → `collinear-vertex` → `non-planar-section` → `non-convex-section`;
  5. `coincident-planes`, then `parallel-planes`;
  6. `sections-not-separated` (B against plane(A) is checked first, then A against plane(B); the code is the same);
  7. `thin-panel`, by face in canonical order.

## 7. Chains of tilted bands: counterexamples, no claim

v2 has **no chain function**. Two counterexamples show why a pairwise check is not enough.

- **CE1, same side at a ring.** Take K = the square (±1, ±1, 0), A = the square (±½, ±½) in the plane z = 1 + x/4, and B = the square (±½, ±½) in the plane z = 2 − y/4. Each pair (A, K) and (K, B) is admissible. But A and B lie on the **same** side of plane(K), so both bands contain the points just above K's centre: the bands overlap. **Necessary condition** for a chain: at every interior ring K, its two neighbours lie strictly on opposite sides of plane(K).
- **CE2, opposite sides everywhere, and still an overlap.** Take the pencil of half-planes through the y-axis, at angles θ_i = 0°, 160°, 320°, 480° (= 120°) measured in the xz-plane. In each, put the section {r ∈ [1, 2]} × {y ∈ [−1, 1]}, quantised to quanta.
  - Each consecutive pair is admissible: the section at θ_j lies at signed distance `r sin(θ_j − θ_i) ≠ 0` from the plane at θ_i.
  - At rings 1 and 2, the neighbours lie on opposite sides (sin(∓160°) = ∓0.342).
  - Band 0 (0° → 160°) and band 2 (320° → 480°) still overlap. In the xz cross-section, a separating-axis computation gives a penetration depth of **1.286 L** (the derivation's own float check).

  So global non-intersection of a tilted chain is **NOT VERIFIED** by any pairwise or ring-wise rule here. It needs a global test (GEO-1.8) or a stronger condition, which is not proposed.

## 8. Fixtures and frozen expected results

Coordinates in L; the fixture file stores them ×10⁶ as integers. "Square" is (±1, ±1, 0). The columns A and B give the arguments in call order; the canonical A is chosen by §5.3.

| ID | A | B | Expected (exact unless marked ≈) |
|---|---|---|---|
| T1 (oblique cut, U2) | square | (1, 1, 2.5), (−1, 1, 1.5), (−1, −1, 1.5), (1, −1, 2.5), in the plane −x + 2z = 4 | 4 lateral faces: at x = 1 a `trapezoid` (a 2 × 2.5 rectangle) and at x = −1 a `trapezoid` (2 × 1.5), both parallel to L; at y = ±1 a `quadrilateral` each, whose section edges meet at L = {x = −4, z = 0}. All owners `AB`. V = 8 (the base area 4 times the mean height 2: a prism cut by a plane). Canonical A is the square. `n_A` = (0, 0, 1), `n_B` = (−1, 0, 2), `axis_direction` = (0, −1, 0) |
| T2 (tilt, triangles) | square | diamond (1, 0, 1.25), (0, 1, 1), (−1, 0, 0.75), (0, −1, 1), in the plane z = 1 + x/4 | 8 `triangle` faces, owners alternating `A` and `B`, as F1 of v1.1. V = **10/3**. *Derivation:* along the tilt family z = 1 + t·x with t ∈ [−¼, ¼] the face combinatorics stay those of F1 (checked at both ends and at 0 by the derivation's brute-force hull), so V is an affine function of t (each tetrahedron's determinant is linear in the B heights); the mirror x → −x maps t to −t and keeps V, so V is constant and equals F1's 10/3 |
| T3 (book, U3) | (0.5, −1, 0), (2, −1, 0), (2, 1, 0), (0.5, 1, 0) | (0, −1, 0.5), (0, 1, 0.5), (0, 1, 2), (0, −1, 2), in the plane x = 0 | L is the y-axis. 4 faces: the inner strip in x + z = 0.5 and the outer face in x + z = 2 (both `trapezoid`), and the faces in y = ±1 (`quadrilateral`, section edges meeting at the origin). V = 2 · (2 − ε²/2) = 4 − ε² with ε = 0.5: **V = 15/4**. Minimum altitude ≈ ε√2 = 0.70711 L. **Canonical A is the second argument** (its smallest vertex (0, −1, 0.5) precedes (0.5, −1, 0)): `n_A` = (1, 0, 0), `n_B` = (0, 0, −1), `axis_direction` = (0, 1, 0) |
| T3t | T3 with ε = 1 q | | V = (4·10¹⁸ − 10⁶) q³ exactly; with `min_altitude` = 1000 q: `thin-panel` (the inner strip has altitude √2 q ≈ 1.414 q, with section edges of 2 L) |
| T4 (near parallel) | square | diamond (10⁶, 0, 10⁶ + 1), (0, 10⁶, 10⁶), (−10⁶, 0, 10⁶ − 1), (0, −10⁶, 10⁶) q | accepted (not parallel); 8 triangles as F1; V = 10¹⁹/3 q³ = 10/3 L³ (T2's derivation with t = 10⁻¹²) |
| T5 (net) | T1 and T2 | | net congruence and seam residuals within τ (v1.1 §6.2); overlap classes reported, not required |

**Negative controls**, one cause each:

| ID | Input | Code |
|---|---|---|
| W1 | square with the vertex (1, 1) raised by 1 q; B as T2 | `non-planar-section` |
| W2 | F1 of v1.1 (square at z = 0, diamond at z = 1) | `parallel-planes` |
| W3 | two disjoint squares in z = 0 | `coincident-planes` |
| W4 | (a) B crosses plane(A): square and (0, −1, −1), (0, 1, −1), (0, 1, 1), (0, −1, 1); (b) B strictly on one side of plane(A) but A crosses plane(B): square and (0, −1, 1), (0, 1, 1), (0, 1, 2), (0, −1, 2); (c) touching: T3 with ε = 0 | `sections-not-separated` |
| W5 | a section with 1 vertex; with 2 vertices | `degenerate-section` |
| W6 | the v1.1 dart and pentagram placed in z = 0 with B as T2; a square with an edge midpoint; a repeated vertex | `non-convex-section`; `collinear-vertex`; `duplicate-vertex` |
| W7 | a float, `true`, a string, a missing key, a `"z"` key | `malformed-input` |
| W8 | a coordinate 10⁹ + 1; 1025 vertices; an empty list | `out-of-bounds` |
| W9 | T3t with `min_altitude` 1000 | `thin-panel` |
| W10 | precedence: a non-planar A and parallel planes → `non-planar-section`; parallel and not separated → `parallel-planes` | as stated |

**Randomized and metamorphic properties** (`random.Random(seed)` only):

| ID | Property | Cases |
|---|---|---|
| S1 | Lateral faces equal the brute-force hull oracle's lateral facets, as vertex sets (exact); canonical-form oracle (§11) holds | seed 20261134: 300 admissible pairs. Each section is a random strictly convex 2D polygon (exact hull of random points, m, n ∈ [3, 10], coordinates in ±10⁵) mapped into 3D by an integer affine map `o + u·e₁ + v·e₂` with `e₁`, `e₂` random non-parallel integer vectors with components in [−3, 3]; non-admissible pairs are redrawn, and the redraw count is reported |
| S2 | Kinds and count: m + n − (two-edge faces); every hull vertex on the inner side of every face plane (exact) | the S1 pairs, plus seed 20261135: 50 near-parallel pairs (B's plane normal = A's plus an integer tilt of size 1 against components ≥ 10³) |
| S3 | Volume: the implementation's tetrahedral sum equals the oracle's independent decomposition (exact) | S1, S2 and all fixtures |
| S4 | χ = 0, orientable, boundary loops ∂A and ∂B (oracle E) | the same |
| S5 | Integer translation, every one of the 24 rotations of the cube, a mirror, and scaling by k ∈ [2, 500] give the transformed result (as sets of faces; volume × k³; a mirror keeps the volume) | S1 pairs, 50 each |
| S6 | Allowed permutations give byte-identical canonical JSON | S1 pairs, 150 |
| S7 | The digest is independent of `PYTHONHASHSEED` (0 and 12345) | all fixtures |
| S8 | Net congruence and seam copies within τ; overlap classes reported | S1 pairs |
| S9 | Baseline: the v1.1 suite passes unchanged | `test_o1.py` |

## 9. Timing

Measured, not budgeted: median ms per band at m = n ∈ {8, 64, 512, 1024}, with the fitted exponent and the conditions (Python version, platform). The oracles' O(N⁴) is not timed.

## 10. Piecewise parallel approximation against the general hull (proven bound)

Replace B by its orthogonal projection π(B) onto the plane Π parallel to A at the offset `c = (max + min of n̂_A · b over B) / 2`.
- **Bound.** Each vertex moves by `|n̂_A · b − c| ≤ δ = (max − min of n̂_A · b) / 2`. The convex hull is 1-Lipschitz for the Hausdorff distance between point sets, so `H(conv(A ∪ B), conv(A ∪ π(B))) ≤ δ`. Also `δ ≤ r_B sin α`, where α is the angle between the planes and `r_B` the largest distance between two vertices of B divided by 2. *Proof:* b − b′ lies in plane(B), so `|n̂_A · (b − b′)| ≤ |b − b′| sin α`.
- **Worked numbers.** T2: n̂_A · b ranges over [0.75, 1.25], so δ = 0.25 L, a quarter of the separation: the approximation is poor there. A slope of 1/100 across a section of half-extent 0.07 L gives δ ≤ 0.0007 L.
- **Limits.** δ bounds the hull geometry, not the design: π(B) is a foreshortened B, so the profile changes by the factor cos α along the tilt direction. The bound is an upper bound and is not tight. It is **proven, not tested** in v2.

## 11. Oracles, independent of the implementation (`oracles_o1v2.py`, which must not import `o1v2.py` or `o1.py`)

| Oracle | Algorithm | Exactness |
|---|---|---|
| H3: hull facets | brute force over every triple of the m + n points: keep planes with all points on one side, group by primitive plane, take the points in each plane; drop the two facets equal to plane(A) and plane(B) **by their point sets**, never by a normal | exact, O(N⁴) |
| SP: support | every face plane has all points on the inner side or on it | exact |
| V3: volume | for each facet of H3, a fan from the facet's centroid (rational) and a cone from the centroid of all points: a decomposition different from the implementation's | exact |
| E: topology | V − E + F from the face lists; each interior edge used once in each direction; boundary loops equal ∂A and ∂B | exact |
| C′2: canonical | the choice of A; ring orientation from the Newell vector against the oriented normal; first-vertex and face patterns; outward normals; `lateral_edges` | exact |
| C, X | net congruence and separating-axis overlap, as v1.1 (reused from `oracles.py`) | float, τ |

## 12. Freeze gate and experiment

- **GO** for the experiment only if this contract, after one independent mathematical review, has no unresolved item, and the freeze is committed before any v2 script.
- The experiment is bounded: tests first (red), then `o1v2.py` (green), then at most one implementation revision. It is a laboratory script, never a production extension.
- **NO-GO** if a proof, fixture value or oracle stays disputed: then no v2 script is written, the contract stays a proposal, and every v2 item is reported NOT VERIFIED.

## 13. Versions

| Version | Commit | Change |
|---|---|---|
| v2.0 | this commit | first v2 contract, before any v2 script; v1.1 unchanged |
