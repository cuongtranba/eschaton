# Eschaton Visual Bible

> **Status: ADOPTED as the artistic reference for object form** by owner decision **ART-D2** on 2026-11-27 (record: [`docs/review/art-1-raven-decision-packet.md`](../review/art-1-raven-decision-packet.md) §0). Adoption makes this the art-direction reference; it does not change any other adopted rule, gate, ADR or phase decision. The adopted geometry gates (GEO-0…GEO-7, [`docs/governance/geometry-quality-gates.md`](../governance/geometry-quality-gates.md)) stay authoritative and unchanged. The companion gates are the adopted [ART-0…ART-5](../governance/art-quality-gates.md). Sources, with use and licence status, are listed in [`docs/research/art-direction-sources.md`](../research/art-direction-sources.md). The Raven concepts that apply this bible are in [`docs/art/raven-concepts/`](raven-concepts/README.md).
>
> **Draft-branch clarifications (2026-11-28).** §4.1.3, §5 and §8 carry the owner's clarifications D-4a and D-4b ([packet](../review/art-1-raven-decision-packet.md) §0.3). They are recorded on draft PR #14 and are not in force on `main` until the owner authorizes a merge. They clarify existing rules and add no gate.

This document is the canonical art-direction reference **for object form and design intent**. It builds on, and does not replace:

- master plan §2 (art direction, tokens and composition);
- ADR 0006 (the ink rendering strategy);
- [`docs/research/look-dev.md`](../research/look-dev.md) (P0.5 look-dev notes).

**Precedence.** The master plan and accepted ADRs outrank this bible: where they conflict, they win and this bible is corrected. The bible is an **artistic** reference. It describes what objects should look like, not what can be built: physical feasibility (foldability, collision, closure, bonds, thickness) is decided only by evidence under the GEO gates and by future construction contracts (Q1–Q6, ADR 0019), never by this document or by concept artwork (§10). Other documents link here instead of restating it.

## 1. Why this exists

