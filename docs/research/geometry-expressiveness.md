# Geometry expressiveness — audit, proposal and lab (research, not a decision)

- Status: **Research and proposal only.** Nothing here is accepted. It does not approve the Phase 3 visual review (P3D-2 stays **not given**), does not adopt an ADR, does not change any production contract and does not start Phase 4.
- Date: 2026-11-26. Base: `main` @ `6024a1b`. Branch: `experiment/origami-expressiveness-lab` (not for merge without owner approval).
- Trigger: owner feedback 2026-11-26 — the scene reads as "only triangles and squares"; origami should be able to build birds, vehicles, houses; triangles should come in many shapes (right or not, determined by the hypotenuse and the other two sides).
- Lab: [`experiments/origami-lab`](../../experiments/origami-lab/README.md), served on `http://127.0.0.1:5182/` (loopback only).

## 1. Summary

1. **The geometry kernel is not the bottleneck.** A Foldon panel is any convex planar polygon with free floating-point vertices (stored rounded to 1e-9, `packages/foldon/src/geometry.ts:318-332`). Creases carry rest angle, range, stiffness and assignment, and `foldProgress`/`poseGeometry` animate real creases (`geometry.ts:232-271`). The master plan already asks to "retain continuous geometry, articulated poses and non-cubic silhouettes" (`docs/master-plan.md:102`).
2. **Monotony is mostly a catalog and grammar omission.** All nine primitives (`catalog.ts`) are axis-aligned unit-cell shapes inset by 0.02: one square panel, one triangle family member (`P02`, isosceles), two gables, a channel, a prism, a pyramid, a box and one crumpled fragment. Assemblies stack them on the cubic yaw-only lattice. There is no parameterised family, no module grammar for non-architectural objects, and Genesis only knows lot roles (`tower`, `house`, `ruin`, `garden`, ADR 0017).
3. **Four real contract limits exist, and only some matter now:**
   - crease **tree only** (ADR 0003): no closed loops, so cones, tubes and closed boxes need an open seam or a duplicated edge;
   - **convex panels only** (`validate.ts`, `panel-not-convex`): non-convex silhouettes need several panels;
   - **no "join" edge kind**: a triangulation seam between coplanar facets can only be written as a crease with rest angle 0, so semantics ("this folds" vs "this is one face") are lost;
   - **cross-Foldon attachment is lattice-only**: assemblies place Foldons at integer anchors with quarter turns (ADR 0002, 0004), so two Foldons cannot meet along a non-axis edge. Anything non-axis has to live inside one Foldon definition.
4. **The lab shows the first three are workable without contract changes**, and isolates the fourth as the one real design question (§6, Q1).
5. **Roadmap recommendation:** decide a minimal expressiveness amendment (§6) **before Phase 4 Collapse fixes the support/fragment model**, because Collapse detaches and simulates panels/pieces; its fragment, bond and support contracts should be designed against richer geometry, not P01–P09. The art-only work (lighting, ink, particles) can stay in Atmosphere.

## 2. Audit — which constraint causes what

| Layer | What it actually is today | Causes monotony? |
|---|---|---|
| Foldon geometry (`GeometryRecipe`, ADR 0003) | Convex planar polygons, free float vertices, crease tree with rest angle/range/assignment, rest pose authored folded | **No.** Any triangle, quad or fan is legal. |
| Validation (`validate.ts`) | Planar, convex, non-degenerate, hinge edges coincide, assignment agrees with sign, range in [-π, π], **every vertex inside the footprint box** | Weakly: convexity and footprint box shape authoring, not expressiveness. |
| Catalog (`catalog.ts`, master plan §4 table) | 9 hand-authored unit-cell primitives, all inset 0.02 from the cell | **Yes — primary cause.** |
| Placement (ADR 0002, 0004) | Integer anchor + quarter-turn yaw, rectangular or masked multi-cell footprints | Yes for *arrangement*, not for shape: buildings read as stacked cubes. |
| Sockets (ADR 0009, 0012) | One socket per external unit face at its centre, profile table, orientation via turn | Indirectly: sockets describe faces of cells, not panel edges, so nothing carries a roof line or a slope from one piece to the next. |
| Wave (ADR 0015) | Variants = catalog item × quarter turn, merged by signature; integer search | No. It never sees panels; a richer catalog only adds variants. |
| Genesis (ADR 0017) | 2D semantic plan (river, roads, lots, roles) → per-lot wave solve with role tile sets | Yes for *object vocabulary*: there is no skeleton/grammar for a recognisable object beyond lot roles. |
| Logical vs rendered (ADR 0013) | A: logical placements (authoritative); B: bounded decorative offsets (not stored); C: fragments; C′: backdrop | No, and it must stay: richer geometry belongs in A (definitions), never smuggled through B. |
| Renderer | Fan-triangulates each panel (`apps/studio/src/renderer/geometry.ts:10-20`), panel edges and crease axes as overlays | Render triangulation is already separate from creases. |

