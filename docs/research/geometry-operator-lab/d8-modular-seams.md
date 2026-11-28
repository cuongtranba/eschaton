# D-8: modular seams between separate sheets (research, design and mathematics only)

- Status: **research note under owner decision D-8** ([decision packet](../../review/art-1-raven-decision-packet.md) §0.4). It prefers modular seams between separate sheets over closed crease networks as the **research direction**. It is **not** a production answer to Q1, Q2 or Q4, it does not accept ADR 0019, and it implements nothing: there is no seam engine, attachment engine or closed-network code. Multi-host attachments, holes and advanced seam topology are deferred to M4 (D-9; lab §10.1).
- Builds on: O1 v1.1 (its bands and nets), the M2 contract (one sheet with a crease tree), and the operators erratum that every off-path O1 ring is a seam ([operators](../geometry-operators.md) §9 item 1).

## 1. Why seams, and why not closed crease networks

1. **Some joins cannot be folds.** Folding never changes the angle sum at a vertex, and a vertex folded from one flat sheet totals exactly 360°. An off-path O1 ring has vertices with other totals (420°, 456.38°, 263.62°, 306.87°, 327.48° in v1.1 fixtures F11–F14 and F17). So those rings **must** be cuts between sheets, whatever else is decided.
2. **A seam keeps each sheet a tree.** Inside each sheet, M2's result E4 holds: creases form a tree, and a pose is a product of rotations along tree paths, with no closure condition. All closed loops are moved into seams, where they are explicit, named constraints with a residual.
3. **A closed crease network is a different problem.** Every interior vertex of degree d must satisfy the rotation-product condition (belcastro and Hull 2002) for rigid folding, and Kawasaki–Justin for flat folding. Those conditions generally remove degrees of freedom and couple all creases around the vertex. That is Q4, and D-8 does not pursue it.
4. **Seams do not remove closure; they localise it.** A cycle of seams still needs the transforms around the cycle to compose to the identity (example CX4). The gain is that the closure is a residual on named boundary pairs, checked in a target pose. It is not a hidden condition on every crease.

## 2. Definitions

| Term | Definition |
|---|---|
| **Sheet** | One M2 sheet: an outline S in its own rest plane, its faces and its crease tree, with a **sheet id** that is unique in the object. A sheet's identity does not change when another sheet is posed, seamed or detached |
| **Boundary chain** | ∂S as an ordered ring of **boundary segments**. By M2 E3, every face vertex lies on ∂S, so ∂S is the outline subdivided at the chord endpoints. It is ordered counter-clockwise seen from the sheet's front, starting at the lexicographically smallest outline vertex |
| **Canonical boundary id** | `(sheet id, k, j)`: outline edge k in the canonical outline ring, sub-segment j along that edge from its start. It is exact, because chord endpoints are exact rationals, and it is independent of the order of insertions (M2 E5). Re-splitting a face never moves an existing boundary point, so ids are stable under later insertions, apart from appending sub-segments |
| **Seam** | A declared pairing of a run of consecutive boundary segments of sheet P with a run of sheet Q. P = Q is allowed: a **self-seam**, such as the cut of a band's net |
| **Intrinsic fold** | A crease inside one sheet: an edge of the crease tree with a fold angle θ. It never changes vertex angle sums |
| **Coplanar tessellation edge** | An edge inside one sheet's flat state with no form meaning (method §4.1). In v1.1, the on-path ring edges dissolve exactly. **In M2 a crease is never a tessellation edge**, even at θ = 0, because it has an assignment and may fold |
| **Intentional seam** | A join between boundary chains. Its vertices may carry angle defect, and its dihedral may be anything, including 0 |

**Distinguishing them, exactly.** Every case is decided from data, never from a picture.
- A **fold** is an edge interior to one sheet (two faces of the same sheet).
- A **seam** is an edge on two boundary chains.
- A seam is **dissolvable** (it could be one sheet) only if both of the following hold:
  - its dihedral in the target pose is 0;
  - every seam vertex that would become interior totals exactly 360°.

  Coplanarity alone is not enough: the F12 and F17 rings have coplanar edges with defect at the vertices (v1.1 §3.3 item 5).

## 3. Conditions on a seam

| Condition | Rule | Kind |
|---|---|---|
| S-1 Same count | the two runs have the same number of segments | exact |
| S-2 Matching lengths | segment i of P and its partner in Q have equal **rest** lengths. Squared lengths are compared exactly as rationals. A difference is a **length residual**. It is either zero, or within a declared gap or overlap tolerance with its source (GEO §1.9); no tolerance is chosen here | exact (or a declared tolerance) |
| S-3 Opposite winding | with both fronts on the same side of the joined surface (both outward), P's run is traversed in P's boundary order and Q's run **in reverse**. That is the edge-orientation condition of an orientable surface: each interior edge is used once in each direction (oracle E of v1.1) | exact, combinatorial |
| S-4 Frame and normal | in the target pose, the front normals of the two faces at each seam segment lie on the same side of the joined surface. A pairing that needs one front to face inward is S-3 with the wrong orientation (CX2) | float, reported |
| S-5 Closure residual | in the target pose, the largest distance between partner vertices. For a tree of seams it is 0 by construction (§4). For a seam that closes a cycle it is measured against τ = 1e-9 · S, as in O1's net band | float, τ |
| S-6 Vertex totals | the sum of the face angles at each seam vertex, over both sheets, is **reported**. It is not required to be 360°. 360° plus a zero dihedral is what makes a seam dissolvable | float, reported |