Three geometry iterations (V1, V2, V3 on draft PR #11) each became more technically valid and each failed visual review. V3 passed its own geometry certificate for 14 birds and 11 cars under its stated assumptions. The independent pixel reviewer still failed it on GEO-2, because the forms were wrong: a conical head without a nape, a plank arm, a rake of planar primaries, a bell-shaped tail, a heraldic silhouette, and a ridge line that meant nothing. The car had a plank chassis, a tower cabin and a fang grille.

The lesson is one of ordering. **Design intent has to exist, and be approved, before construction starts.** Geometry validity is necessary, but it is not sufficient. This bible says what the objects should look like and why. The adopted ART gates say when that intent is approved and how the implementation is held to it.

## 2. The world: Creation, Collapse, Rebirth

Eschaton's subject is a world that is folded into being, comes apart, and is folded again. Every visual decision should serve one of those three states and make the transitions between them legible.

| State | What the viewer should feel | Form | Tone |
|---|---|---|---|
| **Creation** | intention, craft, quiet precision | sheets unfold into crisp, deliberate planes; creases resolve from flat to final | light paper dominant, thin ink lines |
| **Collapse** | loss of structure, not explosion | planes lose tension: creases relax, layers slip, silhouettes sag and fragment along existing creases | ink floods in; hatching densifies; silhouettes go dark |
| **Rebirth** | memory of the old form in a new one | the same creases fold a new arrangement; fragments are re-used, not replaced | paper returns with visible scars (old crease lines kept as faint ink) |

The rule that follows is that **a crease is the unit of meaning**. A crease that cannot take part in folding, collapsing or re-folding does not belong on the object.

## 3. The reference, verified

I checked [`assets/reference/visual-direction.png`](../../assets/reference/visual-direction.png) (1800×1496, SHA-256 `0e29980e…8523fba0`) pixel by pixel rather than from memory.

- **Palette.** The image is a warm sepia duotone. Quantising to eight colours gives cream paper `#f3e2c3` and `#cabaa1`, mid greys `#968b7d`, `#69645d`, `#494745`, and inks `#303030`, `#212123`, `#111113`. Its only saturated pixels are dark warm browns. **There is no chromatic accent in the reference image.** The restrained accent comes from the master plan instead: §2.1 lists an "Optional vermilion `#A84335` — exceptional narrative events only". These sampled values are measurements of the image. They are **not** tokens. The tokens remain master plan §2.1, with `palette.ts` as the code source.
- **Composition.** A single dominant sun disc with fine radiating rays sits off-centre. A left mass of tall ruined towers balances a right diagonal of debris and a dead tree. Distant conical mountains sit in aerial perspective, done with fewer lines and lighter value. A river path leads the eye from the foreground into the middle distance.
- **Mark-making.** Dense parallel gouge lines carry roofs, sky bands and water. Contour lines carry flow. Solid black fills carry near silhouettes. Shading is done with line density, not with gradients.
- **Subjects.** Pagoda-like tiled roofs, slab towers, wrecked cars and a bus, broken timbers and a dead tree. All are angular, heavy and simplified. Detail is concentrated where silhouettes meet the sky.

## 4. Principles

### 4.1 Silhouette first

1. Every object must be identifiable **as a filled silhouette** on both a light field and a dark field before any interior line is drawn. Test it at hero scale and at district scale (§6).
2. A silhouette carries **a few readable signature features**: for a raven, the heavy bill, the wedge tail and the slotted hand. Find them from the subject's biology or function, never from the construction system.
3. **Asymmetry and gesture beat symmetry.** A frontal, mirror-symmetric spread reads as heraldry. Prefer a three-quarter view, banking, a head turn or an offset weight.
   - *Clarification D-4b (owner decision of 2026-11-28, recorded on draft PR #14 and not in force on `main` until a merge is authorized; [packet](../review/art-1-raven-decision-packet.md) §0.3):* this rule is about **gesture, pose and the composition of a view or scene**. It does not require asymmetric geometry. A bilaterally symmetric body, a vehicle shell or an instrument can be correct as geometry. Its symmetry is judged separately from its pose and from the composition it is shown in. No object is required to be asymmetric. A frontal, mirror-symmetric **pose** still reads as heraldry (§5, heraldic spread).
4. **Use negative space deliberately.** Gaps between fingers, the space under a raised wing and the gap between bill mandibles all carry identity. Do not fill them with detail.

### 4.2 Form hierarchy

| Level | Role | Raven example | Budget guidance |
|---|---|---|---|
| Primary | one continuous mass that carries the gesture | bill–head–neck–body–tail spine | the fewest planes that still hold volume |
| Secondary | the large tracts that carry function and rhythm | wing tiers, tail wedge, folded wing | readable as groups, layered with overlap |
| Tertiary | small accents that carry identity | fingers, hackles, nasal bristles, eye | only where they change recognition |

Tertiary detail is earned. It must survive the hero test, and it must either vanish gracefully or merge into secondary forms at district scale. Detail that only appears in close-ups and changes nothing about recognition is gratuitous.

### 4.3 Origami and material language

- **Planes are paper.** A surface is a sheet, or a fold of a sheet, with a defined edge. Volume comes from folding planes around space, the way sculptural wet-folding does, not from solid blocks.
- **Creases carry rhythm.** Creases should repeat with variation: graduated spacing, alternating valley and mountain folds, and tiers whose lengths follow a progression. Equal parallel creases at equal spacing read as a rake, a comb or corrugation unless the subject is corrugated, such as a roof.
- **Layering carries depth.** Overlapping layers with a visible edge show order: covert over secondary, primary over primary. Layers should overlap, not merely touch.
- **Edges carry the ink.** Under the ink treatment, lines belong on silhouettes, borders and real crease changes. A line inside a plane that does not mark a form change is noise. V3's dashed ridge failed for exactly this reason.
- **Thickness is stylised.** Paper thickness is not modelled. Where a form needs thickness, such as the leading edge of a wing, use a folded-over hem or a tube-like fold, not a solid slab.

### 4.4 Proportion

Use the subject's real proportions as the starting point, then exaggerate **only** the signature features, by no more than about 15–20%. Record the target ratios on the concept sheet. Implementation is later compared with them under ART-4 (§9).

### 4.5 Japanese ink and woodcut atmosphere

- **Value structure is two values plus line.** Each object is either paper on ink or ink on paper. Mid-tones come from line density, never from soft gradients.
- **Restraint.** Leave large areas of unbroken paper or unbroken ink. Hatching is reserved for planes turned away from the light, for distance and for collapse.
- **Carved line.** Lines taper and break like gouge marks. An ink object can carry its creases as **light carved lines**, white-line woodcut style, which the concept sheets demonstrate.
- **Distance is drawn by simplification.** Far objects lose tertiary detail first, then secondary detail, and become flat silhouettes. That is a drawing rule, not a fog effect.

### 4.6 Palette, lighting and ink treatment are separate from geometry

Material, lighting and ink are judged **after** form, and they are never used to rescue form. A geometry review (GEO-2 and ART-2) must use a neutral treatment: flat paper tone, one key light and silhouette line only. A shader that hides a bad form fails this bible, even if the frame looks attractive.

Palette: use the tokens in master plan §2.1 (Paper, Pale paper, Ink, Charcoal, Ash) and do not restate them here. Objects carry **no** hue accent. The optional vermilion stays reserved for exceptional narrative events, as §2.1 says. The concept sheets use close neutral values for presentation; those values are not new tokens. Hatching and grain stay world-anchored (ADR 0006). Whether moving pieces such as a flying raven carry hatching is an **open owner question** under ADR 0006, and this bible does not answer it.

## 5. Anti-patterns

| Anti-pattern | How to recognise it | Seen in |
|---|---|---|
| Voxel blockiness | axis-aligned boxes; silhouette steps on a grid | V1 vehicle |
| Extruded slab | constant-thickness prism; a profile pushed along one axis | V1 vehicle, V3 car chassis |
| Plank limb | a limb built as one flat rectangle with no taper, camber or leading edge | V3 bird arm |
| Planar rake | equal, parallel, coplanar blades with equal gaps | V3 primaries |
| Bell or fan tail on a raven | rounded or flared tail outline | V3 tail |
| Heraldic spread | frontal, symmetric, emblem-like pose | V3 below-view silhouette |
| Arbitrary triangles | facets that follow no anatomy and no crease logic | V1 bird |
| Meaningless line | an ink line where there is no form change | V3 dashed ridge |
| Repeated geometric noise | many identical small units that hide the mass | Concept C first pass, before it was revised (see the packet) |
| Shader or noise rescue | texture, grain or dramatic light used to hide weak form | — (a gate rule) |
| Gratuitous detail | detail that does not change recognition at either scale | — |

**Intentional against unintentional (clarifications D-4a and D-4b; owner decision of 2026-11-28, recorded on draft PR #14 and not in force on `main` until a merge is authorized; [packet](../review/art-1-raven-decision-packet.md) §0.3).** The rows above name forms that arise **by default**: from a grid, from an extrusion tool, or from one element repeated at a constant pitch.
- **Rectangular and prismatic structures.** An intentional rectangular or prismatic structure is acceptable when the subject's function and the art direction justify it, and the reason is declared before the artwork. Examples: a slab tower like those in the reference image (§3), a doorway, a crate, a beam, a shipping container. The voxel-blockiness, extruded-slab and plank-limb rows still apply to blockiness that nobody decided, and to a prism that stands in for a form whose function changes along it (a raven limb, a car body).
- **Repeated equal elements.** Deliberately repeated equal elements are acceptable when the subject's function makes them equal. Examples: the four wheels of a car, tuning pegs, a row of identical windows, frets. The planar-rake and repeated-noise rows still apply to an accidental series: equal blades, gaps or steps that the subject does not call for, or many small units that hide the mass.
- **Symmetry.** Symmetric geometry is not an anti-pattern (§4.1.3). The heraldic-spread row is about pose.

These clarifications do not loosen the rest of this bible, the ART gates or the GEO gates. Each declaration is still checked for truth, and every visible form is still judged at every required view and scale.

The board [`raven-concepts/v3-failure-anatomy.png`](raven-concepts/v3-failure-anatomy.png) puts actual V3 pixels next to the corresponding Concept A view, row by row (head, wing, below, side).

## 6. Scale: hero and district

| Scale | Approximate on-screen size | What must survive |
|---|---|---|
| Hero close-up | more than 400 px | everything, including tertiary accents and crease rhythm |
| Mid | 96–48 px | primary and secondary forms; signature features |
| District | 24–12 px | silhouette and signature features only (for a raven: wedge tail, slotted hand, heavy bill) |

The concept sheets include a strip at 96, 48, 24 and 12 px. A concept passes the district test only if its signature features are still readable at 24 px. Production LOD integration is **deferred** (§11).

## 7. Motion and collapse

- **Motion follows the crease graph.** A wingbeat is a sequence of hinge rotations along the creases already on the concept: the arm hinge, the wrist hinge and the finger spread. No surface should bend where there is no crease.
- **Hold on the key poses.** Show the drawn poses (glide, upstroke, perched calling) as key frames. Transitions move fast between them, the way a fold snaps.
- **Collapse runs in reverse order of construction.** Tertiary layers release first, then secondary tiers slide off, then the primary mass loses tension and flattens. Fragments are planes that already existed.
- **Rebirth re-uses crease scars.** The new form keeps faint ink traces of the old creases.
- The feasibility of rigid motion is **not verified** for any concept (see the concept README §E).

## 8. Subject guidance

**Creatures.**
- Start from anatomy: skeleton landmarks, then the masses and the feather or fur tracts.
- Pick one signature pose per concept and use its weight distribution.
- Keep the head expressive, with a clear forehead, nape and jaw or bill.

**Raven.** The raven is the first hero creature.
- Heavy, arched bill with nasal bristles covering roughly the proximal third.
- Steep forehead, and shaggy throat hackles.
- Long, slotted hand that shows about **four long fingers (P6–P9) plus a short P10**. A crow shows about five. This count comes from Corvid Research (2018, 2020): the sources are verified but unsigned blog posts. It agrees with Featherbase's narrowing pattern (outer vanes narrowed on H6–H9, only hinted on H5). The longest primary is P6 or P7, so the fingers graduate and are not equal. None of this has been checked against specimens ([sources](../research/art-direction-sources.md) §5).
- Wedge-shaped tail with the central feathers longest.
- Long neck and head projecting in flight.
- Tell it apart from a crow, which has a fan or square tail, a slimmer bill and a smoother throat. Variants such as a juvenile, a moulting adult or a carrion crow must be labelled as variants, never as "raven".

**Vehicles.**
- A vehicle is a folded shell around a chassis gesture: a long low line, tumblehome, and wheel arches cut as negative space.
- Avoid a plank chassis, a tower cabin and a fang grille.
- Collapse reads as panels peeling along seams, matching the wrecks in the reference.

**Architecture.**
- Roofs are the main signature: tiled, curved eaves and gables. Corrugation is a legitimate repeated rhythm here because the subject is corrugated.
- Towers taper and break. *Clarification D-4a (owner decision of 2026-11-28, recorded on draft PR #14 and not in force on `main` until a merge is authorized):* this is the default, not a ban. A prismatic slab tower, as seen in the reference (§3), is acceptable where function and the art direction justify it and the reason is declared (§5).
- Openings are negative space, not decals.

**Plants.**
- Trunks fork and taper in two or three generations at most.
- Foliage is a few large folded fans.
- Dead trees are line-dominant silhouettes, as in the reference.

## 9. Measurable diagnostics, used only where they help

These are aids for review. None of them is a beauty score, and passing them does not mean a concept is approved.

- **Silhouette test.** Filled silhouette on a light and a dark field, at 96, 48, 24 and 12 px. A reviewer names the subject and its variant.
- **Hierarchy render.** Flat tones per form class (primary, secondary, tertiary). This checks that the primary mass carries the gesture.
- **Target ratios.** For example span to length, tail length to total length, and bill length to total length. They are recorded on the approved concept and later compared under ART-4 within declared tolerances. The tolerance is declared at approval, not fitted afterwards.
- **Crease-meaning audit.** Every inked interior line on the hero maps to a named form change.

## 10. Stylistic versus physical

| Concern | Stylistic (this bible) | Physical (GEO gates and future contracts) |
|---|---|---|
| Plane layout, crease rhythm, hierarchy | ✔ | — |
| Real foldability of one sheet, flat-foldability, collision, closure | — | ✔ (not claimed by any concept artwork) |
| Paper thickness | stylised (hem folds) | not modelled; a future contract would decide |
| Bonds between modules | proposed as an assembly story | needs typed ports and structural rules (Q1–Q6, ADR 0019) |

## 11. Deferred integrations

These are named so that nobody assumes them, and each is out of scope for this bible:

- Production LOD rules.
- Shader and ink rendering in the Studio renderer.
- The animation runtime.
- Catalog, module and contract changes.
- WFC or grammar integration.

Each needs its own plan, and owner authorisation where the phase rules require it.
