# Holdout result: frozen M3 and O1–O3 applied to a biwa-type lute

- Status: **DESIGN-LEVEL RESULT, author's record.** Concept only. It is not approved, not implemented and not an ART-1 concept. The independent review is in [README §4](README.md#4-independent-review).
- Inputs:
  - the frozen method and operators at `8c2bd53`;
  - the selection at `56fe301`;
  - the brief at `ff0b4a2`, committed before any computation or drawing.
- Sheet: [`holdout-biwa-sheet.png`](holdout-biwa-sheet.png), an original design drawing made by [`source/holdout_sheet.py`](source/holdout_sheet.py) from the brief's numbers. Its read-out panel prints values copied from this file.
- How the numbers were made: by the formulas of [`form-method-check.md`](../../form-method-check.md) and [`geometry-operators.md`](../../../research/geometry-operators.md) §3. They were evaluated in a scratch script outside the repository, on the brief's keyframes.
- Scale: the hero lower bound is a largest extent of 400 px. That extent is the overall length, so L_px = 400.
- Every value below was fixed by the brief §8 report plan; none was chosen after seeing a result.

## 1. Worked composition

### 1.1 O1, the body band from K1 to K2 (lower bout to upper bout)

**Sections.**

| Section | x | Half-width w | Half-depth h | Profile |
|---|---|---|---|---|
| A | 0.20 | 0.180 | 0.026 | BODY |
| B | 0.42 | 0.150 | 0.026 | BODY |

The two sections lie in parallel planes 0.22 L apart. Both are convex: 11 hull vertices each, because the back's centre point is collinear and is dropped.

**Faces** (result 2). The sections differ only in width, so every edge that is not axis-aligned changes direction. Only the flat back keeps its direction in both sections. The band therefore has **21 planar faces: 1 trapezoid (the back) and 20 triangles.**

**Volume** (result 4). The section areas are |A| = 0.016599 L² and |B| = 0.013833 L². The middle section, M = ½A ⊕ ½B, has |M| = 0.015266 L². So:

V = 0.22 / 6 · (|A| + 4|M| + |B|) = **0.0033549 L³**

|M| is not the area of the conceptual taper's midpoint section, which is 0.015216 L² (|A| scaled to the mean width). The O1 morph and the conceptual taper differ by 0.33% in area. That is the approximation error of operators §3.1, measured here.

**Fold dihedrals between adjacent lateral faces:**

| Statistic | Value |
|---|---|
| Fold edges | 21 |
| Below 8° | **13** |
| Minimum | 0.04° |
| Median | 3.06° |
| Maximum | 76.4° (at the rim) |

Under P4, each of the 13 folds below 8° is a line that marks almost no form change.

### 1.2 O1, the shoulder bands (K2 → K3 → K4)

| Band | Faces | Folds below 8° | Minimum | Median | Maximum |
|---|---|---|---|---|---|
| SHOULDER → NECK, K3 → K4 | 23 triangles, 0 trapezoids | 11 | 0.20° | 10.65° | 50.96° |
| BODY → SHOULDER, K2 → K3 | 23 triangles | not tabulated | — | — | — |

**The closed shell.** M1 is a closed band chain: the soundboard plus the shell, with a cap at the tail. That is a closed crease network, which needs a **Q4** decision. Without one, it has to be built as two mirrored half-shells joined by a seam along the soundboard centre line and the back centre line, which needs Q1 and Q2.

### 1.3 O2, the pegbox (M2) flat pattern

| Panel | Shape | Dimensions | Joined by |
|---|---|---|---|
| Floor (root) | trapezoid | 0.25 L long, 0.050 L wide at the nut, 0.040 L at the end | — |
| Two walls | rectangles | 0.25 × 0.035 L | each joined to a long edge of the floor by a crease at θ = +90° (valley) |

