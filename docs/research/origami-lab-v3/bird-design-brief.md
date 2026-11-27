# Bird V3 — design brief (GEO-0, GEO-2, GEO-7), written before code

- Status: **exploratory, not approved.** The owner judges the visual result. Standard: [`docs/governance/geometry-quality-gates.md`](../../governance/geometry-quality-gates.md). Construction rules: [`construction-brief.md`](construction-brief.md).
- Date: 2026-11-27. Baseline compared against: V2 crow at `e8082a8` (images at `50de5f1`).

## 1. What the V2 images actually show (reviewed from the pixels, not the report)

Sources: `docs/screenshots/exp-origami-v2-crow-study.png`, `…-fold-crow.png`, `…-sheet-seeds-1-8.png`, `…-sheet-extremes.png`.

| # | Defect seen | Diagnosis | V3 response |
|---|---|---|---|
| 1 | Flat back in the side view: the dorsal line is almost straight from nape to tail | The 8-point ring's dorsal vertex sits only 0.62 t above the shoulder line, and the spine has no hump | Peaked dorsal ridge: half-section D at 0.80 r over a shoulder corner at 0.22 r, giving a 30° roof slope; spine rises over the shoulders, dips at the nape and rises to the rump |
| 2 | Covert rows hover above the arm with a visible window from the side | V2 coverts are quads hung from a camber vertex with clearance, attached by one edge into air | Coverts form a fringe whose root band is hinged **on** the arm's camber crease and lies back over the trailing panel like a shingle. The root is attached, so there is no window |
| 3 | Rake-like primaries: parallel, equal width | Tips were placed by one splay rule on a straight tip edge | Primaries are separate vane modules on an **arc** of sockets, so each radiates from a common centre (fan, ≈ 8–9° apart). Lengths are staggered from a ladder and opening angles alternate ±3° for visible layering |
| 4 | Dotted dark line along the shoulder seam and a bright pinhole at the shoulder vertex | **Render artifact, not a geometric gap.** Seam gap ≤ 5.3e-10 cells (≈ 1e-7 px). Topology at the shoulder is clean: no T-junctions, no duplicate vertices; the shoulder edge is shared by two body facets and the wing root by design. Opening angles there are 52–168°, so there is no near-coplanar z-fighting. The renderer uploads each sheet's separately transformed vertices as unindexed `Float32`, so 1-ulp mismatches between sheets rasterise as sub-pixel cracks that show the dark interior or the background | The V3 page renders welded positions (one canonical position per design vertex) and shows raw vs welded close-ups of the V2 shoulder as evidence |
| 5 | Span 7.5 % short on 3 variants | Finger extent was estimated, not solved | Span is a **measured** global constraint, checked on the built wing (tip to tip) by the solver |
| 6 | 48 separate sheets, about 20 of them single panels | Strip unfolder output | Every sheet is a designed module (§5); no leftover singles |
| 7 | Reads as "a careful low-poly mesh divided into strips" | Triangulated loft quads and diagonal creases everywhere | Body facets are planar **trapezoids only** (homothetic sections), with long continuous ridge lines (dorsal, shoulder, flank, keel) and transverse folds. Wings are folded plates with a camber crease. Feathers are folded blades with a rachis ridge |

## 2. References

No reference geometry or image is imported or traced.

