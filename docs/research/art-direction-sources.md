# Art direction sources: origami, ink, corvids, design

- Status: research note, 2026-11-27. It supports the [Visual Bible](../art/visual-bible.md) (adopted 2026-11-27, ART-D2) and the Raven concepts. It is not a decision.
- **Verified** means the page or file was opened on 2026-11-27 and the stated fact was read there. **Unverified** means the page was blocked, timed out or was seen only in search results.
- No external artwork is reproduced in this repository. Public-domain museum images were downloaded **for private study only**, into a scratch folder outside the repository, and are not committed.

## 1. Project reference (primary)

| Source | Status | What was checked | Use |
|---|---|---|---|
| `assets/reference/visual-direction.png` (owner-supplied; SHA-256 `0e29980ebefff5dc629c44d0ec2dec35c71b951aba43c8c2d2b7078e8523fba0`) | Verified, pixel analysis | 1800×1496. Warm sepia duotone. No chromatic accent: the only saturated pixels are dark browns. Sun disc with fine rays; slab towers; tiled roofs drawn with dense parallel gouge lines; wrecked cars and a bus; dead tree; conical mountains. See Visual Bible §3 | Master plan §2: an art-direction anchor; confirm rights before any public redistribution |
| Master plan §2–§2.3; ADR 0006; `docs/research/look-dev.md` | Verified | Tokens (§2.1), including optional vermilion for exceptional narrative events only; composition rules (§2.2); world-anchored hatching (ADR 0006) | Project documents |

## 2. Imagery analysed directly

These are all Met Open Access, public domain. Each was downloaded and looked at; notes are on the actual pixels.

| Work | URL | What the pixels show that matters here |
|---|---|---|
| Kawanabe Kyōsai, *Crow Resting on Wood Trunk*, woodblock, Met JP3153 | https://www.metmuseum.org/art/collection/search/56706 | One solid ink mass. Domed head sitting close on the body, with almost no visible neck. Eye mid-head, roughly level with the top of the bill base. The folded wing is one lighter plane over the darker body. The primaries form one tapering blade, and the tail extends beyond it. Stout feet grip the perch. |
| Kyōsai, *Crow on a Bamboo Branch*, ca. 1887, Met 14.76.61.11 | https://www.metmuseum.org/art/collection/search/54618 | A heavy arched bill and a rough throat outline. The body axis is about 50–60°. Very few interior marks; the silhouette carries everything. |
| Kyōsai, *Crow and the Moon*, ca. 1887, Met 14.76.61.25 | https://www.metmuseum.org/art/collection/search/54631 | The flight read is carried by the shape of the wing mass, not by individual feathers. (The download was truncated; only the upper part could be viewed.) |
| Myōchin Munesuke, *Okimono in the Form of a Raven*, early 18th c., steel, Met 13.112.20 | https://www.metmuseum.org/art/collection/search/22176 | A plated raven that still reads as natural. The wing is layered plates sliding over a calm body, the bill is huge and arched, and the wedge tail extends past the wingtip. This is the closest precedent for "folded plates" on a raven. |

These observations drove the round-2 revision of Concept B: a shorter neck, a plump body, the eye moved lower, one primary blade, and a tail that extends past the wingtips.

## 3. Origami craft and computational origami

