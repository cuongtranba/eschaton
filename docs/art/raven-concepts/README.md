# Raven concepts A · B (+ B-2) · C (ART-1 candidates)

> **Status: CONCEPT ARTWORK. Not implemented geometry.** On 2026-11-27 the owner selected **Concept B (perched), Sheet B v4 at SHA-256 `554069333c47d2c8adde05f0fa4866be5d278d27873807cac7e76a694ec4f74f`, as the artistic direction** (ART-D3a). That selects a direction. It does not approve final object quality, geometry or foldability. **B-2 v3 is not approved** (ART-D3b: revise before approval), and any revised B-2 is pending a new owner ART-1 decision. A and C are not approved. ART-D3c (tolerances) is not authorized. Record: [decision packet](../../review/art-1-raven-decision-packet.md) §0.
>
> The sheets are design artifacts. They are not production meshes, not geometry contracts, and not evidence for any GEO gate. Physical foldability, collision, closure and structural bonds are **NOT VERIFIED** for any concept. The sheets apply the adopted [Visual Bible](../visual-bible.md). The labels printed on the historical sheets ("pending owner ART-1 review") describe their state when they were drawn, and the images are kept unchanged.

## Artwork

| File | What it shows |
|---|---|
| [`raven-concept-a-anatomical.png`](raven-concept-a-anatomical.png) | **Sheet A v4**: anatomical folded raven, gliding |
| [`raven-concept-b-sumi.png`](raven-concept-b-sumi.png) | **Sheet B v4**: sumi sculptural raven, perched and calling |
| [`raven-concept-b2-sumi-flight.png`](raven-concept-b2-sumi-flight.png) | **Sheet B-2 v3**: the same sumi raven in a banked glide (flight study). **Not approved** (ART-D3b: revise before approval); kept unchanged as history |
| [`raven-concept-b2-sumi-flight-v4.png`](raven-concept-b2-sumi-flight-v4.png) | **Sheet B-2 v4**: the first flight revision under ART-D3b, drawn after the committed [brief](b2-v4-flight-brief.md). Independent review: **NEEDS REVISION** (packet §7.1). Kept unchanged as the reviewed record |
| [`raven-concept-b2-v4-details.png`](raven-concept-b2-v4-details.png) | B-2 v4 close-ups and v3 beside v4 (reviewed record) |
| [`raven-concept-b2-sumi-flight-v5.png`](raven-concept-b2-sumi-flight-v5.png) | **Sheet B-2 v5**: the second flight revision, answering the v4 review. Independent review: **NEEDS REVISION** ("close"; cleanup-level defects, packet §7.2). **Pending owner ART-1**; not approved |
| [`raven-concept-b2-v5-details.png`](raven-concept-b2-v5-details.png) | B-2 v5 close-ups (near and far hand, wrist, arm front elevation, head), v3 beside v5 at matched view directions, clay beside ink, silhouettes on light and dark fields |
| [`raven-concept-c-modular.png`](raven-concept-c-modular.png) | **Sheet C v2**: modular tessellated raven, upstroke. Independent review: NO-GO as a separate direction |
| [`raven-concepts-comparison.png`](raven-concepts-comparison.png) | A, B, B-2 and C side by side: hero, ink context, silhouette, district scale, hierarchy |
| [`v3-failure-anatomy.png`](v3-failure-anatomy.png) | Actual V3 pixels (PR #11 @ `616b0cf`, captured at `74c686f`) beside A and B, per GEO-2 defect |

The exact file digests reviewed by the owner are listed in the [decision packet](../../review/art-1-raven-decision-packet.md) §2.

Each sheet contains:

- A large three-quarter hero with annotated landmarks.
- An orthographic turnaround: front, side, top, and the underside for the flying poses or the back for the perched pose.
- Close-ups of the head, the wing and the tail.
- A form-hierarchy diagnostic.
- Filled silhouettes on light and dark fields, with context props hidden.
- A district-scale strip at 96, 48, 24 and 12 px, for both signature silhouettes.
- An ink/woodcut context study.
- Design-intent notes.

### How the artwork was made, and its limits

Every view of a sheet comes from **one hand-authored sculpt maquette**, so the hero and the turnaround agree by construction.

- **Modelling.** Each maquette is a Blender 5.2.1 Python script ([`source/`](source/)), rendered headless with EEVEE: flat values, no cast shadows, and Freestyle crease, border and silhouette lines.
- **Compositing.** The sheets are composed with Pillow.
- **Inputs.** No imported or generated meshes, no AI image generation, and no external artwork. The ink context backgrounds are drawn procedurally in [`source/sheet.py`](source/sheet.py) after the project's own reference.

These scripts are drawing tools. They are not imported by any package, and they are not a Geometry V4 implementation. They place sculpted planes; they do not fold sheets. B and B-2 are **two separately authored maquettes**: that they are one folding of the same sheets is a hypothesis (§E.2).

To reproduce, with Blender 5.2.1 and Pillow 11 (the V3 screenshot directory comes from PR #11 @ `616b0cf`):

```sh
cd docs/art/raven-concepts/source
for c in c1_anatomical c2_sumi c2f_sumi_flight c3_modular; do
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python render.py -- $c out/$(echo $c | cut -d_ -f1)
done
for c in c1 c2 c2f c3; do python3 sheet.py $c out/$c sheet-$c.png; done
python3 compare.py <V3-worktree>/docs/screenshots .
# B-2 v4 (2026-11-27), rendered outside the repository:
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python render.py -- c2f4_sumi_flight <scratch>/c2f4
python3 sheet.py c2f4 <scratch>/c2f4 sheet-c2f4.png
python3 b2v4_boards.py <scratch>/c2f <scratch>/c2f4 b2v4-details.png   # <scratch>/c2f is the unchanged v3 maquette
# B-2 v5:
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python render.py -- c2f5_sumi_flight <scratch>/c2f5
python3 sheet.py c2f5 <scratch>/c2f5 sheet-c2f5.png
python3 b2v5_boards.py <scratch>/c2f <scratch>/c2f5 b2v5-details.png
```

`sheet.py` gained three optional `concepts.json` fields: `ink_scale` and `ink_left` for the ink study, and `district_sub` for the district caption. Their defaults reproduce the earlier sheets; only `c2f4` and `c2f5` set them.

The committed PNGs were then palette-quantised to 256 colours to keep the repository small (2.7 MB in total). Render outputs are not committed, apart from `renders/*/projection.json` (landmark projections and bounds) and `renders/*/spec.json` (hierarchy classes and module counts).

**Limitations of the medium.** These are maquette renders, not hand illustration.

- Lines come from a renderer, not a brush, so the ink studies only approximate a carved woodcut. The reviewer noted the absence of gouge texture.
- The heroes are cream paper for form review (GEO-5.1 neutral). The raven's black identity appears only in the silhouette and ink panels.
- Faces are flat planes. Curved creases are not shown.
- The paper is shown with no thickness.

### Iteration history

Every round was judged on pixels: by me first, then by an independent reviewer who did not make the sheets.

| Round | What happened |
|---|---|
| Self-iteration | **A:** washed out, gull-like head, saw-tooth tail; fixed. **B:** stilt legs, shield coverts, grape hackles; fixed. **C:** pointed kites made saw-teeth everywhere (the "repeated noise" anti-pattern); replaced by blunt shingles. |
| Independent round 1 | **A:** revise (dorsal fin, rake, straight bill). **B:** credible. **C:** NO-GO. Presentation: post inflating B's silhouette, cropped close-ups, a one-sided failure board. The four-finger fact was also corrected in this round. |
| Revision 2 | A v2; B v2 rebuilt after studying Kyōsai's crows and the Myōchin steel raven; new B-2 flight study; C v2 (calm hull, modules on the tracts only). |
| Independent round 2 | **A:** revise (over-hooked bill, keel belly). **B:** credible. **B-2:** revise (glove hand, slab arm). **C:** NO-GO as a separate direction. |
| Revision 3 | Flat values with no cast shadows on all sheets; A v3, B v3, B-2 v2. C geometry unchanged. |
| Independent round 3 | **A:** regressed (dorsal spikes larger, box hull). **B:** credible. **B-2:** palm plate. **C:** NO-GO. |
| Revision 4 | A v4 (rounded section, wing root on the flank, hackle strip); B v4 (hackle strip, covert leaf moved); B-2 v3 (diagonal hand taper, graduated fan). |
| Independent round 4 (final) | **B:** CREDIBLE. **B-2:** needs revision (show as a flagged sketch). **A:** needs revision. **C:** NO-GO. Details are in the [decision packet](../../review/art-1-raven-decision-packet.md) §3. |
| Owner decisions (2026-11-27) | ART-D3a selects **B (perched)** as the direction; ART-D3b: **revise B-2** before approval. See the packet §0. |
| Revision 5 | [Brief](b2-v4-flight-brief.md) committed before drawing; bounded wing-anatomy research verified the four-finger claim's source and the wing formula. **B-2 v4**: new maquette `c2f4_sumi_flight.py`, B's own head profile, a cambered layered arm, a bridged wrist, and a graduated fanned hand. B, B-2 v3, A and C are unchanged. |
| Independent round 5 | **B-2 v4: NEEDS REVISION.** Plank arm in the top and underside views, slab hem, glove hub underneath, a repeated finger unit, a jaw gap and neck hoop, a clipped side view, wrist clutter and presentation errors (packet §7.1). |
| Revision 6 | **B-2 v5** (`c2f5_sumi_flight.py`, derived from v4; v4 unchanged): broad arm root tapering to the wrist with an S-curved trailing edge, bevelled hem, under-wing coverts, one flat primary-covert leaf, alula removed, individual finger widths and notches, the hackle strip set inside the throat, fewer head rings, a wider tail fan, and corrected framing. |
| Independent round 6 | **B-2 v5: NEEDS REVISION** ("close"). Fixed: the jaw gap, the hoop, the clipping, the sliver, the crop, the pairs and the dark-field silhouettes. Open: lines that mark no form change on the fingers and the side wing; a banded head in the top and underside views; a near-rectangular inner arm from above; a tail-root pinhole; small slivers. **The revision stopped here** to keep the handoff bounded (packet §7.2–§7.3). |

## The directions

### A — Anatomical Folded Raven (gliding), v4

- **Intent.** A believable volume and a fully layered wing. It is the most naturalist origami of the set.
- **Primary form.** One lofted spine runs bill – head – nape – body – wedge tail. It has a neck waist and a rounded breast, and the breast, not a keel, is the lowest point.
- **Head.** Steep forehead, nape step, and a deep bill arched along the culmen.
- **Secondary forms.**
  - A thick leading-edge band (a hem, not a plank).
  - A covert tier.
  - Rounded secondaries.
  - Ten primaries: **4 long slotted fingers (P6–P9) and a short P10**.
- **Tertiary accents.** A hanging throat-hackle strip, a bristle flap, the eye facet and the alula.
- **Maquette figures.** Span/L 1.94; tail 0.37 L; bill about 0.10 L; about 1,000 faces.
- **Risk.** The most detail of the set. Tiers merge below about 24 px.

### B — Sumi Sculptural Raven (perched, calling), v4, plus B-2 flight study, v3

- **Intent.** Few, large, purposeful planes; a bold gesture; designed for the ink world first.
- **References.** Its proportions follow Kawanabe Kyōsai's crows: a domed head close on a plump body with a short neck, the eye mid-head, and a single primary blade with the tail extending past it. It also follows the Myōchin plated steel raven. The source list is in [`art-direction-sources.md`](../../research/art-direction-sources.md) §2.
- **Primary form.** A pentagonal-section body with one dorsal ridge and a concave nape fold.
- **Secondary forms.** A folded wing of covert leaf, secondary tier and one primary blade. The keeled three-blade wedge tail is about 0.27 L.
- **Tertiary accents.** A hanging hackle strip with a jagged lower edge on each side of the throat, stout legs, and the eye.
- **Maquette figures.** About 260 faces. The post is context and is hidden in the silhouette, district and hierarchy tests.
- **B-2, flight study.**
  - Banked 14° glide.
  - Arm: a covert band folded over a tapered, notched secondary plane.
  - Hand: the inner primaries continue the trailing edge as one tapering plane, with 4 long fingers and a short P10 beyond it.
  - Keeled wedge tail.
  - About 210 faces.

### C — Modular Tessellated Raven (upstroke), v2

- **Intent.** Structural rhythm. **One** folded chevron-shingle module in three sizes S, M and L, confined in v2 to the wing and tail tracts over a calm hull. The head anatomy was taken from A v2.
- **Module counts.** 95 placements of one definition: 38 small, 16 medium and 41 large.
- **Independent verdict, round 2.** **NO-GO as a separate direction.** Its round-2 fixes came from adopting A's head and hull, and its own idea, the shingle wing, still produces a comb block in side view and a heraldic top view. It is kept in the packet as evidence for what modular repetition does to a creature, not as a candidate.

## E — Construction feasibility (proposed, not proven)

Everything in this section is **hypothesis**. The unit "sheet" means a proposed standalone folded piece of paper. None of these modules has been folded, simulated or checked.


### E.0 Common frame

**Units.** 1.0 L means bill tip to tail tip. A Common Raven is 54–71 cm long. Ratios are targets for ART-1 tolerances; they are **not** measured geometry.

| Landmark ratio | Target | Tolerance proposed for ART-4 (**not authorized**, ART-D3c) | A | B | B-2 v3 | B-2 v4 | B-2 v5 | C |
|---|---|---|---|---|---|---|---|---|
| Span / L (flight) | 1.9–2.05 | ±0.08 | 1.94 | — | ≈1.9 | 2.00 | 2.00 | 1.77 (flexed upstroke) |
| Tail / L | 0.30–0.40 (wedge, central longest) | ±0.03 | 0.37 | ≈0.31 (shortened in v3) | ≈0.36 | 0.33 | 0.33 | ≈0.33 |
| Bill / L | 0.09–0.12, culmen arched | ±0.015 | ≈0.10 | ≈0.11 | ≈0.10 | 0.12 (B's bill scaled ×1.12; above the brief's 0.10 intent) | 0.12 (as v4) | ≈0.10 |
| Head : body depth | 0.65–0.8 | ±0.08 | ≈0.7 | ≈0.65 | ≈0.7 | 0.69 | 0.70 | ≈0.7 |
| Arm : hand along the span | about 35 : 65 (brief §3, from measured wing data) | — | — | — | — | 33 : 67 | 33 : 67 | — |
| Visible long fingers | 4, plus a short P10 | exact | 4 + 1 | folded (n/a) | 4 + 1 | 4 graduated (P6/P7 longest) + 1 | 4 graduated, individual widths + 1 | 9 L-modules fanned (≈4 read as fingers) |

The B-2 v4 and v5 figures are computed from the maquette's own coordinates before banking (bill tip to central tail tip, L = 1.027). They are reported, not fitted. The values in the target and tolerance columns stay **proposals**: ART-D3c was not authorized.

**Semantic part graph, shared by all three concepts.** Each slot has a mirror relation L↔R where paired.

```text
raven
 ├─ head      (bill.upper, bill.lower, crown, cheek.L/R, eye.L/R, bristle.L/R)
 ├─ throat    (hackles.L/R)
 ├─ body      (neck, mantle, breast, belly, rump)
 ├─ wing.L/R  (arm: leading-edge band, coverts, secondaries/tertials; hand: primary coverts, alula, P1–P10)
 ├─ tail      (rectrices, under-tail coverts)
 └─ legs.L/R  (thigh, tarsus, toes)     [perched only]
```

**What the construction work needs, whichever concept is chosen.** Port frames sit on non-axis edges: a wing root at a swept angle, and fingers fanned at 8–12° steps. That is open question **Q1** (where a non-axis seam lives). Seams that never fold are **Q2** (a `join` edge kind). Families of feathers are **Q3** (parameterised families). The domed head and the hull are closed shells, which is **Q4**. The tree-only crease model would leave an open seam there. Placing birds as props or agents in districts is **Q5**. Every new catalog version is **Q6**. Collapse and detach behaviour depends on **ADR 0019**, which is proposed and not accepted, and **Phase 4 is not authorized**. None of these is decided here.

### E.1 Concept A: anatomical folded raven

- **Topology.** The body is one closed lofted shell (neck to rump). The head is a shell joined at the nape. Each wing has three tiers: a leading band plus about 11 coverts, 12 secondaries, and 10 primaries with the alula. The tail has 12 rectrices.
- **Candidate modules.**
  - `vane`: one sheet folded on a centre mountain crease, in three length classes and two tip classes (round or pointed). It is used for secondaries, coverts, primaries, rectrices and hackles.
  - `hem-band`: a leading-edge tube fold.
  - `shell-segment`: a body ring panel set.
  - `bill`: two mandible sheets.
- **Ports.**
  - Every `vane` has a typed root port: a root edge of a given width class and a hinge axis tangent to its tract line.
  - Tracts provide rows of ports along a curve, which is a non-axis edge frame.
  - The `hem-band` exposes a row of covert ports.
- **Symmetry.** Mirror L↔R. Variants change length classes per tract (moult, juvenile).
- **Rigid fold path.** Wing extension is three hinges: shoulder, elbow-wrist and finger spread, each with a stated range. Glide is the rest pose. Feathers ride on their root hinges and fan by a shared spread parameter.
- **Hinge limits.**
  - Finger spread is 0–12° between neighbours.
  - Covert lift is 0–15°.
  - Tail fan is 0–25° in total.
- **Constraints.**
  - Local: overlap order (covert above secondary) and a minimum overlap per row.
  - Global: wedge outline (central rectrices longest), four long visible fingers, span/L inside tolerance, and the silhouette tests.
- **Assembly.** Body shell, then head and bill, then tail rectrices from the centre outward, then the wing leading band, then secondaries from inner to outer, then coverts, then primaries P1–P10, then the alula, then hackles and bristles.
- **Reuse.** One `vane` definition family serves about 50 instances per bird. It could be reused meaningfully on other birds and on plant leaves, where it does the same structural job.
- **Search scope.** A finite catalog plus bounded sampling of length classes. A grammar is needed only for tract layout. WFC is not suitable: these are anatomy slots, not a lattice.
- **Unproven.**
  - That a curved shell body can be built from tree-only creases (this needs Q4).
  - Collision between overlapping tiers through the wingbeat.
  - Covert lift clearance.
  - Paper thickness at the overlaps, which is not modelled.
- **Trade-offs.** It has the most modules (about 1,060 faces in the maquette) and the highest risk of becoming the V3 "lots of valid feathers" without design. It needs an LOD strategy that keeps only the spine, the wedge and the fingers at district scale.

### E.2 Concept B / B-2: sumi sculptural raven

- **Topology.** The body is one pentagonal-section shell with a dorsal ridge crease, about 10 rings. The head and bill sit on it.
- **Perched modules (B).**
  - Folded wing: a covert leaf, a secondary tier and one primary blade group, so 3–5 sheets per side.
  - Tail: three keeled blades.
  - Hackle fringe: one sheet per side.
  - Legs: two sheets.
- **Flight modules (B-2 v3, not approved).**
  - Arm: one sheet, a covert band folded over a tapered secondary plane with three pleats.
  - Primary-covert plate.
  - Four finger blades and a short P10.
  - Keeled three-blade tail.
- **Flight modules (B-2 v4, reviewed NEEDS REVISION; v5, pending owner ART-1).**
  - Arm: a `hem` (leading-edge fold), a cambered covert `leaf` and a scalloped secondary `pleated-plane`. These are three layers per side.
  - Wrist: an `alula` blade and a primary-covert `leaf`.
  - Hand: four broad inner `blade`s and four emarginated finger `blade`s, plus a short P10. That is nine blades per side, in about three length classes.
  - Tail: the same keeled three-blade wedge as B.
  - v5 removes the alula and adds an under-wing covert `leaf` on the arm and on the hand.
  - This is more parts than B-2 v3 (about 340–350 faces against about 210). The added parts are hand and wrist layering, which the review asked for. It is still one `blade` family, so Q3 (parameterised families) matters more for v4 than for v3.
- **Candidate modules.**
  - `blade` (long keeled vane), in two length classes.
  - `leaf` (covert), in two size classes.
  - `pleated-plane` (the arm).
  - `ruff` (hackle fringe).
  - `pent-shell`.
- **Ports.**
  - A wing root port on the shoulder, typed "arm".
  - A wrist port, typed "hand".
  - A tail root port, typed "tail-fan".
  - These are few, but they are non-axis (Q1).
- **Perched to flight is a re-fold, not a swap.** The same `leaf`, `pleated-plane` and `blade` instances unfold from the folded-wing pose to the glide pose about the shoulder and wrist hinges. That is a **hypothesis**. The two maquettes were authored separately and their sheet identity is not shown.
- **Hinge limits (proposed).**
  - Shoulder: 0–110° (folded to spread).
  - Wrist: 0–150°.
  - Finger spread: 0–10°.
  - Tail fan: 0–30°.
- **Constraints.**
  - Global: the head sits close on a short neck, the tail extends past the folded wingtips, four fingers show in flight, and the silhouette tests pass.
  - Local: blade overlap and ruff placement under the jaw.
- **Assembly.** Shell, then head and bill, then tail blades, then the wing (arm plane, then hand blades), then the ruff, then the legs.
- **Reuse.** `blade` is used for primaries and rectrices (the same structural job, a load-free vane), and also suits plant leaves and roof shingles. `pent-shell` suits other creatures. Few modules means strong identity per module.
- **Search scope.** A finite catalog. Pose variation along hinges is deterministic. No WFC is needed for the object, which fits Genesis district placement as a single prop or agent (Q5).
- **Unproven.**
  - That the perched and flight states are one folding of the same sheets.
  - That the large planes stay planar under the wing hinge.
  - Pentagonal shell closure (Q4).
  - Thickness at the blade stack.
- **Trade-offs.** It has the least detail, about 200–300 faces. It reads best at district scale and is most at home in the ink world. In close-up it may feel austere, which is intentional and must be accepted at ART-1. B-2 was not drawn before review round 1 and is newer than the rest.

### E.3 Concept C: modular tessellated raven

- **Topology.** A calm hull shell with the head. **One** `shingle` definition (a chevron folded on its long axis) in three size classes S, M and L, placed in rows on the wing tracts and the tail: 95 placements.
- **Candidate modules.**
  - `shingle(S|M|L)`.
  - `hull`.
  - `bill`.
- **Ports.** Each tract is a row of identical typed root ports at a fixed pitch. That is the simplest port contract of the three, but it is still non-axis (Q1). Sizes as one module family with three variants is Q3.
- **Rigid fold path.** Each row folds as one Miura-like unit: a single row hinge drives every shingle in it. The wingbeat is shoulder plus row spread.
- **Constraints.**
  - Local: brick offset between rows, and minimum overlap.
  - Global: the wedge comes from root stagger, not from scaling; the trailing-edge curve likewise comes from root stagger.
- **Reuse.** The highest of the three. The same concrete `shingle` id meets GEO-7.5(c) across tracts, and potentially roofs and scales.
- **Search scope.** A finite catalog plus row grammar. It is the best fit if the owner wants grammar or WFC-style row placement later.
- **Unproven.** Row collision during the upstroke, closure of the hull (Q4), and the row-hinge mechanism.
- **Trade-offs.** In round 1 the repetition destroyed the hierarchy (a pangolin body, NO-GO). The v2 fix confines modules to the tracts, which makes C closer to A with a mechanical feather language. The raised-wing side view stays a dense comb.

### E.4 Comparison

| | A anatomical | B / B-2 sumi | C modular |
|---|---|---|---|
| Artistic fit with the reference (ink, district) | medium: detail merges at small sizes | **high**: bold mass, angular planes | low to medium: mechanical rhythm |
| Raven readability (self-assessment; see the independent review) | high in flight | high perched; flight newer | medium |
| Construction modules | many (about 4 families, about 50+ instances per wing pair) | **few (5 families, 15–25 instances)** | 1 family × 3 sizes, 95 instances |
| Reuse potential | `vane` across birds and plants | `blade`, `leaf`, `pent-shell` across creatures, plants and roofs | `shingle` everywhere (risk of sameness) |
| Scope risk for Geometry V4 | high (V3-like volume of parts) | **lowest** | medium (row mechanics, still non-axis) |
| Needs new contracts | Q1, Q2, Q3, Q4 | Q1, Q4 (Q2 optional) | Q1, Q3, Q4 |
| ADR 0019 (detach) | many small detachable parts | few large parts (clear collapse story) | rows detach as units |

### E.5 Recommendation for owner ART-1 review, and what the owner decided

The original recommendation was **B, with B-2 as its flight direction (hand open)**. On 2026-11-27 the owner selected **B (perched)** as the direction (ART-D3a). The owner asked for B-2 to be revised before approval (ART-D3b). The decision record is in the [decision packet](../../review/art-1-raven-decision-packet.md) §0. The B-2 v4 and v5 revisions and their independent reviews are in the packet §7.
