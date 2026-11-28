# P1 and P7 check: old and revised principles against real cases (PROPOSED)

- Status: **PROPOSED evidence for the proposed method M3** ([`form-construction-method.md`](form-construction-method.md)). Nothing here is adopted, approved or a gate. The numbers are design diagnostics on committed concept data. They are not GEO evidence, and they say nothing about beauty.
- Why: the owner's third ART-D3b ruling (decision packet §0.2) asked that P1 and P7 reject their own documented failing cases (the B-2 v5 scaled profile family and the v5 two-tone front block) without punishing a valid prism, repeated equal geometry, planar sheets or sparse forms.
- Inputs, all committed at `8e4e0cf` and unchanged since `418e243`:
  - v5: the `head` and `body` keyframes and the `PENT` profile in `docs/art/raven-concepts/source/c2f5_sumi_flight.py` (`build()`), lofted linearly between keyframes by `kit.loft`;
  - v6 and v7: `KEYS` and the named profiles in `c2f6_sumi_flight.py` and `c2f7_sumi_flight.py`, interpolated by `formkit.program(keys, sub=6)`, with section planes perpendicular to the spine axis (`slice_axis=(-1, 0, 0)`);
  - the same profiles are in `renders/b2v7/v5-v7-readouts.json` (where the key `"v6"` holds the **v7** data, as `b2v7_export.py` line 6 says);
  - spans: v5 2.00 L (brief §10), v6 2.033 L and v7 2.107 L (`ratios.span_L` in the read-out files). L is bill tip to tail tip, about 1.0 model unit.
- How the numbers were made: the formulas below were evaluated in a scratch script outside the repository (pure Python; Pillow rasterisation at 3000 px for silhouette unions). No script, runtime or lab was added. Every value can be recomputed by hand or by any polygon library from the inputs above. Rounding: three decimals.

## 1. P1: what is measured, and why

### 1.1 Frame, units and normalisation

A section is a closed polygon in its section plane, written in the declared frame of that plane: `s` across, `u` up. For the B-2 lofts this frame is fixed by the spine tangent and world up (`kit.loft`, `formkit.section_loft`); it is **declared, not fitted**.

The normalisation N removes exactly three things: position, size and aspect. It moves the centre of the section's bounding box to the origin and scales each frame axis so that the box becomes [−1, 1]². Everything else stays: where the widest point sits, a flat top, a keel, tumblehome, the number and placement of corners.

Why aspect is removed here: one profile stretched by different width and height factors is still one profile. B-2 v5 is the proof. Its sections are `diag(w_i, h_i) · PENT` with aspect running from 1.22 to 0.74, and it was still read as banded and as a block. Aspect is a proportion (layer P). It is checked separately, by landmark ratios (GEO-2.2) and outlines (P2). P1 is the only check that sees **profile structure**, so it must not let aspect stand in for it.

Admissible frame changes, minimised over:
- for a bilaterally symmetric mass, only the mirror across the midline (rotation would break the symmetry);
- for an asymmetric mass, any rotation in the section plane.

### 1.2 Metric

`d(A, B)` is the Hausdorff distance between the boundaries of N(A) and N(B), minimised over the admissible frame changes. Its unit is the half-extent.

- It needs no vertex correspondence and selects no landmark. A flat top (v7 `BROW` has its top along `y ∈ [−0.48, 0.48]`), a symmetric peak or a different vertex count is therefore not a degenerate case. The round-2 "peak offset" and "side lean" descriptors failed exactly there (packet §9.4).
- Also reported, for comparison only:
  - `1 − IoU` of N(A) and N(B): the area deficit;
  - `d_sim`: the Hausdorff distance after translation to the centroid and **uniform** scaling to unit area, with no aspect removal. This is the Kendall/Procrustes notion of shape (Kendall 1984, doi:10.1112/blms/16.2.81). It is shown in order to demonstrate why it is the wrong metric for F1.

### 1.3 Decision, with units

1. **Scaled profile family (F1).** If `d ≤ ε_m` for every pair of keyframes across the declared function stations, the program is one profile, and P1 **fails**.
   - `ε_m` is a measurement floor, not a taste threshold.
   - For profiles stored with two decimals, rounding moves a vertex by at most 0.005 half-extents. When sections are sliced from a mesh, the slice is also taken at the declared station ± the station tolerance stated in the brief, and the smaller value is used.
