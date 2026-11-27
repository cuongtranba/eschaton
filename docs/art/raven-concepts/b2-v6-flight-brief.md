# B-2 v6 flight revision: design brief (generic method applied)

- Status: **DESIGN TARGET, committed before any v6 drawing, maquette script or render.** It authorizes nothing and approves nothing. It answers the owner's second **ART-D3b** ruling (2026-11-27): B-2 v5 is **not approved**, and the fix must follow a method that is generic for all objects ([decision packet](../../review/art-1-raven-decision-packet.md) §0.1). Whatever v6 produces is **pending the owner's ART-1 decision**, even if a reviewer finds it credible.
- Method: the proposed [form construction method](../form-construction-method.md) (§5 procedure, §6 principles P1–P9), committed in `449406b` before this brief. **The same procedure** is applied to a vehicle, a building and a tree in the [form studies](../form-studies/README.md). This brief contains no raven-only rule. Its raven content is layer S (subject grammar), A (Concept B's art direction) and P (raven numbers), as the method §3 separates them.
- Direction kept: Concept B (perched) is the selected direction (ART-D3a) at Sheet B v4, SHA-256 `554069333c47d2c8adde05f0fa4866be5d278d27873807cac7e76a694ec4f74f`. v6 must read as the same bird. It does **not** change Sheet B, `c2_sumi.py`, or any historical B-2 file (v3 `60887d90…`, v4 `a9a61b68…`, v5 `888cf4a5…` and its details `dfb18c3c…`).
- Out of scope: Foldon or any package or app code; Geometry V4; Phase 4; imported or generated meshes; AI imagery; shaders that hide form; claims of foldability, planarity, convexity, collision, closure, thickness or structural support. ART-D3c is not authorized, so every number below is a **design intent**, not an ART-4 tolerance.

## 1. What failed at v5, mapped to the method

The defects are the round-2 reviewer's (packet §7.2) and the owner's (packet §0.1). The middle column is the generic failure pattern of the method §2. This is the point of the revision: each defect is fixed by fixing its pattern for the whole object, not by patching the part where it was seen.

| v5 defect (view) | Pattern | Principle | Fixed for the whole object by |
|---|---|---|---|
| Head banded from top and below (4–5 bands) | F1 homothetic sections, F4 undeclared lines | P1, P4 | Head and body section program with keyframes at landmarks (§3), and a crease map in which transverse lines exist only at landmarks (§6) |
| Front body reads as a block; depth shallow | F1, F7 | P1, P7 | Sections that change shape (deep, round breast; broad back; flat rump); three plane families from the front; elbow arch and hand dihedral |
| Inner arm close to a rectangle from above; light rectangular under-covert panel with straight ends | F2, F5 | P2, P5 | Converging arm outline (§4); under-wing coverts as a graded row with a shaped edge, not a rectangle |
| Tail-root pinhole (underside silhouettes) | F3, F6 | P3, P6 | Rump-to-tail junction declared continuous; tail roots inside the rump with overlap; under-tail covert |
| Slivers at the mouth and the wrist; a tan tab at the wrist; loose strips under the arm | F6, F8 | P6, P8 | Every secondary element has a host, a root frame and an overlap; the gape is a declared seam with no open gap |
| Lines on the fingers and the side-view wing that mark no form change | F4 | P4 | Lines only on declared edges; each declared fold visibly changes the plane |
| Near-hand widths nearly equal; notch steps on one diagonal; primaries spray from one wrist point from above | F5 | P5 | A series law with two groups, a non-linear width profile, non-collinear notches and roots spread along the hand |
| Fingers start abruptly after the rounded inner blades | F3 | P3 | The hand's trailing edge continues the secondaries' line into the fingers (C junction) |

## 2. Step 1: gesture and landmarks

- **Pose.** As v5: a banked glide of 20°, turning toward the viewer, pitched 3° nose down, head turned 9° into the turn, inner (near) wing flexed 9° at the wrist, tail twisted with the bank. The hero camera is v5's, so the comparison is fair.
- **Spine landmarks** (x along the body, L = bill tip to tail tip, about 1.0): bill tip 0.525; gape and bill base 0.40; brow (forehead break) 0.375; crown 0.33; nape 0.27; neck base 0.22; breast (deepest section) 0.11; wing root mid 0.02; vent 0.13 behind; tail root 0.165 behind; central tail tip 0.505 behind.
- **Wing landmarks** (along the span u, from the body side): shoulder 0.06; elbow 0.20; wrist 0.40, the most forward point of the leading edge; hand tip about 0.95.

## 3. Step 2: section program (P1)

Each keyframe is a different **shape**, not a scaled copy. Shapes are described by aspect (height to width), peak (where the top is), side lean, and fill (boxy or pointed).

| Keyframe | Aspect h/w | Shape, and why |
|---|---|---|
| Bill base and brow (0.375–0.40) | 1.25 | tall and narrow: the bill's base is deep and the forehead is steep (B's head) |
| Crown (0.33) | 1.05 | a flat crown plane between two temple folds, cheeks leaning in below: the domed head of B, as planes |
| Nape (0.27) | 0.95 | pinched: the concave nape fold separates head from body |
| Neck base (0.22) | 0.95 | round, the hackle strip hangs below |
| Breast (0.11) | 0.95, deepest | full round bottom, the lowest point of the body; sides lean out below the wing root |
| Back at wing root (0.02) | 0.75 | broad, flat-topped with the low dorsal ridge (B's ridge); the wing roots sit on its shoulders |
| Vent (−0.13) | 0.55 | wide and flat: the body flattens into the tail |
| Tail root (−0.165) | 0.35 | flat plate, the width of the tail root, so the junction to the tail is continuous |

Proposed diagnostic (method §6, P1): normalised aspect, peak and fill vary by more than 0.1 between neighbouring keyframes of differing function. Reported on the sheet; not a verdict.

## 4. Step 3: outlines (P2)

- **Arm planform.** The root is broad, with the tertials fairing onto the flank. The leading edge sweeps forward to the wrist and bows out at the patagium. The trailing edge sweeps forward faster, so the edges **converge**. Root chord about 0.40 L, wrist chord about 0.29 L, a ratio of about 0.72, against v5's 0.96.
- **Hand planform.** It broadens again at the inner primaries, then splits into fingers. The longest feathers are P6 and P7.
- **Body profile.** The back line rises from the tail to the shoulders and falls into the nape; the belly line falls from the vent to the breast and rises into the throat. Neither line is parallel to the other over any run longer than the body depth.
- **Tail.** A wedge, the central blade longest (B).

## 5. Step 4: junctions (P3)

| Junction | Class | How |
|---|---|---|
| Bill to head | B (stated): the bill is a separate horny sheath | the bill's base sits inside the head shell; the gape line is a declared seam with no gap |
| Head to neck at the nape | B (stated): the nape fold | one concave valley fold at the nape landmark |
| Neck to body | C | the section program flows from neck to breast with no ring line |
| Body to wing (shoulder) | C over the top, B underneath | on top, the covert leaf overlaps the back; underneath, the under-wing coverts root on the flank |
| Arm to hand (wrist) | C on the trailing edge, B (stated) on the leading edge | the trailing edge runs from the secondaries through the inner primaries without a step; the primary-covert leaf bridges the wrist on top and below and overlaps both |
| Inner primaries to fingers | C | the outline of the inner blades continues into the fingers; the first finger starts where the inner blades' trailing line reaches it |
| Rump to tail | C | the rump section is already a flat plate at the tail root; the tail blades root inside it, with an under-tail covert below |

## 6. Step 5: envelopes and tracts (P5, P6)

- **Declared negative spaces:** the finger slots (opening toward the tips), the space between the near wing and the body in the hero, and the gape **only** as a line, not a gap. **Nothing else.** In particular: no hole at the tail root, at the wrist, at the mouth or under the arm.
- **Tract: primaries.** Two groups. Inner blades P1–P5: broad and rounded, overlapping more toward the wrist, roots spread along the hand rather than from one point. Fingers P6–P9: slotted, P6 and P7 longest, P8 and P9 shorter toward the leading edge, P10 short and slim. The width profile is not monotone in the fingers (P7 is the widest finger), the fan steps are unequal, and the notch points are placed so that they are **not on one line** (target R² of a straight fit through the four notches below 0.95; v5 was close to 1).
- **Tract: secondaries and coverts.** The secondaries' trailing edge is gently scalloped with uneven steps. The covert leaf's notches are irregular. The under-wing coverts are a graded row whose rear edge follows the converging arm, not a rectangle.
- **Tract: tail.** Three keeled blades as B.

## 7. Step 6: edges (P4)

The maquette declares **panels**. A line is drawn only on a panel boundary (a fold, hinge or seam), on a free boundary or on the silhouette. Inside a panel the sheet is either flat or a gentle bend, shown with continuous shading and no line. A bend inside a panel that is too sharp for paper is reported (method §6, P4).

| Region | Declared folds and seams | Panels that bend |
|---|---|---|
| Head | gape seam; bill base seam; brow fold; two temple folds (crown plane edges); cheek folds; nape valley | the cheeks between brow and nape |
| Body | dorsal ridge; two flank folds below the wing root | breast and belly as one bent panel per side |
| Arm | hem fold at the leading edge; camber fold at about a third of the chord; covert leaf edge | the secondary plane, gently cambered |
| Hand | each blade's rachis (a mountain fold); the primary-covert leaf edge | none |
| Tail | each blade's keel | none |

## 8. Step 7–8: evidence on the sheet

The v6 sheet keeps the ART-1 checklist (hero, front, side, top, underside, close-ups, silhouettes on light and dark, district strip, hierarchy, ink context, landmarks, pose intent, target ratios, banner, provenance, digests). A second board adds the method's artefacts: the section strip, the planform and profile overlay, the junction table, the crease declaration map, and the diagnostic read-outs. A third board puts v5 and v6 side by side at **the same camera, scale and light**, for hero, top, underside, front and side, with matched crops of the head, the arm, the wrist, the hand and the tail root, and the silhouettes. It also shows v6 drawn with v5's line and shading settings, so that a reader can see which changes are form and which are drawing.

## 9. Proportion intent (not tolerances)

As v5, measured and reported, not fitted: span/L about 2.0; tail/L about 0.33; bill/L about 0.12 (B's bill); head : body depth about 0.70; arm : hand along the leading edge about 35 : 65.

## 10. Not claimed

- That v6 folds from paper, or that it and Sheet B are one folding of the same sheets (packet §8.2, H8). The **perched-to-flight re-fold is unverified**.
- Planarity, convexity, collision, closure, thickness or structural support of any maquette part. The maquette's panel and bend read-outs are drawing aids, not GEO-1 evidence.
- Anything about Q1–Q6 or ADR 0019.

## 11. Iteration log

The target above is fixed at the commit that adds this file. Any later narrowing or deviation is logged here, with its reason, and is not hidden.

| Round | Seen in the pixels (self-assessed) | Change |
|---|---|---|
| v6-1 | The first loft used cosine easing between keyframes. It flattened the slope at every keyframe (a band source of its own), and the diagnostics showed the brow fold at 1–4°, a line marking no form change. A panel bent 80° internally: at the nape, tilted section frames made neighbouring rings cross | Catmull-Rom section program inside each declared segment, with breaks only at segment boundaries; sections sliced in fixed vertical planes; the head yaw ramps along the neck instead of stepping |
| v6-2 | From the top, the head read as a smooth bulb on a pinched neck. The pinch belongs to the dorsal profile, not the plan width | Temple folds moved inboard, so the crown reads as a plane; nape kept low but no longer narrow in plan |
| v6-3 | Declared folds under 8° on the cheeks, the throat and the arm camber, so lines without a form change | The brow fold is declared only across the crown, where it is a real break; the camber at the wrist is stronger. Read-out: no declared fold under 8° |
| v6-4 | The near arm in the hero read as one pale plate | The secondary tier became four unevenly spaced pleats, alternating mountain and valley (a series law, P5), as B-2 v3's pleated arm did |
| v6-5 | The silhouette read-out (P6) found the tail-root pinhole in v5 (86 px² at 400 px height) and a larger one in v6 (246 px²). Cause: the arm's arch and camber lift its root, and the bank swings its projection out from the narrow vent flank. An unresolved junction (P3) | The arm, its pleats and its coverts are rooted inside the body (root at u = 0.03), and a tertial fairing joins the trailing edge to the flank and the tail root. Read-out: no hole in the hero, top or underside; the side-view gap between the wings is declared |
| v6-6 | Finding about the method, not the bird: the proposed P5 straight-line test on notch points did **not** flag v5 (R² 0.15 in the wing plane, 0.77 in the hero view of the near hand, against a proposed flag of 0.98). The reviewer's "one diagonal" is an evenly stepped, monotone arc in the judged view | v6's notches are staggered (hero R² 0.20, non-monotone). The method's P5 diagnostic is revised to be measured in the judged view and to flag a regular monotone progression (method §12). Width profile: P7 widest, not a monotone shrink |

**Deviation from §6 and §7, logged.** The arm root moved from u = 0.06 to u = 0.03 so that it overlaps the body (§6, P8). The tertial fairing is a new secondary element that §6 did not name; it is the "deliberate overlap" that §5 asks for at the rump-to-tail junction. Measured on v6 (reported, not fitted): span/L 2.03, tail/L 0.35, bill/L 0.12 (B's bill), head : body depth 0.74, arm chord wrist/root 0.72 (v5 0.95).

## 12. B-2 v7 target (committed before any v7 drawing)

The independent round-1 review found v6 **NEEDS REVISION** (packet §9.2). v6 stays unchanged as the reviewed record. B-2 v7 is a new file with a new digest. It keeps §2–§9 above and answers the review through the same method steps, not by bird-only patches:

| Review finding | Step and principle | v7 target |
|---|---|---|
| Hero crops the longest fingertips (blocker) | 8 (read every view) | The hero camera moves back. **v5 is re-rendered at the same new camera**, so the comparison stays matched; the framing change is stated on the board |
| Eye missing; identity with Sheet B weakened | 1 (landmarks), layer S | The eye sits on the cheek plane at mid-head, as in Sheet B |
| Smooth shading across doubly curved crown, throat and belly (shader rescue) | 6 (edges), P4, method §4.0 | Crown, throat and belly become plates that are flat across their width, so every panel can bend only along its length (developable; read-out: no angle defect). Continuous shading is used only in such panels. The board adds a **flat-faceted control** of v7, with declared lines and flat faces, so the reader can see the geometry without any smoothing |
| Wing root and fairing lie over the back; the body is halved in the top hierarchy | 4 (junctions), P3, P8 | The arm's camber and arch fade to zero at the root, so the root passes under the back; the covert leaf and hem start at the flank; the tertial fairing moves under the body (an under-tone part) |
| Tan strip at the wrist; line stubs in the underside coverts; dashed line at the rump | 5 and 6, P6, P8 | The under-wrist covert lies inside the upper leaf's outline; the under-covert rows overlap less; the under-tail covert is lowered off the tail blades |
| Finger roots meet at one point; inner blades jump to fingers | 5, P5, P3 | Roots spread along a longer hand; P5 lengthened, so the trailing line runs into P6 |
| Captions overclaim (panel count, "roots spread", crown "plane") | 8 | Captions computed from the model or limited to what the pixels show |

Not changed: pose, bank, cameras other than the hero distance, proportions (§9), and everything §10 does not claim.