- The long edges of the floor converge at atan(0.005 / 0.25) = 1.15° to the axis, so the folded walls stand square to the floor and lean 1.15° inward in plan.
- All three panels are convex and planar, and the crease structure is a tree rooted at the floor. **But each wall has four peg holes,** so it is not a convex panel. Representing it needs either:
  - coplanar convex pieces joined at 0°: tessellation edges, which need the non-folding `join` edge kind of **Q2**; or
  - a panel kind with holes.

  Neither exists in Foldon today.

### 1.4 O3, the reflex mate at the nut (B junction)

**Ports.**
- Host port F_h: origin at the nut, (0.89, 0, 0), with axes (spine x, across s, up u).
- Child port F_c: at the nut end of the pegbox floor, with axes (x′, s′, u′).

**Mate.** M rotates about the nut line (the s axis) by 65°, carrying x′ to d = (cos 65°, 0, −sin 65°) = (0.4226, 0, −0.9063). It carries u′ to n = (0.9063, 0, 0.4226).

**Placement.** g = F_h · M · F_c⁻¹ maps a child point (x′, s′, u′) to (0.89, 0, 0) + x′·d + s′·ŝ + u′·n.

| Child point | Placed at |
|---|---|
| Pegbox end, x′ = 0.25 | **(0.9957, 0, −0.2266) L**, the brief's value |
| Overlap point, x′ = −0.03 | (0.8773, 0, +0.0272) L |

**Finding.** The overlap point lies **above** the fingerboard. A reflex joint that is "glued and wedged onto a projection" [1] is a volumetric joint. It is not a surface overlap, and O3's overlap semantics do not describe it. The nut is the subject's own transitional element (P3), so it would be the collar. This joint is a case O3 does not cover as written.

### 1.5 Attachments

| Element | Built as | Notes |
|---|---|---|
| Tailpiece | small O1 prism, attached by O3 to the soundboard | — |
| Frets | small O1 prisms, attached by O3 to the neck | — |
| Nut | small O1 prism, attached by O3 to the neck | — |
| Bachimen | a sheet attached by O3 with a normal offset ε > 0 | A coplanar layer would be the GEO-1.11 coplanar-overlap negative control |
| Pegs | O1 octagonal prisms (8 rectangles), attached by O3 with clearance through a full turn | the circumradius is constant, so the clearance is constant |
| **Strings** | each joins **two** hosts, the tailpiece and a peg | O3 requires an assembly **tree**, so a second host makes a cycle and is rejected with `not-a-tree`. Nothing in the frozen operators types a tension member. V3's `Seam`, which is checked but never used for placement, is the nearest precedent |

## 2. Frozen-principle read-outs (brief §8)

