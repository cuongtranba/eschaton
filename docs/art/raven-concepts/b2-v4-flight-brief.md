# B-2 v4 flight revision: design target and intent

- Status: **DESIGN TARGET, committed before any drawing or maquette change.** It authorizes nothing and approves nothing. At the commit that adds this file, no B-2 v4 drawing, maquette script or render exists. The revision answers owner decision **ART-D3b** (2026-11-27): "revise B-2 wing and flight pose before approval". Whatever it produces is **pending the owner's ART-1 decision**, even if the independent review finds it credible.
- Direction: Concept B, "Sumi Sculptural Raven" (perched), was selected by the owner (ART-D3a) at Sheet B v4, SHA-256 `554069333c47d2c8adde05f0fa4866be5d278d27873807cac7e76a694ec4f74f`. B-2 v4 must read as **the same bird** in flight. It does not change Sheet B, its source `c2_sumi.py`, or any other historical sheet.
- Replaces: nothing. B-2 v3 (`raven-concept-b2-sumi-flight.png`, SHA-256 `60887d90ea23c0bfe5df8b31aa8d2f84ba4be3becc40133e40acef9dc2122672`, source `c2f_sumi_flight.py`) stays in the repository unchanged, as the "before" in the comparison.
- Out of scope: Foldon or any package or app code, Geometry V4, Phase 4, imported or generated meshes, AI imagery, shaders used to hide form, extra facets used as a substitute for design, and any claim of physical foldability. ART-D3c is not authorized, so every number below is a **design intent**, not an ART-4 tolerance.

## 1. What is wrong with B-2 v3, at its actual pixels

The round-4 reviewer's findings (decision packet §3), re-checked on crops of the committed v3 sheet, plus two more from my own inspection. I drew v3's successor, so these findings are self-assessed.

| # | Part, view | Defect | Bible anti-pattern |
|---|---|---|---|
| D1 | Near hand, hero | Four long blades of near-equal width leave a straight wrist edge almost parallel: a four-tine claw | planar rake (§5) |
| D2 | Far hand, hero; arm close-up | The hand is a separate rectangular plate with a near-vertical trailing edge; the fingers sprout from its end like a glove | hand separation; plank limb |
| D3 | Arm, hero and close-up | The arm is one large flat trapezoid with a regular saw-notch trailing edge; it has no camber, leading-edge thickness or taper | plank limb (§5) |
| D4 | Arm close-up | A stray fragment sits at the lower left of the frame | meaningless line |
| D5 | Head, hero and close-up (own finding) | Ring-banded facets make the head read as a segmented cylinder, unlike B's domed head with its nape fold and forehead plane | — (identity drift from B) |
| D6 | Throat, hero and head close-up (own finding) | The small ruff triangles under the jaw read as debris, not as sleeked hackles | gratuitous detail |

## 2. Identity kept from Concept B

These are the selected direction's traits. B-2 v4 keeps them and does not redesign them.

- **Few, large, purposeful planes.** The face budget stays in B's range: about 260 faces for B, and **at most about 450** for B-2 v4. A larger count would mean detail is substituting for design.
- **Primary mass.** A pentagonal-section body with one dorsal ridge.
- **Head and neck.** A compact neck with a concave nape fold, a domed head with an angular forehead plane, the eye at mid-head, and a heavy bill arched along the culmen. The head is built from B's own head profile, rotated into the flight axis, not re-invented.
- **Tail.** B's keeled three-blade wedge, central blade longest.
- **Throat.** A hackle strip, sleeked in flight, read as one jagged-edged plane. B's caveats (a bib-like strip in shade, the hooded front column, the dark triangles) belong to Sheet B and are **not** silently fixed here. They stay open in the packet.

## 3. Wing anatomy that the design follows

Bounded research, 2026-11-27. **Verified** means the page was opened and the statement was read there. Numbering is P1 innermost to P10 outermost. Full citations are in [`art-direction-sources.md`](../../research/art-direction-sources.md) §5.

