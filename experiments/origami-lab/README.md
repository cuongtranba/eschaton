# Origami geometry expressiveness lab (EXPERIMENTAL, throwaway)

**Status: experimental and throwaway. Not a production contract, not an approved design, not part of any phase scope.** Nothing outside `experiments/origami-lab` imports it, and it may be deleted once the question below is answered in a decision record.

## Question

The owner finds the current visuals "just triangles and squares". The Foldon kernel already allows arbitrary convex planar panels, free float vertices, crease trees and per-crease angle ranges, but the catalog (P01–P09) only uses a handful of axis-aligned shapes. Can a **parameterised primitive family plus a module/skeleton grammar** produce recognisable, diverse objects **without changing Foldon, world, wave or genesis contracts**?

The lab imports only `@eschaton/foldon` (entry point) and `three`. Every object below is converted to ordinary `GeometryRecipe`s and each recipe passes `defineFoldon` with a `rectangularFootprint` fitted to its rest-pose bounding box and `faceSockets(footprint, { default: "open" })`.

## Run

```sh
pnpm --filter @eschaton/exp-origami-lab dev        # http://127.0.0.1:5182 (strict port; ORIGAMI_LAB_PORT overrides, see vite.config.ts)
pnpm --filter @eschaton/exp-origami-lab test
pnpm --filter @eschaton/exp-origami-lab typecheck
pnpm --filter @eschaton/exp-origami-lab build
```

Reproducible URLs: `?seed=3&t=0.5&object=bird&overlay=1`. Also `flat=1` (2D crease patterns), `flap=1`, `play=1`, `layout=single`, `az=` and `el=` (camera degrees).

## What the page shows

- Four objects side by side (bird, vehicle, house, pine), each generated from the **same** triangle/quad family and the same module and connection machinery. Orbit with the mouse; click a viewport to select it for the inspector.
- Seed input with previous/next, fold progress slider (t = 0 flat sheet, t = 1 rest pose), play/pause fold, wing-flap articulation toggle.
- Edge overlays with the FOLD-aligned colours: M red, V blue, F grey, J yellow dashed, B black, S green.
- Per-part flat crease patterns as SVG with the same colours.
- A "Before" strip posing the current `primitiveCatalog` P01–P09 at t = 1 with the same material.
- Inspector (`objectInspection`): parts, module ids, panels with variant id and triangle class and squared sides, creases, joins, connections, Foldon definition ids, fingerprints and footprints, class counts and distinct variant ids.
- Animation re-poses the model every frame through `poseObject` (Foldon `foldProgress` and `poseGeometry`); stored meshes are never interpolated.

## Model (`src/`, no three, no DOM)

| File | Role |
|---|---|
| `lattice.ts` | Lattice Q = 8 (1/8 cell). `TriangleSpec { base, offset, height }` and `QuadSpec { bottom, top, shift, height }` in integers, derived class and traits, validation (`degenerate`, `sliver` below 10°, `aspect` above 12, `off-lattice`, `too-large` above 64 units), SSS boundary constructor `triangleFromSides`, variant id (`tri.b12.o-3.h9`) and fingerprint |
| `edges.ts` | Edge descriptor `{ squaredLength, kind, winding }`, kinds M V F J B S, `compatible(a, b)` with reasons `length-mismatch`, `orientation`, `kind-mismatch` |
| `sheet.ts` | A module is a flat crease tree: panels mated edge to edge by an exact reflection-free rigid motion, angles on a 7.5° step with M in [-180, 0), V in (0, 180], F and J exactly 0, optional articulation range, flat-net overlap check |
| `foldon.ts` | Sheet to `FoldonDefinition`: flat net, `poseGeometry` to target angles, re-record posed panels through `foldedNet` (same idiom as `irregularFragment`), `defineFoldon` |
| `object.ts` | Skeleton grammar: parts (modules), `seam` connections (real hinges, edge compatibility enforced, optional `closing` for unglued coincident edges) and `mount` connections (rigid assembly transform: lattice point on a host panel, 15° turn, 7.5° tilt, lift, side) |
| `pose.ts` | `poseObject(obj, t, articulationPhase)` |
| `checks.ts` | Non-degenerate panels, seam compatibility, folded-state overlap at t in {0, 0.25, 0.5, 0.75, 1}, reuse report |
| `inspect.ts` | `objectInspection` |
| `objects/*.ts` | The four recipes. `generate(name, seed)` uses a local mulberry32 PRNG; each slot draws from a small enumerated list and derived values (house roof from the gable, neck from the body flank, wing from the keel edge) are never sampled independently |

