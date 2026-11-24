# Ink look-dev notes (P0.5)

**Date:** 2026-11-24
**Scope:** Master plan §2.3. Six rendering techniques tested independently at a fixed camera and light, plus a reference composition ("The Last District (look-dev)") built from the Foldon catalog and a seed.
**Environment for every observation below:** headless Chromium (Playwright 1.65) on WSL2 with no GPU adapter, so every run used the **WebGL2 fallback** of `WebGPURenderer` (three 0.187.0, TSL node materials). The WebGPU backend was not exercised. Frame costs are labelled non-representative.
**Acceptance:** aesthetic acceptance is the project owner's decision. The notes below describe what the screenshots show and where I think they fall short of `assets/reference/visual-direction.png`. They are not an approval.

## What was built

- `apps/studio/src/renderer/materials.ts` is still the only place materials are made. One `MeshBasicNodeMaterial` carries the whole ink surface as a TSL `colorNode`. Techniques are driven by uniforms, so each is a toggle and the same shader renders both sides of the compare split.
- `apps/studio/src/lab/look.ts` holds the `look` settings in lab state (`setLook` command): palette preset, quantize, hatching strength, haze, sun elevation and azimuth, grain, outlines, compare. The `Flat (no ink)` preset resolves to every technique off.
- Per-surface tone comes from two attributes that the adapter writes: `ink` (per vertex, used by the procedural backdrop) and `instanceInk` (per instance, an `InstancedBufferAttribute`). Both hold `(tone, unlit)`. Tone shifts the Lambert value before quantization, so a tone of 0.9 gives a near-black mass that still shows a charcoal sunlit face, and a negative tone brightens the pale corridor. `unlit` is used for sky shapes.
- Reference composition modules are in `apps/studio/src/lab/composition/` (see "Composition generator" below).

## Techniques

Screenshots are in `docs/screenshots/`, all at the composition camera, default seed, reduced motion on.

| Shot | Look |
|---|---|
| `p0.5-compare-flat.png` | `Flat (no ink)`: smooth half-Lambert on the ink ramp, no hatching, grain, haze or outlines |
| `p0.5-compare-quantized.png` | Quantized light only (five steps), hatching 0, haze 0, grain off, outlines off |
| `p0.5-compare-hatching.png` | Quantized + hatching 85 %, haze 0, grain off, outlines off |
| `p0.5-compare-full.png` | Everything on (haze 60 %); the same frame as `p0.5-reference-composition.png` |
| `p0.5-orbit-stability-a.png`, `-b.png` | Orbit mode, two angles about 16 px of drag apart, everything on |
| `p0.5-reference-seed-2.png` | Seed 77, everything on |

The in-app **Compare** checkbox renders the same camera and sun twice into one canvas (flat left, current look right); see technique 7.

### 1. Quantized lighting

- **What:** half-Lambert `n·L` (`0.5·n·sun + 0.5`), minus `0.55 × tone`, then `floor(v·5 + 0.003)/4` mapped through the token ramp ink → charcoal → ash → paper → pale paper. The Quantize toggle blends between the stepped value and the continuous value on the same ramp, so the comparison isolates the stepping.
- **Observed:** compare `flat` against `quantized`. Stepping turns the smooth gradients on the P04/P09 rubble and ridge facets into flat paper-cut planes, which is closest to "folded paper". With a sun behind the scene (default azimuth 140°, elevation 42°), camera-facing walls fall in the ink band and the roofs and ground catch pale paper, which is where the strong near-black masses come from.
- **Issue found and fixed:** tones that put a value exactly on a band edge (for example tone 0.4 → value 0.6) produced per-pixel speckle, because interpolated attribute values land on either side of `floor`. A 0.003 bias moves the edges off the values the generators use. Any new generator should avoid values within about 0.001 of a multiple of 0.2.
- **Shadows:** only this cheap route is implemented, so there are no cast shadows. I did not run a shadow-map experiment. `MeshBasicNodeMaterial` does not receive shadows, so real shadow maps would mean moving the surface to a lit node material with a custom lighting model, a depth pass for the tall instanced masses and a second look at the WebGL2 fallback cost. I recommend deciding that after the owner accepts the flat-versus-quantized look.

### 2. Procedural directional hatching

