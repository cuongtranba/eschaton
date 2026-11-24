# Phase 0 research notes: references R1–R10

**Date:** 2026-11-24
**Scope:** Master plan §15 references R1–R10, plus the current npm version of `three`.
**Method:** Each reference was opened with WebFetch, or with `gh api` / `npm view` for license and commit data. Where a page was blocked, the metadata came from Crossref. Summaries are from WebFetch's small model, so quoted sentences should be re-checked against the source before they are used as specification text.

Summary. The ten references fall into three groups. Wave Function Collapse (R1, R2, R3) gives the solver baseline. R1 is an MIT-licensed reference implementation of simple tiled and overlapping models. R2 is a paper whose abstract was not retrieved, so only its bibliographic metadata is recorded. R3 is a Tessera (Unity) generator API page. The Tessera paper itself could not be read as text. Grammar and folding (R4, R5, R6, R7) cover building massing, the FOLD crease-pattern format (MIT), the Origami Simulator (MIT, WebGL), and MarkovJunior (MIT, rewrite rules with Markov nodes). Three.js (R8, R9, R10) covers the renderer, TSL, and instancing. The npm `three` package is at 0.187.0 (MIT). Nothing here validates Eschaton's combined approach. These notes only list what each technique suggests for Phase 0 tests.

---

## R1. mxgmn/WaveFunctionCollapse

**What it is.** Maxim Gumin's reference C# implementation of WFC. It provides a simple tiled model and an overlapping model, both generating bitmaps or tilemaps from an example.
**Verified:** GitHub repo metadata, the LICENSE file, and the README/repo listing via `gh api`. Last default-branch commit 2026-03-22 ("nonperiodic input fix"). Repo `pushed_at` 2026-10-15.
**Not verified:** Algorithm details were not read from the source code.

**License:** MIT. The LICENSE file is the MIT text ("Copyright (c) 2016 Maxim Gumin"). Note that the GitHub API reports `license.spdx_id` as `NOASSERTION`, so the SPDX classifier does not match the file. Treat the license as MIT based on the file.

**Key technique points**
- Simple tiled model: tiles have sockets and compatibility lists per direction. The solver is entropy-driven, picks a weighted candidate, then propagates.
- Overlapping model: patterns are extracted from a sample; compatibility comes from overlap, not explicit sockets.
- Periodic and non-periodic input handling is a source of bugs (the recent commit is titled "nonperiodic input fix").
- Weighted choice by tile frequency, with restarts on contradiction.

**Testable implications for Eschaton**
- Propagation must remove any candidate whose external socket has no compatible neighbour in the current domain. Test: a 2×2 candidate placed next to a fixed incompatible tile is never chosen in any seed of a corpus.
- For fixed seed and fixed input, the solver output is identical across runs. Test: two solves with seed 42 produce equal canonical hashes.
- A contradiction must return an explicit failure result, not a partially filled grid. Test: a deliberately unsatisfiable 3×3 constraint returns `unsatisfiable`, with no cells committed.

**Decision:** **Adapt.** Use the basic adjacency/propagation loop as a conceptual model for the Phase 2 solver. Do not copy the C# code. Implement our own TypeScript solver (§5.1).

---

## R2. Hierarchical Semantic Wave Function Collapse (Alaka & Bidarra, FDG 2023)

**What it is.** A paper (ACM FDG 2023, *Proceedings of the 18th International Conference on the Foundations of Digital Games*, DOI 10.1145/3582437.3587209). It proposes WFC over hierarchies of constituent tiles, with semantic tiles that expand into finer tiles.
**Verified:** Bibliographic metadata via Crossref: title, authors (Alaka, Bidarra), container, date 2023-04-12, license field (CC BY 4.0 for the version of record).
**Not verified:** The abstract and the body. The DOI redirects to dl.acm.org, which returned HTTP 403 to WebFetch. Crossref has no abstract for this record. The techniques below come from the plan's own summary (§3), not from the paper.

**License:** Paper — no code license. Crossref lists CC BY 4.0 for the article.

**Key technique points (from plan §3; not confirmed from the paper)**
- Coarse semantic generation first, then fine assembly of constituent tiles.
- Boundary contracts between the coarse and fine levels.
- Hierarchical backtracking when the finer level is unsatisfiable.