| Fact | Source | Status | Design consequence |
|---|---|---|---|
| A raven shows four finger feathers (P6–P9); a crow shows five (P5–P9). Both have ten primaries | Corvid Research, "A matter of a pinion" (2018): "the crow has five evident finger feathers (feathers 5-9) whereas ravens only have four (feathers 6-9)" | **Verified**, but the source is an unsigned blog post (its photos are credited to the Slater Museum), not a peer-reviewed or specimen source | Four slotted fingers |
| Raven outer vanes are partly narrowed on H6–H9; H10 is narrowed along its whole length; on H5 the narrowing is only hinted. Inner vanes are clearly narrowed on H6–H10 | Featherbase, *Corvus corax*: "Die Außenfahnen der H6 bis H9 sind nach außen hin teilverengt, H10 hingegen ist komplett verengt … auf H5 ist die Teilverengung nur ansatzweise zu erkennen" | **Verified** on the page. The page does not state its numbering direction; "H10 fully narrowed" only makes sense if H10 is the outermost feather (inference) | Each finger narrows after mid-length, so the slots open toward the tips. P10 is a slim blade, and P5 is barely slotted |
| The longest primary is P6 (4 of 6 specimens) or P7 (2 of 6) | Featherbase, same page, measurement table | **Verified** | The wingtip is formed by P6–P7. P8 and P9 are progressively **shorter** toward the leading edge, so the fingers are graduated and are not equal tines |
| P10 is clearly shorter than P9, about as long as P3–P4: short, but not a stub | Meinertzhagen 1926, *Novitates Zoologicae* 33, wing-formula table | **Reported** by the research pass from a rendered PDF table; **not re-checked** by me | P10 is a short, slim leading blade at about half finger length |
| Longest primary 315–396 mm against longest secondary 217–240 mm; wing length (carpal joint to tip) 368–475 mm; hand-wing index 31–47 % | Featherbase measurement table (wing length from AVONET) | **Verified** | The hand is the longer part of the extended wing, so arm : hand along the leading edge is about 35 : 65 (corrected from an earlier draft figure of 45 : 55) |
| Wing span 116–153 cm, length 54–71 cm | Wikipedia, "Common raven" | Verified (secondary source), already in §5 of the sources file | span / L about 2.0–2.2 |
| The feathers "are stacked up, and slide across each other like certain folding fans"; "from below we see mainly the inner webs of the feathers, and from above mainly the outer webs" | Sibley Guides, wing feather article | **Verified** | From above, each flight feather's outer vane lies **over** the inner vane of its neighbour toward the wingtip. This direction is an **inference** from the quote, not a stated rule |
| Covert rows overlap like roof tiles: marginal coverts on the leading edge, then lesser, median and greater coverts; the primary coverts and the alula sit over the hand's base | Wikipedia, "Covert feather"; US FWS Feather Atlas glossary; BTO wing-topography diagram | Verified (secondary sources and a labelled diagram) | Arm layering: hem (marginal coverts), then the covert leaf, then the secondaries. The primary-covert leaf and the alula bridge the wrist |
| Ravens soar with the wings held flatter than crows, which glide in more of a "V" | San Fernando Valley Audubon, "Crows and ravens" | Verified, but a local-chapter page | A shallow dihedral (a few degrees), not a V |
| Long, narrow, fingered wings; a wedge tail with the central pair longest | Audubon field guide; Featherbase | Verified | Narrow hand; the tail as in B |

**Not found or unverified, and therefore not used as fact:** ulna and digit lengths and the wrist's position along the leading edge; how far the greater coverts reach over the secondaries; glide sweep and dihedral angles; the shape of the raven's secondary trailing edge and its camber; "a longer neck in flight than a crow" (search snippets only). Where the design needs these, it uses **stylised choices**, named as such in §4 and §5.

## 4. Design target, segment by segment

The wing reads as **one continuous limb**: shoulder, arm, wrist and hand. Each transition is an overlap of layers, never a butt joint or a seam across the whole chord.

| Segment | Target |
|---|---|
| Shoulder | The wing root sits high on the flank behind the neck base. The covert layer overlaps the body's shoulder, so there is no gap or slot at the root |
| Arm (humerus and forearm) | Three layered planes, front to back. (1) A leading-edge **hem**, a folded-over band that gives the edge visible thickness. (2) A **greater-covert leaf** with a graduated, irregular notched edge, overlapping roughly the front half of the secondaries. (3) A **secondary plane** with a gently scalloped trailing edge. The arm is **cambered**: a spanwise mountain crease sits at about a third of the chord, so the section is a shallow arch and not a flat slab. The chord tapers slightly from shoulder to wrist |
| Wrist | The most forward point of the leading edge. The leading edge kinks there: it sweeps forward from shoulder to wrist, then back from wrist to tip. A small **alula** blade and a **primary-covert leaf** overlap the arm and the hand across the joint, bridging them. No full-chord seam and no vertical trailing edge at the wrist |
| Hand: inner primaries | Overlapping blades of graduated length fanning from the wrist, not one plate. Their trailing edge continues the secondaries' trailing-edge line into the fingers without a step |
| Hand: outer primaries (fingers) | **Four** slotted fingers, P6–P9, that **fan** with unequal gaps (wider toward the tip). They are **graduated**: P6 and P7 form the tip, and P8 and P9 are progressively shorter toward the leading edge. Each narrows after mid-length (§3), curls up, and twists progressively more than its inner neighbour. Seen from above, each one lies over the root of its outer neighbour (§3, inferred). **P10** is a short, slim leading blade. P5 is barely slotted. The finger count rests on a verified but unsigned source (§3) |
| Tail | B's keeled three-blade wedge, slightly twisted into the turn |

