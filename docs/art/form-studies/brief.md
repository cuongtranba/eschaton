# Form studies: design brief (vehicle, building, tree)

- Status: **DESIGN TARGET, committed before any study drawing, maquette script or render.** Concept design studies only. They are **not** production models, not ART-1 candidates, not geometry contracts and not evidence for any GEO gate. They authorize nothing and approve nothing.
- Purpose: apply **the same procedure** of the proposed [form construction method](../form-construction-method.md) (§5), committed in `449406b`, to materially different categories, and show for each a failure and its correction under the same camera, scale and light. The raven is the fourth category; its brief is [`b2-v6-flight-brief.md`](../raven-concepts/b2-v6-flight-brief.md).
- *Later note (round-1 and round-2 reviews):* the building and the tree were not used to derive the principles, but they are **not blind holdouts** (method status lines; packet §9.2, §9.4). Round 2 used the method as revised in `09591cf`, not as committed in `449406b`. The round-2 sheet banners still say "HOLDOUT category … exactly as committed in 449406b"; that wording is superseded here.
- **Holdout protocol (as first written).** The method's principles were derived from raven and vehicle failures only (method §2). The **building** and the **tree** were not used to derive them. They are designed here with the method exactly as committed in `449406b`. If a principle does not transfer, or needs a change to work, that is recorded as a **finding** in the studies README, with the principle's id. The method is not quietly edited to fit. This is a qualitative design check. It does not prove that any solver generalises.
- Each study has two maquettes: **before**, which rebuilds the failure **mechanism** of method §2 (one profile scaled, a box on a slab, equal elements, lines by crease angle), and **after**, which follows steps 1–6 below. For the vehicle, actual V3 pixels from PR #11 @ `616b0cf` are shown beside them as the observed failure. For the building and the tree, the V1 pixels on PR #11 are shown, if they include them, as context only.
- Subject identity: generic subjects in the Eschaton reference's world (`assets/reference/visual-direction.png`: wrecked cars, pagoda-like tiled roofs, a dead tree). None is a recreation of a specific real product or building.
- Out of scope: package or app code, Geometry V4, imported or generated meshes, AI imagery, feasibility claims of any kind.

## 1. Vehicle: a small sedan (derivation category)

Units: L = bumper to bumper.

| Step | Decision |
|---|---|
| 1. Gesture and landmarks | Long and low, sitting down over its wheels. Front axle 0.18, cowl 0.38, windscreen head 0.48, roof rear 0.70, deck 0.82, rear axle 0.78. Height 0.33 L; body width 0.37 L; tyre diameter 0.17 L. Wheelbase/L 0.60 |
| 2. Section program (P1) | Nose (0.03): low, wide, rounded shoulders, aspect 0.45. Front axle: the **peaks are the two fender crowns**, higher than the bonnet's centre, aspect 0.55. Cowl: a beltline shoulder appears. Cabin: two tiers, the body sides leaning in about 8° (tumblehome) and the glasshouse leaning in about 18°, aspect 0.9. Rear axle: fender crowns again, the deck lower. Tail: cambered, aspect 0.5 |
| 3. Outlines (P2) | Side: the bonnet slopes down to the nose; the beltline rises slightly to the tail; the roof arcs. Plan: widest at the axles (fender flare), narrowing at the nose and the tail; the glasshouse narrows toward the rear |
| 4. Junctions (P3) | Bonnet to windscreen: B, the cowl fold, with the raked windscreen as the transitional plane. Windscreen to roof: B, a soft fold. Glasshouse to body: B, a stated shoulder ledge. Fender to body: C, the fender crown flows into the beltline. Wheel to body: a negative envelope (below) |
| 5. Envelopes and tracts (P5, P6) | Declared negative spaces: the four wheel arches with a stated clearance around each tyre, the grille opening, the side windows. Side windows: two groups that differ (front with a raked pillar edge, rear tapering into the C-pillar). Grille: one recessed opening with three bars whose lengths follow the opening's curved outline. **Wheels: four identical** (see adversarial case V-a) |
| 6. Edges (P4) | Folds: beltline shoulder, fender crowns, bonnet edges, windscreen and roof edges, the arch lip hems. Seams: door cuts (they are where Collapse peels the panels, bible §8). Bent panels: bonnet, roof, body sides |

**Before** (mechanism of F1, F2, F3, F5, F6, F8): one chamfered rectangular section swept the full length; a vertical-sided box cabin set on it; wheels outside the body with no arches; two equal fang slats; lines by crease angle.

## 2. Building: a three-tier tower (holdout)

Units: H = ground to finial tip.

| Step | Decision |
|---|---|
| 1. Gesture and landmarks | A stable, symmetric, tapering stack in the reference's pagoda language. Podium top 0.10; tier eaves at 0.36, 0.60 and 0.80; finial tip 1.0. Footprint width 0.55 H |
| 2. Section program (P1) | Podium: **prismatic by function** (adversarial case B-a). Walls: rectangular by function. The variation is in the roofs: each roof's section changes from a steep upper slope to a flatter, flared eave (a bent panel). Tier plans step back by a progression that is not constant: 1.0, 0.76, 0.54 |
| 3. Outlines (P2) | Elevation: the stack's outline converges from the podium to the finial; each eave line curves up at the corners; the walls are vertical (declared) |
| 4. Junctions (P3) | Wall to roof: B, a stated overhang (eave) whose shadow is a designed negative band. Roof to next wall: B, a stated setback with a wall plate. Top roof to finial: C, the hip folds run into the finial |
| 5. Envelopes and tracts (P5, P6) | Declared negative spaces: the eave shadows, the recessed openings (doors and windows as recesses with frames, never decals). Tract: the tiers themselves, as a series with a heavier ground tier and a different top element (the finial). **Roof corrugation is a declared tessellation** (adversarial case B-b) bounded by the curved eave envelope |
| 6. Edges (P4) | Folds: roof hips and ridges, the eave hem. Seams: wall to podium, wall plates. Tessellation: corrugation lines are folds of a declared corrugated sheet. Bent panels: the flared roof slopes |

