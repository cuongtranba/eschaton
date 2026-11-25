# ADR 0006: Ink visual strategy

- Status: **Accepted with amendments** — owner decision D3 (2026-11-25, recorded in [`../review/phase-0-owner-review.md`](../review/phase-0-owner-review.md) §0) approved this ADR on condition that the independent-review amendments ([`../review/adr-review.md`](../review/adr-review.md)) are applied. They are applied in the section "Amendments (owner D3, 2026-11-25)" below. Accepted as the **technical direction only**. Aesthetic acceptance is **not** given here: under owner decision D1 the current scene is accepted only as a research and look-development prototype.
- Date: 2026-11-24
- Master plan: §2, §2.3, §13 ("Hatching flickers or obscures silhouettes")

## Context

The target is a living woodcut print on warm paper (`assets/reference/visual-direction.png`). Hatching that is anchored to the screen shimmers when the camera moves; hatching anchored to UVs needs UVs on every generated panel.

## Options considered

1. **Screen-space hatching / post-process.** Cheap and uniform, but swims with the camera.
2. **UV-based textures.** Stable, but needs authored UVs and texture memory per recipe.
3. **World-anchored tri-planar procedural hatching** in the material, with the projection plane chosen from the dominant axis of the world normal.
4. **Real shadow maps for the cast-shadow part of the look.** Needs a lit node material and a depth pass.

## Decision

Option 3 for hatching, with the other techniques from `docs/research/look-dev.md`:

- Quantized half-Lambert light in five steps mapped through the token ramp (ink, charcoal, ash, paper, pale paper), with a per-instance tone bias.
- Directional hatching: near-vertical on walls, diagonal on tops, horizontal on sky; line density grows with darkness; `fwidth`-based anti-aliasing fades to a tint under about 3 px per period.
- Paper grain from two octaves of noise at world position.
- Depth haze (aerial perspective) mixes toward paper and fades hatching.
- Ink outlines from the exact panel and crease edges; compare split for flat versus ink.
- **Shadows deferred.** Only the cheap route is implemented; no shadow map experiment was run.

## Consequences

- Known limits recorded in the look-dev notes: 1-pixel lines only (no heavier foreground marks); hatch frequency and the sky factor 0.16 are hand-tuned per scene; grain reads as mottled stone on the near-black masses; the far plain dissolves into paper; ridges look like soft tents; no vehicles; foreground reads as crumpled paper.
- Stability across motion was judged by eye on two orbit screenshots; no pixel metric exists. The §12 requirement "stable hatching across motion" is **not** verified numerically.
- A band-edge speckle bug was found and fixed with a 0.003 bias; new generators must avoid tone values within 0.001 of a multiple of 0.2.
- Cost on the software rasteriser could not rank the techniques (about 180 ms/frame regardless); a discrete-GPU measurement is owed.
- Haze and grain are tied to per-scene scale constants (`inkScale` in `apps/studio/src/lab/scene.ts`), not camera-derived values.

## Evidence

- [`../research/look-dev.md`](../research/look-dev.md); screenshots `docs/screenshots/p0.5-*.png`; commit `279e8c8`.
- `apps/studio/src/renderer/materials.ts`, `apps/studio/src/lab/look.ts`.
- e2e: value-split check ("the reference composition shows both near-black masses and pale paper"), reduced-motion pixel-identity check, compare-mode check.

## Amendments (owner D3, 2026-11-25)

- **Aesthetics are decided through D1, not through this ADR.** D1 accepted the reference composition only as a research and look-development prototype, together with the narrowed Phase 0 criteria V1–V5. It is not final art and not evidence of procedural generation. The original artwork (`assets/reference/visual-direction.png`) stays the anchor, and the Genesis, Atmosphere and The Last District visual gates remain.
- **Consequence on moving geometry:** hatching and grain sample `positionWorld` (`apps/studio/src/renderer/materials.ts`). On geometry that moves relative to the world (folding panels per ADR 0003, detached fragments per ADR 0013 layer C), the pattern therefore slides across the surface. The projection plane also switches abruptly when a folding panel's dominant normal axis changes. **Object-space (instance-local) anchoring**, which master plan §2.1 allows ("world/object anchored"), is the recorded alternative.
- **Open owner question, Phase 5 scope** (the "stable hatching across motion" exit criterion): should hatching on moving pieces be world-anchored (it slides) or object-anchored (it moves with the piece)? Phase 1 keeps the existing material unchanged, so the folding panels and fragments in the world mode show the sliding behaviour described above. This question does not block Phase 1.