| Source | Author | Status | Why it matters | Use |
|---|---|---|---|---|
| "Akira Yoshizawa", https://en.wikipedia.org/wiki/Akira_Yoshizawa | Wikipedia | Verified | Wet-folding of thick, dampened paper gives a rounded, sculpted volume. Use it for head and breast masses, and keep the wings crisp | CC BY-SA 4.0 |
| "Yoshizawa–Randlett system", https://en.wikipedia.org/wiki/Yoshizawa%E2%80%93Randlett_system | Wikipedia | Verified | Valley folds are dashed and mountain folds are dash-dot: a line language for crease overlays | CC BY-SA 4.0 |
| "TreeMaker", https://langorigami.com/article/treemaker/ | Robert J. Lang | Verified | The tree method: a stick figure becomes flaps, and circle or river packing gives the crease pattern. The raven's flap list is bill, 2 wings, tail and 2 legs | Page copyrighted; software GPL |
| "Raven, Opus 422" (2004), https://langorigami.com/artwork/raven-opus-422/ | Robert J. Lang | Verified (no full image) | A master's raven folded from one uncut square of hanji | Copyrighted: cite and link only |
| *Origami Design Secrets*, 2nd ed., https://langorigami.com/publication/origami-design-secrets-2nd-edition/ | Robert J. Lang | Verified (publication page) | Standard design text: tree method, box pleating | Copyrighted book |
| Software page, https://tsg.ne.jp/TT/software/ | Tomohiro Tachi | Verified | Origamizer, Freeform Origami and the Rigid Origami Simulator. Rigid origami keeps panels flat and moves only creases, which suits wingbeat motion | Non-commercial use with citation |
| Origami applications and *Curved-Folding Origami Design* (CRC 2019), https://mitani.cs.tsukuba.ac.jp/origami_application | Jun Mitani | Verified | ORIPA and ORI-REVO; curved creases bend panels while they stay developable | © Mitani; non-commercial |
| "Curved-Crease Sculpture", https://erikdemaine.org/curved/ | Erik & Martin Demaine | Verified | Pleated curved forms that settle into an equilibrium shape | Treat as copyrighted |
| "Éric Joisel", https://en.wikipedia.org/wiki/%C3%89ric_Joisel | Wikipedia | Verified | Characterful sculptural wet-folding; "paper and water only, without adhesive or scissors" | CC BY-SA |
| Satoshi Kamiya, http://www.folders.jp/; *Yatagarasu* in Gilad's database | Kamiya; Gilad Aharoni | Verified (probably official) | A three-legged crow motif (Shinto) by a super-complex designer, as a possible cultural variant | Link only |
| Giang Dinh, giangdinh.com | Giang Dinh | Verified (site shell only, no works visible) | Minimal wet-folded forms | Copyrighted |

## 4. Modular and tessellated origami

| Source | Status | Why it matters | Use |
|---|---|---|---|
| Koryo Miura, "Method of Packaging and Deployment of Large Membranes in Space", ISAS Report 618 (1985), https://jaxa.repo.nii.ac.jp/records/31382 | Verified (abstract) | Miura-ori: a single degree of freedom, so one motion opens the whole sheet. That fits an open-close gesture | Record page; no licence shown |
| "Ron Resch", https://en.wikipedia.org/wiki/Ron_Resch; Lang, "{8.8.4}B Resch Tessellation", https://langorigami.com/composition/8-8-4b-resch-tessellation/ | Verified | Triangulated relief. Use it as covert texture, never as the silhouette | CC BY-SA; copyrighted |
| "Tomoko Fuse", https://en.wikipedia.org/wiki/Tomoko_Fuse | Verified | Unit origami: many identical units forming a larger whole | CC BY-SA |
| Eric Gjerde, https://www.origamitessellations.com/ | Verified | Tessellation crease patterns | © Gjerde; ask before any reuse |

## 5. Corvid anatomy and identification

