# Origami lab V3 — construction brief (GEO-0 and GEO-7 plan), written before code

- Status: **exploratory experiment, not approved.** The governing standard is [`docs/governance/geometry-quality-gates.md`](../../governance/geometry-quality-gates.md), adopted 2026-11-27 (rules only). Nothing here adopts an ADR, decides Q1–Q6, changes a production contract or starts Phase 4.
- Date: 2026-11-27. Base: V2 at `103d9e7` (draft PR #11), plus the certificate audit commit `7dc9b37`. V1 (`73b612b`) and V2 stay in the repository unchanged as baselines, on `experiment/origami-lab-v2-baseline`.
- Companion briefs: [`bird-design-brief.md`](bird-design-brief.md) and [`vehicle-design-brief.md`](vehicle-design-brief.md). Targets: [`bird-target-views.svg`](bird-target-views.svg) and [`vehicle-target-views.svg`](vehicle-target-views.svg), plotted by [`plot_targets.py`](plot_targets.py) from the numbers in the briefs.

## 1. Why V2's construction is replaced

V2 builds one lofted design surface per object (a target mesh) and cuts it into flat pieces with a greedy strip unfolder. GEO-7 forbids that as the source of shape, for three reasons:

1. **Every V2 piece is a unique net cut from one target.** Nothing is reusable or detachable as a unit, and no choice is made under constraints.
2. **The strip unfolder is the source of V2's GEO-1 gap.** Every sampled-only pair (24–30 per variant) is a ring strip that wraps around the body and closes on itself at u → 1. A distance certificate cannot prove that closure (audit, `7dc9b37`).
3. **About 20 of V2's 48 sheets are single panels left over by the unfolder**, with no design meaning.

## 2. The V3 construction: modules, ports, part graph, constraints

**Module.** A module is one flat sheet folded rigidly by its own crease tree. It is defined independently of any object, by a family function and quantised parameters taken from finite ladders. The definition is plain data: panels in the folded rest pose, the crease tree and named ports. Its id is `fnv1a64(canonicalJson({ family, version, params }))`. A module's panel adjacency must be a **tree**. No two panels of one module may touch except through the hinges between them, so no seam ever closes inside a sheet. Design rule 1 removes V2's sampled pairs by construction instead of by sampling harder.

**Families (version 1)**:

| Family | Sheet | Ports | Used by |
|---|---|---|---|
| `band` | half of a homothetic frustum: a chain of 3–4 trapezoids folded on longitudinal creases | `front`, `back` (section polylines), `mid.top`, `mid.bottom` (midline seams), longitudinal ridge edges | bird body; vehicle body, cabin and tyre tread |
| `cap` | half of a pyramid that closes a section to an apex: a chain of triangles | `base` (section), midline seams, ridge edges | bird beak and rump; vehicle nose, tail, windshield and wheel sidewalls |
| `vane` | a folded blade: a broad trailing vane and a narrow leading vane on a rachis crease running from the root's leading corner to the tip | `root` (one straight edge) | bird primaries and tail feathers; vehicle grille slats and mudflaps |
| `fringe` | a root band carrying k tongues, each on its own crease | `root` | bird secondaries and coverts |
| `plate` | one or two convex panels (optional camber crease) with named edges and socket edges | named edges and sockets | bird arm, hand and tail plate; vehicle running boards |
| `arch` | a chain of quads bent around an axis | `start`, `end` | vehicle fenders |

**Ports and contracts.** A port is either an edge or a section polyline. Its contract has three parts: `kind` (for example `section:keel:0.088`, `socket:vane:0.120`, `shoulder`, `wrist`), its exact length or section (quantised to 1e-6 cells), and the side that may mate. An attachment joins two ports and is accepted only if all of these hold:

- the kinds are a declared pair;
- the lengths are equal;
- the opening angle comes from the finite ladder for that pair;
- after placement the two ports coincide to 1e-9 cells.

Otherwise it is rejected with a reason: `kind-mismatch`, `length-mismatch`, `angle-not-allowed`, `port-in-use` or `ports-apart`.

**Placement.** The child is moved rigidly so that its port edge lies on the parent port edge, reversed. Its panel's half-plane makes the stated **opening angle** with the parent panel's half-plane about the shared line. The angle is orientation-free, as in the audit: 180° is flat continuation and small angles fold the child back over the parent. Section ports mate by their vertex lists.

**Part graph and provenance.** An object is a tree of attachments over module instances. Each instance has a stable id (`bird/wingL/primary.2`), a semantic slot, a definition id and its parent attachment. Extra coincident port pairs (for example left and right halves meeting on the midline) are declared **seams** and checked. The provenance DAG records, for each instance:

- the chosen definition;
- the solver decision that chose it;
- the candidates the solver eliminated, with the constraint that eliminated each one.

**Constraint search, not sampling.** A seed sets *targets* inside bounded anatomical or functional windows; that step is a bounded sampler and is called so. A small finite-domain constraint solver then chooses module variants and attachment angles. It uses backtracking with forward checking, minimum-remaining-values ordering and seeded value ordering. Constraints have separate owners:

- *local*: port contracts, checked by the kernel at attachment;
- *global*: measured landmark ratios (span, tail, beak), required layering (an overlap that has clearance) and no interpenetration, checked by the object's plan on the built geometry;
- *object-specific function* (vehicle): wheel inside its fender arch with clearance, ground clearance, wheelbase.

The search log records every eliminated candidate. This is a constraint search over finite domains. It is not WFC, because there is no lattice and no adjacency propagation over cells. It is not a grammar.

**Detach and recombine.** `detach(assembly, instance)` returns the remaining assembly and the detached subtree, with instance and definition ids unchanged. `attach` re-validates the contract. Tests show a bird feather detached and re-attached, and the same concrete vane moved into a vehicle socket of the same contract.

**From assembly to Foldon.** Instances are placed and welded only at declared ports. The result is converted to the lab's design format with **one sheet per instance**, compiled with the V2 compiler and verified by the audited GEO-1 checker. Tests assert that every compiled piece is exactly one instance's panels. The compiler's re-unfolding is a check, not the source of shape: each module's crease tree is the only spanning tree of its tree-shaped panel graph.

## 3. Reuse levels (GEO-7.5) — what will be claimed

| Level | Meaning | Planned evidence |
|---|---|---|
| (a) primitive helper | the same function, e.g. a homothetic section helper | not claimed as reuse |
| (b) module family | the same family generator with different quantised params | `band` and `cap` in the bird body and in the vehicle body, cabin and wheels |
| (c) concrete definition | the same definition id | `vane` definitions used as bird feathers and as vehicle grille slats or mudflaps; the same tail and primary vane id used several times inside the bird |

Is (c) for the vane meaningful? In both objects it does the same structural job: a thin folded blade, held only at its root edge, in a row of like blades. Its visual role differs (feather vs slat), and whether that counts as meaningful is the **owner's** judgement. In the lab the vehicle is shown at about the bird's size (vehicle 4.4 cells, bird 4 cells). In a world at true scale (crow ≈ 0.47 m, car ≈ 4.4 m) the shared vane would need to be catalogued at both sizes. **Concrete reuse across true-scale objects is not claimed.**

## 4. Units, tolerances and thresholds (justified at object scale, GEO §1.9)

The scale is 1 cell = 1 Foldon cell. Bird length L_b = 4 cells (as V2, so before/after compare at one scale). Vehicle length L_v = 4.4 cells (1 cell ≈ 1 m of the reference car). At the review cameras one cell spans about 150–300 px.

| Threshold | Value | Why at this scale | Counterexample / negative control |
|---|---|---|---|
| Minimum panel altitude | 0.004 cells | Smallest designed feature (vane tip region, brow step) ≈ 0.04 cells, so 1/10 of it; ≈ 0.6–1.2 px at review scale (sub-pixel sliver); 4·10⁶ × Foldon's 1e-9 storage grid | a 0.0039-cell sliver is rejected (`degenerate`) |
| Thin-angle annotation | 6° | Vane tips are 7–12°; below 6° a tip renders as a needle at review scale | an unannotated 5° panel is rejected (`thin-unannotated`) |
| Port length equality | 1e-6 cells | Port lengths come from the same ladder value; 1e-6 is under 10⁻⁵ of the smallest port (0.14 cells), far above float error | a vane with root 0.141 on a 0.140 socket → `length-mismatch` |
| Weld / seam closure | 1e-9 cells | Placement composes ≤ 12 rigid transforms of magnitude ≤ 5 cells; error ≈ 1e-14 | a port placed 1e-6 apart → `ports-apart` |
| Designed layer clearance | ≥ 0.008 cells between layered sheets that do not share a port | ≈ 1.2–2.4 px, so layering reads as distinct paper without z-fighting at 24-bit depth; below 0.1 % of the object | a covert fold angle with clearance below it is eliminated by the solver |
| Contact tolerance | 1e-7 cells | As V2 (audited); 2 orders below the clearance | GEO-1.11 controls |
| Landmark tolerance | baseline ±3 % (span, tail, beak); variants inside their windows | 3 % of the span ≈ 0.24 cells ≈ 40 px, smaller than V2's worst miss (−7.5 %) | a solver run with an impossible span window returns `unsatisfiable` |

## 5. What is not claimed (GEO-7)

- Paper thickness, tabs, pockets and glue.
- A physical assembly order or path between modules (modules are shown exploded while they fold).
- One-sheet origami.
- Any attachment physics.
- That the finite catalog is complete, or that the search finds the best composition. It finds one that satisfies the stated constraints, deterministically for a seed.
- Production readiness. Q1 (non-axis seams between Foldon definitions) is exactly what the module ports exercise, and it stays open.

## 6. Rejected alternatives

1. **Keep V2 (target loft → strip unfolding) and certify harder.** Rejected: it violates GEO-7.9 and leaves closures inside sheets.
2. **Golden-venture style identical triangular units for every surface.** Rejected for now: rigid edge-to-edge closure of rings of identical units needs friction or tolerance that the rigid-panel model does not have, and the beaded look fights the woodcut reference.
3. **One-sheet tree-method bases (Lang).** Rejected: they produce layered needle flaps (the V1 look) and need closed crease networks (Q4).
4. **Longitudinal body strips (one sheet per facet row from beak to tail).** Rejected: fewer sheets (6 instead of 14), but each strip would be a unique net cut from a target body.