### Crease kind to Foldon mapping

| Lab kind | Foldon |
|---|---|
| M | crease, negative rest angle, `mountain`, range `[-π, 0]` |
| V | crease, positive rest angle, `valley`, range `[0, π]` |
| F, J | rest angle 0 crease with range `[0, 0]` (Foldon has no join or flat kind) |
| S | seam hinge, sign of the angle decides `mountain` or `valley` |
| B | no crease (boundary) |
| articulated | the same crease with range `[lo, hi]` |

## Findings

No Foldon, world, wave or genesis change was needed for any object. Things worth knowing for a decision:

1. **No join kind.** J (triangulation edge inside one logical face, FOLD `J`) and F (designed fold line kept flat) are represented as rest-0 hinges pinned to the range `[0, 0]`. Non-convex silhouettes (car sides) therefore cost extra panels and creases, and consumers cannot tell a join from a real flat crease except through the range.
2. **Tree-only creases.** Closed shells cannot be glued. The house roof meets the gables and right wall, the wheel fans meet their first spoke and the car sides meet the hood and trunk along coincident but unglued edges. The lab checks those with `closing` seams (edge compatibility only) and they appear as open seams in the paper.
3. **Articulation ranges must include the flat state.** `foldProgress` clamps `rest * t` to the crease range, so a flap range such as `[7.5°, 75°]` stops t = 0 from being flat. The lab requires articulation ranges to start at 0 (valley) or end at 0 (mountain).
4. **Mounts are not expressible as Foldon placements.** `Placement` and `Pose` take an integer cell anchor and a quarter turn about Y, while the lab mounts wheels, tiers and the chimney at lattice-unit offsets with 15° turns and 7.5° tilts. They stay lab-level rigid transforms between separate definitions. A production version would need arbitrary rotation in the assembly layer or would bake the posed geometry into one definition.
5. **Exactness on the lattice limits shapes.** Gluing needs equal integer squared lengths. A right isosceles gable cannot be glued to integer-length walls and roofs (slant² = 2m²), so house gables are Pythagorean acute or obtuse only. Exact 360° isosceles fans with one leg length are rare: only R = 125 closes as eight spokes; the 6-spoke R = 65 and 5-spoke R = 74 fans leave gaps of 3.06° and 4.62°.
6. **Angle quantisation.** Creases use a 7.5° step while Pythagorean slopes are 36.87°, 53.13°, 22.62°, 67.38°, so roofs and windshields are off by at most 0.75° (a few hundredths of a lattice unit).
7. **Stored precision.** `foldedNet` rounds to 1e-9 and finds hinge edges by coincident vertices. Across 1,200 generated objects (4 objects × seeds 0–299) no hinge was lost to rounding.
8. **Reuse.** Across seeds 0–7 of the four objects there are 125 distinct panel variant ids, 10 of them used by more than one object (`reuseReport`), all from the two families `tri` and `quad`.
9. **Footprints.** Rest-pose boxes are small (for example bird 8×3×4, car body 8×4×3, house 3×4×4 cells) because 1 cell = 8 lattice units; `defineFoldon` accepted all of them with open face sockets.

## Deviations from the brief