2. **Visibility at the tier.** At each declared function station, the profile change must show at the smallest size at which the mass's section form must read.
   - The displacement in pixels is `Δ = d · s_px`, where `s_px` is the **smaller** half-extent of the two sections, in pixels, at that size.
   - Required: `Δ ≥ p`, with `p = 2 px`. This is the method's existing visibility constant (P6: "2 px at 400 px").
   - The size is the **hero lower bound**: the object's largest extent drawn at 400 px (bible §6). Section shape is internal form, which bible §6 requires at hero scale and does not require at mid scale. For a raven in flight, the largest extent is the span, so `L_px = 400 / (span / L)`.
   - A section with `s_px < p` cannot show any change at that size. It is reported "unresolvable", neither pass nor fail.
3. **Pass** only if 1 does not apply and every declared station meets 2.

**Where the stations come from.** The function stations are those of the subject's grammar (layer S, method §3). For the raven they are forehead, crown, nape, neck, breast, back, vent and tail root (bible §4.2 and §8). They are fixed in the brief **before modelling** (method §4.0), and a reviewer confirms them against layer S. A mass whose grammar has no function change along its spine has an empty program. For it, P1 has nothing to test. That is not an exemption, and its legitimacy is checked under §4.0.

**Sampling.** If keyframes are declared, they are measured exactly. If the sections come from slicing a built mesh, report `d` at the station and at ± the station tolerance, and use the worst case: the smallest `Δ` for a pass, the largest `d` for the F1 test. The B-2 values below are declared keyframes, so they carry no slicing error.

## 2. P1 results on the actual B-2 data

The station is named by its profile in the source, so the function change is the author's own declaration. Pairs with the same named profile (`BROW`→`BROW`, `BACK`→`BACK`) are within one function and are not graded. `Δ` is computed at the hero lower bound.

**v5** (`L_px` = 200). Every pair of the ten keyframes has `d = 0.000` and `1 − IoU = 0.000`. Aspect runs from 1.22 to 0.74. The largest pairwise `d_sim` is 0.162. Because every pair is 0, the choice of stations does not matter. **P1 FAIL** (scaled profile family).

**v6** (`L_px` = 196.8):

| From (x, profile) | To (x, profile) | Aspect | d | 1 − IoU | d_sim | s_px | Δ px | Verdict |
|---|---|---|---|---|---|---|---|---|
| 0.366 BROW | 0.322 CROWN | 1.22 → 1.09 | 0.063 | 0.046 | 0.080 | 10.6 | 0.67 | not visible |
| 0.322 CROWN | 0.268 NAPE | 1.09 → 0.91 | 0.104 | 0.061 | 0.077 | 11.4 | 1.19 | not visible |
| 0.268 NAPE | 0.225 NECK | 0.91 → 1.05 | 0.074 | 0.041 | 0.059 | 11.4 | 0.84 | not visible |
| 0.225 NECK | 0.130 BREAST | 1.05 → 1.02 | 0.030 | 0.020 | 0.023 | 15.7 | 0.47 | not visible |
| 0.130 BREAST | 0.030 BACK | 1.02 → 0.78 | 0.166 | 0.095 | 0.152 | 18.1 | 3.01 | visible |
| −0.070 BACK | −0.130 VENT | 0.71 → 0.60 | 0.082 | 0.060 | 0.085 | 8.3 | 0.67 | not visible |
| −0.130 VENT | −0.205 PLATE | 0.60 → 0.28 | 0.200 | 0.103 | 0.343 | 2.8 | 0.55 | not visible |

**v7** (`L_px` = 189.8):

| From (x, profile) | To (x, profile) | Aspect | d | 1 − IoU | d_sim | s_px | Δ px | Verdict |
|---|---|---|---|---|---|---|---|---|
| 0.366 BROW | 0.322 CROWN | 1.22 → 1.09 | 0.039 | 0.025 | 0.063 | 10.3 | 0.40 | not visible |
| 0.322 CROWN | 0.272 NAPE_FLAT | 1.09 → 0.91 | 0.055 | 0.028 | 0.069 | 11.0 | 0.60 | not visible |
| 0.240 NAPE | 0.205 NECK | 0.97 → 1.05 | 0.066 | 0.041 | 0.043 | 12.9 | 0.85 | not visible |
| 0.205 NECK | 0.130 BREAST | 1.05 → 1.02 | 0.030 | 0.020 | 0.021 | 16.3 | 0.48 | not visible |
| 0.130 BREAST | 0.030 BACK | 1.02 → 0.78 | 0.166 | 0.091 | 0.150 | 17.5 | 2.90 | visible |
| −0.070 BACK | −0.130 VENT | 0.71 → 0.60 | 0.082 | 0.053 | 0.086 | 8.0 | 0.65 | not visible |
| −0.130 VENT | −0.205 PLATE | 0.60 → 0.28 | 0.131 | 0.072 | 0.292 | 2.7 | 0.35 | not visible |