**Testable implications for Eschaton**
- A coarse semantic cell that expands to a fine assembly must expose the same boundary signature as the fine assembly. Test: for every coarse role in a preset, all expansion candidates agree on the boundary sockets.
- If the fine level has no solution for a coarse choice, the coarse choice is revised, not the output emitted partially. Test: a seeded case where a coarse "roof" role has no fine candidate fitting the footprint returns a revised coarse placement or a budgeted failure.

**Decision:** **Defer.** Revisit the paper in Phase 3 once the abstract or full text can be read. Phase 0 needs no hierarchy.

---

## R3. Tessera (Boris the Brave): PDF and generator API

**What it is.** Tessera is a Unity add-on that runs WFC to generate 3D tile-based levels. The PDF describes its extended WFC system. The generator API page documents the `TesseraGenerator` MonoBehaviour.
**Verified:** The generator API page loaded (`docs/tessera/6/api/Tessera.TesseraGenerator.html`). Its parameters include `size` (cells), `cellSize` (stride between cells), `tiles`, `initialConstraints`, `skyBox` (boundary constraints), `seed`, `backtrack`, `retries`, `stepLimit`, `failureMode`, `contradictionTile` and `uncertaintyTile`. The page says that "big" tiles may occupy a multiple of the cell size.
**Not verified:** The PDF. WebFetch returned raw binary PDF bytes and no readable text, so none of the paper's claims about multi-cell encoding were checked. The docs index page did not describe big tiles either.
**Not verified:** How a big tile declares its footprint or offset. The API page does not say.

**License:** Not verified. Tessera is a Unity package; no license was checked for it.

**Key technique points**
- Tessera uses a fixed grid of cells (`cellSize` stride) and allows tiles larger than one cell.
- Constraints can be fixed via `initialConstraints`, and the boundary can be constrained with a `skyBox` tile.
- Failure output is configurable (contradiction and uncertainty placeholder tiles), which matches the Eschaton requirement to report failures explicitly.
- Retries and backtracking are configured separately (`backtrack`, `retries`, `stepLimit`).

**Testable implications for Eschaton**
- A 4×4 placement must write the same placement ID into all 16 covered cells, or into none. Test: after a solve, every cell in the footprint references one placement, and no cell is left referencing a placement whose footprint was removed.
- Boundary constraints are applied to the outer cells only. Test: a `boundaryConstraint` for "exterior empty" leaves interior cells unconstrained.
- Failure output is an explicit diagnostic value. Test: a solve with `retries: 0` on a contradictory input returns a failure object carrying seed and contradiction cell, not a grid with placeholders.

**Decision:** **Adapt.** Mirror the API idea of configurable failure outcomes and explicit boundary constraints. Do not depend on Unity-specific data. Re-read the PDF in a text-capable form before designing the multi-cell encoding (plan §5.2).

---

## R4. Müller et al., Procedural Modeling of Buildings (SIGGRAPH 2006)

**What it is.** The CGA shape grammar paper, which describes procedural building facades and massing as split and subdivision rules. DOI 10.1145/1179352.1141931, ACM SIGGRAPH 2006 Papers.
**Verified:** Crossref metadata: title "Procedural modeling of buildings", authors Müller, Wonka, Haegler, Ulmer, Van Gool, SIGGRAPH 2006, 204 citations per Crossref.
**Not verified:** The abstract and body. The DOI redirects to dl.acm.org, which blocked WebFetch with HTTP 403. The grammar techniques below are from the plan §3, not from the paper.

**License:** Paper — no code license.

**Key technique points (from plan §3; not confirmed from the paper)**
- Shape grammar: a building is a derivation from an initial massing volume through split, extrude and component rules.
- Semantic labels (roof, facade, floor) drive which component catalog is used at each level.
- Parameters (floor heights, proportions) are sampled per seed.

**Testable implications for Eschaton**
- Massing splits must conserve the footprint: the sum of child lot areas equals the parent area, within integer cell rounding. Test: a lot split of a 6×4 lot produces children whose cells partition it exactly.
- Each semantic role produced by the grammar maps to exactly one candidate catalog. Test: a "roof" lot never receives a candidate tagged only "facade".

**Decision:** **Adapt.** Use the split-and-label idea for Phase 3 massing only. Do not implement a full CGA interpreter in Phase 0.

---

## R5. FOLD (edemaine/fold)

