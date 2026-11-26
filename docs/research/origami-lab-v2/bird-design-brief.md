# Bird V2 — design brief (GEO-0 principle and GEO-2 morphology), written before code

- Status: **experimental design study, not approved.** It does not close P3D-2, adopt an ADR, start Phase 4 or change a production contract. The owner decides the visual verdict.
- Gate spec: [`../geometry-quality-gates.md`](../geometry-quality-gates.md). This brief is the GEO-0 and GEO-2 design input for the hero object.
- Date: 2026-11-26. Baseline: lab V1 at `73b612b` (PR #11 draft).

## 1. Why the bird, and why first

The owner suggested the bird because it is the hardest test. It needs organic volume (head, breast, tapering body), a thin articulated surface (the wings), layering (primaries, tail) and a pose that reads as alive. The reference art ([`assets/reference/visual-direction.png`](../../../assets/reference/visual-direction.png)) has more vehicles than birds. Its birds are small dark silhouettes against the sky, so the bird must read as a **silhouette first** at small size, from below and from three-quarter views. A technique that produces a convincing bird (lofted faceted shell plus thin lofted surfaces, unfolded into flat pieces) transfers directly to vehicle bodies, wheels and roofs. Starting with the car would not show that it handles organic shape.

## 2. What V1 got wrong (concrete, from `docs/screenshots/exp-origami-seed-1-t1.png` and `src/objects/bird.ts`)

| Defect | Cause in V1 | V2 response |
|---|---|---|
| Body is two flat triangles (a keel), with no breast, back or head volume | `body` part = 2 lattice triangles hinged at a 15–30° keel | Closed faceted shell lofted through 8 anatomical stations |
| Long needle neck with a tiny head | Neck is one trapezoid 20–28 units long on a 4–6-unit top, so the neck is 3–5× the head height | No visible neck in flight (corvid head is held into the shoulders). Head and neck are lofted stations with real width |
| Flat card wings without a wrist or a leading edge | Each wing is one triangle plus one quad with one valley | Wing = arm (cambered, 3-point sections) + hand (thin) + 0/4/5 primary "fingers"; shoulder and wrist hinges |
| Tail is two triangles hinged to the wing roots | Tree-only module lacks a centred edge | Tail fan hinged on a body tail-root edge, pleated corrugation |
| 7.5° angle steps and the 1/8 lattice make integer edges dominate shape | The lattice is used for identity *and* for shape | Identity = hash of a quantised parameter record. Shape = continuous design geometry. Seam exactness comes from **shared vertex indices** (topology), not from integer squared lengths |

## 3. References (study, not copying)

No reference geometry or image is copied or imported. They inform proportions, shape language and method.

| # | Reference | What it gives us | Licence / use |
|---|---|---|---|
| R1 | Mitani, J., Suzuki, H. "Making papercraft toys from meshes using strip-based approximate unfolding", *ACM TOG* 23(3) (SIGGRAPH 2004) 259–263. [Author PDF](https://mitani.cs.tsukuba.ac.jp/dl/mitani_2004_siggraph_papercraft.pdf) | The method family. A rounded animal is a **polyhedral mesh unfolded into flat pieces (strips)** and glued along cut edges. It is a modular sheet assembly, not one-sheet origami | Cited method; no code or figure reused |
| R2 | Demaine, E., O'Rourke, J. *Geometric Folding Algorithms*, CUP 2007, Part III (polyhedra, edge unfolding) | Edge-unfolding a polyhedron to one non-overlapping net is an open problem even for convex polyhedra (Dürer's problem) and can fail for non-convex ones. So **splitting into several pieces is a principled necessity**, not a hack | Cited |
| R3 | Tachi, T. "Simulation of Rigid Origami", *Origami⁴* (2009) 175–187 | Rigid panels and hinges, with configuration = fold angles. We use the same model: each panel stays congruent and moves only by rotations about crease lines | Cited |
| R4 | Belcastro, S.-M., Hull, T. "Modelling the folding of paper into three dimensions using affine transformations", *Linear Algebra Appl.* 348 (2002) 273–282, doi:10.1016/S0024-3795(01)00608-5 | Folding = piecewise isometry. The pose of a panel is the product of rotations about the creases on its path to the root. This is the kinematics of `@eschaton/foldon` `poseGeometry` | Cited |
| R5 | Lang, R. J. *Origami Design Secrets*, 2nd ed., CRC 2011 | One-sheet tree-method bases (flapping bird, crane) make long thin flaps by **layering**. Rendered as rigid single-layer panels they read as needles and flat cards, which is exactly the V1 failure. That is why V2 does **not** imitate one-sheet bird bases | Cited, contrast only |
| R6 | Carrion crow (*Corvus corone*): length about 45–52 cm, wingspan 84–104 cm ([RSPB](https://web-cdn.rspb.org.uk/birds-and-wildlife/identifying-birds/corvids-how-to-identify-the-crow-family), [Wikipedia](https://en.wikipedia.org/wiki/Carrion_crow)); square-to-rounded tail, heavy beak, 5 "fingered" primaries in flight | Baseline proportions and shape language (crow fits the reference's barren, post-collapse mood) | Facts |
| R7 | Herring gull: length 55–67 cm, wingspan 125–155 cm ([Wildlife Trusts](https://www.wildlifetrusts.org/node/186)). House sparrow: length about 14–16 cm, wingspan 21–25 cm ([NHM](https://nhm.ac.uk/discover/house-sparrow-passer-domesticus.html)) | Bounds of the span ratio: sparrow ≈ 1.6, crow ≈ 2.0, gull ≈ 2.3 | Facts |
| R8 | Avian topography (standard field-guide terms: arm/hand wing, wrist (carpal joint), primaries, secondaries, coverts, rectrices) | Semantic slots and their names | Common terminology |

## 4. Modular sheet assembly vs true one-sheet folding

- **V2 is a modular papercraft (R1), not one-sheet origami (R5).** Each *piece* is a flat, non-overlapping sheet (checked) that folds rigidly into its rest shape by rotations about its tree creases (R3, R4). Pieces are joined by **glue seams** (cut edges that coincide only in the assembled state) and by **joints** (shoulder, tail root) whose axis is a shared mesh edge.
- **Not claimed:** that the bird folds from a single uncut sheet. It does not claim physical feasibility beyond zero-thickness rigid panels: paper thickness, tabs and glue flaps are not modelled.
- Piece count is reported per seed. It is an output of the unfolder (R2), not a design target.

## 5. Shape language (art direction)

- **Faceted, angular, deliberate.** Triangulated facets with visible ridge lines, like a cut-paper or woodcut silhouette. The reference uses heavy black shapes with sharp angular breaks, not smooth curves.
- **Silhouette hierarchy.**
  1. Primary: a cross shape in flight (body axis vs wing span), with the wing broader at the arm and tapering or fingered at the hand.
  2. Secondary: head and beak wedge, breast bulge below the shoulder line, tail fan.
  3. Tertiary: fingered primaries, pleated tail, camber ridge on the arm, mandible ridge.
- **No decals, no painted lines.** Every detail is a panel or a crease.

## 6. Target proportions (normalised: total length L = beak tip to tail tip = 1)

The baseline is a crow in gliding flight. Seeds vary within the bounds (§9).

### 6.1 Body stations (loft sections, 8-point ring)

The ring profile at each station, with w = half-width, t = height above the spine line and b = depth below it, has vertices P0 (0, t) dorsal ridge, P1 (0.72w, 0.62t) shoulder line, P2 (w, −0.05b) widest, P3 (0.62w, −0.62b) lower flank, P4 (0, −b) keel, and P5–P7 mirrored.

| Station | s (from beak tip) | spine y | w | t | b | Why it exists |
|---|---|---|---|---|---|---|
| S0 beak tip | 0.00 | −0.012 | point | | | beak point, tip slightly below the gape line (hooked corvid bill) |
| S1 gape / beak base | 0.095 | 0.000 | 0.026 | 0.026 | 0.024 | beak length ≈ 0.10 L (crow) |
| S2 forehead / eye | 0.135 | 0.008 | 0.048 | 0.050 | 0.038 | steep forehead step: the head reads as a separate mass from the beak |
| S3 crown | 0.195 | 0.006 | 0.054 | 0.050 | 0.046 | widest head |
| S4 nape / throat | 0.250 | −0.004 | 0.050 | 0.042 | 0.058 | slight waist between head and body (no needle neck) |
| S5 shoulder / breast | 0.330 | 0.000 | 0.088 | 0.070 | 0.105 | deepest point: breast muscle mass; wing root leading edge |
| S6 rump / belly | 0.530 | 0.006 | 0.075 | 0.058 | 0.078 | wing root trailing edge; root chord 0.20 L |
| S7 vent | 0.600 | 0.012 | 0.048 | 0.036 | 0.040 | taper into the tail |
| tail root edge | 0.635 | 0.018 | half-width 0.035 | | | straight hinge edge for the tail fan |

Head-to-body width ratio: 0.054 / 0.088 ≈ 0.61. Breast depth (t + b) at S5 = 0.175 L.

### 6.2 Wings (per side, flight pose)

| Landmark | Rule | Crow value |
|---|---|---|
| Span ratio (tip to tip / L) | parameter, bounds 1.55–2.45 | 2.0 |
| Wing root | body edge P1@S5 → P1@S6 (a real shared edge, the shoulder hinge axis) | chord 0.20 |
| Arm (shoulder → wrist) | 40 % of the root-to-tip distance; 3-point sections LE, camber ridge CR at 30 % chord raised 10 % chord, TE | chord 0.30 |
| Wrist | 2-point section (straight line LE_w → TE_w), so the wrist hinge is a straight crease; the leading edge is most forward here | |
| Hand | thin 2-point sections, leading edge swept back by `sweep` from the wrist (most forward point, s = 0.285) | chord tapers to 0.60 × arm at the finger base |
| Primaries ("fingers") | 0, 4 or 5 tapered triangles on the hand tip edge, splayed from −15° to +35°, tips curled up by `curl` | 5 fingers, length 0.22 |
| Dihedral | arm `dihedralArm` (−4° to +12°), hand `dihedralHand` (−10° to +6°); a negative hand dihedral gives the gull "M" | +8° / +2° |

### 6.3 Tail

Fan from the tail root edge (half-width 0.035) to K = 6 feather tips, spread half-width 0.08–0.13. Tip outline `square | rounded | wedge | forked`. Pleat height ±0.010 alternating gives a corrugated paper fan. Length 0.365 L for the crow.

### 6.4 Three-view target

[`bird-target-3view.svg`](bird-target-3view.svg) plots §6.1–6.3 for the crow baseline (top, side, front). The geometry produced later is compared to it in GEO-2 (landmark ratios recomputed from the built mesh).

Target iteration (recorded because it is the point of designing before coding): the first plot used arm chord 0.26, a straight leading edge and 0.15 L fingers. In plan view it read as two planks with a comb at the end. Target v2 widens the arm (0.30), puts the wrist forward of the shoulder, tapers the hand to 0.6 × chord and lengthens the fingers to 0.22 L. That matches the broad, slotted corvid planform (R6).

## 7. Topology, creases and seams (why each fold exists)

| Element | Topology | Crease / seam type | Purpose |
|---|---|---|---|
| Body shell | Closed polyhedral surface, stations S0–S7 + tail-root edge, 8-point rings, non-planar quads split along the shorter diagonal | Tree creases (valley or mountain, measured from the design), glue seams on cut edges, J where adjacent facets are coplanar | Volume: head, breast, back ridge, keel |
| Beak | 8-triangle pyramid S1 → S0 | Ridge creases along P0 (culmen) and P2 (gape line) | Wedge beak; hook from tip below the gape |
| Tail cap | 4 + 4 fan triangles + dorsal and ventral triangles meeting at the tail-root edge | Tail-root edge is shared by 3 faces: the tail hinges on the dorsal one; the ventral one is a glue seam | Clean, straight tail hinge |
| Wing | Open lofted strip root (2) → arm (3) → wrist (2) → hand (2) → tip (n+1 or 1) | Shoulder = **joint** on the body edge P1@S5–S6, articulated. Wrist = straight crease, articulated (coupled). Camber ridge = valley/mountain pair | Flap through the shoulder and secondary joint at the wrist |
| Primaries | One triangle per finger on the hand tip edge | Creases with upward curl | Slotted wingtip silhouette |
| Tail fan | Root triangle + 3-point mid line + (K+1)-point pleated tip line | Alternating mountain/valley pleats | Layered fan read, stiffness look |

Feasibility limits: zero-thickness panels, no tabs. The shoulder rotation is about a body edge, not a ball joint, so it gives flap only (no sweep or twist). The wrist is a single straight crease. The rest pose is gliding flight; a perched pose with folded wings is **not** attempted.

Alternatives considered:

1. **One-sheet bird base (R5).** Rejected: it produces layered needle flaps (the V1 look) and needs closed crease networks.
2. **Hand-modelled hero mesh.** Rejected by the brief: it is not a reusable family.
3. **Smooth subdivision surface.** Rejected: it is not paper, and it is not rigid-panel foldable.

## 8. Reusable family (GEO-3 basis)

- `ring(stationFrame, profile)`: a closed n-gon section.
- `loft(sections)`: stitches consecutive closed rings (equal counts → planar quad or two triangles along the shorter diagonal) or open polylines (greedy shorter-diagonal stitch, any counts).
- `fan(apex, ring)`: closes a ring to a point (beak, wing tip).
- `strip`/`loft` with open sections: wings, tail, fingers.
- Mirroring is by construction (left and right sides are built by the same function with `side = ±1` and share centreline vertices).
- The same primitives would build a car body (ring loft along the vehicle axis), wheels (n-gon prism lofts) and roofs (open lofts). That transfer is **not demonstrated** in this iteration unless GEO-3 evidence for a second object is recorded.

## 9. Parameters that change silhouette (bounded; seeds sample them)

| Parameter | Bounds | Silhouette effect |
|---|---|---|
| `span` | 1.55–2.45 | sparrow-like stubby to gull-like long wings |
| `chord` | 0.75–1.25 × 0.30 | slender vs broad wings (aspect ratio) |
| `sweep` | 5°–28° | straight vs swept hand |
| `fingers` | 0, 4, 5 | pointed vs slotted wingtip |
| `dihedralArm`, `dihedralHand` | (−4°, 12°), (−10°, 6°) | flat, V, or gull "M" |
| `tail` | 0.24–0.42 L | short vs long tail |
| `tailShape` | square, rounded, wedge, forked | tail outline |
| `tailSpread` | 0.08–0.13 | closed vs fanned tail |
| `beak` | 0.07–0.13 L | finch-short to crow-heavy |
| `head` | 0.88–1.15 | head mass |
| `breast` | 0.88–1.2 | slim vs barrel body |

Identity = `fnv1a64(canonicalJson({ version, params }))`, with every parameter quantised to 1/1000 before hashing and building. Hash distinctness is **not** used as evidence of visual variation (GEO-3 uses landmark ratios and silhouette IoU instead).
