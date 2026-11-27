# Bottom-up modular computational origami for Eschaton — methods compared, experiment, smallest viable extension

- Status: **research, not a decision.** It adopts no ADR, keeps Q1–Q6 open (geometry expressiveness research, §6, on the PR #11 branch) and starts no Phase 4 work. It records what the V3 lab experiment demonstrates and what it does not.
- Date: 2026-11-27. Sources were checked on 2026-11-27 by opening them. Any claim that could not be confirmed from a primary source is marked *unverified* and is not relied on.
- Experiment: `experiments/origami-lab/src/v3/` (module kernel, part graph, solver, bird, vehicle), review page `v3.html`. Construction rules: [`construction-brief.md`](construction-brief.md).

## 1. Methods and what each assumes

| Method | Input → output | Assumptions and limits (from the source) | Fit for Eschaton |
|---|---|---|---|
| **Strip-based approximate unfolding** (Mitani & Suzuki, *ACM TOG* 23(3) 2004, 259–263, doi:10.1145/1015706.1015711) | A manifold triangulated **target mesh** → continuous triangle strips without internal vertices | The authors concede approximation accuracy "may not appear particularly good" and that tolerance cannot be specified. Strips are split if they intersect in the plane. Packing and assembly are manual (tape). No 3D non-intersection or assembly guarantee | Poor as the *source of shape*. It is target mesh → unique nets: no reuse, no detachment as units, no constraint choice (GEO-7.9). It is what V2 did |
| **Edge unfolding of polyhedra** (Demaine & O'Rourke, *Geometric Folding Algorithms*, CUP 2007, ch. 22, doi:10.1017/CBO9780511735172.024; Bern et al., *Comput. Geom.* 24(2) 2003, doi:10.1016/S0925-7721(02)00091-3) | Polyhedron → one non-overlapping net | Whether every convex polyhedron has an edge unfolding is open (Dürer's problem, Open Problem 21.1). Some nonconvex polyhedra with convex faces have **no** edge unfolding | Explains why one-sheet shells need cuts. A cut that recloses inside a sheet is exactly what the swept checker cannot certify (V2 audit) |
| **Rigid origami simulation** (Tachi, *Origami⁴* 2009, 175–187) | Crease pattern with fold-angle variables → motion | Plates and hinges. Closed vertex loops need F = χ₁⋯χₙ = I. Self-intersection is avoided only locally ("global self-intersection avoidance … not solved") | The kinematic model Foldon already uses for **trees**. Loop closure is why V3 keeps every module a tree (Q4 stays open) |
| **Freeform rigid-foldable quad meshes** (Tachi, *AAG 2010*, 87–102, doi:10.1007/978-3-7091-0309-8_6) | Planar-quad mesh → rigidly foldable structure | Local vertex conditions are insufficient for loops around holes; transforms along closed strips must compose to the identity | Relevant only if closed networks are adopted (Q4) |
| **Origamizer** (Tachi, *IEEE TVCG* 16(2) 2010, doi:10.1109/TVCG.2009.67) | Arbitrary polyhedral surface → **one sheet** crease pattern with hidden tucks, no cuts | "does not always guarantee a solution". Tucks are kept non-intersecting only inside the solid. No folding motion | Expressive, but one-sheet and target-driven. It does not give detachable units or finite catalogs |
| **Tree method / TreeMaker** (Lang, *SoCG 1996*, 98–105, doi:10.1145/237218.237249; TreeMaker 5, GPL-2) | Stick-figure **tree** → one-sheet flat **base** via a constrained (circle-packing-like) optimisation | The output is a flat base, not final 3D shaping ("relatively easy to transform it into a recognizable representation" afterwards) | The *semantic skeleton* idea fits the part graph. The one-sheet base does not: rendered as rigid panels it gives the needle flaps of V1 |
| **Modular (unit) origami** (Torrence, *Bridges 2022*, 507–514: "many identical units are combined"; units join by insertion. Riskin, arXiv:0706.2433, Sonobe polyhedra) | A small set of identical folded units plus joining rules → assemblies | Joins rely on friction and tolerance (pockets and tabs); models are "topologically equivalent", not exact | **Closest to Eschaton's identity** (finite catalog, reuse, detach and recombine). Rigid exact edge closure has to replace friction joins, which is why V3 ports are exact and loops close only through rigid section ports |
| **FOLD v1.2** (Demaine, Ku, Lang; github.com/edemaine/fold, "rough draft") | File format | `edges_assignment` includes `J` (join: incident faces are one effective face) and `C` (cut, optional). `edges_foldAngle` is in degrees, positive valley. `multiModel` collects separate models but there is **no construct for gluing separate sheets** | Fits the inside of a module (M/V/F/J). Inter-module ports and contracts are outside FOLD, so Eschaton needs its own contract record |
| **WFC** (Gumin 2016, github.com/mxgmn/WaveFunctionCollapse; Merrell, *I3D 2007*, 105–112, doi:10.1145/1230100.1230119; Karth & Smith, *FDG 2017*, doi:10.1145/3102071.3110566, full text *unverified*) | Finite tile set plus local adjacency → assignment | The reference WFC observes minimum entropy, propagates local adjacency and, on contradiction, returns nothing (restart is the caller's job). Merrell: global consistency is NP-complete. Global constraints need extensions | Fits **placement of whole compiled objects or modules on the world lattice** (the existing wave package). It does not fit choosing feather lengths to hit a measured span, which is a global geometric constraint |
| **Shape and graph grammars** (Stiny & Gips 1972, primary text *unverified*; Müller et al., *ACM TOG* 25(3) 2006, doi:10.1145/1141911.1141931, abstract-level only) | Rules rewriting labelled shapes or semantic hierarchies | Rule order and termination are design decisions | Fits the **semantic part graph** (body → wing → hand → primaries). V3 writes the graph as data plus a plan function; it does not claim a rewriting grammar |
| **Finite-domain constraint search** (backtracking with forward checking; standard CSP technique) | Variables with finite domains, plus constraints | Complete for finite domains within a budget. It finds *a* solution, not the best. A budget exhaustion is reported as such, never as unsatisfiable | V3's choice mechanism. Local port contracts and global measured constraints both act as constraints with stated owners |

Self-intersection: none of the sources guarantees global non-self-intersection. Origami Simulator (Ghassaei, Demaine, Gershenfeld, *Origami⁷* 2018) is a compliant bar-and-hinge solver with no collision handling; its paper lists collision detection as future work. Eschaton's swept certificate (GEO-1 §3.1) therefore has to be its own, and the V3 audit corrected two flaws in it.

## 2. Distinctions the experiment keeps apart

| Concept | Where it lives in V3 | Not to be confused with |
|---|---|---|
| **Intrinsic panel topology** | Inside one module: panels, the crease tree, M/V angles | Contacts between modules |
| **Geometric contact** | The exact `panelContact` test at a pose; allowed only on a boundary shared at that pose | A connection: touching is not attaching |
| **Attachment semantics** | `Attachment` between declared ports. The contract has kind, length and angle ladder; rejection reasons are typed | A structural bond. An attachment says *where* a module sits, not how strongly it holds |
| **Structural bond** | Not modelled (production ADR 0014 owns bonds) | Attachment. Collapse (Phase 4) would need bond strength per attachment, which is not decided here |
| **Local occupancy** | Not modelled for lab objects (Q5: do birds and cars occupy cells?) | Panel geometry. Occupancy is the integer footprint (ADR 0004) |
| **Non-axis edge frames** | Port frames are arbitrary rigid frames inside the object | World sockets (ADR 0009/0012), which are axis-aligned unit faces. This gap is Q1 |

## 3. The experiment (what is demonstrated, with evidence)

Evidence is in `gate-evidence.md` and `evidence-v3-*.json`, with SHA, and in `test/v3.test.ts`.

1. **Bottom-up construction.** Every panel of the bird and the vehicle comes from a module definition in the finite catalog (`band`, `cap`, `vane`, `fringe`, `plate`, `arch`, `stitch`). Modules are placed only through ports, and nothing is imported or lofted from a target.
2. **Actual constraint-based selection.** A seed sets targets (a bounded sampler). The finite-domain search then chooses ladder values. Its log records eliminated candidates with the constraint that eliminated each one, for example a covert lift rejected by layer clearance, or a primary length base rejected by the measured span. An infeasible problem is reported as `unsatisfiable` (test).
3. **Reusable graph and compatibility checks.** Port contracts reject wrong kind, wrong length (a 0.001-cell difference), off-ladder angles, ports used twice, and open seams (tests).
4. **Meaningful variants.** Bird: crow, seeds 1–8, out-of-sample seeds and both corners, all with measured landmarks inside tolerance. Vehicle: hero, seeds 1–8 and both corners (see the evidence for which solve).
5. **Identity under detach and recombine.** A primary detached from the bird keeps its instance and definition ids and re-attaches to another socket of the same contract. It is refused by a socket of another kind (test).
6. **Cross-object reuse at level (c).** The short blunt vane is one definition id used as the bird's alula and as the vehicle's grille slats. The `band` and `cap` families build both bodies (level b). See the construction brief §3 for why level (c) holds only at the lab's shared scale.

What it does not demonstrate:

- physical paper behaviour or assembly order;
- closed crease networks;
- placement of these objects in the world lattice (Q1, Q5);
- that the solver's composition is the best one;
- any production contract.

## 4. Smallest viable future extension (proposal only; owner decides; no production code)

1. **Module definitions as ordinary Foldon definitions plus a port table.** Panels and crease tree are already compiled per module by the lab via `foldedNet` and `defineFoldon`. Additive work: a *port* record (edge or section, kind, length, side) stored beside the definition and hashed into a module catalog fingerprint. Q6 (catalog versioning) applies unchanged.
2. **A `join` edge kind (Q2).** The vehicle's running board and the coplanar crown strips are joins today, stored as rest-0 creases.
3. **Object-local placement of modules (Q1 option a).** Keep inter-module frames inside a compiled object recipe. The world lattice still sees one definition per object (or per detachable sub-assembly). Only if Collapse must detach *individual* modules in the world is a sub-cell edge-frame socket (Q1 option b) needed. The lab's `detach` shows the data needed: instance id, definition id and the parent port.
4. **Constraint search stays in generation (Genesis-side), not in Foldon.** Port compatibility is a pure, data-level check that belongs beside the catalog. Global measured constraints belong to the object plan that owns them.
5. **Roadmap impact.** Decide Q1 and Q2 before Phase 4 fixes the fragment and bond model, because fragments of modular objects would naturally be modules (a feather, a fender, a wheel). This repeats the recommendation of the expressiveness research and does not authorise Phase 4.