`NAPE_FLAT` → `NAPE` (x 0.272 → 0.240) is one function, the nape, and is not graded.

Verdicts: v6 **FAIL** and v7 **FAIL**. Each has one visible change of seven declared stations, breast to back. The other six profile changes are real (`d > ε_m`) but below 2 px at the hero lower bound.

This agrees with the round-2 reviewer's reading of v7 ("volume carried by gradients rather than planes", front body "a hexagonal prism"). That agreement was **not** used to set any value: `p`, the tier and the metric were fixed in §1 before this table was computed.

**Sensitivity.** If `s_px` is the larger of the two sections' smaller half-extents instead, v7 breast to back becomes 3.41 px. The others are 0.50, 0.71, 1.07, 0.61, 1.08 and 1.05 px, all still below 2 px, so the verdict is unchanged.

Each v7 change reaches 2 px only at the following drawn span (span = 2.107 L):

| Station | Span needed |
|---|---|
| breast → back | 276 px |
| nape → neck | 942 px |
| back → vent | 1230 px |
| crown → nape | 1333 px |
| neck → breast | 1667 px |
| brow → crown | 2000 px |
| vent → tail plate | 2286 px |

So most of v7's declared profile changes would show only in close-ups.

## 3. P1 adversarial and counterexample cases

| Case | Data | d | d_sim | Result under revised P1 | Why it matters |
|---|---|---|---|---|---|
| Aspect-only family (v5) | `diag(w_i, h_i) · PENT` | 0 | up to 0.162 | FAIL (F1) | A similarity metric reads aspect as shape and would pass v5 |
| Collinear vertex inserted into PENT | (0.475, 0.66) added on the edge (0, 1)–(0.95, 0.32) | 0.000 | — | no change: still one profile | Vertex-count padding cannot game the metric |
| One vertex nudged by 0.01 | (0.62, −0.85) → (0.63, −0.85) | 0.0102 | — | `d > ε_m`, but Δ = 0.0102 · s_px, which is 0.4 px for s_px = 40 → not visible, FAIL | A token change cannot pass. This is why the visibility clause exists |
| Twisted single profile (asymmetric mass) | square rotated 20° in plane | 0.502 in the fixed frame; **0.000** minimised over rotation | — | FAIL (one profile) | Rotation is minimised for asymmetric masses, so a twist cannot fake a profile change |
| Square vs diamond | (±1, ±1) vs (0, ±1), (±1, 0) | 0.707 | — | a genuine profile change | Upper reference for one corner-to-edge change |
| **Valid rectangular building shaft** | 20 × 12 m rectangle at every floor of a 60 m shaft | 0 | 0 | **not graded**: layer S (repeated floors, one function) gives an empty function program, declared before modelling (§4.0) | A prism is not punished. It is also not exempted by assertion: an empty program must cite layer S, and a reviewer confirms it |
| Building setback | 20 × 12 → 16 × 12 | 0 | 0.068 | a setback changes size and aspect only. Two shaft masses meeting at a setback form a **junction** (P3), not a P1 change | Setbacks belong to P2 and P3, not P1 |
| Functional equal repeated elements (four wheels, a row of equal windows) | equal copies of one element | — | — | P1 is not applied **across** elements, only along one mass's spine | Equality across elements is P5's subject, and P5's tessellation clause is bound to bible §4.3 (method P5) |
| Planar sheet (a door leaf, a sign, a flat roof plate) | not a solid | — | — | P1 does not apply (kind: sheet, §4) | A sheet's section is a curve. Its depth is P7's camber measure |

## 4. P7: what is measured, and why

### 4.1 What was wrong