**What it is.** The FOLD file format (JSON) for origami models and crease patterns: vertices, edges, faces, with mountain/valley assignments and fold angles.
**Verified:** Repo metadata via `gh api`: license MIT, last commit 2023-10-23 ("Link to rhino-grasshopper-fold"), repo pushed 2024-01-04. The repo page and the spec (`doc/spec.md` on `main`) were read through WebFetch.
**Not verified:** The full spec text was summarized by WebFetch, not read verbatim. The quoted sentences below should be checked against the file before they are used as a schema.

**License:** MIT.

**Key technique points**
- Keys: `vertices_coords` (`[x,y]` or `[x,y,z]` per vertex), `faces_vertices` (vertex IDs per face, counterclockwise), `edges_vertices` (`[u,v]` per edge).
- `edges_assignment` values: `B` (boundary), `M` (mountain), `V` (valley), `F` (flat), `U` (unassigned), `C` (cut), `J` (join, added in spec 1.2).
- `edges_foldAngle`: "The fold angle is a number in degrees lying in the range [−180, 180]." and "The fold angle is positive for valley folds, negative for mountain folds, and zero for flat, unassigned, and border folds." The spec says the sign should match `edges_assignment` when both are present. The key was renamed from `edges_foldAngles` in spec 1.1.
- There is no rest-angle or stiffness key in FOLD; those belong to our own schema.

**Testable implications for Eschaton**
- The FOLD adapter must map `M` to a negative `edges_foldAngle` and `V` to a positive one. Test: a round-trip of a single-crease FOLD with `M` and `edges_foldAngle = -90` keeps the sign and assignment together; a mismatched pair is rejected at import.
- Import must reject `faces_vertices` entries that reference a missing vertex ID. Test: a FOLD fixture with vertex index 99 in a 4-vertex mesh fails validation.
- Export of a hinge panel pair must emit exactly one edge with `edges_assignment` `V` or `M`, and the shared edge's vertex coordinates must be equal. Test: the two panels' shared-edge vertices are coincident after export.

**Decision:** **Adopt (as an adapter only).** Use FOLD for crease import/export, as §4.2 and §3 say. Do not make FOLD the world-state format.

---

## R6. Origami Simulator (Amanda Ghassaei)