**Stylised, not sourced:** the camber crease position, the scalloped trailing edge, the leading-edge hem used as thickness, the wrist kink angles and the finger fan angles. §3 found no raven-specific source for them. They are design choices in B's plane language, not anatomy claims.

## 5. Pose

- A **deliberate banked glide**, turning toward the viewer, at about 18–22° of bank.
- **Asymmetry carries the gesture.** The inner (lower) wing is slightly more flexed at the wrist than the outer wing, and the head is turned a little into the turn. The tail twists with the bank.
- A shallow **dihedral**: the wings are raised a few degrees (ravens soar flatter than crows, §3) and the fingertips curl up. The exact angles are stylised choices.
- The hero is a three-quarter view from slightly above and in front, so both hands, the wrist kinks and the wedge tail read at once. The silhouette must not be a frontal, symmetric spread (heraldic spread, bible §5).

## 6. Proportion intent (not tolerances)

| Ratio | Intent | Note |
|---|---|---|
| Span / L | about 2.0–2.1 | L is bill tip to tail tip. The sources give 2.0–2.2 (§3). Measured on the maquette and reported, not fitted |
| Arm : hand, along the leading edge of one wing | about 35 : 65 | from the wing-length and span data in §3; the hand, including the fingers, is the longer part |
| Finger slots: depth / hand chord at the wrist | about 0.35–0.45 | deep enough to read as slots at 24 px |
| Tail / L | about 0.33–0.37 | wedge, central longest |
| Bill / L | about 0.10 | heavy and arched |
| Head ahead of the wrist line | clearly ahead | the head projects in flight |

These are reported as measured on the maquette. They are not ART-4 tolerances (ART-D3c is not authorized).

## 7. Deliverables (all new, versioned files; nothing historical is overwritten)

| File | Content |
|---|---|
| `source/c2f4_sumi_flight.py` | the B-2 v4 maquette script (design asset only; imported by nothing) |
| `source/concepts.json`, key `c2f4` | sheet text for v4 (the existing keys are unchanged) |
| `source/b2v4_boards.py` | the detail and comparison board composer (design asset only) |
| `raven-concept-b2-sumi-flight-v4.png` | Sheet B-2 v4: hero, front, side, top and underside, close-ups, hierarchy, ink context, silhouettes on light and dark, district strip, intent notes |
| `raven-concept-b2-v4-details.png` | Close-ups of the near and far hand, the wrist, the arm section and the head, with a v3 → v4 before-and-after comparison at matched views, and neutral clay beside ink |
| `renders/b2v4/projection.json`, `spec.json` | landmark projections, bounds and face counts |

Each image carries the label "PROPOSED CONCEPT ARTWORK, pending owner ART-1 review, NOT approved, NOT implemented geometry", and its SHA-256 is recorded in the decision packet.

## 8. How the result is judged

1. **Self-check** against §1 (each of D1–D6 gone, at the pixels) and the bible's §5 anti-patterns. A self-check is not a verdict.
2. **Independent review** of the final pixels, captured after the last material change, by an agent that made none of the artwork and reads none of the source. It applies the ART-2 checklist and names every finding by part and view.
3. If the result is not credible, it is reported as **NO-GO** with the outstanding defects. It is not forced, and it is never approved by the agent.
4. In every case the owner decides ART-1 for B-2 v4. Until then it is `NOT VERIFIED`.

## 9. Not claimed

- That B-2 v4 folds from paper, or that it and Sheet B are one folding of the same sheets (concept README §E.2 stays a hypothesis).
- Collision, closure, thickness or bond feasibility: all `NOT VERIFIED`.
- Anything about Q1–Q6 or ADR 0019. The wing's non-axis root and wrist ports (Q1), the closed head and body shell (Q4) and detachment in Collapse (ADR 0019, Proposed) remain open owner decisions.