Three distinctions the proposal keeps apart:

- **Render triangulation vs fold crease.** Render fans are drawing data. A crease is a hinge with an angle. A *join* is a designed seam between coplanar facets of one logical face (FOLD v1.2 `J`); a *flat crease* is a designed fold line that is currently flat (FOLD `F`).
- **Geometric edge connection vs structural bond vs logical occupancy.** Inside a definition, panels connect by creases (geometry). Between entities, bonds (ADR 0014) are runtime constraints. Occupancy is the integer footprint. A panel edge matching another panel edge is a *geometric* compatibility; it does not create a bond and does not change occupancy.
- **Macro lattice vs local frames.** The cubic lattice stays the logical macro grid. Panel vertices, edge frames and mount frames live in the definition's local space and are validated against the footprint box.

## 3. External references (verified 2026-11-26)

| Reference | What we take from it |
|---|---|
| Ghassaei, [Origami Simulator](https://github.com/amandaghassaei/OrigamiSimulator) / [origamisimulator.org](https://origamisimulator.org/) (MIT) | Faces with more than three sides are triangulated before simulation; those edges are **facet creases** with a 0° target and their own stiffness, distinct from mountain/valley creases. Edge types: mountain, valley, facet, boundary, cut, undriven. Fold percent 0 = flat, 100 = fully folded. It is a compliant (not rigid) solver: distance, face and angular constraints. Advice: symmetric triangulation, avoid long skinny triangles. Paper: Ghassaei, Demaine, Gershenfeld, "Fast, Interactive Origami Simulation using GPU Computation", 7OSME (linked; not fetched). |
| [FOLD format](https://github.com/edemaine/fold), [spec v1.2](https://edemaine.github.io/fold/doc/spec.html) (Demaine, Ku, Lang) | `edges_assignment` ∈ {B, M, V, F, U, C, J}; **J = join edge, "appropriate for triangulation edges used in simulation but which are not meaningful otherwise"**; `edges_foldAngle` in degrees in [-180, 180], positive valley, negative mountain (same sign as our θ, ADR 0003); `frame_classes` creasePattern / foldedForm. |
| Demaine & O'Rourke, *Geometric Folding Algorithms*, [ch. 16 "The Tree Method"](https://www.cambridge.org/core/books/abs/geometric-folding-algorithms/tree-method/D707B38D6059199B14D27EC3A48E2621) (CUP 2007, pp. 240–253) | Lang's tree method designs single-sheet bases from a stick-figure tree via disk packing (TreeMaker). We borrow the **idea of a semantic skeleton tree** driving geometry, not the single-sheet solver. |
| Walker & Stankovic, ["Algorithmic design of origami mechanisms and tessellations"](https://doi.org/10.1038/s43246-022-00227-5), *Communications Materials* 3:4 (2022) | Generalised rigid-foldability conditions for degree-n vertices; generates patterns and "generic three-dimensional panel-hinge assemblages". Relevant if we ever allow **closed** crease networks (cycles); not needed for tree-only modules. |

Not claimed: an arbitrary triangulated surface is not a physically foldable single sheet. Eschaton objects are **modular** — several single-sheet modules (each a flat, non-overlapping crease pattern) joined by seams and mounts — which is closer to modular origami and procedural panel-hinge assembly than to one-sheet tree-method origami.

## 4. Proposal — primitive family, compatibility, grammar

### 4.1 Lattice and canonical triangle frame

Lengths are integers in units of 1/Q cell, Q = 8. One canonical source per triangle:

```
TriangleSpec = { base: b > 0, offset: o, height: h > 0 }   // integers, 1/8 cell
A = (0, 0)   B = (b, 0)   C = (o, h)                        // local 2D frame
```

- Every integer triple with b > 0, h > 0 is a non-degenerate triangle, so the frame cannot express an invalid triangle except by size limits.
- Squared side lengths are **exact integers**: |AB|² = b², |AC|² = o² + h², |BC|² = (o − b)² + h².
- Class by exact integer tests: obtuse at A iff o < 0; obtuse at B iff o > b; obtuse at C iff o(o − b) + h² < 0; right iff one of those is 0; otherwise acute. Isosceles iff two squared lengths are equal.
- **Why not (a, b, c):** the side-length triple needs the triangle inequality and generally puts C off the lattice (irrational o, h), which breaks exact identity. SSS stays a *validated input form* that converts to (b, o, h) or returns `off-lattice` / `inequality`.
- **Why not angles + scale:** irrational, engine-dependent trig in the identity.
- Congruence key (derived, never stored): sorted squared lengths plus handedness. Two authored frames may be congruent; identity stays with the authored frame, congruence is a query.

Examples (Q = 8):

| Spec (b, o, h) | Squared sides | Class |
|---|---|---|
| (8, 0, 6) | 64, 36, 100 | right at A (3-4-5) |
| (8, 4, 4) | 64, 32, 32 | right isosceles at C |
| (12, −3, 8) | 144, 73, 289 | obtuse at A |
| (12, 3, 5) | 144, 34, 106 | obtuse at C (3·(−9) + 25 = −2) |
| (10, 5, 12) | 100, 169, 169 | acute isosceles |
| (16, 3, 4) | 256, 25, 185 | obtuse at C, long and low |

Rejected (counterexamples):

| Input | Reason |
|---|---|
| (8, 4, 0) | `degenerate` — no area |
| SSS 3, 4, 8 | `inequality` — 3 + 4 < 8 |
| (16, 8, 1) | `sliver` — smallest angle ≈ 7.1° < 10°; unstable normals, z-fighting, the long skinny triangles Origami Simulator warns against |
| right triangle stretched ×1.5 along one axis | not a family member: non-uniform scale changes angles and edge lengths, so seams no longer match; every shape must be authored as its own (b, o, h) |
| dart (non-convex quad) | Foldon rejects non-convex panels; express as two triangles joined by a `J` edge |

Quads: `QuadSpec = { bottom, top, shift, height }` with vertices (0,0), (bottom,0), (shift+top,height), (shift,height); convex for top, height > 0. Rectangle = shift 0, top = bottom.

Variant id: readable and stable, e.g. `tri.b12.o-3.h8`; fingerprint `fnv1a64(canonicalJson(spec))` (existing `@eschaton/foldon` exports).

### 4.2 Edges and compatibility

Every panel edge has `{ squaredLength (integer, 1/Q²), kind }`, kind ∈ FOLD-aligned {M, V, F, J, B} plus S (seam between modules). Two edges may be glued iff squared lengths are **exactly equal** and they are traversed in **opposite directions** (consistent sheet orientation). Integer equality is exact because every authored edge's squared length is an integer, even when the edge itself is a hypotenuse placed off-axis.

Example: a gable (b = 16, o = 8, h = 6) has slanted edges of squared length 100 (length 10/8 cell); a roof panel's slope edge must also have squared length 100. A roof sampled independently with slope 9/8 (81) is rejected (`length-mismatch`). The grammar therefore *derives* the roof from the gable.

### 4.3 Creases and angles

- Fold angle θ uses the existing convention (θ > 0 valley, θ < 0 mountain; FOLD-compatible). Targets are quantised to 7.5° steps; M ∈ [−180°, 0), V ∈ (0, 180], F and J exactly 0.
- An **articulation** range [lo, hi] (same sign as the assignment) marks a joint that animates (wing flap) — data, not code.
- Within a module the crease graph stays a **tree**, so poses never need a closure solver; self-intersection is checked at sampled fold progress (§7).

### 4.4 Modules and object grammar

- **Sheet module:** a flat crease pattern built by gluing family panels edge to edge as a tree; must not self-overlap when flat. Compiles to a Foldon `GeometryRecipe` with the existing idiom from `catalog.ts` (`irregularFragment`): build flat → `poseGeometry` with target angles → re-record via `foldedNet` so rest angles are measured. `foldProgress(t)` then animates from flat sheet (t = 0) to rest (t = 1).
- **Connections:** `seam` (edge of module A to edge of module B, must pass §4.2, plus a dihedral — a real hinge) and `mount` (module B's root frame at a lattice point of a panel of A with a quantised in-plane turn and tilt — a rigid assembly transform, e.g. wheels, chimney, tree tiers).
- **Object recipe = semantic skeleton graph** (body, neck, head, wings…; walls, gables, roof…) whose slots each hold a **finite, versioned list of module variants**. Grammar constraints keep the silhouette (wing span / body length bounds; roof derived from gable; tiers strictly decreasing). A seed picks variants through a local integer PRNG. Object identity = hash of chosen variant ids + connections.
- **Where WFC fits:** the wave solver never sees panels or parameters. A compiled object (or module) becomes a Foldon definition (footprint + face sockets) and enters the catalog as a finite variant; WFC handles local adjacency between definitions; Genesis (the grammar layer) picks which recipe goes where. State explosion is bounded by the variant lists, not by continuous parameters.
- **What is not allowed:** free per-instance transforms, non-uniform scale, random polygons, decorative geometry that feeds occupancy or simulation (ADR 0013 Layer B remains bounded, unstored, render-only).

## 5. Lab — what it proves and how to judge it

See [`experiments/origami-lab/README.md`](../../experiments/origami-lab/README.md) for running instructions. Results and evidence are in §8.

Visual acceptance criteria for the owner (proposed; the owner decides):

1. Three or more distinctly recognisable objects (bird, vehicle, house; plus a pine as a natural structure) from the **same** triangle/quad family, visible from a 3/4 view without labels.
2. Varied triangles: acute, right and obtuse; isosceles and scalene; at least one quad family member in each object where it fits.
3. Real crease animation: the fold slider takes every module from a flat sheet (t = 0) to its folded pose (t = 1); articulated joints (wings) move by crease angle, not by mesh tweening.
4. Inspectability: per object, the parts, module variants, panel classes, creases (M/V/F/J colours as in FOLD/Origami Simulator) and the flat crease pattern.
5. Seed variety with a kept silhouette: seeds 1…8 give visibly different variants that still read as the same kind of object.
6. Before/after: the current P01–P09 strip is shown on the same page with the same material.

## 6. Questions for the owner (ADR candidates, none adopted)

1. **Q1 — Where does a non-axis seam live?** Options: (a) keep all non-axis joins *inside* one Foldon definition compiled from a recipe (the lab's approach; no contract change; identity = recipe hash; respects "no finished building meshes" because the definition is derived from shared primitives, not authored as a mesh); (b) add a sub-cell **edge-frame socket** so two Foldons can meet along a panel edge (contract change to sockets, ADR 0009/0012, and to assembly validation); (c) leave objects off-lattice as backdrop (rejected: not world state). Recommendation: (a) now, (b) only if Collapse needs to detach individual modules of an object.
2. **Q2 — Add a `join` edge kind to `CreaseDefinition`** (FOLD `J`: never folds, excluded from fold progress, drawn differently) instead of rest-0 creases? Small, additive, changes definition hashes of new pieces only. Recommendation: yes, as part of the amendment.
3. **Q3 — Parameterised family in Foldon** (`TriangleSpec`/`QuadSpec`, Q = 8, variant ids) as authoring helpers that produce ordinary `GeometryRecipe`s? Recommendation: yes; no schema change, only new pure helpers.
4. **Q4 — Closed crease networks** (cones, tubes): keep tree-only (open seam) or adopt a closure check (Kawasaki/Maekawa or rigid-foldability conditions, Walker & Stankovic)? Recommendation: keep tree-only; revisit only with evidence.
5. **Q5 — Object grammar in Genesis:** extend roles to object recipes (skeleton graph + variant slots) for lots and props? Recommendation: after Q1–Q3, scoped to houses and one natural structure first; birds and vehicles are props/agents whose world semantics (do they occupy cells? move?) need their own decision.
6. **Q6 — Catalog versioning:** new definitions change the catalog fingerprint stored in world headers (`packages/world/src/region.ts:57`, `registry.ts:198`). Confirm that a new catalog version is acceptable and that old replays stay pinned to their fingerprint.

## 7. Test plan (for a production amendment, public seams only)

| Promise | Test |
|---|---|
| Triangles are classified exactly | table of (b, o, h) → acute/right/obtuse using integer arithmetic only |
| Invalid shapes are refused at the boundary | degenerate, sliver, inequality, off-lattice each return their code |
| Seams match exactly | equal squared length + opposite orientation accepted; unequal (100 vs 81) and same-direction rejected |
| Modules are flat-foldable sheets | a self-overlapping flat net returns `flat-overlap` |
| Folds are continuous and collision-free | for t ∈ {0, 0.25, 0.5, 0.75, 1} no two non-adjacent panels intersect |
| t = 0 is flat, t = 1 is the rest pose | all panels of a module coplanar at 0; vertices equal the stored recipe at 1 |
| Variants are deterministic | same seed → same object fingerprint; ≥ 3 distinct fingerprints over seeds 1…8 |
| Reuse | all objects draw from one family; the set covers acute, right, obtuse and quads |
| Compiled definitions are ordinary Foldons | every compiled recipe passes `defineFoldon` with a fitted footprint and face sockets |
| Placement/graph constraints (production only) | compiled definitions enter `createCatalog`; wave golden digest unchanged for the old catalog; new catalog fingerprint differs |

## 8. Lab results (2026-11-26, branch `experiment/origami-expressiveness-lab` on `6024a1b`)

What was built: `experiments/origami-lab` (about 2,250 lines of TypeScript in `src/`, `web/` and `test/`) imports only `@eschaton/foldon` and `three`. No file under `packages/`, `apps/`, `tools/` or `benchmarks/` changed.

Per object, seeds 1–8 (measured with the lab's public API):

| Object | Distinct fingerprints | Distinct panel variants | Panels (avg) | Creases (avg) | Joins (avg) | Foldon definitions | Triangle classes used | Folded overlaps |
|---|---|---|---|---|---|---|---|---|
| bird | 8/8 | 40 | 10 | 9 | 0 | 1 | acute, right, obtuse + quads | 0 |
| vehicle | 8/8 | 37 | 39 | 34 | 26 | 5 (body + 4 wheels) | acute + quads | 0 |
| house | 7/8 | 36 | 15 | 13 | 2 | 2 (house + chimney) | acute, obtuse + quads | 0 |
| pine | 8/8 | 20 | 55 | 51 | 21.5 | 4–5 (trunk + tiers) | acute + quads | 0 |

- Every compiled recipe passes `defineFoldon` unchanged (fitted rectangular footprint, open face sockets). The implementer additionally generated seeds 0–299 for all four objects (1,200 objects) with no build failure and no folded-state overlap at t ∈ {0, 0.25, 0.5, 0.75, 1}; that sweep is not a committed test.
- Across seeds 1–8, 10 panel variant ids are shared by more than one object; all panels come from the two families `tri` and `quad`.
- Animation is crease posing (`foldProgress` + `poseGeometry`) every frame; t = 0 is a flat sheet per module (tested), t = 1 equals the stored rest pose (tested).

Visual reading (lead's own observation from the screenshots; **not** an owner verdict):

- **House and pine** read clearly. Roof pitch, overhang, chimney and tier shapes vary by seed.
- **Vehicle** reads as a car body. The wheels are flat faceted discs on the sides; two of the three fan sizes leave thin slits (finding 5 in the lab README).
- **Bird** is the weakest: it reads as an abstract paper crane only from some angles, and its body variant barely changes between seeds (wings, neck and tail do). A convincing bird needs either more modules (separate body halves, a head module) or closed crease networks (Q4); this is the clearest evidence of where tree-only modules stop being enough.

Screenshots (1500×1000 unless noted, headless Chromium via agent-browser, software rendering):

| File | Shows |
|---|---|
| `docs/screenshots/exp-origami-seed-1-t1.png` | seed 1, folded, with the P01–P09 "before" strip |
| `docs/screenshots/exp-origami-seed-1-overlay-t1.png` | same with M/V/F/J/B/S edge colours |
| `docs/screenshots/exp-origami-seed-1-t050-overlay.png` | mid-fold (t = 0.5) |
| `docs/screenshots/exp-origami-seed-1-t0-flat.png` | t = 0: every module is a flat sheet |
| `docs/screenshots/exp-origami-seed-1-flat-pattern.png` | 2D crease patterns per part |
| `docs/screenshots/exp-origami-seed-2-t1.png`, `-seed-3-t1.png`, `-seed-5-t1.png` | seed variety, silhouettes kept |
| `docs/screenshots/p3-webgpu-m5pro-district-seed-1.png` (existing) | the current Studio district for comparison |

Contract findings confirmed by the lab (details in the lab README "Findings"):

1. No join/flat kind: J and F become rest-0 hinges pinned to range `[0, 0]` → supports Q2.
2. Tree-only creases leave closed shells as unglued coincident edges (house gables, wheel fans, car sides) → Q4.
3. Articulation ranges must contain 0 because `foldProgress` clamps to the range.
4. Mounts (wheels, chimney, tiers) at sub-cell offsets and 15° turns are **not** expressible as Foldon `Placement`s → the core of Q1.
5. Exact integer seams constrain shapes: a right isosceles gable cannot meet integer-length walls (slant² = 2m²); only some isosceles fans close at 360°. This is the price of exact identity; the alternative (tolerance-based seams) would put floating point into identity and is not recommended.
6. Crease angles on a 7.5° step versus Pythagorean slopes (36.87°, 53.13°, …) differ by at most 0.75°.