- **Round 2** asked for at least two plane families at least 8° apart, each covering at least 10% of the projected area. The reviewer saw two tones in v5's front block. By that definition, two tones are two plane families, so v5 passes its own fail example (packet §9.4). No read-out for it was ever computed.
- **Round 1** asked for three families at 20°. That flags every box seen square-on.
- Both versions count planes, which is a panel quota in disguise. They depend on lighting, and they reward tessellation: more facets mean more families.
- A third candidate, the area-weighted spread of visible normals, was considered and rejected for the same reason. A finely tessellated sphere and a Miura field both maximise it, yet under bible §4.5 ("two values plus line") the first reads as a disc and the second as a flat sheet.

### 4.2 Revised measure for a solid: the end view must not be a single section

For a view direction `v`, the solid is the union of its slices `Σ(t)`, taken perpendicular to `v`. Its silhouette is therefore `S_v = ∪_t Σ(t)`, projected along `v`. Define:

`e_v = min_t  H(∂S_v, ∂Σ(t))`, the Hausdorff distance between the silhouette outline and the best single slice outline, in model units. Then `e_v · L_px` is in pixels at the tier.

`e_v ≈ 0` means that **one cut explains the whole outline**. The view then shows a single section, a cut-out or a prism end, and its depth reaches the viewer only through interior lines. This is the geometric content of "reads as a block from the front".

The quantity:
- is shader-free;
- counts nothing;
- is correspondence-free;
- does not change when facets are added (a silhouette does not depend on tessellation density);
- is unchanged by a roll about `v`. The sheet's 20° bank is such a roll.

**Rule** (solid masses; a mass is one run of a spine between declared junctions, §4 of the method):
1. **End views.** Along each spine that has a non-empty function program (P1), the end view must have `e_v · L_px ≥ p` at the hero lower bound. If it does not, the declared change of function does not show from the end, and P7 **fails**. Along a spine with an empty program (a prism, a column, a uniformly tapered roof), the end view may be a single section. That is a truthful view of that form, not a defect.
2. **Hero view.** The declared hero is oblique (ART-1 sheet). No solid may be a single section in it (`e_v · L_px ≥ p`). This catches a cut-out or card hero. A box seen in a three-quarter view passes. For a cube of side a seen along a body diagonal:
   - the silhouette is a regular hexagon of circumradius (√6/3) a ≈ 0.816 a;
   - the largest slice is the middle hexagon, of circumradius (√2/2) a ≈ 0.707 a, whose corners lie at the midpoints of the silhouette's edges.

   That gives `e_v` = (√6/3 − √6/4) a = (√6/12) a ≈ 0.204 a, and an area ratio of 0.75.
3. **Depth ratio**, reported in every principal view: `D_v` = extent along `v` ÷ smaller in-view extent. It is compared with the layer-S or layer-P target written in the brief, within the brief's tolerance. There is no universal number.

**Sheets** (a wing plate, a door, a sign, a sail-like panel). P7 measures camber, `c` = the largest distance from the chord plane ÷ the chord, for each declared section. It is compared with the layer-S target: a cambered arm (B-2 brief) needs `c > 0`; a door may have `c = 0`. Plane families are never asked for.

**Sparse forms** (a branching crown, a lattice). P7 measures the envelope: the principal extents `λ1 ≥ λ2 ≥ λ3` of the members' end points, with `λ3 / λ1` compared with the layer-S target. Example: the round-2 tree crown measured about 4.5 : 1 from the top (packet §9.4), so `λ3 / λ1` ≈ 0.22. Whether that fails depends on the tree's grammar target, which that study never stated. That is recorded as a gap, not graded here.

**No circularity.** The function program and every target come from layer S, fixed before modelling and confirmed by a reviewer (§4.0). `e_v`, `D_v`, `c` and `λ` are measured on geometry. No diagnostic sets its own target.

## 5. P7 results on the actual B-2 data (end view along the spine, body mass)

For v6 and v7, the slices perpendicular to the spine are the stations themselves, because those builds fix `slice_axis`.

For v5 this is an approximation. `kit.loft` tilts each ring with the spine tangent, by at most 9.5° on the body (at the last station). That shortens the tilted ring's projected height by at most 1.4%, on small rear sections that lie inside the silhouette anyway. The posed vertical offsets of the stations are kept. The head yaw is ignored because it moves only the head mass. The sheet's 3° pitch is ignored.

