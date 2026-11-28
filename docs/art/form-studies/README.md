# Form studies: one method, four categories (concept design studies)

> **Status: CONCEPT DESIGN STUDIES. Not ART-1 candidates, not approved, not implemented geometry.** They test whether the proposed [form construction method](../form-construction-method.md) (PROPOSED, not adopted) transfers across materially different objects. They are not production models, and no study here claims foldability, planarity, collision, closure, thickness or structural support. Brief: [`brief.md`](brief.md), committed in `a400997` before any study maquette.

## Sheets

| File | Category | Role | SHA-256 |
|---|---|---|---|
| [`form-study-vehicle.png`](form-study-vehicle.png) | vehicle: small sedan | derivation category (V3 car) | `ca0254eef1ec31f9587c329532ec266cdf4d645dfc1feea1220ca4644e249b4c` (round 2; round 1 was `b4b1c239…62440207` at `57da41b`) |
| [`form-study-building.png`](form-study-building.png) | building: three-tier tower | not used for derivation (not blind, see below) | `6463db76427a643a41863d4ff5923a026805bd076efb62fc552fb3e0e7c4eb0a` (round 2; round 1 was `9240dcae…891f4d6d90` at `57da41b`) |
| [`form-study-tree.png`](form-study-tree.png) | tree: dead tree | not used for derivation (not blind, see below) | `b97d89c37c87c52010b4672507f006f1d30c6c7f685ac6568bfaf2da11ca763f` (round 2; round 1 was `4c48d54a…44b68c534` at `57da41b`) |
| [`../raven-concepts/raven-concept-b2-sumi-flight-v6.png`](../raven-concepts/raven-concept-b2-sumi-flight-v6.png) and its [comparison](../raven-concepts/raven-concept-b2-v6-compare.png) and [method](../raven-concepts/raven-concept-b2-v6-method.png) boards | raven: B-2 v6 flight | derivation category; an ART-1 candidate (pending owner) | listed in the [decision packet](../../review/art-1-raven-decision-packet.md) §9 |

The study sheets are working files: round 2 replaced the round-1 images at the same paths. The round-1 images, which the round-1 reviewers judged, stay retrievable from git at `57da41b` with the digests above. (The B-2 sheets, by contrast, are versioned files that are never overwritten.)

Every study sheet shows, at the same cameras and lights:
- a **before** maquette that rebuilds the failure **mechanism** of method §2, drawn the way the earlier lab and sheets were drawn (flat faces, a line on every edge sharper than 15°);
- an **after** maquette that follows the procedure's steps 1–6, drawn with declared lines only;
- the earlier observed lab pixels, cited (V3 car; V1 house and pine, which never had a per-object review);
- the section strip, the crease declaration map, the silhouettes with the 48 and 24 px district strip, the steps as applied, the adversarial case, and the read-outs.

The before maquettes are reconstructions of a mechanism by this author. They are not the lab's code and not its geometry.

## Holdout protocol, and what happened

The principles were written from the raven and vehicle failures and committed in `449406b`. The building and the tree were designed afterwards. **They are not blind holdouts.** The round-1 method review (packet §9.2, B1) showed why:
- the method text already gave building and tree examples (a tiered roof, a branch collar);
- the categories were planned in advance;
- the before maquettes are this author's reconstructions of a failure mechanism, not the lab's objects. The building "before" is stacked boxes, while the cited V1 house is a gable house.

So the studies show that the **procedure can be carried out** on other categories. Much of each after's improvement over its before comes from subject grammar and art direction (a pagoda grammar, a sedan grammar), not from the universal principles alone. The principle text was not edited to fit a holdout. Holdout findings are recorded below and in method §12.1.

This is a qualitative design check by one author. It is not evidence that any solver, grammar or WFC would generalise (method §7.4), and it is not a GEO-3 claim.

## Transfer matrix (round 2)

How each principle was applied in each category, what is reusable, and what proof is still missing. "Family" means GEO-7.5 level (b), and "definition" means level (c). The raven column is B-2 v6 (round 1); B-2 v7 is in the packet §9.4.