| Item | Value | Frozen M3 verdict | Is the verdict right? |
|---|---|---|---|
| P1, M1 station K2 → K3 (BODY → SHOULDER) | d = 0.139, 1 − IoU = 0.044, s_px = 9.6, **Δ = 1.33 px** | FAIL | **Disputed.** The shoulder change is real and sourced: the back rounds into the neck. The mass is only 10 px deep at the hero lower bound, so any honest change is about 1 px. The rule may be too strict for shallow masses, or the design too timid. Unresolved |
| P1, K3 → K4 (SHOULDER → NECK) | d = 0.100, s_px = 8.8, **Δ = 0.88 px** | FAIL | as above |
| P1, K0 → K1 → K2 | same profile, one function | not graded (empty program within the resonator) | yes: the flat resonator is not punished |
| P7, M1 end view along the spine | **e_v = 0.0004 L = 0.15 px** (K1's section explains the whole outline) | **FAIL** (the program is non-empty: the shoulder station) | **No. A counterexample to M3 P7.** A real biwa seen end-on *is* a flat tray with the neck in front of it. The end-view clause was derived from the raven, where breast and back differ in outline. Here the station's sections lie inside the widest section |
| P7, sensitivity: body and neck as two masses joined at the shoulder (C) | 0.10 px and 0.21 px | allowed: each program is empty | the verdict flips with the partition. The raven showed the same (check §5). The method does not say whether a function change is a station inside a mass or a junction between masses. **That is a gap that can be gamed** |
| P7, M1 hero (three-quarter) | e_v = 0.25 L (100 px) | pass | yes |
| P7, soundboard (sheet) camber | c = 0.0058 | not graded | the source says "slightly curved" [1] and gives no number, so the target is NOT VERIFIED |
| P4, soundboard folds | centre 0.38°, next 1.35° | flagged (below 8°) | **The conflict is real.** The sourced curvature [1] cannot be drawn as folds that read (P4), and a bent panel has no production representation (method P4, M3). It is the same open item as the raven's bent panels |
| P4, O1 aspect-only bands | 13 of 21 folds below 8° | flagged | a consequence of O1 on an aspect-only family (§3, finding O1-a) |
| P5, pegs | width CV 0, spacing CV 0, angle-step CV 0, no overlap | **flagged as a rake** | **No.** Four equal pegs are functionally equal. M3 narrowed the tessellation clause to corrugated or tiled subjects and left no clause for equal functional elements. The brief declared this gap in advance (§5) |
| P2, neck | width ratio 0.833 over 0.25 L, which is more than twice the width (0.144) | not flagged (just outside 0.85–1.15) | yes |
| P6 | the crescents, the channel opening and the peg gaps are declared | pass by declaration | the silhouette's hole topology was not computed (the front silhouette has no enclosed hole) |

## 3. Transfer: expected against found

| Expected before drawing (brief §8) | Found |
|---|---|
| Steps 1–6 can be carried out | **Yes.** Masses, kinds, function program, keyframes, junctions, envelopes, tracts and the crease map were all written from sources before modelling |
| O1 builds the convex body bands | **Yes,** with exact faces and volume. **Finding O1-a:** on an aspect-only family, O1 gives many near-coplanar triangles (13 of 21 folds below 8°), which P4 flags as lines without form |
| O2 builds the pegbox channel | **Yes,** with three panels and two valley folds. The peg holes break convexity (Q2) |
| O3 covers the attachments | **Mostly.** It does **not** cover a two-host string or a wedged volumetric joint |
| P1 and P7 judge correctly | **No for P7's end-view clause** (a counterexample) and for P5 (a false rake). **P1 is disputed** for shallow masses. All three verdicts depend on declarations (partition, tier) that M3 leaves under-specified |

**Subject grammar needed (layer S, not supplied by the method):**
- the one-piece shell and neck;
- the separate reflex headstock;
- four strings, four frets and four pegs;
- the fret law;
- the crescent holes;
- the plectrum band.

The method supplied only the procedure and the vocabulary. That is the intended split (method §3).

**Reuse, judged by GEO-7.5:**

| Level | Judgement | Why |
|---|---|---|
| **(b) family** | **meaningful** | The O1 section shell does the same structural job (enclosing a volume through keyframe sections) in the raven body and in the biwa shell. O2's two-fold channel and O3's attachment are likewise reused for the same jobs |
| **(c) concrete definition** | **not justified anywhere** | No keyframe, panel or module is shared between the raven and the biwa. Sharing, say, a feather vane as a fret would be decorative token sharing |

## 4. What this holdout shows, and what it does not

**Shows:**
- The frozen procedure and vocabulary can be executed on a category that played no part in deriving them.
- The three operators cover the main forms.
- Six concrete failures or gaps:
  1. P7's end-view clause wrongly fails a faithful flat body.
  2. P7 and P1 verdicts depend on the mass partition, which M3 does not define well enough.
  3. P5 has no clause for equal functional elements.
  4. O1 makes near-invisible folds on aspect-only families.
  5. O3 lacks two-host tension members and volumetric joints.
  6. Holes and slight curvature run into Q2 and the curved-panel gap.

**Does not show:**
- that the method generalizes: one category is not enough;
- any aesthetic quality: no reviewer judged a built form, because none was built;
- foldability, collision or closure;
- the pegbox angle or the body depth, which are unsourced.

**Changes that would follow (NOT applied).** Any of these would make a variant M3.1 or O1.1. The variant would be exploratory, and the biwa would no longer be a holdout for it.
- P7: apply the end-view clause only when a station's section is **not** contained in the widest section, or replace it.
- Define a function station against a junction from layer S, with a reviewer.
- P5: a clause for equal functional elements, bound to layer S.
- O1: change width by Minkowski stretching (keeping edge directions) instead of axis scaling, so bands are trapezoids.
- O3: a typed two-host tension member, with a closure check.

None of these is made here. The frozen M3 and its result above stay as recorded.

## 5. Corrections after the independent review (supersede the text above)

The text above, and the sheet, are kept as the reviewed record. Where they conflict with the following, the following holds.

| # | Claim above | Correction |
|---|---|---|
| C1 | §1.1: largest fold 76.4° | **103.6°.** The scratch computation took \|n₁·n₂\|, which folds every angle into 0–90°. The counts below 8° and the median are unaffected |
| C2 | §2: end view `e_v` = 0.15 px; partition figures 0.10 / 0.21 px | The reviewer's exact computation gives **0.04 px** and **0.00 / 0.055 px**. The author's values came from a 2400 px rasterisation. Every verdict is unchanged |
| C3 | §1.4: O3 does not cover a wedged volumetric joint | **Disputed, not a gap.** The overlap lands above the fingerboard only because the host port was placed on the nut's top line. Operators §3.3 already gives an O1 collar for B junctions, and the nut is that collar. The finding about the two-host string stands |
| C4 | §2 and §4: P7 end-view counterexample, "a real biwa seen end-on is a flat tray" | **Narrowed.** A real end view also shows the pegbox and pegs. The finding is per mass: *P7's end-view clause fails any mass whose station sections all fit inside its widest section.* For M1 that holds only under the **unsourced** assumption that the K3–K5 depths are no greater than K1's |
| C5 | Sheet read-out and §3: "applied as written" | **Not fully.** Two deviations from the frozen procedure were not disclosed. First, the declarations were not confirmed by an independent reviewer before use (method §4.0 rule 5). Second, the §5 step artefacts (gesture drawing, planform and profile overlay, envelope and tract diagram, crease declaration map) were given as tables in the brief, not as drawings |
| C6 | §4: "six concrete failures or gaps" | **Credited to the frozen texts where already stated:** O1-a (aspect-only families give triangles; operators §3.1), partition sensitivity (M3 P7 limits; check §5) and the closed shell (operators §3.1). **New from the holdout:** adding a C junction empties both function programs, so a verdict can be flipped by declaration; P7's nested-section clause; and P1 on shallow masses (d(BODY, NECK) = 0.219, giving 1.93 px, still below 2 px). The P5 flag is designed behaviour, and the gap is the missing declaration route for equal functional elements |
| C7 | §2: P1 K3 → K4 graded | K4 is not a declared station. Only K2 → K3 is graded |
| C8 | Brief §3: overall depth about 0.28 L | About **0.24 L**: the pegbox drop is measured from the soundboard line, and the drawing shows 0.239 L |
| C9 | Sheet subtitle: "signature: … bent pegbox"; "4 frets (graded tract)" | Front silhouettes cannot show the bent pegbox, so the district-tier signature in brief §7 is **NOT VERIFIED**. The frets are drawn at equal heights, and their spacing was chosen at drawing time and is not in the brief; the graded law is **not** shown |
| C10 | Protocol §2.4 | The drawings and the composition share commit `a2ec1c1`, against the protocol's separate commits. This was not disclosed |
| C11 | Pegs | They are drawn short and not octagonal, and they are not angled as the sources describe [1][4] |

**Reproducibility.** The read-outs were computed by a script outside the repository, because the ruling forbids a runnable lab or a runtime prototype. The reviewer re-derived the key numbers independently. Whether such diagnostic scripts may be committed under `docs/` as design artefacts is put to the owner (packet §10, decision D-5).