| # | Reference | Used for | Use |
|---|---|---|---|
| R1 | Carrion crow: length 45–52 cm, wingspan 84–104 cm (RSPB; Wikipedia, verified 2026-11-26 for V2) | Baseline ratios: span/L ≈ 2.0; square-to-rounded tail; heavy beak; 5 slotted primaries | Facts |
| R2 | Herring gull 55–67 cm / 125–155 cm (Wildlife Trusts); house sparrow 14–16 cm / 21–25 cm (NHM) | Span window 1.55–2.45 | Facts |
| R3 | Avian topography (field-guide terms: arm and hand wing, carpal joint, primaries on the hand, secondaries on the arm, greater and median coverts overlapping secondaries' bases, rectrices). The rachis sits near the leading edge of a primary (narrow outer vane, broad inner vane) | Slots, feather layering order, vane asymmetry | Common terminology |
| R4 | Torrence, E., "Modular Origami Map Coloring Models", *Bridges 2022*, 507–514: "many identical units are combined"; units join by insertion | Modular units joined by contracts (vane and fringe reuse) | Cited method |
| R5 | Tachi, T., "Simulation of Rigid Origami", *Origami⁴* (2009) 175–187: plates and hinges, fold angles as variables, loop closure F = χ₁⋯χₙ = I for closed vertex loops | Why every module is a tree (no loop closure needed) | Cited |
| R6 | Mitani, J., Suzuki, H., *ACM TOG* 23(3) 2004, 259–263, doi:10.1145/1015706.1015711: strips approximate a target mesh | The V2 method, rejected as a shape source (GEO-7.9) | Cited, contrast |

## 3. Shape language (art direction, `assets/reference/visual-direction.png`)

- **Kept from the reference:** heavy, angular, dark silhouettes; birds as small cross-shaped marks against the sky, so the bird must read first as a **silhouette from below and in three-quarter view**.
- **Primary forms:**
  - the flight cross: body axis against the wingspan;
  - a broad arm and a slotted hand.
- **Secondary forms:**
  - a wedge head with a heavy beak and a steep forehead;
  - a deep breast under a peaked back with a shoulder hump;
  - a fanned tail.
- **Tertiary forms:**
  - the rachis ridge on every vane;
  - layered covert, secondary and primary rows;
  - transverse folds along the body;
  - the keel ridge.
- **Not decided here:** ink and hatching, which are deferred to the renderer (ADR 0006).
- **No decals, no painted lines.** Every line is a crease, a sheet edge or a ridge.

## 4. Target proportions (crow baseline; L = beak tip to tail tip = 1; built at L = 4 cells)

### 4.1 Body — homothetic half-sections ("keel" shape)

Half-section vertices relative to the spine point, in units of the station radius r: D (0, 0.80) dorsal ridge; U (1.00, 0.22) shoulder corner (widest); B (0.74, −0.72) flank corner; K (0, −1.24) keel. Depth is 2.04 r and width 2 r. Facets: dorsal D–U (30° roof), flank U–B, ventral B–K.

| Station | s (from beak tip) | r | spine y | Role |
|---|---|---|---|---|
| beak apex | 0.000 | point | −0.014 | hooked tip, below the gape line |
| S1 gape | 0.100 | 0.028 | 0.000 | beak base; beak/L = 0.10 |
| S2 brow | 0.140 | 0.048 | 0.012 | steep forehead step: the head reads as a mass separate from the beak |
| S3 nape | 0.230 | 0.046 | 0.004 | head-to-neck waist; head width/body width = 0.048/0.088 = 0.55 |
| S4 breast | 0.330 | 0.088 | 0.000 | deepest point (2.04 r = 0.18 L); shoulder line = wing root leading end |
| S5 belly | 0.500 | 0.074 | 0.010 | wing root trailing end; root chord ≈ 0.17 L |
| S6 vent | 0.600 | 0.040 | 0.016 | taper |
| rump apex | 0.640 | point | 0.024 | tail root |

Radius ladder (finite, ×L): 0.028, 0.034, 0.040, 0.046, 0.048, 0.056, 0.064, 0.074, 0.080, 0.088, 0.096. Each station picks the ladder value nearest its target times a head or breast scale; the constraints are below.

### 4.2 Wings (per side; measured on the built geometry)

| Landmark | Baseline | Window or ladder |
|---|---|---|
| Span ratio (tip to tip / L) | 2.00 | target from the seed in [1.55, 2.45]; built value within ±3 % of target |
| Arm span (shoulder line → wrist, in plane) | 0.30 | ladder 0.22, 0.26, 0.30, 0.34, 0.38 |
| Wrist chord (arm plate only; the secondaries add their length behind it) | 0.16 | ladder 0.14, 0.16, 0.18, 0.20 |
| Wrist leading edge | s = 0.29 (ahead of the shoulder at 0.33) | fixed |
| Camber crease | 35 % chord; trailing panel folded 10° down | fixed |
| Arm dihedral | +8° (seed: −4…+12, nearest ladder step of 2°) | 2° ladder |
| Hand (wrist → socket arc) | a short plate, 0.10 | ladder 0.06, 0.08, 0.10, 0.12, 0.14 |
| Primary sockets | k = 5 (crow) or 4, width 0.20 cells = 0.05 L, on an arc from the wrist's trailing corner (innermost primary points back-outward) to the hand tip (outermost points outward), fan step 10° (radius ≈ 0.29 L) | k ∈ {4, 5}; fan step ladder 8°, 10°, 12° |
| Primary vanes (outer → inner) | 1.68, 1.92, 1.92, 1.68, 1.44 cells (0.36–0.48 L: crow primaries are about half the body length) | vane length ladder 1.20, 1.44, 1.68, 1.92, 2.16 cells; width 0.20; emarginated (the trailing vane narrows in the outer third) |
| Primary layering | opening angles alternate 180° ± 3° about the hand plane | ladder ±2°, ±3°, ±4°; adjacent primaries must not touch |
| Alula | one short vane on a 0.14-cell socket at the wrist's leading corner, folded forward-up 20° | vane 0.48 × 0.14 cells (the shared short vane, see the vehicle brief) |
| Secondaries | fringe of 6 tongues on the arm trailing edge, length 0.11 L, tip width 1.25 × root share, alternate ±4° | tongue length ladder 0.09, 0.11, 0.13 L |
| Coverts | fringe of 5 tongues hinged on the camber crease, over the trailing panel; tips reach 0.02 L past the trailing edge | lift ladder 6°, 8°, 10°, 12°; clearance ≥ 0.008 cells to the arm and secondaries |
| Articulation | shoulder −30°…+35°, wrist −20°…+25°, both toward up | as V2 |

### 4.3 Tail

| Landmark | Baseline | Window or ladder |
|---|---|---|
| Tail ratio (rump apex → central tail tip, / L) | 0.365 | target in [0.26, 0.42]; built within ±3 % |
| Tail plate | one symmetric sheet, two panels on a midline crease (V of 8°), hinged on the rump cap's shoulder ridges | fixed |
| Tail vanes | 3 per side, root width 0.20 cells, **spatulate** (1.4 × wider at 60 % length) so that neighbours overlap into a closed fan, layered by alternating opening angles; lengths by tail shape (rounded: outer shorter; square: equal; wedge: centre longest; forked: outer longest) | vane ladder 0.96, 1.12, 1.28, 1.44 cells |
| Spread | fan step 7° per vane (seed 5°–9°) | fan step ladder 5°, 7°, 9° |

### 4.4 Multi-view target

[`bird-target-views.svg`](bird-target-views.svg) shows top, side, front, below (silhouette) and an oblique three-quarter wireframe. [`plot_targets.py`](plot_targets.py) plots it from the tables above, independently of the lab code.

## 5. Modules and fold topology (why each exists)

| Slot | Module (family) | Sheets | Creases (M/V) | Attachment | Why |
|---|---|---|---|---|---|
| Body segments ×5 per side | `band` keel half-frustum: dorsal, flank and ventral trapezoids | 10 | two longitudinal creases, at the shoulder corner (U) and flank corner (B) | section port to the next segment; midline seams to the mirror half | Volume from a finite chain of segments; transverse folds at stations, continuous ridges |
| Beak | `cap` (3 triangles to the hooked apex) | 2 | ridges along the culmen, gape (U) and gonys | `base` on S1 | Wedge beak, hook from an apex below the gape |
| Rump | `cap` to the rump apex | 2 | ridges | `base` on S6 | Closes the body; carries the tail hinge on its U ridge |
| Arm | `plate`: leading and trailing panel | 2 | camber valley 10° | **joint** on the torso segment's U ridge (shoulder), articulated | Broad cambered arm, flap axis on a real edge |
| Hand | `plate` with 4–5 socket edges on an arc | 2 | none (one panel) | **joint** on the arm's wrist edge, articulated | Wrist hinge; arc sockets give the fan |
| Primaries | `vane` ×4–5 per side | 8–10 | rachis crease, leading vane folded up 25° | root on a hand socket | Slotted, fanned, layered wingtip |
| Alula | `vane` (short, shared definition) | 2 | rachis crease | root on the hand's wrist-corner socket | Tertiary wrist detail; anatomical |
| Secondaries | `fringe` (6 tongues) | 2 | tongue creases ±4° | root on the arm trailing edge | Trailing-edge feather row, layered |
| Coverts | `fringe` (5 tongues) | 2 | lift crease 6–12°, tongues draped | root on the camber crease | Shingled layer over the secondaries' roots, no window |
| Tail plate | `plate`, symmetric, 2 panels | 1 | midline valley (V-tail) | joint on the left rump cap ridge, seam on the right | One tail sheet carries both fans |
| Tail feathers | `vane` ×6 | 6 | rachis crease | root on tail-plate sockets | Fanned tail; shape from the length pattern |

Total: about 41 sheets, each a designed module (V2 had 48, about 20 of them leftover singles). The count is an output, not a target.

**Design rule (closure only between modules):** every module is a tree of panels with no self-contact. Seams that close (midline, section ports, tail-plate right root) close **between** modules in the assembled pose, which is a static exact test. This removes V2's sampled closures.

**Feasibility limits and non-claims:**

- Panels have zero thickness and there are no tabs.
- The shoulder is a hinge on a body edge (flap only; no sweep or twist).
- The wrist is a hinge between the arm and hand modules.
- No perched pose is attempted.
- Upper tail coverts and a separate eye or brow module are left out of this iteration (recorded as possible tertiary detail).

## 6. Constraints the solver enforces (global, object-owned) and what the seed does

- **Seed → targets (bounded sampler):** span, tail ratio, beak ratio, head scale (0.85–1.2), breast scale (0.85–1.2), primaries 4 or 5, tail shape, arm and hand dihedral, head pitch (−8…+10°, applied as a spine offset at S1–S2).
- **Solver variables (finite domains):**
  - station radius classes;
  - arm span, wrist chord and hand span classes;
  - the primary length pattern;
  - primary layering amplitude;
  - secondary length;
  - covert lift and drape;
  - tail vane classes and arc radius.
- **Constraints:**
  1. Station sequence: S2 > S1; S3 ≤ S2 (waist); S4 is the largest; S4 ≥ S5 ≥ S6; head/breast width in [0.48, 0.66].
  2. Measured span within ±3 % of target.
  3. Measured tail ratio within ±3 % of target.
  4. Measured beak ratio within ±5 % of target.
  5. No contact between any two modules except on declared ports (exact test).
  6. Layer clearance ≥ 0.008 cells where layered sheets overlap in plan.
  7. Primaries: adjacent vanes may not touch beyond their shared root vertex.
- **Value order:** nearest to the sampled target first, ties broken by the seed. The log records each eliminated value with its constraint.

## 7. Rejected alternatives

1. **Keep the V2 loft and fix only the listed defects.** Rejected: it still violates GEO-7.
2. **Primaries as one fringe sheet.** Rejected for the primaries: separate vanes give independent layering and are detachable, the natural unit for Collapse. Fringes are kept for secondaries and coverts, where the row reads as one tract.
3. **A separate hood-shaped head module over the body front.** Rejected: its edges would leave a hollow throat visible from below. The head is two band segments plus the beak cap.

## 8. Iteration log (changes made during implementation, after the brief commit `0c9db3d`)

Logged per GEO §1.8. These changes do not retroactively satisfy GEO-0 for the code written before them. Each was forced by a check (contact, validity, solver infeasibility) or by the implementer's look at the clay images, and each is recorded here with its reason.

| # | Change | Why |
|---|---|---|
| 1 | Spine heights S5 −0.002, S6 0.010, rump 0.020 (were 0.010, 0.016, 0.024) | With the tabled values the back was level from S4 to S5, which repeated V2's flat back. The back now falls from the shoulder hump to the tail |
| 2 | Arm camber crease runs corner to corner, from the shoulder's leading corner to the wrist's trailing corner (was 35 % chord root → 35 % wrist) | A port must be one panel's edge; a crease ending mid-edge splits both the shoulder and the wrist port |
| 3 | Covert row stops short of both ends (fringe insets 0.30 at the wrist and 0.22 at the shoulder) | The innermost tongue crossed the torso (exact contact test). At the wrist the crease meets the trailing edge, so coverts there sat on the secondaries' roots |
| 4 | Fringe tongues side by side (spread 1.0) with blunt tips | Tongues of one sheet cannot overlap in the flat sheet (paper cannot overlap itself; the compiler split the sheet). Overlap now happens only between separate modules (coverts over secondaries, vanes) |
| 5 | Primaries 0.26 cells wide; blunt (inner) and emarginate (outer) tips. Lengths = a shape of index offsets + a solver-chosen base on the ladder 0.96–2.64 | The first clay images read as needles and splinters. Index offsets let the span constraint pick length without changing the stagger |
| 6 | Ladders refined and widened: beak 0.055–0.15 (step 0.005), tail vane 0.64–1.84 (0.04), arm span 0.18–0.46, primary fan 7 / 8.5 / 10°, covert lift 4–12° | The solver reported windows unreachable and ladder steps coarser than the tolerances. Beak/L is measured on the built bird, so the parameter ladder must extend past the window. Each half-step is now under its tolerance |
| 7 | Tail vanes 0.26 cells wide, spatulate, stacked monotonically (each outer vane lower; step chosen by the solver from ±2 / 3.5 / 5°) | Alternating layering crossed for short tails (exact contact test). Shingle stacking is how a fanned tail overlaps |
| 8 | Alula 0.36 × 0.14 cells, blunt (was 0.48 pointed) | Shared definition with the vehicle grille slats; pointed slats read as fangs on the car |
| 9 | Two-stage search (body and tail, then wings against the fixed body) with the plan's coupled-first variable order; each geometric constraint scoped to the variables that change it | One-stage search with whole-bird constraints exhausted its budget, and MRV ordering thrashed on body radii that cannot fix a tail dead end |
| 10 | Covert clearance measured against the secondaries only (sheets without a shared port), as the construction brief §4 states | The first implementation measured coverts against the arm they are hinged to, where clearance is zero at the root by construction |
| 11 | Secondaries row inset 0.16 at the shoulder end; covert inset at the shoulder end 0.34 (was 0.22). The search now requires automated GEO-1 = PASS (sheet folds, flap sweep, rest pose) | The first evidence run (`b1b4a41`) found seeds 5 and 7 and the min corner FAIL: the innermost secondary swept into the belly and tail plate during the flap, and the min corner's innermost covert hit the torso. Seeds 6 and 303 were NOT VERIFIED (sampled-only). The rest-pose contact constraint did not cover motion |
| 12 | After independent review round 1 (pixels at `b1b4a41`; blockers: hull-like side view with head and beak merged, heraldic planform, needle primaries): larger head carried higher (S1 r 0.032, y 0.01; S2 y 0.03; S3 y 0.022; brow target 0.056 × head; head/breast window [0.55, 0.72]; strict nape waist); wrist leading edge 0.08 ahead; wrist chord ladder 0.12–0.18; primary fan step 4–6° (was 7–10°); primaries at most 1.3 × the arm (new anatomical constraint; arm ladder extended to 0.54); visible rachis (leading vane 0.28 W folded 35° on primaries, 20° on tail vanes); tail vanes 0.22 wide, fan step 3–5°; alula = the shared short vane 0.26 × 0.119 | The reviewer graded the side view worse than V2 and the below silhouette a claw/glyph. The head is still the body's keel section scaled down, which limits how separate it can read: a distinct head module is the next structural step and is recorded as open |
