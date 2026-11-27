# Geometry quality gates (GEO-0 … GEO-7) — adopted standard

- Status: **ADOPTED as the geometry acceptance standard** by owner decision on 2026-11-27 (handoff "Geometry V3"). The owner adopted the **rules**. No existing model, verdict or gate outcome was approved by that decision.
- In force: repository-wide once this file and the matching line in `AGENTS.md` are merged into `main`. Until that merge, adoption is authorised but repository-wide enforcement is pending. Enforcement is by review against this document. **No automated repository-wide enforcement exists** (no CI job reads this file); the automated [A] checks are per-object tests that each implementation must provide and name.
- Scope: any new or changed object geometry (Foldon definitions, object recipes, module catalogs, procedural generators of visible shape) that is presented for acceptance, and the way experiments report on geometry.
- Not decided here: the exact construction contract (ports, sockets, bonds), any physics, Phase 4, or the open questions Q1–Q6 of the geometry expressiveness research (non-axis seams, a `join` edge kind, parameterised families in Foldon, closed crease networks, object grammar in Genesis, catalog versioning). Those remain owner decisions.
- History: GEO-0…GEO-6 were first proposed on 2026-11-26 for the origami lab (draft PR #11, branch `experiment/origami-expressiveness-lab`, file `docs/research/geometry-quality-gates.md` on that branch). That proposal and the V2 evidence recorded against it are a frozen historical record; they keep their original verdicts. The stricter rules below (§1 items 8–13 and GEO-7) apply **prospectively**, from adoption on.

## 1. Rules that apply to every gate

1. **Three verdicts only:** `PASS`, `FAIL`, `NOT VERIFIED`. Each verdict names the exact commit SHA of the evidence. Anything not evidenced at that SHA is `NOT VERIFIED`, never `PASS`.
2. **No averaging.** There is no overall score. Any hard criterion that FAILs makes its gate FAIL. A gate passes only if every applicable hard criterion passes.
3. **Evidence is a path and a commit.** Every verdict cites files (screenshots, JSON, test names, CI run id) produced from one stated SHA. Screenshots without that SHA in the image or in file metadata are not evidence. If a later docs-only commit is the branch head, report both SHAs and say which files differ.
4. **Automated vs human.** Each criterion is **[A]** (machine-checked by a named test or script) or **[H]** (human judgement against the written rubric). Green tests never imply an [H] pass.
5. **No self-approval.** The implementer records [A] results and may write a *self-assessment* of [H] criteria. [H] verdicts need a reviewer independent of the implementation. An independent reviewer's verdict is a recommendation; **acceptance of GEO-2, GEO-5 and GEO-7 is the owner's alone.**
6. **Honest limits, no blanket claims.** Every automated check states what it does not prove (for example "0 collisions detected by these certificates under these assumptions", never "no overlap"). Test counts, pair counts, facet counts and green CI are not evidence of validity or quality by themselves.
7. **Failure consequence.** A FAIL blocks the gates and claims built on it: GEO-3 diversity claims are void while GEO-2 FAILs, and nothing enters production while any applicable hard criterion is not PASS and owner-approved.
8. **Design before implementation, in an earlier commit.** The design brief and the target drawings (GEO-0) are committed in a commit that is an ancestor of, and **not the same as**, the first commit that implements the geometry. Later brief changes are logged in the brief's iteration log; they do not retroactively satisfy GEO-0 for code written before them.
9. **Units, tolerances and thresholds are justified at the object's scale.** Every numeric threshold states its unit, the intended object size in that unit, and why the value is right at that size (for example a minimum panel altitude relative to the smallest designed feature and to the storage precision). Each threshold has at least one **counterexample** (an input just beyond it that must be rejected) and a **negative control** test that fails the check on purpose.
10. **Material changes invalidate verdicts.** Any material change to geometry, rendering, material, lighting, camera or framing after a visual review invalidates the affected [H] verdicts; they return to `NOT VERIFIED` until a reviewer inspects the new pixels at the new SHA. The final review must be of pixels captured after the last visual change.
11. **Exploration vs production acceptance.** An experiment may report partial findings and may leave gates at `NOT VERIFIED` or `FAIL`; it must label itself exploratory and claim nothing beyond its evidence. **Production acceptance** requires every applicable hard criterion at `PASS` on one SHA, CI green on that SHA, and the owner's sign-off on GEO-2, GEO-5 and GEO-7.
12. **No gaming.** Never weaken a threshold, exclude difficult cases, change sampling or narrow the tested range to turn a verdict. A threshold change is a change to this standard and needs the owner. If a hard criterion cannot be met, the report says `NO-GO` and lists the precise remaining work.
13. **Prospective only.** Records made before adoption keep their verdicts as history and are not silently re-graded. New work on the same object is graded under this version.

## 2. GEO-0 — Principle and design brief (before code)

Purpose: geometry comes from an understood subject and a stated method, not from tuning code until something renders.

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 0.1 | Brief and target drawings are committed in a commit that is a strict ancestor of the first implementing commit (§1.8) | A (git) | yes |
| 0.2 | Reference study: at least two real-subject references (anatomy, vehicle or architecture data) and at least one folding or construction reference, each with source and licence or use statement. No reference geometry or image is imported or traced | H | yes |
| 0.3 | Shape language: primary, secondary and tertiary forms named, with the reason each exists | H | yes |
| 0.4 | Target proportions as numbers (ratios of a named reference length, with tolerances) and multi-view target drawings plotted from those numbers | H + A (file exists) | yes |
| 0.5 | Construction plan: modules, connection contracts, creases (mountain/valley), seams and joints, and why each exists (see GEO-7) | H | yes |
| 0.6 | Construction honesty: what the construction is (for example modular sheet assembly) and what is not claimed (§9) | H | yes |
| 0.7 | Feasibility limits and at least two rejected alternatives with reasons | H | no |

Consequence of FAIL: no geometry code is reviewed; return to design.

## 3. GEO-1 — Geometric validity

Purpose: every panel, fold and seam is mathematically valid, and every validity claim is exactly as strong as the check behind it.

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 1.1 | Panels are planar, strictly convex and non-degenerate (minimum altitude), with thresholds justified per §1.9 | A | yes |
| 1.2 | Thin panels need annotation, not a blanket angle ban: an interior angle below the stated thin-angle threshold is allowed only on a face the design marks `thin`, with the reason in the brief | A | yes |
| 1.3 | Declared join topology: every seam and joint is a shared vertex pair (topological identity). Equal edge length is a consequence, not the proof | A | yes |
| 1.4 | Flat pattern: every sheet unfolds by its own crease tree into one plane with no overlapping panels (exact 2D test; touching along a shared edge or vertex is allowed) | A | yes |
| 1.5 | Rigidity: panel edge lengths are unchanged at every evaluated pose | A | yes |
| 1.6 | Closure: in the assembled pose, and at both ends of every articulation range, every copy of every shared vertex coincides | A | yes |
| 1.7 | Contact, not exemption: two panels may touch only on the boundary they actually share at that pose. Hinged, closing and mounted pairs are not exempt | A | yes |
| 1.8 | Swept check with its strength stated per pair (§3.1). Pairs that are only `sampled` keep GEO-1 at `NOT VERIFIED`; a `collision` is FAIL | A | yes |
| 1.9 | Articulated edges remain hinges after unfolding (an articulated edge that became a cut is a compile error) | A | yes |
| 1.10 | Every sheet compiles to a Foldon definition that passes `defineFoldon` / `validateFoldon` unchanged | A | yes |
| 1.11 | Negative controls exist and fail as expected, at least: a flap folded flat onto its parent; a vertex-sharing fan crossing; coplanar overlap; a collision confined between sample times; a mount sunk into its host; an articulated edge that would be cut; an edge-sharing pair whose relative rotation passes through coincidence between the endpoints; a seam that closes inside one sheet (must stay `NOT VERIFIED`, not PASS) | A | yes |

### 3.1 Swept-check certificates: required assumptions

A certificate kind may be reported only with its assumptions satisfied and stated:

- `analytic` (edge-sharing pair): two convex panels share a full edge, their only relative motion is rotation about that edge, and the **unwrapped opening angle** between their two half-planes (measured about the edge line, independent of front orientation) never reaches a multiple of 360° over the interval. Two cautions apply. A signed fold angle is not a substitute: it equals ±180° at coincidence only for consistently oriented faces, and 0° for inconsistently oriented ones (three faces on one edge cannot all be consistent). Wrapped `atan2` end values are not enough: a relative rotation of 180° or more can wrap to an apparently small difference. The path must be unwrapped with steps of less than 180° of relative motion.
- `static`: no relative motion over the interval; one exact test decides.
- `certified` (distance): distance at the interval midpoint exceeds a rigorous relative speed bound times the half-width. The bound must be configuration-independent (for example hinge-to-point reach measured along polylines inside rigid panels) and the fold-angle schedule must be the one actually posed (for example linear in the parameter).
- `certified` (sector): at a vertex fixed under every relative motion, the angular gap between the two corner sectors exceeds the summed angular speed times the half-width. The sector test must handle coplanar and near-coplanar sectors without declaring a false gap.
- `sampled`: exact tests at sample points only. This is not a proof. Reports list every sampled pair and its uncertified parameter interval.
- `collision`: an exact test found contact outside the shared boundary.

Endpoints of the interval where two copies of a vertex meet (seam closure) cannot be certified by a distance bound; they need a dedicated local argument or a design without such closures inside one sheet, and are otherwise `sampled`.

What GEO-1 does **not** prove: paper thickness, tab and glue feasibility; that a physical assembly order exists between sheets; non-intersection for parameter values that were not built.

### 3.2 Rationale: why not a coarse lattice and an angle ban

Quantise design *parameters* so identity is a stable hash; do not quantise vertex *positions* when that changes the shape. Counterexamples: an equilateral triangle with integer sides is off any rational lattice for its height and would be rejected though valid; equal squared edge lengths do not prove a joint is compatible (orientation and interpenetration are separate facts); a fixed 10° minimum angle rejects legitimately tapered feather or vane tips.

## 4. GEO-2 — Morphology and art direction

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 2.1 | Multi-view targets (at least front, side, top) and annotated primary/secondary/tertiary forms exist before implementation (GEO-0.4) | H | yes |
| 2.2 | Landmark ratios **measured on the built geometry** (not estimated or read back from parameters) match the brief within the stated tolerance for the baseline and stay within stated bounds for every variant | A | yes |
| 2.3 | Recognisable without labels from three-quarter, side, front and below/top, in neutral clay and in pure silhouette, by an independent reviewer | H | yes |
| 2.4 | Subject-specific requirements (below) are met or explicitly NO-GO | H | yes |
| 2.5 | Close-ups show intentional tertiary detail made of panels and creases, never painted lines or decals | H | yes |
| 2.6 | Balanced proportions: no needle limbs, no blank slabs, no unexplained gaps, holes or windows | H | yes |
| 2.7 | The translation to the reference art direction (`assets/reference/visual-direction.png`) is written down: what is kept and what is deferred to shading or ink | H | no |

Panel counts and facet quotas are **not** criteria. More panels are not better.

Subject requirements:

- **Bird:** head, beak and neck; body with breast, back and tail; wings with root, wrist and tip regions; layered feathers attached at their roots; balanced proportions; a recognisable flying or resting pose.
- **Vehicle:** coherent wheelbase; wheels with real thickness, an axle line, fenders and ground clearance; cabin and bonnet volumes; a faceted volumetric silhouette; intentional details made of geometry (no decals, no flat discs).
- **Building:** layered roof with overhang and ridge; openings with frame or recess; base, walls and roof layering.
- **Pine:** trunk and branch hierarchy; angular, layered taper; no holes that read as disconnected panels unless deliberate.

## 5. GEO-3 — Generative expressiveness

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 3.1 | Every face is traceable to a module instance, a semantic slot and the decision that placed it (GEO-7.3, 7.6) | A | yes |
| 3.2 | Parameters and choices affect silhouette and proportion (not only hash); bounds are stated and anatomically or functionally justified | H | yes |
| 3.3 | At least 8 seeded variants including both extremes and out-of-sample seeds, all at least non-FAIL on GEO-1, on a contact sheet at identical camera, light, material and scale | A + H | yes |
| 3.4 | Diversity measured on geometry (landmark spread, silhouette IoU as diagnostics). Distinct hashes are not evidence of variation | A | yes |
| 3.5 | Recognisability preserved across all variants (independent reviewer, contact sheet) | H | yes |
| 3.6 | Claims match the mechanism: a bounded random sampler is called that; "WFC", "constraint solving" or "grammar search" only when the solver and a constraint that eliminates a choice are demonstrated | H | yes |

## 6. GEO-4 — Motion and fold

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 4.1 | Flat → folded sequences come from crease transforms (`poseGeometry` angles), not mesh interpolation | A | yes |
| 4.2 | Hinge axes are shared edges; joint vertices stay fixed during articulation | A | yes |
| 4.3 | Continuous trajectories (bounded step between samples) and no edge stretch | A | yes |
| 4.4 | No penetration during fold or articulation: GEO-1.8 over the fold range of every sheet and every articulation range | A | yes |
| 4.5 | Meaningful articulation where the subject has it (for example wing root and wrist) | H | no |
| 4.6 | Visual evidence: fold sequence, flat crease pattern per sheet, articulation sheet, inspector with joint semantics | H | yes |

## 7. GEO-5 — Visual evidence and review

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 5.1 | Neutral material (one matte clay, flat shading), fixed lights, fixed cameras and world scale; no shader, texture, ink or post-processing that could disguise geometry | A (page code) + H | yes |
| 5.2 | Views: three-quarter, front, side, top, silhouette (from below for flying subjects), close-ups; multiple seeds; before/after at the same camera, material and scale | H | yes |
| 5.3 | Reproducible capture: a committed script and URL parameters regenerate every image; the served commit is printed in the page; final images come from a clean committed tree | A | yes |
| 5.4 | Independent review of the final pixels, after the last visual change (§1.10), with findings by severity (blocker / major / minor) and concrete locations (view, part, seed) | H | yes |
| 5.5 | Simplistic shapes are rejected even when every test is green | H | yes |
| 5.6 | Owner approval is the only acceptance | H | yes |
| 5.7 | Live preview: loopback URL, served SHA, process id and an HTTP readiness check are recorded; existing previews are not stopped | A | yes |

## 8. GEO-6 — Engineering and integration readiness

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 6.1 | Production contracts untouched by experiments (`packages/*`, `apps/*` diff empty unless the change is the authorised subject) | A (git diff) | yes |
| 6.2 | Deterministic identity: same inputs give the same id and geometry; ids hash versioned, quantised definitions | A | yes |
| 6.3 | Reproducible commands documented: test, typecheck, lint, build, capture | A | yes |
| 6.4 | Tests cover promises at the public seam, including the GEO-1.11 and GEO-7 negative controls; no mocks, spies or sleeps | A + H | yes |
| 6.5 | Performance bounded and measured (build and verify time per object) | A | no (yes before production) |
| 6.6 | Versioning and compatibility risk stated (catalog fingerprint) | H | yes |
| 6.7 | CI green on the exact head commit, with artifact provenance | A | yes |
| 6.8 | No unnecessary abstraction: each new module has one owner and a reason | H | no |
| 6.9 | Production use requires the owner's decisions on the open contract questions and on this gate; no automatic merge or phase authorisation | H | yes |

## 9. GEO-7 — Construction philosophy (hard production gate)

Eschaton is *A Self-Constructing Universe*: **complexity through composition, beauty through constraints.** Objects are built bottom-up from independently defined folded modules joined through compatible contracts and arranged by a semantic part graph under constraints. A shape must not come from a target mesh that is cut into arbitrary unique nets.

| # | Criterion | Kind | Hard |
|---|---|---|---|
| 7.1 | **Finite, versioned module catalog.** Each module is an independently defined folded sheet (its own flat crease pattern and Foldon definition), serialisable, with an id that hashes its versioned definition | A | yes |
| 7.2 | **Connection contracts.** Every attachment joins declared ports with typed compatibility (for example edge length class, orientation, profile, role). An incompatible attachment is rejected with a reason, shown by a negative control | A | yes |
| 7.3 | **Semantic part graph.** The object is a graph of slots (anatomy or function) holding module instances and attachments; every face traces slot → instance → definition → panel | A | yes |
| 7.4 | **Constrained choice, honestly named.** Choices are made by a stated mechanism. Constraint search (including WFC-style propagation) is claimed only with a demonstrated constraint that eliminates a candidate; otherwise it is "bounded sampling". Global constraints (silhouette, anatomy, function) and local compatibility (ports) are separate checks with separate owners | A + H | yes |
| 7.5 | **Reuse at the right level.** Reports distinguish (a) a shared primitive helper (for example a loft function), (b) a shared module family (a parametric generator), and (c) reuse of the same concrete versioned module definition (same id). A shared helper alone does not satisfy GEO-7. Cross-object reuse of (c) is shown with a table of definition ids per object, and must be meaningful (the module does the same structural job), not decorative | A + H | yes |
| 7.6 | **Provenance DAG.** Acyclic; each instance records its definition id, its parent attachment and the decision that chose it | A | yes |
| 7.7 | **Legal alternatives.** At least one alternative legal composition from the same catalog satisfies the global constraints, and at least one candidate composition is rejected by a stated constraint | A | yes |
| 7.8 | **Observable identity under attach/detach/recombine.** Detaching an instance and re-attaching it (in the same or another object) preserves its definition id and instance identity, and the check is observable in tests or the inspector | A | yes |
| 7.9 | **No imported or hard-coded final mesh.** A target drawing guides constraints and acceptance, never generation. Global shaping may place ports (a skeleton); every panel comes from a module definition | A + H | yes |
| 7.10 | **Bounded complexity.** No facet, panel or sheet-count targets; fewer modules, sheets and cuts are preferred when the read is equal; no gratuitous detail | H | yes |

Preferred research direction (not an approved contract): modular computational origami, in which each module is a single flat sheet folded by its own crease tree and modules join by declared contracts. Folding everything from one continuous sheet is **not** required.

**Not claimed** unless separately evidenced: physical paper thickness; tabs, pockets and glue; a feasible physical assembly path; true one-sheet origami; physics of attachment or detachment.

## 10. Reporting template (copy per object and evidence SHA)

```
Object: <name>   Evidence SHA: <sha>   Branch head: <sha, if different, and why>   Exploratory | Production candidate
Reviewer (H): <who, independence>   Owner: pending | <decision>
GEO-0  PASS|FAIL|NOT VERIFIED  evidence: <paths>   brief commit <sha> precedes implementation commit <sha>
GEO-1  …  report: <path/test>   sampled pairs: <list with intervals>   thresholds: <unit, scale, justification>
GEO-2  …  measured landmarks: <values vs targets>   independent: …   owner: pending
GEO-3  …  mechanism: <sampler | constraint search (demonstrated by …)>
GEO-4  …
GEO-5  …  images captured at <sha> after last visual change at <sha>
GEO-6  …  CI run: <id> on <sha>
GEO-7  …  catalog ids reused across objects: <table>   provenance: <path>   alternatives/rejections: <cases>
Blocking findings: <severity, location, description>
NO-GO items and remaining work: <list>
Approval needed from owner: <exact list>
```
