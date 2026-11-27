# Gate evidence — origami lab V3 (exploratory; no acceptance implied)

- Standard: [`docs/governance/geometry-quality-gates.md`](../../governance/geometry-quality-gates.md). The rules were adopted by the owner on 2026-11-27 and are on `main` since PR #12 was merged (`03760d2`, merged by the `cuongtranba` account at 04:41 UTC, not by the agent). There is no automated repository-wide enforcement. No model is approved by the standard.
- Status: **exploratory experiment** (rule 11). It is not a production candidate, and it closes no gate. The owner's sign-off on GEO-2, GEO-5 and GEO-7 has not been given for anything.
- Evidence SHA: geometry and page code at `2749991`. Images and `evidence-v3-*.json` were captured from a clean tree at `74c686f` (docs-only difference from `2749991`); the page banner reads `experiment/origami-lab-v3 @ 74c686f`. They are committed in `616c56f`. Later commits on this branch are docs only (this record).
- History: V1 (`73b612b`) and V2 (`103d9e7`) are ancestors of this branch, and their records are unchanged. V2's verdicts are historical and were not re-graded (rule 13).

## Summary verdicts (recommendations; the owner decides)

| Gate | Bird (crow + 13 variants) | Vehicle (hero + 10 variants) | Why (short) |
|---|---|---|---|
| GEO-0 | **PASS** [A: git] / [H self] | **PASS** [A: git] / [H self] | Briefs and multi-view targets are in `0c9db3d`, a strict ancestor of the first implementing commit `7225fad`. Later changes are logged (bird §8 rows 1–12, vehicle §9 rows 1–8) and are not counted for GEO-0 |
| GEO-1 | **PASS [A]** at `2749991`: 14/14, 0 sampled, 0 collisions | **PASS [A]** at `2749991`: 11/11, 0 sampled, 0 collisions | Every sheet's fold, the flap sweep (bird) and the rest pose are certified by the audited checker. The search requires this verdict. Limits below |
| GEO-2 | **FAIL** (independent reviewer, round 2 at `74c686f`) | **FAIL** (round 2) | Bird: head and beak one cone, no neck; heraldic planform; oversized bell tail; needle hands on extremes. Vehicle: plank body without bonnet or cowl step, fang grille, fenders invisible from the side, tower cabin |
| GEO-3 | **NOT VERIFIED** | **NOT VERIFIED** | Void while GEO-2 fails (rule 7). [A] parts pass (variants, measured spread) |
| GEO-4 | **PASS [A]** 4.1–4.4; 4.6 images present | n/a (no articulation) | Flap = shoulder and wrist joints between modules. The sweep is certified, with no sampled pairs |
| GEO-5 | **NOT VERIFIED** | **NOT VERIFIED** | 5.3 and 5.7 [A] PASS. 5.4 done (two independent rounds). 5.6 owner approval pending. The dashed seam line is undiagnosed (5.1 caveat) |
| GEO-6 | **NOT VERIFIED** | **NOT VERIFIED** | 6.1–6.5 and 6.7 PASS. Production use needs Q1–Q6 and owner decisions (6.9) |
| GEO-7 | **NOT VERIFIED** (owner judgement on 7.5 and 7.10 pending) | same | [A] parts pass. Whether the reuse is meaningful is the owner's call |

**NO-GO for acceptance of either object.** Remaining work is listed in §8.

## GEO-0 — evidence

`git log --oneline 103d9e7..HEAD` shows the briefs commit `0c9db3d` before the first V3 code `7225fad`.

- **0.2 references:**
  - Bird: R1–R6, including Torrence 2022, Tachi 2009 and Mitani 2004, verified in [`modular-construction-research.md`](modular-construction-research.md).
  - Vehicle: V-R1 (1940 Chevrolet brochure), V-R2 (Mercedes 170 V) and V-R3 (1940 Ford).
- **0.3–0.6:** briefs §3–§6.
- **0.7:** each brief lists rejected alternatives.
- **Rule 9 thresholds:** construction brief §4 gives each threshold with its scale justification and counterexample, and `test/v3.test.ts` holds the negative controls.

## GEO-1 — evidence (automated; `evidence-v3-bird.json`, `evidence-v3-vehicle.json`, `test/v3.test.ts`)