- **What:** world-anchored and tri-planar. The projection plane comes from the dominant axis of the world normal: top faces use `(x, z)`, side faces `(z, y)` or `(x, y)`. Stripe coordinates are `dot(plane, direction) × frequency`, so a point on a tower wall keeps its stripe when the camera moves. Walls use near-vertical lines, tops use a 34° diagonal, sky uses horizontal lines.
- **Density follows darkness:** line half-width grows with `smoothstep(0.15, 0.8, darkness)`; a second perpendicular family appears from darkness 0.5; in the darkest (ink) band the lines flip to coarse ash lines "carved" into the black, with a thin cross family, as in the reference woodcut. `Hatching strength` scales all of it, and haze fades it.
- **Anti-aliasing:** `fwidth` of the stripe coordinate sets the smoothstep width, and coverage fades to its average value once a period falls below about 3 px.
- **Stability:** `p0.5-orbit-stability-a.png` and `-b.png` show the same towers at two angles. The carved and ink lines stay attached to the faces (compare the left tower: same column pattern, only the perspective changes). There is no screen-space term. I checked it by eye only; no pixel metric was computed.
- **Issue found and fixed:** the first stripe function drew a half-intensity line even when its half-width was 0, which put a cross-hatch on pale faces. Coverage is now multiplied by `smoothstep(0, aa, halfWidth)`.
- **Known issues:** (a) line width is a fraction of the period, so lines thicken or thin with the world-space frequency, not in pixels; at the far ridge the period is about 5 px and the lines turn into a tint. (b) Sky hatching uses a frequency scaled by 0.16 because the sky plane is about 670 units away; that scale is a hand-tuned constant, and a different camera distance needs a new value. (c) The hatch frequency is a per-scene value (`inkScale.hatchFrequency`: 7 for lab items, 0.9 for the composition), not a user control.

### 3. Paper grain

- **What:** two octaves of MaterialX Perlin noise (`mx_noise_float`) sampled at `positionWorld × frequency`, amplitude 0.035 in value, added after hatching. The sky backdrop uses the same noise at a lower frequency (scaled like the hatching), so it is static grain on a static backdrop.
- **Observed:** on the paper bands the grain is barely visible. On the near-black masses it reads as a mottled stone texture rather than paper tooth, which I would call too coarse in `p0.5-reference-composition.png`. The perspective makes the noise cell size change with distance (estimated from the frequencies as roughly 30 px near and 5 px far; not measured) because it is world-anchored. Making it constant in pixels would break the "no screen-space shimmer" rule, so I kept it.

### 4. Depth haze (aerial perspective)

- **What:** `smoothstep(hazeStart, hazeEnd, length(positionView)) × haze`, mixed 95 % toward Paper. Hatch strength is multiplied by `1 − haze`. Unlit sky shapes are exempt. Outline lines use the same haze, scaled by 1.2.
- **Observed:** with haze 0 (`compare-hatching`) all five ridges and the skyline are black and the depth layering is lost. With the default 60 % (`compare-full`) the ridges step from ash to nearly paper. This is the technique with the clearest value. The far plain also dissolves into paper, which makes a large empty pale band in the middle of the composition; the reference has a darker, textured plain there.

### 5. Ink outlines

- **What:** panel edges (charcoal) and crease edges (ink, exact hinge segments from `PosedGeometry.creases`) are two `LineSegments` fed from the same CPU pose buffers as before, faded with the haze. Sky batches are excluded because their lobes would show internal seams. The toolbar "Panel edges" overlay and the Look "Ink outlines" toggle both have to be on.
- **Observed:** on the stacked P08 towers the outlines read as window grids, which suits the reference but also carries the "toy cube" risk the brief warns about. Crease edges are darker than panel edges as intended, but P08 boxes have creases on all their hinged edges, so the difference is hard to see.
- **Known issue:** WebGL lines are always one device pixel wide. There is no way to make the near-foreground marks heavier than the far ones without moving to quad-based lines (a screen-space-width or world-width ribbon). I recommend that as the next experiment if outlines are kept.

### 6. Stylized shadows

Cheap route only (see technique 1). Decision recorded: no shadow maps in P0.5.

### 7. Compare mode

- **What:** one frame is rendered twice. Pass 1 uses the `Flat (no ink)` uniforms for the full canvas. Pass 2 sets the current look's uniforms, enables a scissor on the right half and keeps the color buffer. Both passes use the same camera object, so the view and light are identical. The `Flat | Ink` labels are a DOM overlay.
- **Observed:** uniforms are applied per render call on the WebGL2 backend, so the split works without a second material set. I did not test this on the WebGPU backend. Draw calls and triangles in the status bar double while it is on (28 and 10 308 for the reference scene), because `renderer.info` reports both passes.

## Reference composition

### Structure

`apps/studio/src/lab/composition/` (pure modules, seed in, placements out):