## 10. Iteration log

The target above (§1–§9) is unchanged since commit `6a26c50`, which precedes every B-2 v4 drawing and source file. The rounds below are the author's self-iteration on scratch renders before the first artwork commit (`e519ea1`). They are not review verdicts.

| Round | Seen in the pixels (self-assessed) | Change |
|---|---|---|
| 1 | Hero cropped both wingtips. The free finger parts were too long and nearly parallel on the flexed near wing. The alula stuck forward like a horn in the top view. The primary-covert leaf was a tall box at the far wrist. Regular saw-teeth on the covert and secondary edges | Wider finger bases with emargination after mid-length; wider fan angles; alula laid along the leading edge; lower leaf; fewer, irregular notches; camera pulled back |
| 2 | The head was about 0.85 of body depth, so it read as a box (B is about 0.65). The hem read as a plank. Close-up cameras framed nothing useful | B-proportioned head (0.69 of body depth); tapered hem; stronger camber; cameras re-aimed |
| 3 | The far eye showed above the crown. A gap at the chin read as an open hole. The hem's dark underside tone read as a board edge | Eye moved onto the lower side face; lower mandible extended back and hackle strip moved up; hem fold in paper tone with a convex leading edge |
| 4 | The wrist leaf pointed inward like an arrowhead. From the front, the arm read as a straight board | Blunt inner edge and lower lift on the leaf; slight elbow arch along the arm; camber tapering to the wrist |
| 5 | Presentation: an arrow glyph rendered as tofu; the ink raven was cropped; the "P10" callout pointed at a barely visible feather | Captions reworded; optional ink scale; the P10 callout dropped from the hero (P10 is shown in the close-ups) |

**Measured deviation from §6.** The bill is 0.12 L, against an intent of about 0.10. It is B's own bill, scaled by 1.12 with the rest of B's head; identity with B was kept rather than the number. The other intents are met: span 2.00 L, tail 0.33 L, arm : hand 33 : 67, head : body depth 0.69.

### After independent review round 1 (B-2 v4: NEEDS REVISION, packet §7.1)

B-2 v4 is kept unchanged as the reviewed record. **B-2 v5** answers the review in new files: `c2f5_sumi_flight.py`, derived from v4, `b2v5_boards.py`, and the v5 sheet and details board. The design target in §1–§9 is unchanged. Two choices narrow it, and both are recorded here rather than hidden:
- **The alula is omitted.** The brief named it as a small tertiary blade. It read as an unreadable sliver at the wrist, and floated in the side view, so it did not earn its place (bible §4.2). The primary-covert leaf alone bridges the wrist, above and below.
- **The arm's taper comes from the planform.** The leading edge bulges, and the trailing edge runs forward from a broad root to the wrist, in an S-curve. The chord shrinks from about 0.40 L to about 0.38 L. Combined with the bulge and the S-curve, it reads as a taper rather than a rectangle.

| Round | Seen in the pixels (self-assessed) | Change |
|---|---|---|
| v5-1 | Answering the review: plank arm in top and underside, slab hem, glove hub underneath, repeated finger unit, jaw gap, neck hoop, head bands, thin tail, clipped side view | Broad arm root and S-curved trailing edge, stronger leading-edge bulge; hem as one bevel facet; under-wing covert leaves on arm and hand; each finger its own width, notch point and fan gap; hackle strip derived from the throat sections, set inside them; four head rings instead of six; tail fan ±0.24 rad; side, front and far-hand cameras re-framed |
| v5-2 | The alula still read as a sliver (top: a forward spike; side: floating) | Alula removed |
| v5-3 | The inner blades' raised spines pierced the primary-covert leaf: the review's "dangling lines". The hero touched the frame's bottom edge | Lower blade roots and ridges below the leaf (inner over outer kept); hero camera pulled back |
| v5-4 | The wrist close-up did not show the leaf; a board caption overclaimed "same orthographic cameras" | Near-top-down wrist camera; caption now says "share orthographic view directions" |

Measured on v5: span 2.00 L, tail 0.33 L, bill 0.12 L (B's bill, as in v4), arm : hand 33 : 67, head : body depth 0.70.

**Independent review round 2 of v5: NEEDS REVISION** (packet §7.2). The revision stops at v5. The open defects are listed there, and B-2 stays pending the owner's ART-1 decision.
