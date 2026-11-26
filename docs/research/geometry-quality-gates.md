# Geometry quality gates (GEO-0 … GEO-6) — proposal, not adopted

- Status: **proposal for the owner.** Written for the origami lab (`experiments/origami-lab`, draft PR #11). It does **not** change accepted production instructions (`CLAUDE.md`, `AGENTS.md`, the master plan, ADRs), it does not close P3D-2 or any phase gate, and it does not authorise Phase 4. Adopting it, in whole or in part, is the owner's decision (§9).
- Date: 2026-11-26. Trigger: owner review 2026-11-26. The lab V1 geometry was rejected as "ugly, coarse, simplistic, an unprincipled assembly of code"; the owner asked for enforceable gates that tie mathematical understanding and design intent to the implementation.
- First application: [`origami-lab-v2/gate-evidence.md`](origami-lab-v2/gate-evidence.md) (hero bird).

## 1. Rules that apply to every gate

1. **Three verdicts only:** `PASS`, `FAIL`, `NOT VERIFIED`. Anything not evidenced at the exact commit under review is `NOT VERIFIED`, never `PASS`.
2. **No averaging.** There is no overall score. Any hard criterion that FAILs makes its gate FAIL, whatever the others say. A gate passes only if every hard criterion passes.
3. **Evidence is a path and a commit.** Every verdict cites files (screenshots, JSON, test names, CI run) produced from one stated commit SHA. Screenshots without a SHA in the image or file metadata are not evidence.
4. **Automated vs human.** Each criterion is marked **[A]** (machine-checked by a named test or script) or **[H]** (human judgement against the written rubric). Green tests never imply an [H] pass.
5. **No self-approval.** The implementer may record [A] results and a *self-assessment* of [H] criteria. [H] verdicts need a reviewer who is independent of the implementation (§7). Final acceptance of GEO-2 and GEO-5 is the **owner's alone**.
6. **Honest limits.** Every automated check states what it does not prove (for example "0 collisions detected at sampled poses under these assumptions" rather than "no overlap").
7. **Failure consequence.** A FAIL blocks the next gate and any claim built on it. For example, GEO-3 diversity claims are void while GEO-2 morphology FAILs, and nothing enters production while GEO-6 is not PASS *and* owner-approved.

## 2. GEO-0 — Principle and design brief (before code)

Purpose: geometry must come from an understood subject and a stated method, not from tuning code until something renders.

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 0.1 | A design brief exists **before** the implementing commit (git history shows it first or in the same commit as the first geometry code) | A (git) | yes |
| 0.2 | Reference study: at least two real-subject references (anatomy, vehicle or architecture data) and at least one paper or folding reference, with source and licence or use statement. No reference geometry or image is imported or traced | H | yes |
| 0.3 | Shape language: primary, secondary and tertiary forms named, with the reason each exists | H | yes |
| 0.4 | Target proportions as numbers (ratios of a named reference length) and a 3-view target drawing plotted from those numbers | H + A (file exists) | yes |
| 0.5 | Topology and fold plan: which surfaces are closed or open, where creases (mountain/valley), joins, glue seams and joints are, and why each exists | H | yes |
| 0.6 | Construction honesty: states whether the object is **true one-sheet folding** or a **modular sheet assembly** (papercraft), and what is not claimed (thickness, tabs, physical foldability) | H | yes |
| 0.7 | Feasibility limits and at least two rejected alternatives with reasons | H | no |

Consequence of FAIL: no geometry code is reviewed; return to design. The owner does not approve low-level mathematics item by item; the brief records it for audit.

## 3. GEO-1 — Geometric validity

Purpose: every panel, fold and seam is mathematically valid, and every validity claim is exactly as strong as the check behind it.

| # | Criterion | Kind | Hard | Lab V2 check |
|---|---|---|---|---|
| 1.1 | Panels are planar (≤ 1e-6 cells), strictly convex, with minimum altitude ≥ 0.004 cells (≈ 1/250 cell, far above Foldon's 1e-9 storage grid and below any intended feather tip) | A | yes | `verifyCompiled → panels.issues` |
| 1.2 | **Thin panels need annotation, not a blanket angle ban.** An interior angle below 6° is allowed only on a face the design marks `thin` (feather vanes, beak tip), and the brief must say why | A | yes | `thin-unannotated` issue |
| 1.3 | Declared join topology: every seam and joint is a **shared vertex pair** of the design surface (topological identity). Equal edge length is a consequence, not the proof | A | yes | construction + `seamGap` |
| 1.4 | Flat pattern: every piece unfolds by its own crease tree into one plane (off-plane ≤ 1e-6) with no overlapping panels (exact 2D test; touching along a shared edge or vertex is allowed) | A | yes | `flat` report, fold sweep at u = 0 |
| 1.5 | Rigidity: edge lengths of every panel are unchanged at every evaluated pose (≤ 1e-7 cells) | A | yes | `rigidity` |
| 1.6 | Closure: in the assembled rest pose, and at both ends of every articulation range, every copy of every design vertex coincides (≤ 1e-6 cells) | A | yes | `seamGap` |
| 1.7 | **Contact, not exemption:** contact between two panels is allowed only on the boundary they actually share at that pose (coincident vertices or edge). Hinged, closing and mounted pairs are **not** exempt | A | yes | `panelContact`, `posedContacts` |
| 1.8 | **Swept check, with its strength stated per pair:** `analytic` (convex pair hinged on a full shared edge with \|dihedral\| < 180° over the interval: they meet only on that edge), `static` (no relative motion: one exact test), `certified` (interval proof by distance > rigid speed bound × half-width, or by sector gap > angular speed × half-width at a fixed shared vertex), `sampled` (exact tests at interval midpoints only), `collision` | A | yes for `collision`; `sampled` keeps GEO-1 at NOT VERIFIED | `verifyCompiled → sweeps` |
| 1.9 | Articulated edges must remain hinges after unfolding (an articulated edge that became a cut is a compile error) | A | yes | `compileDesign → articulation` |
| 1.10 | Every piece compiles to a Foldon definition that passes `defineFoldon` / `validateFoldon` unchanged | A | yes | `definitions` |
| 1.11 | Negative controls exist and fail as expected: flap folded flat onto its parent, a vertex-sharing fan crossing, coplanar overlap, a collision confined between sample times, a mount sunk into its host, an articulated edge that would be cut | A | yes | `test/v2.test.ts` |

What GEO-1 does **not** prove:

- Paper thickness, tab and glue feasibility.
- That a physical assembly order exists between pieces (pieces are shown exploded for t < 1).
- Global non-intersection for parameter values that were not built.

### 3.1 The lattice and the 10° sliver rule (V1) — restrictions and counterexamples

- **V1 rule:** vertices on a 1/8-cell lattice, triangles built from integer (base, offset, height), plus `triangleFromSides`. Seam validity was taken to be equality of integer squared lengths.
- **Counterexample 1:** the equilateral triangle with integer sides (5, 5, 5) has height 5√3/2, which is off the lattice, so V1 rejects a perfectly valid panel (`triangleFromSides(5, 5, 5)` → `off-lattice`; test "an equilateral triangle that the V1 1/8 lattice rejects…").
- **Counterexample 2:** equal squared length does not prove joint compatibility. Two edges of length 10 glued with the wrong orientation, or glued where the dihedral makes the panels interpenetrate, satisfy the length rule. Topology plus the contact checks are needed (1.3, 1.7).
- **Counterexample 3:** a 10° minimum angle rejects intended forms. A tapered primary feather or a tail vane can legitimately be 4–8° at the tip. V1's rule forced blunt, coarse shapes; V2 replaces it with an absolute minimum altitude (1.1) plus annotation (1.2).
- **What remains justified:** quantise *design parameters* (V2 uses 1/1000 of the reference length) so that identity is a stable hash. Do not quantise *vertex positions* when that changes the shape.

## 4. GEO-2 — Morphology and art direction

Purpose: the object reads convincingly as its subject, in the project's visual language, from geometry alone.

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 2.1 | 3-view target (front, side, top) plus annotated primary/secondary/tertiary forms exist **before** implementation (GEO-0.4) | H | yes |
| 2.2 | Measured landmark ratios of the built mesh match the brief within a stated tolerance (bird: span/L, tail/L, beak/L within 5 % for the baseline) | A | yes |
| 2.3 | Recognisable without labels from three-quarter, side, front and below, in neutral clay and in pure silhouette, by an independent reviewer | H | yes |
| 2.4 | Subject-specific requirements (below) are met or explicitly NO-GO | H | yes |
| 2.5 | Close-ups show intentional tertiary detail, made of panels and creases, never painted lines or decals | H | yes |
| 2.6 | Proportions balanced: no needle limbs, no blank slabs, no unexplained gaps or holes (holes only where designed) | H | yes |
| 2.7 | Translation to the reference art direction (`assets/reference/visual-direction.png`) is written down: what is kept (angular, heavy silhouette shapes) and what is deferred to shading or ink | H | no |

Panel counts and facet quotas are **not** criteria. More panels are not better.

Subject requirements:

- **Bird:**
  - head, beak and neck, and body with breast and tail
  - wings with root, mid (wrist) and tip regions
  - layered, folded structure
  - balanced proportions
  - a recognisable flying (or resting) pose
- **Vehicle:**
  - coherent wheelbase
  - wheels with real thickness, an axle line, fenders and ground clearance
  - cabin and bonnet volumes
  - a faceted volumetric silhouette
  - intentional details made of geometry
- **Building:**
  - layered roof with overhang and ridge
  - openings with frame or recess
  - architectural layering (base, walls, roof)
- **Pine:**
  - trunk and branch hierarchy
  - angular, layered taper
  - no holes that read as disconnected panels unless deliberate

Consequence of FAIL: the object stays experimental. GEO-3 diversity and production work on it are void until GEO-2 passes the owner.

## 5. GEO-3 — Generative expressiveness

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 3.1 | Objects are built from a reusable family (named primitives, e.g. `ring`, `loft`, `stitch`, `fan`). Every face is traceable to a primitive call and a semantic slot (module and part). There is no monolithic per-object mesh | A + H | yes |
| 3.2 | Parameters affect silhouette and proportion (not only colour or hash); bounds are stated and anatomically or functionally justified | H | yes |
| 3.3 | At least 8 seeded variants **including both extremes and out-of-sample seeds** are built, all pass GEO-1, and are shown on a contact sheet at identical camera, light, material and scale | A + H | yes |
| 3.4 | Diversity is measured on geometry: landmark ratio spread and silhouette IoU (diagnostics, not a beauty score). Distinct hashes are not evidence of variation | A | yes |
| 3.5 | Recognisability is preserved across all variants (independent reviewer, contact sheet) | H | yes |
| 3.6 | Claims match the mechanism: a bounded random parameter sampler is called that, never "WFC" or "grammar search" unless a solver with constraints is demonstrated | H | yes |
| 3.7 | Reuse in a second object type is demonstrated, not asserted | H | no (yes before production) |

## 6. GEO-4 — Motion and fold

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 4.1 | Flat → folded sequence comes from actual crease transforms (`poseGeometry` angles), not mesh interpolation | A | yes |
| 4.2 | Hinge axes are the shared edges; joint vertices stay fixed during articulation (≤ 1e-6) | A | yes |
| 4.3 | Continuous trajectories: no jump larger than the speed bound between consecutive samples; no edge stretch (GEO-1.5) | A | yes |
| 4.4 | No penetration during fold or articulation: GEO-1.8 sweeps over the fold range of every piece and over every articulation range | A | yes |
| 4.5 | Articulated wing through a root joint and a secondary joint where feasible | H | no |
| 4.6 | Visual evidence: fold contact sheet (t = 0 … 1), flat crease pattern per piece, articulation sheet, inspector with joint semantics | H | yes |

## 7. GEO-5 — Visual evidence and review

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 5.1 | Neutral material (one matte clay, flat shading), fixed key/fill/rim lights, fixed cameras and world scale; no shader, texture, ink or post-processing that could disguise geometry | A (page code) + H | yes |
| 5.2 | Views: three-quarter, front, side, top, silhouette (from below for flying subjects), close-up; multiple seeds; side-by-side old and new | H | yes |
| 5.3 | Reproducible capture: a committed script and URL parameters regenerate every image; the served commit is printed in the page | A | yes |
| 5.4 | **Independent review:** a reviewer who did not implement the geometry inspects the image pixels against this rubric and records findings with severity (blocker / major / minor) and **concrete locations** (view, part, seed) | H | yes |
| 5.5 | Simplistic shapes are rejected even when every test is green | H | yes |
| 5.6 | **Owner approval** is the only acceptance. Agent or reviewer statements are recommendations | H | yes |
| 5.7 | Live preview: loopback URL, exact served SHA, process ID and an HTTP readiness check are recorded; existing previews are not stopped | A | yes |

## 8. GEO-6 — Engineering and integration readiness

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 6.1 | Production contracts untouched by the experiment (`packages/*`, `apps/*` diff empty) | A (git diff) | yes |
| 6.2 | Deterministic identity: same parameters give the same id and geometry; ids are hashes of versioned, quantised parameters | A | yes |
| 6.3 | Reproducible commands documented: test, typecheck, lint, build, capture | A | yes |
| 6.4 | Tests cover promises at the public seam, including the negative controls in GEO-1.11. No mocks | A + H | yes |
| 6.5 | Performance bounded and measured (build and verify time per object) | A | no (yes before production) |
| 6.6 | Versioning and compatibility risk stated (catalog fingerprint, Q6) | H | yes |
| 6.7 | CI green **on the exact head commit**, with artifact provenance (SHA in screenshots and evidence) | A | yes |
| 6.8 | No unnecessary abstraction: each new module has one owner and a reason | H | no |
| 6.9 | Phase 4 dependency: production use requires owner decisions on Q1–Q6 (`geometry-expressiveness.md` §6) and on this gate. No automatic merge or phase authorisation | H | yes |

## 9. Adoption proposal (owner decides)

1. The owner adopts or edits this spec as the geometry acceptance standard for the origami track.
2. If adopted, the minimal production-instruction change would be **one line** in `AGENTS.md`/`CLAUDE.md`: "New or changed object geometry must pass `docs/research/geometry-quality-gates.md` GEO-0…GEO-6; GEO-2 and GEO-5 need owner approval." That line is **proposed here and not applied**.
3. Until adoption, the gates are used only inside the lab, and their verdicts are informational.

## 10. Reporting template (copy per object and commit)

```
Object: <name>   Commit: <sha>   Reviewer (H): <who>   Date:
GEO-0  PASS|FAIL|NOT VERIFIED  evidence: <paths>   notes:
GEO-1  …  automated report: <path/test>  sampled-only pairs: <n> (certified for u < <x>)
GEO-2  …  self-assessment: …  independent: …  owner: pending
GEO-3  …
GEO-4  …
GEO-5  …
GEO-6  …  CI run: <id> on <sha>
Blocking findings: <severity, location, description>
Approval needed from owner: <exact list>
```
