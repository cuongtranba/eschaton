# Holdout brief: short-necked plucked lute, biwa type (design target, before any drawing)

- Status: **DESIGN TARGET for a design-level transfer check.** It is not an ART-1 concept, not approved, and not a geometry contract. It is committed **before** any drawing, computation or composition for this category (method §4.0 rule 2).
- Method: the frozen M3 at `8c2bd53`, applied step by step as written (method §5, steps 1–6). Where M3 is ambiguous, the choice is stated here and is **not** chosen by looking at a result.
- Variant: a generic biwa in the satsuma proportion. It is **not** a reproduction of any museum object, and nothing is traced.
- Units:
  - **L** is the overall length along the neck axis, from the tail of the body to the end of the pegbox. For the satsuma record [2] that is 88.9 cm.
  - x runs along the spine from the tail (x = 0) to the nut (x = 0.89).
  - In each section's declared frame, `s` runs across and `u` points up, toward the soundboard.
  - Numbers in brackets refer to the references in [README §3](README.md#3-selection-log).

## 0. Layers (method §3)

| Layer | What it holds for this subject |
|---|---|
| **S, subject grammar** | Shell carved from one board, with the neck as part of the same piece. Soundboard glued on. Headstock and pegbox: a separate part, glued and wedged onto a projection at the top of the neck [1], and reflex [4]. Four strings [4][5] from the tailpiece [1] to four pegs [4]. Four raised frets on the neck [5][4]. A sharkskin band (bachimen) across the soundboard [4]. Two crescent sound holes [4][1]. A shrimp-tail end (ebio) [1] or a pentangular finial [4] |
| **A, art direction** | Visual Bible: few large planes, silhouette first, two values plus line, creases as the unit of meaning. Concept B's language (adopted direction for the raven) is **not** borrowed |
| **P, constraints** | Width ÷ length about 0.35–0.37 [2][3][4]. A flat back, shallower than a Western lute [5]. Not sourced, so these are design assumptions: the body depth, the pegbox angle, the fret positions |

## 1. Gesture and landmarks (step 1)

**Pose.** The lute stands upright on its tail, leaning back about 15° from vertical, with the soundboard toward the viewer. This is the way such instruments are shown on stands. The hero is a three-quarter view from the soundboard side, slightly above.

**Landmarks along the spine:**

| Landmark | x (L) | Role |
|---|---|---|
| Tail end | 0.00 | — |
| Lower bout | 0.20 | widest point; tailpiece region |
| Upper bout | 0.42 | plectrum band |
| Shoulder | 0.58 | the body narrows into the neck |
| Neck root | 0.64 | — |
| Nut | 0.89 | end of the shell piece; junction to the headstock |
| Pegbox end (ebio) | about 0.99 | reached when projected on the spine |

## 2. Section program (step 2)

**Masses** (method §4: one mass is the run between declared junctions):

| Mass | Spine | Kind | Why |
|---|---|---|---|
| M1 shell and neck | x 0 → 0.89 | **solid**: a closed hollow resonator. The surface is paper; thickness is not modelled | one carved piece [1]; the headstock is the only separate structural part |
| M2 pegbox | from the nut, bent back | **sheet**: a folded open channel | the pegbox is drilled and chiselled hollow [1]; an open channel is a sheet with two folds |

**Function program of M1** (layer S, before modelling):
- The body from 0 to 0.42 has **one function**, the resonator. The tailpiece and the bachimen are attachments; they are not changes of the section's function.
- **One station: the shoulder at 0.58**, where the resonator becomes the neck that carries the strings and frets.
- The nut at 0.89 is the mass's end.

**Keyframes.** Each profile is a half-profile that is mirrored across `s = 0`. Every section's top is at u = 0, so the soundboard and the fingerboard are flush; the section centre is at u = −h.

| Key | x | w (half-width) | h (half-depth) | Profile | Reason |
|---|---|---|---|---|---|
| K0 | 0.03 | 0.100 | 0.024 | BODY | rounded tail end in plan |
| K1 | 0.20 | 0.180 | 0.026 | BODY | lower bout. Width 0.36 L lies in the sourced 0.35–0.37 |
| K2 | 0.42 | 0.150 | 0.026 | BODY | upper bout |
| K3 | 0.58 | 0.075 | 0.024 | SHOULDER | **function station:** the flat back begins to round toward the neck |
| K4 | 0.64 | 0.036 | 0.022 | NECK | neck root |
| K5 | 0.89 | 0.030 | 0.020 | NECK | nut |

Profiles, as `(s, u)` points in half-extent units, listed from the soundboard centre round to the back centre:

| Profile | Points | Shape |
|---|---|---|
| BODY | (0, 1.0), (0.65, 0.985), (1.0, 0.92), (0.97, 0.30), (0.85, −0.55), (0.62, −1.0), (0, −1.0) | slightly arched soundboard; widest at the rim, near the top; sides curving in to a **flat back** |
| SHOULDER | (0, 1.0), (0.75, 0.99), (1.0, 0.85), (0.96, 0.15), (0.78, −0.62), (0.45, −0.98), (0, −1.0) | — |
| NECK | (0, 1.0), (0.9, 1.0), (1.0, 0.75), (0.92, 0.0), (0.65, −0.70), (0.30, −0.97), (0, −1.0) | flat fingerboard; **rounded back** |

**Design assumptions.**
- **Body depth:** 2h = 0.052 L, about 4.6 cm. It lies between the heike record (3.4 cm overall [3]) and a body depth inferred from the satsuma overall depth [2].
- **The tail cap** from K0 to x = 0 is a wedge to a segment of half-width 0.05 at u = −0.024.

## 3. Outline (step 3)

- **Plan:** a pear. The half-width runs 0.10 → 0.18 → 0.15 → 0.075 → 0.036 → 0.030, converging toward the neck. The lower body is convex in plan; it is a pear, not a rectangle (P2).
- **Profile:** the soundboard and the fingerboard form one straight line. The back is flat over the body and rounds at the shoulder. The pegbox drops behind the back plane.
- **Pegbox (design assumption):** length 0.25 L, bent back by β = 65° from the neck axis.
  - Its end therefore lies at x = 0.89 + 0.25 cos 65° = 0.996 and u = −0.25 sin 65° = −0.227.
  - With the 0.052 body depth, the overall depth is about 0.28 L. That is consistent with, but below, the satsuma record's 29.2 / 88.9 = 0.33 L, which may include the pegs.
  - The angle is **not sourced**.

## 4. Junctions (step 4)

| Junction | Class | Reason | Transition or overlap |
|---|---|---|---|
| Soundboard to shell rim | **seam**, B | glued joint [1] | the rim edge at u = −0.08h below the soundboard centre line is inked as a seam |
| Neck (M1) to headstock and pegbox (M2) | **B** (hard break) | glued and wedged; reflex [1][4] | the pegbox floor overlaps the neck's top projection by 0.03 L. Mate angle 65° about the nut line |
| Shoulder (inside M1) | **C** (continuous) | carved from one piece | O1 bands K2 → K3 → K4 |

## 5. Envelopes and tracts (step 5)

**Positive envelopes:**
- **Front, the soundboard view:** the pear, the neck, and the pegbox foreshortened.
- **Side:** a thin slab body, the neck line, and the pegbox dropping behind.
- **End view along the spine:** the body section with the neck in front of it.

**Declared negative envelopes:**
- the two crescent sound holes, each a crescent of chord about 0.07 L, on the upper bout either side of the centre line [4];
- the open top of the pegbox channel;
- the gaps between pegs;
- the string clearance above the soundboard (hero only).

**Tracts:**

| Tract | Series law | Ends | Status |
|---|---|---|---|
| Frets, 4 | Positions from the nut by the string-length ratios of the instrument's intervals; heights increase toward the body [1]. **Assumption:** spacings shrink toward the nut. Fret 1 is ivory, as the nut is; the others are a different material, which is not modelled [1] | — | the intervals are not sourced |
| Pegs, 4 | two per side, at equal spacing along the pegbox; functionally equal | **declared as a functional series, not a rake.** This is stated **before** any P5 read-out. M3 P5 has no clause for equal functional elements outside corrugated or tiled subjects | an open item, recorded and not resolved here |
| Strings, 4 | from the tailpiece to the pegs, converging slightly | gauges differ by pitch (assumption) | tertiary; hero only |

## 6. Edges (step 6): crease declaration map

| Element | Edges | Kind |
|---|---|---|
| M1 shell | every edge between O1 hull faces, and the keyframe rings K1–K5 where adjacent faces are not coplanar | folds |
| M1 shell | keyframe rings on the Minkowski path, if any | tessellation edges, **never inked** (operators §3.1, result 6) |
| Soundboard | the rim | **seam** |
| Soundboard | the soundboard centre line, where the two arched halves meet | **fold.** Its dihedral is expected to be very small; this is stated now, not after measuring |
| Soundboard | pieces around the crescents | coplanar convex pieces joined by **tessellation edges**, never inked |
| M2 pegbox | the floor and two walls; two creases along the floor's long edges | **folds**, θ = +90° (valley) |
| M2 pegbox | the floor's end | **boundary** |
| Pegs | O1 octagonal prisms crossing both walls | — |
| Pegs | rotation about the peg axis | O3 articulation, with clearance |
| Frets, tailpiece, nut | small O1 prisms | attached by O3 |
| Bachimen | a sheet laid on the soundboard with a normal offset ε > 0 | O3 layer |

## 7. Scale tiers (P9)

| Tier | What must read | Signature features (bible §4.1.2) |
|---|---|---|
| Hero | everything | — |
| Mid (96–48 px) | pear body, neck, bent-back pegbox; the crescents at 96 px only | — |
| District (24–12 px) | the pear and the bent-back pegbox as a silhouette | pear-shaped body, short neck, bent-back pegbox (all sourced [4][5]) |

## 8. What the holdout will report (fixed now)

1. P1 at the M1 function station (K2 → K3 → K4), at the hero lower bound (largest extent = 400 px, so L_px ≈ 400).
2. P7 for M1 (solid): `e_v` in the end view along the spine, and in the hero.
3. P7 for M2 (sheet): camber, expected 0 (plane walls). P7 for the soundboard: camber against "slightly curved" [1].
4. P4 line visibility for the soundboard centre fold. P5 for the pegs and strings.
5. O1 face counts and types for the bands K1 → K2 and K3 → K4. The O2 pegbox flat pattern. The O3 frame product of the reflex mate.
6. **Sensitivity, reported but not used to pass:** the alternative partition, with the shell and the neck as two masses joined at the shoulder by a C junction.

**Rejected alternatives:**
- **A soundboard that is a bent panel.** It has no production representation (method P4).
- **A body lofted index to index.** That is the F1 and F4 mechanism.
- **A pegbox as a solid section.** The source says it is hollowed [1], and its U section is non-convex for O1. As a folded sheet it is two O2 creases.