| File | Role | Inputs |
|---|---|---|
| `random.ts` | One independent seeded stream per subsystem (`mulberry32` from `scatter.ts`, salted) | seed, stream id |
| `affine.ts` | Yaw/pitch/roll/scale placement of a `Basis`, beam placement between two points, panel orientation | |
| `view.ts` | The composition camera preset and NDC → world projection used by the sky and ridges | |
| `sky.ts` | Dedicated sky composition: five engraved sky strips, sun disk with a ring and 150 radial strokes, up to 34 star marks (some are skipped near the sun), six cloud bands made from flat lobes | frame, seed |
| `ridges.ts` | Backdrop generator: five folded strips of triangles, each with crest, shoulder and foot lines; farther ridges are taller toward the right and lighter | frame, seed |
| `district.ts` | Ground slabs and the winding corridor (46 flat P01 strips along a seeded curve), hero watchtower plus three truncated ruined watchtowers and eight P08 slab towers on the left, six `roof-house`s along the corridor, foreground rubble (P09, P06 beams, P02 facets, P04 mounds) and a broken `ruined-gate`, a recursive tree of P06 prisms, a P08 skyline, 26 P02 dust specks | seed streams, assembly leaves |
| `referenceScene.ts` | Combines the above into one `Composition` | seed |

`lab/scene.ts` groups placements by definition into `LeafBatch`es (instanced), poses each definition at the current fold progress, adds the three procedural panel batches (sky, clouds, ridges), and computes a layout hash (FNV-1a over batch keys, instance transforms and tones), which the Inspector shows. The result is cached per seed so look sliders do not rebuild it.

Everything solid is a Foldon instance (P01, P02, P04, P06, P08, P09 and the `watchtower`, `roof-house` and `ruined-gate` assemblies) scaled by an affine basis; the backdrop and sky are the only procedural panels. Non-uniform instance scaling is used to turn P08 into slab towers and P01 into long strips. That departs from the grid-cell placement of the lab, which is intended here and is not a claim about what Phase 3 should do.

### Stats (default seed 20261124, WebGL2, 1440×860)

| | Value |
|---|---|
| Draw calls | 15 with outlines (13 without; the two line batches), 28 with compare on |
| Triangles | 5 154 |
| Instances | 543 (Inspector "Scene instances") |
| Batches | 12 (9 instanced Foldon batches and 3 procedural panel batches) |
| Geometries | 15 |

### Seed behaviour

Towers stay on the left, the sun on the upper centre, the corridor winds through the middle and the tree stays on the right for seeds 20261124 and 77 (`p0.5-reference-seed-2.png`). Seed 77 puts a large dark P04 mound in the lower-left foreground that covers part of the corridor entrance. I did not check more seeds visually; the e2e test only checks that the layout hash differs between seeds and repeats for the same seed.

### Animation

Cloud bands sway by about 16 units over a 3-minute period and the 26 dust specks drift on sinusoids. Both stop when reduced motion is on, and the renderer then only draws when something changed. The clock is the `requestAnimationFrame` timestamp; nothing uses a random source.

## Measurements (non-representative)

Headless Chromium, WebGL2 software rasterizer, 1440×860, motion allowed so every frame renders. Wall-clock frames per second from the `data-frames` counter over 6 s.

| Configuration | ms / frame | Draw calls |
|---|---:|---:|
| Flat (no ink) | 184 | 13 |
| Ink ramp, smooth, all extras off | 188 | 13 |
| + quantize | 177 | 13 |
| + hatching | 180 | 13 |
| + grain | 175 | 13 |
| + haze | 183 | 13 |
| + outlines (full) | 181 | 15 |
| Full + compare split | 264 | 28 |

The per-technique differences are inside the noise of a software rasterizer that is limited by something other than shading (about 180 ms regardless), so **these numbers cannot rank the techniques**. They only show that none of the six makes the fallback unusable by itself and that compare costs about 1.5× a single pass. A discrete-GPU measurement is still owed for the §9.1 table.

## Recommendations

1. Keep quantized lighting, tone-biased albedo and haze. They carry most of the "ink on paper" read and are cheap.
2. Keep hatching, but treat its frequency as a per-scene art parameter and move the sky's 0.16 factor into the sky data when the camera is no longer fixed.
3. Re-tune grain (smaller amplitude and a finer first octave) before any owner review.
4. Decide on outline width before building further on outlines (see technique 5).
5. Do not start real shadow maps yet. First decide whether back-lit silhouettes are the intended look.
6. Composition gaps against the reference that I would raise with the owner: the empty pale plain between the towers and the mountains, ridges that look like soft tents instead of engraved mountains, no vehicles, and a foreground that reads as crumpled paper rather than layered debris. The structure (towers left, winding pale corridor, radiant sun, cloud bands, ridges right, barren tree right) is in place.

## Verification of the claims above

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e` and `pnpm screenshots` were run against the final tree; see the P0.5 commit message and the hand-off report for the outputs.