**Before**: each tier the same box scaled (homothetic), flat roof slabs of equal thickness with no overhang, equal spacing, openings as dark flat decals, lines by crease angle.

## 3. Tree: a dead tree (holdout)

Units: H = ground to the highest tip.

| Step | Decision |
|---|---|
| 1. Gesture and landmarks | A line-dominant leaning silhouette, as in the reference. Root flare 0–0.06; first fork 0.42; second-generation forks around 0.62–0.75; one broken leader |
| 2. Section program (P1) | Base: a lobed flare (root buttresses). Trunk: oval. Below a fork: flattened in the fork's plane. Branches: rounder and thinner by generation |
| 3. Outlines (P2) | The trunk tapers from the flare to the fork; the branches taper to their tips; the leader breaks off |
| 4. Junctions (P3) | Fork: C, the trunk's flattened section divides into the two branch sections (a branch collar), with no butt joint and no gap |
| 5. Envelopes and tracts (P5, P6) | Tract: branches by generation. Length shrinks by a factor that changes per generation, the divergence angles differ, the spacing along a parent is uneven, and one side is heavier (the lean). Declared negative space: the sky framed between the main limbs. No holes inside a limb |
| 6. Edges (P4) | Folds: a few long bark ridges per limb, along the limb (never rings). Seams: none at forks (C). Bent panels: the limb faces between ridges |

**Before**: a cylinder trunk with one profile, equal-length sticks at equal angles and equal heights, butt-joined with gaps, lines by crease angle.

## 4. Adversarial cases (where a principle should **not** fire)

| Id | Case | Principle under test | Expected |
|---|---|---|---|
| V-a | four identical wheels | P5 (series) | not a tract: identical parts doing the same job at different stations; reuse justified (method §7.1, level c) |
| B-a | rectangular podium and walls | P1, P2 | declared prismatic by function; the variation moves to the roofs and the openings |
| B-b | corrugated roof field | P5 | declared tessellation; the rake flags are expected and are not defects; the envelope carries the variation |
| B-c | a symmetric tower | bible §4.1.3 (gesture), not a method principle | the method has no asymmetry rule. *Later note (round-1 review):* whether bible §4.1.3, "asymmetry and gesture beat symmetry", applies to a symmetric structural form is an **owner question**; this study does not decide it |
| T-a | a broken, irregular dead tree | P5 grouping | irregularity is the subject; the series law still holds per generation |

## 5. Deliverables

All new files under `docs/art/form-studies/`. Maquette sources under `source/`. Sheets: one per category, plus a cross-category board of the method's artefacts and the transfer matrix in the README. Each image carries "CONCEPT DESIGN STUDY, not approved, not implemented geometry", and each digest is recorded in the README.

## 6. Iteration log

The target above is fixed at the commit that adds this file.

| Round | Category | Seen in the pixels (self-assessed) | Change |
|---|---|---|---|
| 1 | vehicle | Read-outs flagged door cuts as weak folds (they are seams), 80° bends inside hidden wheel-well surfaces, and a side glass panel wrapping from the windscreen corner | Read-out checks folds only, as P4 intends; window frames, door cuts and the A-pillar declared as seams; wheel wells and glasshouse base declared hidden; front quarter glass is its own panel |
| 2 | vehicle | The section strip drew every section at its own size without the glasshouse, so P1 barely showed | Strips at one common scale, glasshouse included at the cabin stations |
| 1 | building | T-junction lines inside walls; corrugation folds at 2–8°; a 90° jamb inside one panel | Walls rebuilt as a shared-vertex grid; corrugation amplitude raised; one panel per jamb face (findings S4, S5) |
| 2 | building | Upturned corners erased the hip fold (0.5°); the flare was one sharp kink | Softer corner lift and a six-ring flare profile; finial bands as separate panels. 24 weak folds remain (S6) |
| 1 | tree | One panel per pair of hexagon facets put 60° folds inside panels | One panel per facet: the lines are bark ridges along each limb |
| 2 | tree | Buttress valleys faded through zero up the trunk | Upper trunk fluted so each valley stays a valley (finding S7) |
| — | building | Logged deviations found by the round-1 review: the eaves were built at 0.33, 0.56 and 0.76 H (brief: 0.36, 0.60, 0.80) and the footprint at 0.62 H (brief: 0.55 H). Proportions were adjusted while modelling and not logged at the time | Logged here; values kept |
| 3 (round 2) | vehicle | Round-1 review: top view clipped and at another scale; arch lips read as hoops; plan not widest at the axles; deck fell to the tail | Top camera turned to the length axis at the side view's scale; lips laid on the body side between 14° and 166°; fender flares widen the body at the axles; deck rises to the tail; bumper plate removed; grille bars given a top face |
| 3 (round 2) | building | Round-1 review: tiles radiated from the finial (sunburst, hips unreadable); soffit wrongly hidden; section strip slivers | Tiles parallel to each face's fall line and clipped by the hips; soffit counted as visible; strip shows the roof profile and every wall; "front" relabelled as a corner elevation |
| 3 (round 2) | tree | Round-1 review: crown nearly in one plane; fork as prisms pushed into a stump; too massive | Limbs and branches spread in depth; the trunk tapers into two limbs rooted inside it; branches rooted inside their parents with a collar; thinner limbs; 13 tips. Four small sky gaps where branches cross are an extension of the declared negative space |