| Object | Variants | Verdict | analytic / static / certified / sampled / collision | Max seam gap | Max rigidity drift | Max flat off-plane | Min angle (thin-annotated faces) | Min altitude | Invalid definitions |
|---|---|---|---|---|---|---|---|---|---|
| Bird | 14 | PASS ×14 | crow 380 / 7818 / 4368 / 0 / 0 | 3.2e-9 | 1.2e-9 | 1.4e-9 | 3.1° (vanes and fringe band, annotated) | 0.0496 | 0 |
| Vehicle | 11 | PASS ×11 | hero 1768 / 141046 / 424 / 0 / 0 | 6.7e-9 | 9.5e-10 | 1.3e-9 | 7.28° (none thin) | 0.0200 | 0 |

What changed from V2, and why GEO-1 now passes:

- **Certificate audit (`7dc9b37`).** Two latent flaws were found by constructed fixtures and fixed:
  - Co-hinged pairs were judged from wrapped `atan2` end values, so a relative swing of 180° or more through a neighbour was certified.
  - Signed fold angles equal ±180° at coincidence only for consistently oriented faces; on three-face edges they coincide at 0°.
  
  The edge-sharing certificate now unwraps the orientation-free opening angle between half-planes (steps under π/2 of motion) and reports the exact coincidence instant. The consistency tolerance is 1e-6 rad, because Foldon stores rest angles from vertices rounded to 1e-9. The V2 bird reproduces its published counts exactly, so the flaws were latent there.
