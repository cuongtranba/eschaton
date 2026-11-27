# Holdout transfer check: one previously unused object category (design level)

- Status: **DESIGN-LEVEL TRANSFER CHECK. Concept only.** It is not an ART-1 concept, not approved, and not implemented geometry. No production model is built, and nothing in it is runnable.
- Authority: the owner's third ART-D3b ruling ([packet](../../../review/art-1-raven-decision-packet.md) §0.2), item 5.
- What it can show: whether the **frozen** method M3 and the operators O1–O3 can be applied, as written, to one category that played no part in deriving them.
- What it cannot show: that the method generalizes. One category is not enough evidence for that.

## 1. Frozen inputs

The commit that adds this file freezes these three files. That commit is recorded in §2 when the selection is logged:
- [`docs/art/form-construction-method.md`](../../form-construction-method.md) (M3), with [`form-method-check.md`](../../form-method-check.md);
- [`docs/research/geometry-operators.md`](../../../research/geometry-operators.md);
- [`docs/research/geometry-operator-lab.md`](../../../research/geometry-operator-lab.md).

**No change to the frozen files until the holdout result is recorded.** *Later note: after the result was recorded (`a2ec1c1`) and reviewed, errata sections were **appended** to the frozen files (method §14, check §8, operators §9, lab §8). The frozen text above them is unchanged, and `8c2bd53` keeps it.* If the holdout shows that the method or an operator must change, the rules are:
- the frozen version and its result stay as recorded;
- the change is a new variant (M3.1 or later);
- the new variant is **exploratory**, and this category is no longer held out for it.

## 2. Selection protocol

1. **Freeze first.** The frozen files are committed before any category is named, and this file is committed in the same commit.
2. **Independent selector.**
   - The selector is a separate agent that wrote none of the method, operators, studies or B-2 artwork.
   - It receives the frozen file paths and the repository, and nothing else from the author.
   - It searches the frozen files and the history of PR #14 and PR #11 for every object category named there.
   - It then proposes a category that meets three conditions:
     1. no example, derivation, study or failure in those files uses it;
     2. its form logic differs materially from a creature, a vehicle, a building and a branching plant;
     3. real references for it can be cited with verified sources.
3. **What is logged:** every candidate considered, each rejected candidate with its reason, the final choice, the search terms used to check for leakage, and at least two verified real-subject references (title, author or owner, URL, licence or use statement). References are **cited, never imported or traced** (ART §2.6).
4. **Author steps after selection,** in separate commits, in this order:
   1. a holdout brief that applies method §5 steps 1–6, committed before any drawing;
   2. original design drawings, clearly labelled as original, made from the brief's numbers;
   3. a small manually worked O1/O2/O3 composition.
5. **Independent reviewer.** A second separate agent inspects the drawings (pixels) and the reasoning, not the text alone, and records a verdict.

## 3. Selection log

