# Form studies: one method, four categories (concept design studies)

> **Status: CONCEPT DESIGN STUDIES. Not ART-1 candidates, not approved, not implemented geometry.** They test whether the proposed [form construction method](../form-construction-method.md) (PROPOSED, not adopted) transfers across materially different objects. They are not production models, and no study here claims foldability, planarity, collision, closure, thickness or structural support. Brief: [`brief.md`](brief.md), committed in `a400997` before any study maquette.

## Sheets

| File | Category | Role | SHA-256 |
|---|---|---|---|
| [`form-study-vehicle.png`](form-study-vehicle.png) | vehicle: small sedan | derivation category (V3 car) | `b4b1c239dd0f8834510918561eb67f20dc80364a683e53dd6c50f90d62440207` |
| [`form-study-building.png`](form-study-building.png) | building: three-tier tower | **holdout** | `9240dcaef4c823b3a3cbd80a097c684aecdf0d589f9a172dadba1d891f4d6d90` |
| [`form-study-tree.png`](form-study-tree.png) | tree: dead tree | **holdout** | `4c48d54a4bec03081ae9eaeda2a201130d4ad31a7c6ac6f120234ec44b68c534` |
| [`../raven-concepts/raven-concept-b2-sumi-flight-v6.png`](../raven-concepts/raven-concept-b2-sumi-flight-v6.png) and its [comparison](../raven-concepts/raven-concept-b2-v6-compare.png) and [method](../raven-concepts/raven-concept-b2-v6-method.png) boards | raven: B-2 v6 flight | derivation category; an ART-1 candidate (pending owner) | listed in the [decision packet](../../review/art-1-raven-decision-packet.md) §9 |

Every study sheet shows, at the same cameras and lights:
- a **before** maquette that rebuilds the failure **mechanism** of method §2, drawn the way the earlier lab and sheets were drawn (flat faces, a line on every edge sharper than 15°);
- an **after** maquette that follows the procedure's steps 1–6, drawn with declared lines only;
- the earlier observed lab pixels, cited (V3 car; V1 house and pine, which never had a per-object review);
- the section strip, the crease declaration map, the silhouettes with the 48 and 24 px district strip, the steps as applied, the adversarial case, and the read-outs.

The before maquettes are reconstructions of a mechanism by this author. They are not the lab's code and not its geometry.

## Holdout protocol, and what happened

The principles were written from the raven and vehicle failures and committed in `449406b`. The building and the tree were designed afterwards, with the method text unchanged. Where the method did not transfer cleanly, the finding is recorded below and in the method's §12. **The method's principle text was not edited to fit a holdout.** The only principle-text change after `449406b` (P5 end alignment) came from the raven, a derivation category.

This is a qualitative design check by one author. It is not evidence that any solver, grammar or WFC would generalise (method §7.4), and it is not a GEO-3 claim.

## Transfer matrix

How each principle was applied in each category, what is reusable, and what proof is still missing. "Family" means GEO-7.5 level (b), and "definition" means level (c).

| Principle | Raven (B-2 v6) | Vehicle | Building (holdout) | Tree (holdout) | Reusable relationship or family, or why reuse is not justified | Proof still needed |
|---|---|---|---|---|---|---|
| **P1** sections change shape | brow tall, crown plane, nape pinched, breast deep, back broad, rump a plate | nose low; fender crowns are the peaks at the axles; the cabin section adds a glasshouse leaning in | walls and podium **declared prismatic** (B-a); the roofs change from steep to flared | lobed flare, fluted oval, flattened in the fork plane | relationship: a keyframed **section program** (formkit `program`), never one profile scaled. Family: a *section shell*. Each subject keeps its own keyframes, so the concrete definition is not shared | P1 section-shape read-out on built geometry with a negative control (method §11); the closed shells need Q4 |
| **P2** outlines converge | arm chord wrist/root 0.72 (v5 0.95) | bonnet falls, beltline rises, plan widest at the axles | stack 1.0 / 0.76 / 0.54; eave lines turn up | taper flare to fork to tips | relationship only; no module | convergence read-out on built geometry |
| **P3** junctions C or stated B | nape B, neck C, rump–tail C with a tertial fairing | cowl B with the windscreen as transition, fender–beltline C | wall–roof B (designed eave overhang) | fork C with a collar | relationship: a **typed junction class** on a port (C ports share an edge or a plane; B ports carry their transition). Not a module | needs typed ports: Q1 (non-axis seams), Q2 (`join` edge) |
| **P4** lines declared, at landmarks | head bands gone; 0 declared folds under 8° | door cuts and window frames as seams; 0 folds under 8° | corrugation and hips declared; **24 folds under 8° remain** (finial bands, hip ends) | bark ridges along limbs; 0 folds under 8° | relationship: the **edge taxonomy** (method §4.1); in a future engine it is the crease graph | crease-graph check with negative controls (method §11); developability of bent panels is a maquette aid, not GEO-1 |
| **P5** series has a structure | two groups of primaries; P7 widest; notches staggered; pleats uneven | windows differ; three grille bars set by the opening; **four identical wheels** (V-a: not a tract) | tiers 1.0 / 0.76 / 0.54 with a different top element; **corrugation declared a tessellation** (B-b) | branch length, angle and spacing change per generation (T-a) | family: a **cover vane** (feather covert, roof tile) does the same job, layered weather cover. The concrete definition is not shared: the raven's vanes and the roof's corrugation are different series laws. Wheels: one definition reused four times (level c), justified | judged-view series read-out (method §12 revision); Q3 parameterised families |
| **P6** every gap designed | tail-root pinhole closed (v5 86 px², v6 none); finger slots declared | arches cut around the tyres with a hem lip | eave shadows and recessed openings declared | sky between limbs declared | relationship: **declared negative envelopes**. Family: a *hem* (wing leading edge, arch lip, eave fascia) does the same job, stiffening a free edge | P6 topology read-out; **limit found**: it detects enclosed holes only (below) |
| **P7** volume in every view | breast, back and rump read from the front and below | bonnet, shoulder and side read from the front | not measured | not measured | relationship only | **not verified anywhere**: no plane-family read-out was built |
| **P8** attachment frames | arm rooted inside the body; covert leaves overlap; under-tail covert | wheels inside arches with clearance; glasshouse on a shoulder | each tier sits on the roof below; jambs frame the openings | limbs rooted inside the trunk | relationship: **ports with overlap or clearance**. This is the port contract itself | attachment audit; GEO-7.2 port contracts |
| **P9** scale tier | finger slots, wedge tail and bill at 24 px | arches and glasshouse at 24 px | roof tiers and finial at 24 px; corrugation only at hero | limb fork at 24 px; twigs only at hero | bible §6, unchanged | an independent district-scale read |