## 4. Assembly constraints

- The **assembly graph** has the sheets as nodes and the seams as edges (a self-seam is a loop).
- **A tree of seams** places each sheet rigidly relative to its parent by mating one seam segment: two points and the front normal fix the motion. Every seam in the tree has residual 0, up to float, and no closure is needed. That is the M2 situation, one level up.
- **A cycle of seams**, which includes every self-seam, adds one closure constraint per independent cycle: the composed motion around the cycle must be the identity, which is six scalar equations. It is satisfied by construction when the target geometry is given (an O1 band is given in 3D), and it must be measured (S-5) when the target is reached by posing sheets.
- **Not verified here:**
  - that a collision-free path closes a seam;
  - material thickness (a seam between real sheets needs an offset or an overlap allowance);
  - structural bond behaviour, which is ADR 0019's subject and Proposed;
  - folding motion with seams closed.

## 5. Worked examples

**S1. One O1 band as one sheet with one self-seam.** The band is v1.1 F1, square (±1, ±1) at z = 0 to diamond at z = 1, with 8 triangles.
- The band has no interior vertex, so it develops into one flat sheet: v1.1's net, cut at the lateral edge between face 7 and face 0. Its 10 points are frozen in v1.1 F1.
- The cut edge appears twice in the net: on face 0, from (1, 1) to (0, 0), and on face 7. Both copies have length √2, the lateral edge length, so S-2 holds exactly (squared lengths 2 = 2).
- Face 0 and face 7 traverse the edge in opposite directions in the net (S-3).
- In the band, both copies are the same 3D segment, so the closure residual is 0 by construction. The measured net seam residual is ≤ 4.9e-7 τ (v1.1 evidence).
- The ring vertices are boundary vertices of this sheet (150° and 210° in the band alone), so no defect condition applies inside the sheet.

**S2. Two sheets: the band and a flat cap on ring B.**
- The cap is the diamond itself, a flat sheet with 4 edges of length √2. It is seamed to ring B of the S1 sheet.
- S-1: 4 segments each. S-2: √2 against √2, exact. S-3: the band's lateral faces traverse ring B's edges in the order opposite to the cap's counter-clockwise ring seen from +z (outward). S-5: residual 0, since both are given in 3D.
- S-6: each diamond vertex totals 210° (band) + 90° (cap) = **300°**. Adding a cap on ring A gives 150° + 90° = **240°** at each square vertex.
- The total defect is 4 · 60° + 4 · 120° = 720° = 4π, as Descartes' theorem requires for a closed convex polyhedron. That is a check on the numbers.
- Neither seam is dissolvable: the dihedrals are not 0, and the totals are not 360°.

**Counterexamples.**

| ID | Construction | Failing condition | What it shows |
|---|---|---|---|
| CX1 | ring A of F1 (side 2) seamed to a cap square of side 2 − 1 q | S-2: a length residual of 1 q per segment | rest lengths must match exactly, or within a declared and sourced tolerance; posing cannot fix a length |
| CX2 | the S2 cap with its front facing into the band (its ring reversed) | S-3, S-4 | a seam must keep one orientation; otherwise the joined surface is not orientable along that seam |
| CX3 | the F12 ring (rectangle between two squares): ±y ring edges coplanar, vertices 306.87° | dissolvability (§2) | coplanar seam edges are not tessellation edges while the vertices carry defect; the ring stays a seam |
| CX4 | three equilateral triangles of side 1 placed as a tree of seams around one shared vertex, then the third seam closing the cycle | S-5 in the flat placement | flat, the closing pair is 2 apart (the open angle is 360° − 3 · 60° = 180°). It closes only in a 3D pose, the corner of a regular tetrahedron with dihedrals arccos(1/3) = 70.53°. A cycle of seams is a closure constraint, which a tree of seams is not |

## 6. What this leaves for Q1, Q2, Q4 and ADR 0019

| Question | What this research contributes | What stays open (owner) |
|---|---|---|
| **Q1** where a non-axis seam lives | A seam can be stated exactly as a pairing of canonical boundary ids with conditions S-1 to S-6. That works for option (a), one definition compiled from a recipe, and for option (b), an edge-frame socket | which option; how a seam appears in the Foldon contract; GEO-1.3 shared vertex pairs |
| **Q2** a `join` edge kind | an intentional seam is exactly an edge that never folds and may carry defect, which is the role Q2's `J` proposes | whether to add it, and its effect on definition hashes |
| **Q4** closed crease networks | not pursued (D-8). Every closed loop is placed in seams instead (§1, §4) | Q4 itself stays open; nothing here rules it in or out |
| **ADR 0019** support and bond failure | the closure residual and the assembly graph are where bond behaviour would attach | ADR 0019 stays Proposed; no bond behaviour is modelled |

**Before M3 (O1 + O2 composition).** M3 needs an owner decision on whether bands are joined as sheets with seams. It also needs the seam conditions above to be frozen in a contract, with oracles, as M0 did for O1. This note is the design input for that contract. It is not the contract.