| Version | Mass partition | Area ratio (largest slice ÷ silhouette) | e_v (L) | e_v at hero lower bound | e_v at mid (96 px) | Verdict |
|---|---|---|---|---|---|---|
| v5 | body (x ≤ 0.225) | 0.999 | 0.0002 | 0.04 px (L_px 200) | 0.01 px | **FAIL** |
| v6 | body (x ≤ 0.225) | 0.937 | 0.0085 | 1.67 px (L_px 196.8) | 0.40 px | **FAIL** |
| v7 | body (x ≤ 0.240) | 0.931 | 0.0089 | 1.69 px (L_px 189.8) | 0.41 px | **FAIL** |

v7 would reach 2 px only if the bird were drawn with a span of at least about 470 px.

**Sensitivity to the mass partition.** If head and body are measured as one mass, the head sits above the body's outline in every version:

| Version | e_v (L) | Pixels at hero lower bound | Verdict under the one-mass reading |
|---|---|---|---|
| v5 | 0.0167 | 3.3 | passes |
| v6 | 0.025 | 4.9 | passes |
| v7 | 0.028 | 5.4 | passes |

The method defines a mass as a run between declared junctions, and every B-2 brief declares the nape as a junction (v5 tags `head` and `body`; v7 tags `nape`). So the per-mass reading is the one that applies.

This dependence is real. A brief that **omits** a junction in order to merge masses would change the verdict. §4.0 forbids that: junctions come from layer S, before modelling.

## 6. Old against revised, in one table

"Not computed" means that no read-out existed for that version of the principle.

| Case | P1 round 2 (fill, side lean, shoulder height, ε ≈ 0.1 unitless) | P1 M3 | P7 round 2 (two families at 8°) | P7 round 1 (three at 20°) | P7 M3 |
|---|---|---|---|---|---|
| B-2 v5 | **passes** (wrongly): fill 0.706 and shoulder 0.632 constant, but side lean drifts 48.8° → 62.0° with aspect, so "all within ε" never holds | **FAIL** (d = 0) | **passes** (wrongly): two tones = two families (reviewer) | would flag, not computed | **FAIL** (0.04 px) |
| B-2 v6 | passes (descriptors vary) | FAIL (6 of 7 stations below 2 px) | not computed | not computed | FAIL (1.67 px) |
| B-2 v7 | passes | FAIL (6 of 7 below 2 px) | not computed | not computed | FAIL (1.69 px) |
| Rectangular building shaft | flagged unless declared prismatic (an unconstrained escape hatch) | not graded: empty program from layer S, under §4.0 | exempt if declared | **flags** a valid box square-on | top view may be a section (empty program); hero three-quarter passes (cube: `e_v` ≈ 0.204 a) |
| Equal repeated elements | not addressed | not applied across elements | not addressed | flags each square-on element | not applied: secondary elements are not primary masses |
| Planar sheet | not addressed | not applied (kind: sheet) | flags any face-on plate | flags | camber against the layer-S target; a flat door passes |
| Sparse form (tree crown) | not addressed | not applied | not addressed | not addressed | envelope ratio against the layer-S target; the round-2 crown ≈ 0.22, target never stated |

## 7. What existing evidence cannot show

- **No full meshes are committed for v5, v6 or v7.** Only the keyframes and read-outs are. The body loft could be rebuilt from keyframes. The wings, bill, hackles and tail could not, so:
  - P7 for the side, top and underside views, the hero `D_v`, and v5's "shallow depth" are **NOT VERIFIED** by measurement;
  - running the committed Blender scripts would produce new evidence, and that was not done this round.
- **The perception constant `p = 2 px`** is the method's own P6 constant. It was never measured on viewers. Every verdict above depends on it and on the bible §6 tier sizes.
- **The building, vehicle and tree studies** were not re-measured. Their function programs were written by the same author after the method existed (packet §9.2, B1), so a result would not be independent. They are **NOT VERIFIED** under M3.
- **No positive raven control exists.** No approved raven body passes M3 P1 or P7, so neither measure has been shown to accept a good raven. They are shown only to reject the documented failures and to leave the prism, sheet and repeated-element cases alone.
- **Neither measure proves aesthetics.** A body can pass P1 and P7 and still read badly. Both are aids for a reviewer (method §6 preamble).

## 8. Errata after the independent review of M3 (supersede the text above)

**Reviewer.** A separate agent, 2026-11-27, reviewing the frozen commit `8c2bd53`. It recomputed every table independently in its own pure-Python code. **Verdict: NEEDS REVISION.**