| Principle | Raven (B-2 v6) | Vehicle | Building | Tree | Reusable relationship or family, or why reuse is not justified | Proof still needed |
|---|---|---|---|---|---|---|
| **P1** sections change shape | brow, crown, nape, breast, back and rump keyframes differ in shape (the v6 reviewer: the crown reads as a smooth bulge, not a plane) | nose low; fender crowns are the peaks at the axles; the cabin section adds a glasshouse leaning in | walls and podium **declared prismatic** (B-a); the roof profile changes from steep to flared | lobed flare, fluted trunk, flattened below the fork | relationship: a keyframed **section program**, never one profile scaled. Family: a *section shell*; each subject keeps its own keyframes | P1 read-out on built geometry with a negative control (method §11); closed shells need Q4 |
| **P2** outlines converge | arm chord wrist/root 0.72 (v5 0.95) | bonnet falls, deck rises to the tail; plan widest at the fender flares (round 2) | stack 1.0 / 0.76 / 0.54; eave lines turn up | taper flare to fork to tips | relationship only; no module | convergence read-out on built geometry |
| **P3** junctions C or stated B | nape B, neck C, rump–tail C with a tertial fairing | cowl B with the windscreen as transition | wall–roof B (eave overhang) | fork intended C: the trunk tapers into two limbs rooted inside it; round 2 removed the exposed limb ends, but the reviewer reads the collar as a pasted box and sees segment steps on the limbs | relationship: a **typed junction class** on a port. Not a module | typed ports: Q1, Q2 |
| **P4** lines declared, at landmarks | 0 declared folds under 8°; the v6 reviewer still found line stubs that end mid-panel | door cuts and window frames as seams; 0 folds under 8° | tiles parallel to the fall line, meeting at the hips (round 2; round 1 radiated from the finial); **40 folds under 8° remain** | bark ridges along limbs; 0 folds under 8° | relationship: the **edge taxonomy** (method §4.1); in Foldon it would be the crease graph, and bent panels are an open question (method §7) | crease-graph check with negative controls; developability is a maquette aid, not GEO-1 |
| **P5** series has a structure | two groups of primaries; P7 widest; notches staggered (a design choice after the S1 result); pleats uneven | windows differ; three grille bars set by the opening; **four identical wheels** (V-a: not a tract) | tiers 1.0 / 0.76 / 0.54 with a different top element; **corrugation declared a tessellation** (B-b) | branch length, angle and spacing change per generation (T-a); 13 tips | family: a **cover vane** (feather covert, roof tile) does the same job, layered weather cover; the concrete definition is not shared. Wheels: one definition reused four times (level c), justified | a working end-alignment read-out does not exist (method §6, P5); Q3 parameterised families |
| **P6** every gap designed | tail-root pinhole closed (v5 86 px², v6 none) | arches around the tyres; round 2 moved the lip toward the body side, but the round-2 reviewer still sees it standing off the body in the top, front and three-quarter views (S3: P6 cannot detect this) | eave shadows and recessed openings declared | four small sky gaps where branches cross in projection (20–58 px²); the brief declared only the sky between the main limbs, so this is an **extension**, logged | relationship: **declared negative envelopes**. Family: a *hem* (wing leading edge, arch lip, eave fascia) | P6 read-out; open notches undetected (S3) |
| **P7** volume where function implies it | front body still a faceted lump (v6 reviewer) | bonnet and side read from the front | walls prismatic by declaration; roofs carry volume | the crown is **still nearly planar** from the top (about 4.5:1, round-2 reviewer), so the hero three-quarter view is edge-on (F7, not fixed) | relationship only | **no read-out anywhere** (S9) |
| **P8** attachment frames | arm rooted inside the body; covert leaves overlap; under-tail covert | wheels inside arches with clearance; glasshouse on a shoulder | each tier sits on the roof below; jambs frame the openings | branches rooted inside their parents with a collar | relationship: **ports with overlap or clearance**, the port contract itself | attachment audit; GEO-7.2 |
| **P9** scale tier | finger slots, bill and wedge tail at 48 px; at 24 px the fingers blur and the hero tail is lost (v6 reviewer) | cabin bump and wheels at 24 px; the arches read only from mid scale (round-1 reviewer) | roof tiers and finial at 24 px; corrugation only at hero | fork and lean at 24 px in the side view only; in three-quarter no fork reads at 24 px | bible §6, unchanged | an independent district-scale read |

The three pairs from the handoff:
- **Banded head and stepped cabin** are the same failure: one section scaled (F1) plus lines by sampling (F4) plus a junction nobody designed (F3). They were answered by the same steps, 2, 4 and 6, with different subject content: a crown plane and a nape fold; a glasshouse leaning in on a shoulder. The v6 reviewer found part of the head fix was a drawing change, not a form change.
- **Rectangular wing and plank chassis** are the same failure: parallel outlines (F2) over a homothetic section (F1). They were fixed by step 3 (converging outlines) and step 2. The v6 reviewer confirmed the converging arm survives the old drawing.
- **Repeated feathers, repeated roof tiers and repeated branches** share step 5, a series law with groups and ends, not one recipe. The hand has two groups and staggered notches. The roof is a **declared tessellation** whose envelope carries the variation. The tree changes its law per generation.

## Findings (recorded; the principle text is not changed for holdouts)