The three pairs the owner named:
- **Banded head and stepped cabin** are the same failure: one section scaled (F1) plus lines by sampling (F4) plus a junction nobody designed (F3). They were fixed by the same steps, 2, 4 and 6, with different subject content: a crown plane and a nape fold; a glasshouse leaning in on a shoulder ledge.
- **Rectangular wing and plank chassis** are the same failure: parallel outlines (F2) over a homothetic section (F1). They were fixed by step 3 (converging outlines) and step 2 (the section changes where the function changes).
- **Repeated feathers, repeated roof tiers and repeated branches** share step 5, a series law with groups and ends. They do not share a recipe. The hand has two groups and staggered notches. The roof is a **declared tessellation** whose envelope carries the variation, and its tiers are a progression with a different top element. The tree changes its law per generation.

## Findings (recorded; the principle text is not changed for holdouts)

| # | Category | Principle | Finding | Proposed follow-up (for a later method revision, owner's choice) |
|---|---|---|---|---|
| S1 | raven | P5 | The straight-line end-alignment test did not flag v5 (R² 0.15 in the wing plane, 0.77 in the hero view). Revised in method §12 to a judged-view monotone-progression test | already revised (derivation category) |
| S2 | raven | P5 | Width CV 0.19 on v5's fingers is above the proposed 0.08, yet the reviewer read them as nearly equal. Foreshortening in the judged view hides it | measure widths in the judged view too; untested |
| S3 | vehicle | P6 | The topology read-out finds enclosed holes only. V3's "daylight" between a wheel and a plank body opens to the ground, so it is not a hole and is not flagged | add an open-notch read-out (concavity against the declared envelope); untested |
| S4 | building (holdout) | P4 | Lines appeared inside a plane at T-junctions (a wall built from pieces that do not share vertices): topologically a "boundary", but with no meaning | §4.1 should say a boundary is a free edge of a sheet, never a T-junction inside one plane |
| S5 | building (holdout) | P4 × P5 | A declared tessellation is still subject to line visibility. The first corrugation (2–8° folds) drew lines that marked almost no form change; the amplitude was raised | say explicitly that P5's tessellation exception does not exempt P4 |
| S6 | building (holdout) | P4 | Upturned eave corners nearly erased the hip fold (0.5°). P4 caught it; a softer corner lift fixed it. 24 folds under 8° still remain at the finial bands and hip ends | open in the study; not resolved |
| S7 | tree (holdout) | P4 | A buttress valley that turns convex up the trunk fades through zero, so its line marks no change over part of its length | **new candidate rule:** a declared fold keeps its sign along its length or is split where the sign changes |
| S8 | all | P4 | The method gives no number for the bend allowed across one tessellation edge inside a bent panel. The studies used 20° as a maquette parameter. Residual flags: raven 28 edges (max 30.7°); vehicle 18 visible (max 61.9°: front glass, rockers, C-pillar warp) plus 152 hidden; building 124 visible (max 44.2°: the top roof's apex) plus 132 hidden; tree 1 (20.3°) | state a bend allowance with a reason and a counterexample, or say the read-out is a ranked list only |
| S9 | all | P7 | No plane-family read-out was built, so P7 is judged by eye only | build it before relying on it |
| S10 | building (holdout) | P1, P2 | The method's own counterexample (declared prismatic) transferred as written: the walls were exempt and the variation moved to the roofs | none |

## Read-out summary (aids, not verdicts)

| Category | Panels | Declared folds under 8° | Visible bends over 20° (max) | Hidden-surface bends over 20° | Angle defect over 2° | Silhouette holes at 400 px (after) |
|---|---|---|---|---|---|---|
| Raven B-2 v6 | 102 | 0 | 28 (30.7°) | — | 9 (max 5.3°) | none in hero, top, underside; side: the declared gap between the wings |
| Vehicle | 59 | 0 | 18 (61.9°) | 152 | 0 | none |
| Building | 266 | 24 | 124 (44.2°) | 132 | 0 | none |
| Tree | 81 | 0 | 1 (20.3°) | 0 | 0 | none |

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