- The bird neck is a trapezoid, not a triangle, so the head can hinge on a free short top edge: a triangle-only chain has no short free edge near the tip.
- The tail is two mirrored acute triangles hinged to the wing roots (a swallow tail). A body of exactly two triangles has four outline edges: two carry the wings, one the neck, and no centred edge is left for a single tail.
- The house pitch is acute or obtuse (see finding 5); the right triangle class comes from the bird wings.
- The roof is hinged to the left wall, and the gables, back and right roof edges close as unglued edges (finding 2).
- The house has one overhang trapezoid (on the second roof panel) rather than two, because the first roof panel's eave is hinged to the wall.
- The bird's wing span to body ratio is not enforced by a rule; the keel, wing and neck choices come from short enumerated lists that keep the silhouette.
- The chimney tilt is scaled by fold progress so the flat state does not intersect the roof.

## V2 (2026-11-26): gate-driven redesign of the hero bird (EXPERIMENTAL, not approved)

V1 above is kept unchanged as the baseline. V2 is the response to the owner's rejection of V1's geometry. It is governed by the proposed gate spec [`docs/research/geometry-quality-gates.md`](../../docs/research/geometry-quality-gates.md), the design brief [`docs/research/origami-lab-v2/bird-design-brief.md`](../../docs/research/origami-lab-v2/bird-design-brief.md) (written before code) and the evidence record [`docs/research/origami-lab-v2/gate-evidence.md`](../../docs/research/origami-lab-v2/gate-evidence.md).

| File | Role |
|---|---|
| `src/v2/design.ts` | Design surface on shared vertex indices: `point`, `face`, `quad`, `ringLoft`, `stitch`, `fan`; facing-based orientation; sheet rules |
| `src/v2/compile.ts` | Greedy strip unfolding into flat non-overlapping pieces (Mitani & Suzuki 2004 style), Foldon compile per piece (`foldedNet` from the 3D design, `defineFoldon`), glue seams and articulated joints with direction-resolved signs, `poseCompiled` |
| `src/v2/verify.ts` | GEO-1 automated checks: panel validity, flat nets, rigidity, seam gap, Foldon validity, swept collision certificates (`analytic` / `static` / `certified` / `sampled` / `collision`), `posedContacts` |
| `src/v2/geom.ts` | Exact shared-boundary-aware contact, panel distance, sector gap, rigid transforms |
| `src/v2/bird.ts` | The bird: bounded parameters, `CROW` baseline, `birdParams(seed)` (a bounded random sampler, not WFC), `birdExtreme(0 / 1)` |
| `src/v2/metrics.ts` | Landmark ratios measured on the mesh; silhouette raster and IoU (diagnostics) |
| `v2.html`, `web/v2.ts`, `web/clay.ts` | Neutral clay review page: `?mode=study|sheet|fold|compare|evidence`, `preset=crow|min|max` or `seed=N`, `seeds=…` for sheets |
| `capture/capture.ts` | Reproducible screenshots and `evidence.json` from a running page |

```sh
ORIGAMI_LAB_PORT=5183 pnpm --filter @eschaton/exp-origami-lab dev      # http://127.0.0.1:5183/v2.html
pnpm --filter @eschaton/exp-origami-lab test                          # V1 + V2 tests (V2 sweep of 11 variants ≈ 20 s)
node --experimental-strip-types experiments/origami-lab/capture/capture.ts http://127.0.0.1:5183 docs/screenshots \
  exp-origami-v2-crow-study="mode=study&preset=crow"                  # run from the repo root; see the file header
```

V1 findings that V2's contact test exposes:

- **Interpenetration in the V1 house.** The roof overhang and the right wall interpenetrate at t = 1, giving 6 crossings over seeds 1–8. For seed 1 the intersection segment is 3.96 cells long. This pair is *not* in V1's exempt set. V1's `posedOverlaps` missed it because it shrinks every panel 4 % toward its centroid before testing, and the crossing lies within that margin along the wall's top edge. The likely origin is V1's 7.5° angle quantisation (V1 finding 6); this is not verified.
- **Unglued contacts.** V1 vehicles and houses have 104 edge-touch contacts between unglued panels, at seams that V1 calls "closing".
- **Exemptions and sampling.** Separately, V1 exempts every hinged and closing pair and samples only five fold times. The V2 tests show both blind spots with constructed cases.

Details are in `gate-evidence.md`.