| # | Category | Principle | Finding | Proposed follow-up (owner's choice) |
|---|---|---|---|---|
| S1 | raven | P5 | The straight-line end-alignment test did not flag v5 (R² 0.15 in the wing plane, 0.77 in the hero view). A judged-view replacement was tried and **withdrawn**: it was fitted to one example and would flag graduated progressions (method §12) | no working read-out; the reviewer's eye is the check |
| S2 | raven | P5 | Width CV 0.19 on v5's fingers is above the proposed 0.08, yet the reviewer read them as nearly equal | the 0.08 is marked a placeholder |
| S3 | vehicle | P6 | The topology read-out finds enclosed holes only. Open notches (V3 daylight under a plank; round-1 arch lips standing off the body) are not flagged | add an open-notch read-out; untested |
| S4 | building | P4 | Lines inside a plane at T-junctions | §4.1: a boundary is a free edge of a sheet, never a T-junction inside one plane |
| S5 | building | P4 × P5 | A declared tessellation is still subject to line visibility (round 1: 2–8° corrugation folds) | P5's tessellation exception does not exempt P4 |
| S6 | building | P4 | Upturned corners nearly erased the hip fold. Round 2's parallel tiles make the hips read, but 40 folds under 8° remain at hip ends, finial bands and the soffit | open; not resolved |
| S7 | tree | P4 | A buttress valley turning convex fades through zero | **candidate rule:** a declared fold keeps its sign along its length or is split |
| S8 | all | P4 | No numeric bend allowance for a bent panel; the studies use 20° as a maquette parameter. Bent panels also have no Foldon representation (method §7, round 2) | decide the allowance or treat the read-out as a ranked list |
| S9 | all | P7 | No plane-family read-out was built | build it before relying on it |
| S10 | building | P1, P2 | The declared-prismatic counterexample transferred as written | none |
| S11 | building | P4, F4 | Round 1 generated the corrugation in polar coordinates, so the tool decided the form (a sunburst through the hips) | the procedure's "the tool may not decide" applies to tessellations too |
| S12 | tree | P7, F7 | Round 1's crown lay in one plane: the views were rendered, not designed. "Not measured" hid it | design the top view as an artefact (step 1), even for a tree |
| S13 | building | §4.0 | The soffit was classed as hidden although every elevation shows it; corrected in round 2 (method §12) | the §4.0 declaration test |

## Read-out summary, round 2 (aids, not verdicts; corrected after the round-2 review, see packet §9.6)

| Category | Panels | Declared folds under 8° | Visible bends over 20° (max) | Hidden-surface bends over 20° | Angle defect over 2° | Silhouette holes at 400 px (after) |
|---|---|---|---|---|---|---|
| Raven B-2 v6 (round 1) | 102 | 0 | 28 (30.7°) | — | 9 (max 5.3°) | none in hero, top, underside; side: the gap between the wings |
| Vehicle | 61 | 0 | **161 (82.1°)**, corrected after review: wheel wells, fascia and tail panel are visible and are now counted (the round-2 sheet still prints the earlier 18 and 152) | 9 (underbody, glasshouse base) | **45 (max 20.0°)** | none |
| Building | 266 | 40 | 244 (52.8°), soffit and podium top counted | 0 | 0 | none |
| Tree | 124 | 0 | 6 (32.1°) | 0 | 0 | three-quarter 20, 41, 33; side 58 (sky between crossing branches) |

Files: `renders/*-after-diagnostics.json`, `renders/*-silhouette-holes.json`, `renders/section-strips.json`; the raven's are in `../raven-concepts/renders/b2v6/`.

## Reproduce

Blender 5.2.1 and Pillow 11. The V3 and V1 screenshots come from the draft PR #11 worktree at `616b0cf` (read-only).

```sh
cd docs/art/form-studies/source
export PYTHONDONTWRITEBYTECODE=1
for k in veh bld tree; do
  Blender -b --factory-startup --python render_form.py -- ${k}_before <scratch>/$k-before legacy
  Blender -b --factory-startup --python render_form.py -- ${k}_after  <scratch>/$k-after  declared
done
Blender -b --factory-startup --python export_strips.py -- <scratch>/strips.json
python3 study_sheet.py veh  <scratch>/veh-before  <scratch>/veh-after  <V3>/docs/screenshots/exp-origami-v3-vehicle-study.png out.png <scratch>/strips.json
python3 study_sheet.py bld  <scratch>/bld-before  <scratch>/bld-after  <V3>/docs/screenshots/exp-origami-seed-1-t1.png      out.png <scratch>/strips.json
python3 study_sheet.py tree <scratch>/tree-before <scratch>/tree-after <V3>/docs/screenshots/exp-origami-seed-1-t1.png      out.png <scratch>/strips.json
python3 sil_topology.py <scratch>/veh-after three side front
```

Source screenshots (PR #11, unchanged): `exp-origami-v3-vehicle-study.png`, SHA-256 `90eec218…909657a1`, captured at `74c686f`, committed in `616c56f`; `exp-origami-seed-1-t1.png`, SHA-256 `1cfdb67c…729d05b4c5`, committed in `73b612b` (its banner names the lab at `6024a1b`). The committed PNGs here are palette-quantised to 256 colours.

## Not claimed

- That any after maquette is a valid Foldon definition, folds from paper, or is free of collision.
- That the method would let a solver or grammar produce these forms (method §7.4).
- That the vehicle, building or tree is an approved design. None was submitted for ART-1.