**Reproduced:**
- v5 `d = 0`;
- all 14 v6 and v7 P1 rows (`d`, `1 − IoU`, `Δ`, the span-needed table, the 3.41 px sensitivity);
- the cube value √6/12 · a;
- the square→diamond hull band (faces, angle sums, volume, mid-section area);
- v6 and v7 body `e_v` (1.68 and 1.71 px);
- the camber table;
- every case in §3.

**Erratum E1 (blocker B1): P7 does not reject v5 under the frozen rules.** §5 states that every B-2 brief declares the nape as a junction. **That is false for v5.**
- In `c2f5_sumi_flight.py`, `head` and `body` are Python list names. They are joined (`secs = head + body`) and lofted in one `kit.loft` call.
- The v4/v5 brief declares a nape **fold**, not a junction.
- Under §4.0 rule 2, v5 is therefore **one mass**, with `e_v` = 0.017 L = 3.4 px, and P7 **passes** it.
- A new design can cite bible §4.2 ("one continuous mass … bill–head–neck–body–tail spine") as its layer-S reason for one mass.
- The method has no rule for when a landmark is a fold inside a mass and when it is a junction between masses.

The owner's requirement that P7 reject the v5 two-tone block is therefore **not met** by the frozen text. P1 does reject v5 robustly.

**Erratum E2 (major M1): P7's single-section distance does not measure visible depth.**
- It passes a v5 clone whose first body station is only raised by 0.03 L: `e_v` = 3.0 px, with no change of profile.
- It gives exactly 0 for any body in which one section contains all the others, such as an egg or torpedo body, however strongly the profiles change. A linear blend of convex sections inside a convex set stays inside it.
- Because the pixel size comes from the object's largest extent, its verdict depends on unrelated parts: v7's body drawn with folded wings passes at 3.6 px.

The link between `e_v` and "depth is visible" is **not shown**. The holdout found the same nested-section failure independently.

**Erratum E3 (major M2): P1's layer-U claim fails a class of valid objects, and the mass split can escape it.**
- Turned or extruded objects whose sections are all one profile at every function change (circular sections in a turned vessel, a fuselage, a lighthouse) give `d = 0` and fail as a "scaled profile family". So "a section changes shape where the function changes" is false for that class.
- Declaring a junction at every station empties every program, and the method leaves that undefined.

**Minor corrections:**
- v6 uses `program(keys, sub=4)`, not `sub=6`. v7 uses `sub=6`.
- The body ring tilt reaches 11.0° at the 0.225 ring, not 9.5°.
- `s_px` uses the nominal w and h, not the true bounding-box half-extents, so `Δ` is a lower bound. For v7 vent → plate it is 0.35 px this way but 0.87 px per axis. No verdict flips.
- `NAPE_FLAT` → `NAPE` should have been graded under the same-named-profile rule: `d` 0.136, `Δ` 1.50 px. The verdict is unchanged.
- The reviewer's `d_sim` column differs, for example v6 0.076 against 0.080. That column is a comparison only, and no verdict uses it.
- The single-vertex notch case: a single V-notch in the belly gives `d` 0.432 (7.6 px) and **passes** P1. So "a token change cannot pass" is overstated: a large token change can pass.
- The slice spacing and measurement floor for `e_v` were never stated. The reviewer's exact v5 value is 0.0004 L (0.08 px), against 0.0002 L here, with the same FAIL.
- "Values fixed before the table" cannot be shown from git, because the definitions and the results were committed together in `8371748`.
- `λ` for sparse forms is ambiguous: extents and covariance eigenvalues give different ratios.
- The end-view direction is undefined for a curved spine.

## 9. M3.1: why the M3 measures fail, computed (2026-11-28)

These read-outs come from the committed diagnostic scripts [`form-method-diagnostics/`](form-method-diagnostics/README.md) (owner decision D-5). The evidence file is `form-method-diagnostics/evidence/m31-readouts.json`. §1–§8 above stay unchanged as the M3 record. Every value below is **data** in the sense of method §6.0. The verdicts that M3 would give are shown only to explain why M3.1 drops them.