- **V2 witnesses** (sampled-only pairs, kept as V2's honest NOT VERIFIED; listed per pair by `witnesses`):
  - every body ring strip closes on itself at u ∈ [0.953, 1];
  - one tail-fan pair over u ∈ [0, 1] on seed 202 and both corners.
- **V3 removes the cause by construction.** Every module is a tree of panels with no self-contact, so seams close only between modules in the assembled pose (static, exact).
- **Negative controls (tests):**
  - flap folded flat;
  - vertex-sharing fan crossing;
  - coplanar overlap;
  - between-sample collision;
  - sunk mount;
  - cut articulated edge;
  - wrap-around co-hinged swing;
  - closing seam inside a sheet (NOT VERIFIED, not PASS);
  - contract refusals (kind, a 0.001-cell length difference, off-ladder angle, port in use, open seam);
  - threshold counterexamples (a 0.0039-cell sliver; a dart plate).
- **V1 house reconciliation.** The crossing is one per seed, at t = 1 only, between `walls.right` and `roof.overhang`, in seeds {1, 2, 3, 4, 6, 8}. That is the "6". The V2 table's "seeds with contacts 1–8" counted every contact kind; seeds 5 and 7 have only edge touches.

What GEO-1 does not prove:

- paper thickness, tabs or glue;
- a physical assembly order between modules;
- parameter values that were not built;
- a global theorem beyond the certificates' stated assumptions: convex planar panels, linear fold and articulation schedules, rigid relative speed bounds along panel polylines, fixed-apex sectors.

## GEO-2 — morphology (measured [A] + independent review [H])

Measured landmarks (bird, on the built geometry; tolerances span ±3 %, tail ±3 %, beak ±5 %):

| Variant | span/L (target) | tail/L (target) | beak/L (target) |
|---|---|---|---|
| crow | 1.945 (2.000) | 0.358 (0.365) | 0.100 (0.100) |
| seeds 1–8, 101, 202, 303 | all inside tolerance (see JSON) | inside | inside |
| min corner | 1.569 (1.55) | 0.264 (0.26) | 0.069 (0.07) |
| max corner | 2.395 (2.45) | 0.411 (0.42) | 0.124 (0.13) |

Vehicle (hero; on the built geometry):

- wheelbase/L 0.596;
- height/L 0.339;
- hood/L 0.347;
- tyre diameter 0.66; track 1.48;
- ground clearance 0.253;
- tyre-to-fender clearance 0.079;
- tyres on the ground at 2.5e-11.

Every variant is inside the brief's windows.

Independent review: see §5.

## GEO-3 — expressiveness [A parts]

- **Mechanism:** the seed draws targets (a bounded random sampler). A finite-domain constraint search (backtracking with forward checking, static coupled-first order) chooses ladder values. It is not WFC and not a grammar.
- **Diversity:**
  - bird top-silhouette IoU over seeds 1–8: min 0.365, median 0.655, max 0.88; measured span spread 1.71–2.37;
  - vehicle side-silhouette IoU: min 0.66, median 0.739, max 0.892;
  - one or two window bays, cabin position, wheel size and roof height vary.

## GEO-4 — motion

- **4.1:** Foldon crease angles move every sheet. Shoulder and wrist are joints between modules.
- **4.2:** the hinge axes are the shared port edges.
- **4.4:** the flap sweep (shoulder −30…+35°, wrist −20…+25°) is certified for all 14 birds, with no sampled pairs. Regression: seeds 5 and 7 and the min corner originally collided (innermost secondary into the belly and tail plate); the fix is fringe insets plus GEO-1 as a search constraint.
- **4.6:** `exp-origami-v3-bird-fold.png` shows the fold sequence, five flap phases and the flat nets of all 42 sheets, one per module instance.

## GEO-5 — visual evidence and review

- **5.1:** one matte clay, flat shading, fixed lights and cameras, welded positions.
  - Caveat: the V2 shoulder "dotted line" is **not explained**. The diagnosis page shows raw and welded renders are pixel-identical (reviewer round 1). Geometry is ruled out: seam gap ≤ 5.3e-10, no T-junctions, no duplicate vertices, opening angles 52–168°. The Float32-crack hypothesis in the bird brief §1 row 4 is therefore **not supported** by the pixels. The dashed line also appears on V3 ridges. The cause is undiagnosed: possibly antialiasing or polygon-offset on grazing ridges.
- **5.2:** all views are present: study, contact sheets, extremes, fold, before/after, modules.
- **5.3:** `capture/capture.ts` with the URL queries in the lab README, from a clean tree.
- **5.7:** loopback preview: see the PR comment.
- **Independent reviews:** round 1 at `b1b4a41` and round 2 at `74c686f`, recorded below.

## GEO-6 and GEO-7

- **6.1:** `git diff --stat 6024a1b..HEAD -- packages apps tools benchmarks` is empty.
- **6.2:** determinism test.
- **6.3:** README V3 section.
- **6.4:** 15 V3 tests plus 1 regression, all at the public entry point, with no mocks.
- **6.5:** per variant, measured in the browser at `74c686f`:
  - bird search and build 207–433 ms, verify 95–180 ms;
  - vehicle search and build 1.3–1.9 s, verify 0.8–1.3 s.
- **6.7:** CI on the pushed head (PR comment).
- **7.1–7.4:**
  - a finite versioned catalog (`band`, `cap`, `vane`, `fringe`, `plate`, `arch`, `stitch`);
  - port contracts with refusal reasons (tests);
  - the semantic part graph and the provenance DAG (page inspector; JSON `provenance`);
  - an honestly named search whose eliminations are logged.
- **7.5 reuse:**
  - (b) family: `band` and `cap` build both bodies and the wheels; `plate` builds the wing, tail and board;
  - (c) concrete: the short blunt vane, ids `2c983de2c28393b1` and mirror `96d40e024a51e18d`, is the bird's alula and the vehicle's grille slats;
  - within the bird, primary and tail vane definitions repeat.
  
  Round-1 review called the cross-object reuse "decorative". The owner decides whether it is meaningful.
- **7.7:** legal alternatives: 14 and 11 solved variants. Rejections are in the decision logs, for example a covert lift eliminated by clearance and a primary base eliminated by the measured span or the anatomical cap.
- **7.8:** a primary detached and re-attached, and a grille slat moved from the car into the bird's alula socket (tests).
- **7.9:** no target mesh and no import. Every panel comes from a module definition.
- **7.10:** sheet counts are outputs: bird 40–42, vehicle 80–92. Round 1 flagged the vehicle's sheet count against its read.

## 7. Independent reviews

Reviewers were separate agents that read only the rubric, the briefs and the image pixels, not the code. Their verdicts are recommendations, not owner approval.

**Round 1** (images at `b1b4a41`; committed in `74c686f`'s history). Recommendation: bird GO for owner review only, vehicle NO-GO.

- Blockers:
  1. bird side view reads as a hull or fish, with head and beak as one spike;
  2. bird below view reads as a heraldic glyph (rectangular arm, claw-like hand, thumb alula, oversized square tail);
  3. the dashed seam line persists after welding;
  4. no visible rachis;
  5. needle primaries on the extremes;
  6. vehicle grille "fangs";
  7. plank body, no bonnet, invisible fenders;
  8. framing.
- Responses: bird §8 row 12 and vehicle §9 row 8. The diagnosis correction is bird row 13.

**Round 2** (images at `74c686f`, committed in `616c56f`). Recommendation: **NO-GO for owner review for both objects.** "If the owner wants a progress checkpoint anyway, show these images with this table attached, not as a candidate."

| Round-1 blocker | Round 2 |
|---|---|
| 1 Bird side hull, head and beak one spike | PARTLY: a small chin step and brow bump now; crown to beak still one cone, no nape waist; seen edge-on, the tail is a stalk |
| 2 Heraldic planform | PARTLY: the hand fan is tighter (35–40°); the rectangular arm, thumb alula and broad bell tail (about 2.5 × body width) remain |
| 3 Dashed seam line | NOT RESOLVED: visible on V3 ridges; the diagnosis tiles are identical, so neither cause nor fix is shown |
| 4 Rachis, slivers | PARTLY: a faint leading strip on primaries, almost none on tail vanes; slivers remain between covert tabs |
| 5 Needle primaries on extremes | PARTLY: the baseline is broader; window maximum and seed 7 still show spikes (seed 7 below silhouette "a five-tine rake") |
| 7 Grille fangs | NOT RESOLVED, arguably worse (pointed blades in the recess read as teeth) |
| 8 Plank body, no bonnet, invisible fenders | NOT RESOLVED (only the nose taper changed) |
| 9 Framing | PARTLY (study fixed; the V1 compare still spills and V3 is small in it) |
| 10 Running boards read as loose planks | NOT RESOLVED |
| 11 Tower cabin, tray rear | NOT RESOLVED |

Round-2 verdicts:

- **Bird:**
  - 2.3 FAIL;
  - 2.4: head, beak and neck FAIL; breast, back and tail PARTLY; wing regions PARTLY; layered feathers PARTLY; proportions FAIL; pose PASS;
  - 2.5 PARTLY/FAIL; 2.6 FAIL;
  - 3.5 void (rule 7); 5.2 PASS; 5.5 FAIL.
- **Vehicle:**
  - 2.3 FAIL;
  - 2.4: wheelbase PASS; wheel thickness PASS; axle line NOT VERIFIED; fenders FAIL; ground clearance PASS; cabin and bonnet FAIL; faceted silhouette FAIL; details FAIL;
  - 2.6 FAIL; 3.5 void; 5.5 FAIL.
- **Bird vs V2:** mixed, and worse in the brief's primary read. V3 has better slotted primaries and covert layering in three-quarter view, but its below silhouette reads less like a crow than V2's, and the side view is no better than V2.

## 8. NO-GO list and remaining work

NO-GO for both objects (rule 12). Remaining work, from the round-2 findings (no criterion was weakened to pass):

1. **Bird head module (structural).** Replace the head bands, which are the body's keel section scaled down, with a separately designed head module family: a rounder crown, an explicit nape waist and a brow ridge, attached to the neck band by a section port. Tuning cannot produce a neck from one homothetic section.
2. **Bird planform.** Replace the single rectangular arm plate with a tapering arm (leading-edge break at the wrist, secondaries carrying the trailing outline). Shorten and blunt the outer primaries on the extremes (cap below 1.3 × arm, or a shape-dependent cap). Fold the alula into the leading edge.
3. **Bird tail.** Replace the broad fan plate with a narrow root and stacked vanes, so the tail reads as a closed wedge from below and has thickness from the side. Narrow the fan (target 0.15–0.2 L wide).
4. **Rachis and slivers.** Make the rachis readable (a broader leading vane or a second crease) and close the covert-tab slivers (tab overlap via separate modules, or a different covert construction).
5. **Seam line (5.1 caveat).** Diagnose the dashed dark ridge line in the renderer (antialiasing vs polygon offset vs double-sided shading). No geometric cause was found.
6. **Vehicle body (structural).** Introduce a narrower hood section family and a cowl step: the cabin needs its own lower body section, not the full-width tub. Fenders need visible crowns above the wheel line from the side. Running boards need a visible attachment (a skirt or apron module). The grille should be horizontal or vertical louvres inside a framed recess, not hanging blades.
7. **Reuse (GEO-7.5).** The shared vane (alula = grille slat) was judged decorative in both rounds. A meaningful concrete reuse needs a module that does the same structural job in both objects. Owner decision.
8. **Evidence.** Contact sheets should add a side silhouette for the bird. The vehicle before/after needs per-object framing at one scale.