**What it is.** A realtime WebGL origami simulator. It predicts how a crease pattern folds by solving for displacements of a flat sheet under crease forces, computed in parallel on GPU fragment shaders.
**Verified:** Repo metadata via `gh api`: license MIT, last commit 2026-10-13 (merge of PR #74, "curve-fix"). The repo page was read through WebFetch. The origamisimulator.org site was not opened.
**Not verified:** The solver source code and whether its model is rigid-panel or compliant (the README does not say).

**License:** MIT.

**Key technique points**
- Solves all creases simultaneously by iterating small displacements (solver methods credited to Schenk & Guest and Tachi).
- Inputs: SVG and FOLD crease patterns; FOLD is the internal structure. Outputs: FOLD, STL and OBJ of the folded state.
- Curved creases are handled with ruling-aware triangulation.
- Uses three.js for rendering and earcut/cdt2d for triangulation. Strain visualization is included.
- The README says VR mode "may be deprecated".

**Testable implications for Eschaton**
- A fold angle of 0 must leave the mesh flat within tolerance. Test: a two-panel hinge at fold 0 yields coincident shared-edge vertices and zero dihedral angle.
- The fold must be reversible in our hinge model: fold to 45° and back to 0° returns the original vertex coordinates within 1e-6.
- Hinge edges must stay coincident for every fold value in the allowed range. Test: sweep fold from -90° to +90° in steps and assert the shared-edge vertices match at each step.

**Decision:** **Defer.** Use the shared-edge and fold-sign tests in Phase 0 now. Compare a full crease solver only in the Phase 0 experiment on advanced crease solving (§6, §8 of the plan), after rigid hinges are validated.

---

## R7. MarkovJunior (Maxim Gumin)

**What it is.** A probabilistic programming language based on rewrite rules applied to a grid. Programs are XML models; they use Markov nodes (first matching child applies) and sequence nodes, with optional observations and propagation.
**Verified:** Repo metadata via `gh api`: license MIT, last commit 2026-03-20 ("Python port link"). The README was read through WebFetch.
**Not verified:** The interpreter source and the XML schema in `syntax.md`.

**License:** MIT.

**Key technique points**
- Rule list: the first rule with a match applies at a random match.
- Markov nodes: nested ordered rule groups. Sequence nodes run children in order.
- Observations: a future state can be constrained (for example, "this cell becomes red"), and the interpreter generates only runs that reach it.
- Constraint propagation: unidirectional (fast) or bidirectional (slower). A failed propagation proves a goal is unreachable; step count can be an admissible A* heuristic.

**Testable implications for Eschaton**
- A rewrite applied in a Markov group must be exclusive: only the first matching rule fires per step. Test: a two-rule Markov group on a fixed grid changes only the cells of the first matching rule.
- An observed goal that fails propagation must return "unreachable" without modifying the grid. Test: an impossible observation returns the failure and the grid hash is unchanged.

**Decision:** **Defer.** Useful for Phase 4 local re-collapse rules (§5.4, §6.3) only. Phase 0 does not need an interpreter.

---

## R8. Three.js WebGPURenderer manual

**What it is.** The official three.js manual page for `WebGPURenderer`, the renderer that uses WebGPU with a WebGL 2 fallback.
**Verified:** Page loaded via WebFetch.
**Not verified:** The actual fallback detection logic (the page does not describe it). The current three.js release version of the page was not confirmed.

**License:** Not applicable to the manual. three.js itself is MIT (see the npm line below).

**Key technique points**
- Default backend is WebGPU; "If a device/browser doesn't support WebGPU, the renderer can automatically fall back to using a WebGL 2 backend."
- Force WebGL 2 for testing: `new THREE.WebGPURenderer({ antialias: true, forceWebGL: true })`.
- Initialization is async: call `await renderer.init()` before the first render. `setAnimationLoop()` ensures initialization before the first frame. Custom `requestAnimationFrame` loops must await `init()`.
- Imports: `three/webgpu` (renderer, replaces the main `three` import for the WebGPU build) and `three/tsl` (TSL). An import map can alias both to the WebGPU build files.
- Migration: `ShaderMaterial`, `RawShaderMaterial` and `onBeforeCompile()` are not supported in `WebGPURenderer`; custom materials must be node materials with TSL.

**Testable implications for Eschaton**
- The renderer adapter must await `renderer.init()` before any draw call. Test: rendering before init is either rejected or deferred, and the first frame succeeds after `await init()`.
- A `forceWebGL: true` run must produce a frame with the baseline materials and no compute nodes. Test: the capability report says `backend: webgl2` and the baseline scene renders.
- No custom material in the renderer package may use `ShaderMaterial`, `RawShaderMaterial` or `onBeforeCompile`. Test: a lint or unit check that greps the renderer package for these names fails if any appear.

**Decision:** **Adopt.** Use the renderer adapter with an `init()` await, a `forceWebGL` test path, and node/TSL materials (plan §9).

---

## R9. Three.js TSL reference

**What it is.** The official TSL (Three.js Shading Language) reference: JavaScript node-based shader authoring, transpiled to WGSL or GLSL depending on the backend.
**Verified:** Page opened; the first ~100k of ~204k characters were read via WebFetch. Covered: node categories (built-ins, indexing, materials, buffers, control flow, math, color, post-processing, compute), `material.positionNode`, `instanceIndex`, `instancedArray`, `Fn().compute()`. The import path `three/tsl` and the statement that TSL compiles to WGSL/GLSL were confirmed on the WebGPURenderer manual page (R8), not on this reference page.
**Not verified:** The remaining ~100k characters of the reference were not read. The exact WebGL 2 support status of each function was not confirmed.

**License:** Not applicable (documentation). three.js is MIT.

**Key technique points**
- Nodes are assigned to material slots (`positionNode`, `vertexNode`, `colorNode`) and scene slots (`backgroundNode`).
- Instance-based positioning uses `instanceIndex`, e.g. `positionNode = vec3(instanceIndex.mod(10), instanceIndex.div(10), 0)`.
- Several functions are documented as "Can only be used with WebGPURenderer and a WebGPU backend" (e.g. `countLeadingZeros`, `countOneBits`, `countTrailingZeros`). Compute and atomic functions are WebGPU-oriented.
- `code(..., language)` accepts `'js' | 'wgsl' | 'glsl'`.

**Testable implications for Eschaton**
- Any TSL function that the reference marks WebGPU-only must be used only behind a capability check. Test: with the WebGL 2 forced path, the scene uses no compute or atomic nodes, and the capability flag is off.
- Instance transforms driven by `instanceIndex` in TSL must match the `InstancedMesh` matrices written from CPU data. Test: for index i, the TSL-computed position equals the matrix-translation value within 1e-5.

**Decision:** **Adopt (baseline) / Defer (compute).** Use TSL for material nodes and simple instanced positioning. Keep compute and atomic nodes out until a WebGPU benchmark justifies them.

---

## R10. Three.js InstancedMesh reference

**What it is.** The official `InstancedMesh` class reference: one geometry and material drawn many times with per-instance matrices and optional colors.
**Verified:** Page loaded and read via WebFetch.
**Not verified:** Performance numbers (the page gives none).

**License:** Not applicable (documentation). three.js is MIT.

**Key technique points**
- Constructor `new InstancedMesh(geometry, material, count)`; `count` is the instance count.
- Per-instance data: `setMatrixAt` / `getMatrixAt`, `setColorAt` / `getColorAt`, plus `setMorphAt` for morph weights.
- After editing, set `instanceMatrix.needsUpdate = true` (and `instanceColor.needsUpdate` for colors).
- `boundingSphere` is computed lazily and used for frustum culling and raycasting. It must be recomputed (`computeBoundingSphere()`) after `setMatrixAt` moves instances. `boundingBox` is never computed automatically.
- `dispose()` frees GPU resources and must be called when the instance is no longer used.

**Testable implications for Eschaton**
- After any batch of `setMatrixAt` calls, `instanceMatrix.needsUpdate` must be true and `computeBoundingSphere()` must be called before culling. Test: after moving instances out of a camera frustum, the mesh is culled, and after reset it is drawn again.
- A reset or chunk eviction must call `dispose()` on every `InstancedMesh` it created. Test: create/reset 100 times, then the count of live owned instanced meshes is zero (resource lifetime invariant, §12).

**Decision:** **Adopt.** Use instanced batches per recipe hash and material (§9), with explicit bounds updates and dispose.

---

## Current `three` package version

- `npm view three version`: **0.187.0**
- `npm view three license`: **MIT**
- Latest package modification time on npm: 2026-10-30.

Pin the exact version only after the Phase 0 build is verified (plan §8).

---

## Cross-cutting implications for Phase 0

- Keep the placement contract (§5.2) the public API. The Tessera API (R3) suggests explicit failure values and boundary constraints, so tests must assert them.
- Treat FOLD (R5, MIT) as a boundary adapter. The fold-sign rule (`M` negative, `V` positive) must be tested at import and export.
- Render through a renderer adapter that awaits `init()`, supports `forceWebGL`, and uses TSL node materials only (R8, R9). Ban `ShaderMaterial` and `onBeforeCompile` in the renderer package.
- Use `InstancedMesh` batches per recipe and material, with bounds recomputed after moves and `dispose()` on reset (R10).
- Keep compute-only TSL and WebGPU-only functions out of the baseline (R9).
- Record licenses in the repo: R1, R5, R6, R7 are MIT; R1's SPDX classifier is `NOASSERTION` and needs a manual check; R2 is CC BY 4.0 per Crossref; R3, R4 and R8–R10 have no verified code license.
- Do not copy code from R1, R6 or R7 without a license check and attribution (MIT requires the copyright notice).
- Phase 0 has no WFC runtime. Any solver experiment must compare adjacency and multi-cell placement encodings only (plan §14 step 6).

---

## Not verified

- **R2** (Hierarchical Semantic WFC): abstract and body not retrieved. dl.acm.org returned HTTP 403 to WebFetch. Crossref has bibliographic data but no abstract.
- **R3** (Tessera PDF): the PDF returned raw binary bytes, not readable text. Multi-cell encoding claims from the PDF are unverified. The Tessera docs overview page did not describe big tiles. Tessera's license was not checked.
- **R4** (Procedural Modeling of Buildings): abstract and body not retrieved. The DOI redirected to dl.acm.org, which returned HTTP 403. Only Crossref metadata was read.
- **R6**: the origamisimulator.org site was not opened. Solver source was not read. Rigid vs compliant model not confirmed.
- **R7**: interpreter source and the `syntax.md` XML schema were not read.
- **R8**: the fallback detection logic is not described on the page. Page's three.js version not confirmed.
- **R9**: about half of the TSL reference (~100k of ~204k characters) was not read. WebGL support per function was not confirmed.
- **R1**: the algorithm source was not read; the license is taken from the LICENSE file, not the GitHub SPDX field.
- **R5**: spec quotations come from WebFetch summaries of `doc/spec.md`, not a verbatim copy.
- **`three` license**: confirmed via npm as MIT; the repo `mrdoob/three.js` also reports MIT.