| Source | Status | Facts used |
|---|---|---|
| Audubon Field Guide, Common Raven, https://www.audubon.org/field-guide/bird/common-raven | Verified | 56–69 cm; wedge tail; very thick bill; shaggy throat; long, fingered wings; soars |
| Audubon Field Guide, American Crow, https://www.audubon.org/field-guide/bird/american-crow | Verified | 41–53 cm; short, square-tipped tail; broad, rounded wings |
| BirdNote / Audubon, "How to Tell a Raven From a Crow", https://www.audubon.org/magazine/how-tell-raven-crow | Verified | Raven tail is a wedge (central feathers longer); crow tail is a fan; raven bill larger and curvier, with longer bristles |
| Corvid Research, https://corvidresearch.blog/2020/04/16/the-definitive-guide-for-distinguishing-american-crows-common-ravens/ | Verified | Both species have 10 primaries. **A raven shows about 4 main fingers, a crow about 5.** Raven primaries are slimmer and pointed; hackles can be raised |
| "Common raven", https://en.wikipedia.org/wiki/Common_raven | Verified | 54–71 cm; span 116–153 cm; culmen 5.7–8.5 cm; tail 20–26.3 cm, "strongly graduated"; tarsus 6–7.2 cm |
| RSPB Raven and BTO BirdFacts pages | Verified | Diamond or wedge tail; shaggy hackles; tumbling aerobatics |
| NatureMapping, crow vs raven | Verified | Raven wingtip longer and more slotted; longer neck in flight |
| "Flight feather", https://en.wikipedia.org/wiki/Flight_feather | Verified | Primaries sit on the hand, secondaries on the ulna; tertials, coverts, alula |
| Cornell All About Birds, raven and crow pages | **Unverified** (blocked) | — |
| Corvid Research, "A matter of a pinion" (2018), https://corvidresearch.blog/2018/12/21/a-matter-of-a-pinion | Verified (2026-11-27, B-2 v4 research). Unsigned blog post; its wing photos are credited to the Slater Museum | "the crow has five evident finger feathers (feathers 5-9) whereas ravens only have four (feathers 6-9)" |
| Featherbase, *Corvus corax*, https://www.featherbase.info/uk/species/corvus/corax | Verified (the page's TLS certificate fails strict verification; it was read as text only) | Outer vanes partly narrowed on H6–H9; H10 narrowed along its whole length; on H5 only hinted; inner vanes narrowed on H6–H10. Longest primary P6 (67 %) or P7 (33 %), n = 6; primaries 315.5–396 mm; secondaries 217–240 mm; wing length 368–475 mm (n = 46, AVONET); hand-wing index 31–47 %. The numbering direction is not stated (inferred outermost = H10) |
| Meinertzhagen (1926), *Novitates Zoologicae* 33, wing formulae, https://archive.org/download/biostor-146617/biostor-146617.pdf | Reported by a research pass from an image-only table; **not re-checked** | Raven P10 about the length of P3–P4; P7 longest in the European sample |
| Sibley Guides, wing feather article, https://sibleyguides.com/?p=7222 | Verified (by the research pass) | Flight feathers "slide across each other like certain folding fans"; "from below we see mainly the inner webs … from above mainly the outer webs" |
| "Covert feather", https://en.wikipedia.org/wiki/Covert_feather; US FWS Feather Atlas glossary, https://www.fws.gov/lab/featheratlas/glossary.html; BTO wing topography diagram | Verified (secondary sources and a labelled diagram) | Covert rows overlap like tiles: marginal, lesser, median, greater; primary coverts and alula on the hand. Emargination narrows the outer vane, a notch the inner vane |
| San Fernando Valley Audubon, "Crows and ravens", https://sfvaudubon.org/crows-and-ravens/ | Verified (local chapter page) | Ravens soar with flatter wings; crows hold more of a "V" |

Not found, so not used as fact in B-2 v4: corvid ulna and digit lengths, the wrist's position along the leading edge, the reach of the greater coverts, glide sweep and dihedral angles, the raven's secondary trailing-edge shape and camber, and "a longer neck in flight" (search snippets only).

The span figures conflict: Audubon gives 116–118 cm and Wikipedia 116–153 cm. They are quoted as a range across sources. The design target in the concepts (span about 1.9–2.05 × length) sits inside it.

## 6. Composition, silhouette and NPR rendering

| Source | Status | Takeaway | Use |
|---|---|---|---|
| Arthur Wesley Dow, *Composition* (1913 ed.), https://archive.org/details/compositionserie00dowauoft | Verified | Notan: design first in two values (dark and light), then in three | Public domain |
| Mitchell, Francke & Eng, "Illustrative Rendering in Team Fortress 2", NPAR 2007 (slides) | Verified (PDF) | "Characters must be readable quickly"; interior detail echoes the silhouette; rim light rather than a dark outline on dark subjects | Copyrighted; cite |
| Praun, Hoppe, Webb & Finkelstein, "Real-Time Hatching", SIGGRAPH 2001, https://hhoppe.com/proj/hatching/ | Verified | Tonal art maps give temporally coherent hatching | Cite |
| Blender Manual, Freestyle, https://docs.blender.org/manual/en/latest/render/freestyle/introduction.html | Verified | The line types used for the concept sheets (silhouette, crease, border) | CC BY-SA 4.0 |
| Walt Stanchfield, *Drawn to Life* (2009) | **Unverified** (search only) | Line and silhouette chapter | Copyrighted book |

## 7. How the principles transfer (summary)

Principles are borrowed. Artworks are not copied.

- **Lang's tree method.** Plan the raven's flaps (bill, wings, tail, legs) as a stick figure before anything else.
- **Yoshizawa and Joisel.** Volume comes from shaping planes, and the wet-fold roundness belongs on the head and breast.
- **Tachi's rigid folding.** Motion happens along creases only.
- **Kyōsai.** The silhouette is a single mass, and interior marks are few.
- **Myōchin.** Plates layered over a calm body.
- **Dow's notan.** Two values first.
- **The TF2 study.** Interior folds echo the silhouette.
- **Fuse and Miura.** One module repeated in a rhythm, but confined to tracts. Concept C's round-1 failure shows what happens when repetition covers the whole body.