**Reproduced from M3 and its review:**
- v5: all 45 keyframe pairs give `d` = 0.000, with a sample bound of 0.001.
- v7: all seven graded pairs, plus `NAPE_FLAT` → `NAPE`, reproduce `d` and `Δ` exactly: 0.039 / 0.40 px, 0.055 / 0.60, 0.136 / 1.50, 0.066 / 0.85, 0.030 / 0.48, 0.166 / 2.90, 0.082 / 0.65 and 0.131 / 0.35.
- v5 one-mass `e_v` = 0.017 L = 3.4 px (review: 3.4).
- The raised-station clone gives 2.95 px (review: 3.0).
- v7 body: 1.66 px (M3: 1.69; review: 1.71).
- v7 drawn with folded wings: 3.5 px (review: 3.6).
- v5 body `e_v` = 0.000 L. M3 gave 0.0002 L and the review 0.0004 L; these scripts ignore the ring tilt, as §5 did. The widest station contains the others, so the value is exactly 0 here. All three values give the same M3 verdict.

**Controls and what they show:**

| Case | Read-out | M3 would say | Why that is wrong | M3.1 |
|---|---|---|---|---|
| v5 body against v5 head + body | `e_v` 0.000 L against 0.017 L (3.4 px) | fail or pass, depending on the partition | the verdict comes from the partition, not the form | the partition is declared before the artwork; both readings are reported; a partition-sensitive read-out decides nothing (§4.0 rule 7) |
| v5 with its first body station raised 0.03 L | `e_v` 2.95 px, with no profile change | passes | `e_v` of one section and its translate equals the offset (test: 0.25 exactly for a 0.25 shift), so it measures position, not depth | `e_v` is information only |
| Nested sections: a torpedo of circles, or a circle containing a square and a diamond | `e_v` = 0 (below 1e-12) | fails, whatever the profiles do | a convex body's widest section contains the rest, so one cut explains the outline | as above |
| Shallow body (holdout biwa, frozen record) | P1 `d` 0.139, `Δ` 1.33 px | fails P1 by 2 px | `Δ_px = d · s_px`, and `s_px` is proportional to the mass's depth, so a pixel threshold fails a shallow subject for being shallow | P1 conforms (the declared change exists); visibility is reviewer judgment; P7 compares the declared depth target |
| Turned vessel or lighthouse (circle, 64-gon, radius 1 → 3) | `d` = 0.000 | fails as a "scaled profile family" | one profile at every station is the truth of a turned object | P1 `constant`, conforms |
| Valid prism (identical sections) | `d` = 0.000 | needed an "empty program", in conflict with bible §5 | — | `constant` under D-4a, conforms |
| Rectangle 4 × 1 → 2 × 3 (aspect change only) | `d` = 0.000 | — | an aspect change is not a profile change | conforms only if declared `constant` |
| Square → diamond | `d` = 0.7071 (analytic √2/2) | — | upper reference | — |
| Four equal pegs | width CV = 0 | P5 rake flag | the pegs are equal by function | functionally equal elements (§4.0 rule 8) |
| Folded wings against spread wings, same v7 body | `e_v` 3.5 px against 1.66 px | pass or fail depending on the wings | the pixel scale comes from the whole object's largest extent | P7 uses model-unit ratios of the mass alone |
| Cube along its body diagonal | `e_v` = 0.20412 (analytic √6/12 = 0.20412) | passes | positive control: the formula is computed correctly | information only |

**Dimensional reasoning.**
- `d` is dimensionless. `Δ_px = d · s · (400 / E)`, where s is the mass's smaller half-extent and E is the object's largest extent, both in L.
- A fixed pixel threshold p therefore asks for `d ≥ p · E / (400 · s)`. That bar rises as the mass gets shallower (smaller s) and as unrelated parts spread (larger E). Neither is a property of the section program.
- `e_v` has units of length, and it is bounded below by zero for every nested convex body. It cannot separate "deep" from "flat" bodies whose sections nest.
- `D_v`, `c` and `λ3/λ1` are dimensionless ratios of one element's own extents, so they are invariant under drawing size.

**What remains NOT VERIFIED:**
- `D_v` for B-2 v5–v7: no full mesh is committed.
- Any M3.1 conformance verdict on existing artwork: no brief declared P1 or P7 targets, and M3.1 is not retroactive.
- Whether any read-out tracks what viewers see: no viewer study exists.
- **No metric labels B-2 v5 as rejected.** Its rejection is the owner's and the independent reviewer's visual result (packet §0.1, §7.2).