**Frozen commit:** `8c2bd53de3000fa0df19b03557d1242b339252ca` (pushed to PR #14 before the selector ran).

**Selector.** A separate agent, 2026-11-27. It wrote none of the method, operators, studies or B-2 artwork, and it read the repository at `8c2bd53` only. Its report is summarised below; the full report is kept in the session record, not in the repository.

**Disclosure.** The request to the selector listed example candidate types: "freestanding vessels, musical instruments, furniture, lamps, tools, armour, boats, shells, insects". The owner's handoff had also named "a freestanding vessel or instrument" as examples. So the instrument family was suggested to the selector, together with eight others. The protocol (§2.2) said that the selector would receive only the paths and the repository. This list deviates from that, and the deviation is recorded here.

**Leakage search.**
- **Method.** Case-insensitive whole-word matching, plurals included, over:
  - the frozen files;
  - the studies README and brief, the Visual Bible, the raven READMEs and briefs, and the decision packet;
  - the PR #11 lab `docs/research/**` and `experiments/origami-lab/src/**`;
  - the study and raven sources;
  - the first 200 subjects of `git log --all`;
  - a repository-wide `git grep` at `8c2bd53`.
- **Categories found in use:**
  - raven, bird and crow;
  - vehicle, car, bus and truck;
  - building, tower, house, pagoda and roof;
  - tree, pine and plant;
  - incidental examples: door, window, sign, shipping container, pipe, column, shaft, flat roof plate, "sail-like panel", sphere, cube, box, Miura field, wheel, grille, shingle, eave, finial, fan;
  - similes: bell tail, kite, shield, horn, glove, crane, fish, hull, barrel.
- **Terms of the chosen category with zero hits everywhere:** biwa, pipa, lute, instrument, musical, soundboard, pegbox, fret, peg, plectrum, crescent, tailpiece, headstock, nut, reflex, chordophone.
- **Generic words that do appear** (neck, shoulder, body, belly, waist, mouth, lip, rib, bridge, string) appear only in raven or vehicle anatomy, as code types, or as verbs.
- **"Convex hull"** in the operator document is a geometric term, not a category leak. "Hull" and "keel" used as body metaphors count as a partial leak against boats.

**Candidates.**

| Candidate | Decision | Reason |
|---|---|---|
| Short-necked plucked lute (biwa type) | **chosen** | — |
| Wheel-thrown storage jar | rejected | circular sections that change only in size: too close to the F1 derivation case |
| Anvil | rejected | no attached or layered element |
| Japanese helmet | rejected | its neck lames repeat the derived "cover vane" tract, and it is shaped around a head |
| Stone lantern | rejected | column, firebox, eaves and finial repeat the building study |
| Boat | rejected | keel, sail and hull leak |

Also rejected: bell, folding fan or umbrella, shell or insect, furniture, and the named examples (door, sign, container, pipe, column).

**Chosen: the short-necked plucked lute of the biwa type.** The selector's rationale is that it is a fair test, not an easy one:
- the body is a shallow, flat-backed hollow resonator, a closed shell (Q4);
- the reflex pegbox has a hollow, non-convex section, bent sharply against the neck;
- the crescent sound holes are non-convex designed negative spaces;
- each string spans two hosts, the tailpiece and a peg;
- the frets are a series graded by function;
- the soundboard is a slightly curved sheet.

**References.** Cited only; no image or geometry is imported or traced.

| # | Source | URL | Use | What it gives |
|---|---|---|---|---|
| 1 | Tokyo National Research Institute for Cultural Properties, with craftsman Katsuyoshi Ishida, *Techniques that Support Japanese Performing Arts I: Biwa (Japanese short-necked lute)*, 2023 | <https://tobunken.repo.nii.ac.jp/record/2000017/files/Techniques%20That%20Support%20Japanese%20Performing%20Arts%E2%85%A0%20Biwa%20[Japanese%20short-necked%20lute].pdf> | © TNRICP; facts only | Construction and parts: a carved shell; a tie and post inside; a steamed, slightly curved soundboard; crescent inlays (hangetsu); a tailpiece; a headstock glued and wedged onto the neck; the shrimp-tail end (ebio); octagonal pegs; an ivory nut and first fret, with magnolia frets adjusted in height |
| 2 | The Metropolitan Museum of Art, *Satsuma Biwa*, about 1800, acc. 68.62.1 | <https://www.metmuseum.org/art/collection/search/503051> | Open Access, CC0. Verified through the Met Collection API, because the web page returned HTTP 429 | 88.9 × 30.8 × 29.2 cm |
| 3 | The Metropolitan Museum of Art, *Heike Biwa*, about 1835, acc. 89.4.123 | <https://www.metmuseum.org/art/collection/search/500681> | CC0 | 80 × 30 × 3.4 cm |
| 4 | Horniman Museum and Gardens, *Biwa; lute*, M26-1994 | <https://www.horniman.ac.uk/object/M26-1994/> | facts only | "pear-shaped body in three sections … sharkskin band (bachimen) … two crescent-shaped sound holes, four wooden frets, the reflex pegbox terminating in a simple pentangular finial, four strings … large fluted pegs"; 330 × 900 × 205 mm |
| 5 | Rose and Kapuscinski, Stanford, *Biwa* (gagaku strings) | <https://gagaku.stanford.edu/en/strings/biwa> | facts only | about 106 cm long; flat back, shallower than a Western lute; four strings and four raised frets |

**Not sourced:** the body depth on its own (the recorded depths are overall figures and disagree between records) and the pegbox angle. The brief marks every value it derives from these as a design assumption.

## 4. Independent review

**Reviewer.** A separate agent that made none of the work, 2026-11-27. It inspected the sheet's pixels first (cropped at full resolution) and checked proportions against the Met record through its API, the Horniman record and the Tobunken PDF. It then read the protocol, the brief, the composition and the frozen texts, and recomputed the key numbers independently. Its crops are outside the repository (`/tmp/holdout-review/`).

**Verdict: NEEDS REVISION** (no blocker). It does **support the "transfer partial" conclusion**, and judges the label suitably modest.

### 4.1 Pixels

The front, side, section strip and flat pattern agree with each other and with the brief. The front reads as a plausible original biwa-type lute, though to a layman it reads as "lute or mandolin".

| Problem | Where |
|---|---|
| The end view overlays keyframe sections and leaves out the pegbox and pegs | end-view panel |
| The hero sketch has no soundboard features and reads as a bottle | three-quarter panel |
| The silhouettes are front-only, so the bent pegbox never shows; the crescents are not shown at 96 px | silhouette panel |
| The body outline is coffin-like rather than a rounded teardrop | front view |
| Frets are small and pegs are short against the satsuma reference | front and side views |
| Labels overlap panel borders; the rim seam is an arbitrary inset | several panels |
| Overclaims printed on the sheet: "signature: … bent pegbox", "graded tract" (the frets are drawn at equal heights), and "applied as written" | sheet text |

### 4.2 Method transfer

**What held.** The freeze, the ancestry and the leakage controls are confirmed, and the diff of the frozen files over `8c2bd53..a2ec1c1` is empty. The following reproduced independently:
- P1, both stations (Δ 1.333 and 0.876 px);
- O1 faces, areas and volume, and the 0.33% gap;
- 13 of 21 folds below 8°;
- the hero `e_v`;
- the soundboard camber and folds;
- the reflex-mate placement.

**Findings it judged real under the frozen text:**
- P7 fails a mass whose station sections fit inside its widest one;
- P1 fails shallow masses;
- no declaration route exists for equal functional elements (P5);
- the two-host string;
- holes against Q2;
- soundboard camber against P4.

**Majors:**
1. The read-outs come from an unpublished scratch script. Three values do not reproduce (none changes a verdict):

   | Value | Author | Reviewer |
   |---|---|---|
   | Largest K1→K2 fold | 76.4° | 103.6° (an absolute-value bug) |
   | End-view `e_v` | 0.15 px | 0.04 px |
   | Partition figures | 0.10 / 0.21 px | 0.00 / 0.055 px |

2. The O3 "wedged joint" gap is mostly an artefact of putting the host port on the nut's top line. Operators §3.3 already provides an O1 collar. It should be **disputed**, not a gap.
3. "Applied as written" overclaims. No independent confirmation of declarations was obtained (method §4.0 rule 5), and the §5 artefacts were given as tables instead of drawings. Neither deviation was disclosed.
4. The P7 counterexample was overstated. A real end view shows the pegbox. The finding holds per mass only, and only under the unsourced depth assumption.
5. The sheet does not demonstrate the tier reads.

**Minors:**
- O1-a, partition sensitivity and the closed shell are already in the frozen texts; the new part is that **adding a C junction empties both function programs**.
- The P5 flag is designed behaviour; the gap is the missing declaration route.
- K3→K4 is not a declared station; d(BODY, NECK) gives 1.93 px, still below 2 px.
- The brief's "overall depth about 0.28 L" should be about 0.24 L.
- The drawings and the composition share one commit, against protocol §2.4.
- The pegs are not octagonal and not angled, against [1] and [4].

### 4.3 Response (bounded; no redraw)

The sheet and the composition text stay unchanged as the reviewed record. The corrections are in [`composition.md` §5](composition.md#5-corrections-after-the-independent-review-supersede-the-text-above), and they supersede the claims concerned. The sheet is **not** redrawn this round, because the owner asked to avoid another long cycle of object revisions. Its overclaims are superseded by §4.1 and composition §5.

## 5. Files

| File | What | Commit order |
|---|---|---|
| [`brief.md`](brief.md) | design target: frozen M3 §5 steps 1–6, with the report plan fixed in advance | `ff0b4a2`, before any drawing or computation |
| [`holdout-biwa-sheet.png`](holdout-biwa-sheet.png) | original design drawing: front, side, end view, three-quarter sketch, section strip, pegbox flat pattern, silhouettes at 96/48/24 px, read-outs | after the brief |
| [`source/holdout_sheet.py`](source/holdout_sheet.py) | draws the sheet from the brief's numbers (Pillow). It contains no operator or diagnostic code | after the brief |
| [`composition.md`](composition.md) | worked O1/O2/O3 composition, frozen-principle read-outs, transfer against expectation, failures and limits | after the brief |
