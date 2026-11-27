# ART-1 Raven: owner decision packet (2026-11-27)

- Status: **PARTLY DECIDED.** The owner decided ART-D1, ART-D2, ART-D3a and ART-D3b on 2026-11-27 (§0). ART-D3c is not authorized. The B-2 flight revision went through two independent reviews (§7). Its latest reviewed version, **B-2 v5, was reviewed NEEDS REVISION and then NOT APPROVED by the owner** (ART-D3b, second ruling, §0.1): the concept is to be revised by a method that is generic for all objects, not bird-specific. The proposed generic method, the next B-2 version and their reviews are in §9. Open owner decisions and feasibility hypotheses are in §8. §1–§6 are the original decision request, kept as the record of what the owner was shown. Later edits to them are only notes marked as later: two link and status notes in §1 for the adopted files, a finger-count update in §6, and the base note below.

## 0. Owner decisions recorded (2026-11-27)

**Source.** The owner's explicit message, relayed to the agent in the Kanna handoff "Art Direction adoption, Concept B flight revision, and PR #13 merge" dated 2026-11-27. **Recorded by the agent.** This is not a GitHub human review and the identity is not cryptographically verified.

| ID | Decision | Exactly what it covers | What it does not cover |
|---|---|---|---|
| **ART-D1** | **Adopt ART-0…ART-5** | The gates, now at [`docs/governance/art-quality-gates.md`](../governance/art-quality-gates.md), with an "Art direction" section in `AGENTS.md` (to which `CLAUDE.md` is a symlink) | Any change to GEO-0…GEO-7, which ART complements and never replaces or weakens; any automated enforcement or ruleset change (none was made) |
| **ART-D2** | **Adopt the Visual Bible** | [`docs/art/visual-bible.md`](../art/visual-bible.md) as the artistic reference for object form | Precedence over the master plan or accepted ADRs; any claim of physical feasibility |
| **ART-D3a** | **Select Concept B, "Sumi Sculptural Raven", perched, as the artistic direction** | Sheet B v4, `docs/art/raven-concepts/raven-concept-b-sumi.png`, SHA-256 `554069333c47d2c8adde05f0fa4866be5d278d27873807cac7e76a694ec4f74f` (verified against the file on 2026-11-27; first committed in `e777efd`) | Final object quality; geometry; foldability; A or C (neither is approved); B's open defects in §3 (the hackle bib, the front column and the dark triangles stay open and are not silently redesigned); the tolerances of ART-D3c |
| **ART-D3b** | **Revise B-2's wing and flight pose before approval** | B-2 v3 (`raven-concept-b2-sumi-flight.png`, SHA-256 `60887d90…2122672`) is **not approved as drawn**. B-2 stays pending revision and review | It is not an approved flight design. A revised B-2 does not inherit any approval |
| ART-D3c | Numerical tolerances for ART-4 | **Not authorized.** The values in the concept README §E.0 stay proposals | — |
| Merge | PR #13 may be merged after the decisions are recorded and review and CI are satisfactory | **This PR only** | Under GOV-1, the merge approves no concept, no tolerance, no geometry and no phase gate |

**Unchanged by these decisions:**
- Phase 3 stays open, and Phase 4 is not authorized. P3D-2 has not been given.
- Q1–Q6 and ADR 0019 keep their current statuses.
- No Geometry V4 work is authorized. PR #11 is untouched.
- Historical sheets, review records, digests and provenance are kept. A new sheet version or a material change (ART §2.5) is a new file with a new digest. It is `NOT VERIFIED` until the owner decides on it.

### 0.1 ART-D3b, second ruling: B-2 v5 not approved (2026-11-27)

**Source.** The owner's explicit message, relayed to the agent in the Kanna handoff "Generalized Object Form & Construction Design, B-2 V5 rejection" dated 2026-11-27, issued against `main` @ `5886475d04db76f58105080f63d01426d2d72311` (the PR #13 merge). **Recorded by the agent.** This is an owner instruction relayed to the agent. It is not a GitHub review or approval, and the identity is not cryptographically verified.

| ID | Decision | Exactly what it covers | What it does not cover |
|---|---|---|---|
| **ART-D3b (v5)** | **NOT APPROVED; revise the concept** | Sheet B-2 v5, `docs/art/raven-concepts/raven-concept-b2-sumi-flight-v5.png`, SHA-256 `888cf4a5bb0178057914847f0ffea9d581540c0f6c411f821fedea752c2b0942`, and its details board `raven-concept-b2-v5-details.png`, SHA-256 `dfb18c3ce480af64bda9de1318dcd63c66146ea375a982eec5e03416205e02b9`. Both were first committed in `41c383f`; the digests were re-verified against the files at `5886475` | Sheet B (perched): it stays the selected direction under ART-D3a at `554069333c47…4f74f`. ART-D3c: it stays undecided. Any change to a policy, gate or standard |

The owner's words, verbatim: *"kêu kanna sửa lại theo đánh giá của bạn, nhưng hướng sửa phải là generic cho toàn bộ vật thể chứ không gói gọn theo hình chim"*. In English: have the agent revise according to the reviewer's assessment, but the direction of the fix must be generic for all objects, not confined to the bird shape.

What the ruling instructs, as recorded:
- The revision answers the independent round-2 review of v5 (§7.2) **and** the owner's reading of the v5 pixels relayed in the handoff. The wing layering and the silhouette improved. Still wrong: the head reads banded from the top and from below; the front body reads as a block; the inner arm is close to a rectangle; there is a pinhole at the tail root; there are slivers at the mouth and the wrist; there are lines that mark no form change; and the depth is shallow.
- The method of the fix must be a generic form-design method that applies to every object category. Raven-only corrections do not meet it.
- The perched direction (Sheet B) stays selected. Whether the perched sheets and the flight sheets are one folding stays unverified (§8.2, H8).

B-2 v3, v4 and v5, their digests and their review records (§3 and §7) are kept unchanged as history. A next B-2 version is a new file with a new digest and inherits nothing (ART §2.5). The ruling authorizes the agent to record it and to revise the design. It does not adopt any new policy, approve any artwork, or authorize a merge, Geometry V4, Phase 4 or any phase transition.

The original request follows.

- Original status (before §0): **DECISION REQUEST. Nothing here is decided, approved or adopted.** This packet asks the owner for three separate decisions:
  - an ART-1 concept choice;
  - whether to adopt the ART gates;
  - whether to adopt the Visual Bible.

  None of them is implied by the owner having asked for this work, by the independent reviewer's recommendation, or by a merge of this documentation (GOV-1).
- Base: `main` @ `583d56328016c7529fcb405900f09ba4492c9a9a` (main CI run 45945237316, green). Branch `docs/art-direction-visual-bible`. This is a docs and artwork change only. `packages/*`, `apps/*`, `experiments/*`, `AGENTS.md` and the adopted GEO gates are unchanged. *(This was true at the time of the request. After §0, `AGENTS.md` gained the "Art direction" section, and `README.md` gained index rows. The code and the GEO gates are still unchanged.)*
- Experimental evidence referenced, all read-only and untouched:
  - draft PR #11 @ `616b0cfd316522d038e804cab9eaf04bc715bb59` (CI run 45952369746 green);
  - V3 gate evidence: `docs/research/origami-lab-v3/gate-evidence.md` on that branch, with screenshots under `docs/screenshots/exp-origami-v3-*`.
- Phase status is unchanged:
  - Phase 3 stays open.
  - Phase 4 is not authorized.
  - ADR 0019 is Proposed.
  - No Geometry V4 work was done.

## 1. What to look at

The three sheets and the two comparison boards are open in this order:

1. [Comparison board: A · B · B-2 · C side by side](../art/raven-concepts/raven-concepts-comparison.png)
2. [Sheet B: sumi sculptural raven, perched](../art/raven-concepts/raven-concept-b-sumi.png) and [Sheet B-2: its flight study](../art/raven-concepts/raven-concept-b2-sumi-flight.png)
3. [Sheet A: anatomical folded raven](../art/raven-concepts/raven-concept-a-anatomical.png)
4. [Sheet C: modular tessellated raven](../art/raven-concepts/raven-concept-c-modular.png)
5. [Why V3 failed, against A and B](../art/raven-concepts/v3-failure-anatomy.png)

Supporting documents:
- [Visual Bible](../art/visual-bible.md) (proposed at the time; adopted since, §0)
- [ART-0…ART-5](../governance/art-quality-gates.md) (proposed at the time as `art-quality-gates-proposal.md`; adopted and renamed since, §0)
- [Concept README with construction feasibility](../art/raven-concepts/README.md) (§E)
- [Sources](../research/art-direction-sources.md)

## 2. Artwork identity (what a decision would refer to)

| File | Version | SHA-256 |
|---|---|---|
| `docs/art/raven-concepts/raven-concept-b-sumi.png` | Sheet B v4 | `554069333c47d2c8adde05f0fa4866be5d278d27873807cac7e76a694ec4f74f` |
| `docs/art/raven-concepts/raven-concept-b2-sumi-flight.png` | Sheet B-2 v3 | `60887d90ea23c0bfe5df8b31aa8d2f84ba4be3becc40133e40acef9dc2122672` |
| `docs/art/raven-concepts/raven-concept-a-anatomical.png` | Sheet A v4 | `93c01eabd6f645840c087d79dfd3a6f551995be1d83a6502637294b98c8dc188` |
| `docs/art/raven-concepts/raven-concept-c-modular.png` | Sheet C v2 (relit) | `c8b8a9c0a65db5953c40545e18e07905f9ec02f0025bdcb586feee9f8c4df9e8` |
| `docs/art/raven-concepts/raven-concepts-comparison.png` | Board, four columns | `a843fafdf07dc1f1c80dd13514f65cca94125c3fd5601d794c9dd5b3655a1d54` |
| `docs/art/raven-concepts/v3-failure-anatomy.png` | Board, V3 / A / B | `52026db3ac7f1be8cc8ad711f9f14aba3779195a8fee8774c38e1ec49ef9df20` (caption text corrected after round 4; images unchanged) |
| `assets/reference/visual-direction.png` | Reference (unchanged) | `0e29980ebefff5dc629c44d0ec2dec35c71b951aba43c8c2d2b7078e8523fba0` |

All sheets are maquette renders: Blender 5.2.1 headless plus Pillow, with no imported or generated meshes, no AI imagery and no external artwork. Their sources are in `docs/art/raven-concepts/source/`. Every sheet is labelled "PROPOSED CONCEPT ARTWORK, pending owner ART-1 review, NOT approved, NOT implemented geometry".

## 3. Independent visual review

The reviewer was a separate agent that made none of the artwork and read none of the source. It judged the pixels only, against rubric R1–R9:

| # | Rubric item |
|---|---|
| R1 | Raven read |
| R2 | Silhouette at hero and district scale |
| R3 | Hierarchy |
| R4 | Proportion and anatomy |
| R5 | Paper language |
| R6 | Turnaround consistency |
| R7 | Fit with the reference |
| R8 | Sheet completeness |
| R9 | Avoids the named V3 defects |

Four rounds were run. Each revision changed the pixels, so each round started from void verdicts (GEO §1.10).

| Concept | Round 1 | Round 2 | Round 3 | **Round 4 (final pixels)** |
|---|---|---|---|---|
| **B: sumi, perched** | credible | credible | credible | **CREDIBLE CONCEPT FOR OWNER REVIEW.** R1–R9 PASS; R5 weak |
| **B-2: sumi, flight** | (did not exist) | needs revision | needs revision | **NEEDS REVISION**: show it only as a flight-direction sketch with the hand flagged open |
| A: anatomical | needs revision | needs revision | needs revision (regressed) | **NEEDS REVISION**: may appear as a labelled comparison column |
| C: modular | NO-GO | NO-GO as a separate direction | NO-GO | **NO-GO** |

**The reviewer's final ranking:** B (with B-2 as a flagged flight sketch), then A, then C.

**The reviewer's verdict on the set:** "adequate for an ART-1 **direction** decision with B as the lead … not adequate for approving flight geometry."

**Open defects at the final pixels**, as named by the reviewer:

| Concept | Open defects |
|---|---|
| B | the hanging hackle strip and the covert leaf read as a flat bib in the shaded head close-up, although the silhouette still reads shaggy; the front view still reads as a hooded column; small dark triangles inside the wing planes in the side view and the folded-wing close-up (possibly intersecting maquette geometry) |
| B-2 | the near hand reads as a four-tine claw of almost parallel blades; the hand plate still reads separate, with a near-vertical trailing edge; the arm is one large flat trapezoid; a stray fragment sits in the arm close-up |
| A | the near hand reads as a rake; a hard flank band in the side view; a dark patch inside the back outline where wing-root plates show through; a boxy hackle tab; slat-like paper language |
| C | comb block in the side view; heraldic top view; gill-like hackles; it depends on A's head |

**Fixed across the rounds**, as confirmed by the reviewer:

| Concept | Fixed |
|---|---|
| B | nape break, eye height, arched bill, tail length, throat star, shading smudges, post excluded from silhouette tests |
| B-2 | flight state added, cuff seam removed, finger graduation |
| A | straight bill, then the overcorrected hook; dorsal spikes in the outline; hackle rosette; close-up crops |
| C | conical head and body rings (by borrowing A, which is why it is no longer a separate direction) |

Process notes:
- After round 4, only the failure board's caption text changed. It now marks A's near hand and B-2's hand plate as open, instead of the earlier overclaim. Its images are identical, but the board's file digest changed, so its verdict at the new digest is formally **NOT VERIFIED**.
- The full reviewer reports are summarised here. The reviewer's crops were stored outside the repository, under `/tmp/review-crops/`, and are not committed.

## 4. Recommendation (not an acceptance)

**Recommendation: approve concept B, the sumi sculptural raven, as the ART-1 direction.** Treat B-2 as its flight direction, with the hand explicitly open for revision before any flight geometry is drawn as a target. Here B is the agent's recommendation and also the independent reviewer's first-ranked concept, and neither is an acceptance.

Why B:
- It is the only concept that held a raven read, a clean silhouette at 24 px and a fit with the reference through all four review rounds.
- Its plane language (few large folds, a dorsal ridge, blades) is the closest to Kyōsai's single-mass crows and to the woodcut world.
- It has the lowest construction scope: 5 module families and about 15–25 instances.
- Its few large parts give the clearest Collapse story (concept README §E.2 and §E.4).

What approving B would **not** do:
- It would not approve B-2's hand, A or C.
- It would not adopt the ART gates or the bible.
- It would not authorise Geometry V4, Phase 4, or any change to Q1–Q6 or ADR 0019.
- It would not make B's perched-to-flight re-fold a proven fact.

Alternatives:
- **Select A** if anatomical wing tiering matters more than ink-world fit. Its open defects must be fixed first.
- **Revise** if B's flat throat bib or front column are unacceptable to you.
- **Reject all** if none of these is the right artistic DNA. In that case the bible and the gates still stand on their own as proposals.

C is not recommended in any form: its own idea, modular repetition, failed review in every round. That is recorded as evidence for the bible's "repeated geometric noise" anti-pattern.

## 5. Decisions requested

Each line is a separate decision. Please answer each one, or leave it open.

| ID | Decision | Options | Note |
|---|---|---|---|
| **ART-D3a** | ART-1 Raven concept | **approve B** (with B-2 as its flight direction) · **select A** · **select another** · **revise** (say what) · **reject all** | Approval would record the digests in §2. A material change later voids it (proposed ART §2.5) |
| ART-D3b | If B is approved: B-2's flight hand | approve as drawn · approve the direction with the hand open for revision · revise before approval | The reviewer's view is in §3 |
| ART-D3c | Tolerances for later ART-4 comparison | accept the proposed targets (concept README §E.0) · edit | Proportions only; they are not a geometry contract |
| **ART-D1** | ART-0…ART-5 gates | adopt · edit · defer · reject | Adoption would add one `AGENTS.md` line and rename the file. No CI enforcement |
| **ART-D2** | Visual Bible as the canonical reference for object form | adopt · edit · defer · reject | It complements master plan §2, ADR 0006 and `look-dev.md`, and does not replace them |
| — | Merge of this documentation PR | merge-only authorisation, separate from everything above | Merging approves nothing (GOV-1) |

Not asked here, and not affected by anything above: Q1–Q6, ADR 0019, Phase 3 exit, Phase 4, PR #11, Geometry V4 implementation.

## 6. Open limitations

- **Foldability.** No concept is shown to fold. All construction claims in the concept README §E are hypotheses: foldability, collision, closure, bonds, thickness, and the perched-to-flight re-fold of B and B-2.
- **Medium.** These are maquette renders, not brush drawings. The ink panels approximate woodcut without gouge texture. The heroes are neutral cream paper, so the raven's black identity shows only in the silhouettes and the ink panels.
- **Moving pieces.** Hatching for moving pieces, such as a flying raven, is an open owner question under ADR 0006.
- **Finger count.** "About four fingers" comes from one verified source (Corvid Research) and has not been checked against specimens. *Update, 2026-11-27 (§7):* a second Corvid Research post states it directly ("ravens only have four (feathers 6-9)"), and Featherbase's narrowing pattern (H6–H9 outer vanes, H5 only hinted) agrees. Both were verified, but neither is a specimen study, and the blog posts are unsigned.
- **Unavailable sources.** Cornell All About Birds pages could not be opened.
- **Preview.** No local gallery is running. Another Eschaton chat reported, on 2026-11-27, that the owner had asked for every preview server to be stopped. The images are viewable directly from the paths above. A restart command for an optional loopback gallery is in the PR description.

## 7. B-2 flight revision under ART-D3b (2026-11-27)

Design only. No Foldon, package, app or Geometry V4 change. Nothing in this section is approved. B-2 stays **pending the owner's ART-1 decision**.

- Design target: [`b2-v4-flight-brief.md`](../art/raven-concepts/b2-v4-flight-brief.md), committed in `6a26c50`, before any drawing.
- Anatomy evidence: brief §3. The four-finger count rests on a verified but unsigned source (Corvid Research, 2018). The vane narrowing and the longest primary (P6 or P7) come from Featherbase, also verified.

### 7.1 B-2 v4 and its independent review (round 1)

| File | SHA-256 | Commit |
|---|---|---|
| `raven-concept-b2-sumi-flight-v4.png` (Sheet B-2 v4) | `a9a61b68971dd961224b771c4e6456e9a87f3cfd8688a0f9ac41a7bef5752e28` | `e519ea1` |
| `raven-concept-b2-v4-details.png` | `1ac6100585994b976d664360a33d5f881ebf39704cbfd5b56e06294cc9991991` | `e519ea1` |

The reviewer was a separate agent that made none of the artwork and read none of its sources or the brief. It judged the pixels of the files above, by crops, against ART-2, R1–R9 and the v3 defects D1–D6.

**Verdict: NEEDS REVISION.**

| Item | Finding |
|---|---|
| D1 rake hand | partly fixed: the fingers fan and graduate, but they are one repeated unit of equal width with the same notch step |
| D2 hand plate | partly fixed from above; the underside still shows a rectangular arm and blades radiating from a wrist hub (glove read) |
| D3 plank arm | partly fixed in the hero; constant chord in the top and underside views; the front-elevation hem reads as a slab |
| D4 stray fragment | fixed |
| D5 cylinder head | fixed in profile; head bands remain in the top and underside views |
| D6 ruff debris | partly fixed: there is a see-through gap under the jaw, and the hackle strip stands off the neck as a hoop in the top and underside views |
| New | Side view clipped at the top. A floating sliver in the side view. Dangling lines and an unreadable alula at the wrist. Far-hand close-up cropped. One "matched" before/after pair not matched. No dark-field silhouettes at 48 or 24 px. Thin hero tail. District caption overruns its frame (a template issue that B's sheet shares) |
| ART-2 | 2.1 PASS · 2.2 NOT VERIFIED · 2.3 PASS (weak) · 2.4 PASS (weak) · 2.5 FAIL · 2.6 FAIL |
| R1–R9 | R1, R2 (light), R3, R4 (weak), R5 (weak) and R7 PASS · R6, R8 and R9 FAIL |

The reviewer also found the author's "What changed" panel overstated for D1, D3 and D6. B-2 v4 is kept unchanged as the reviewed record.

### 7.2 B-2 v5 and its independent review (round 2)

B-2 v5 answers the round-1 findings in new files. B-2 v4 is unchanged. The changes, and two narrowings of the brief, are in the brief §10: the alula was omitted because it did not read, and the arm's taper comes from the planform.

| File | SHA-256 | Commit |
|---|---|---|
| `raven-concept-b2-sumi-flight-v5.png` (Sheet B-2 v5) | `888cf4a5bb0178057914847f0ffea9d581540c0f6c411f821fedea752c2b0942` | `41c383f` |
| `raven-concept-b2-v5-details.png` | `dfb18c3ce480af64bda9de1318dcd63c66146ea375a982eec5e03416205e02b9` | `41c383f` |

The reviewer was a new agent that made none of the artwork and saw neither the round-1 reviewer's process nor the author's. It read none of the sources, the brief or the README. It judged the pixels of the files above, by crops, against ART-2, R1–R9, D1–D6 and every §7.1 finding.

**Verdict: NEEDS REVISION** ("close"; the remaining defects "look fixable as cleanup without redesigning the wing").

| Item | Finding |
|---|---|
| Fixed since v4 | the jaw gap, the neck hoop, the side-view clipping, the floating sliver, the far-hand crop, the mismatched before/after pair, the missing dark-field 48/24 px silhouettes, the district caption |
| D1 rake hand | partly fixed: the fingers fan about 35° and graduate in length; the near-hand widths stay nearly equal and the notch steps fall on one diagonal |
| D2 hand plate | partly fixed: no plate, and the wrist hub is hidden from below; from above the primaries still spray from one wrist point |
| D3 plank arm | partly fixed: the front view curves and tapers; the inner arm from above is close to a rectangle, and the underside shows a light rectangular panel with straight ends |
| D5 head | partly fixed: B's dome and bill in profile; 4–5 bands across the head in the top and underside views |
| D6 throat | partly fixed: the hero is clean; dark shards at the bill base (underside view) and pale slivers at the mouth corner (head close-ups) |
| New | a pinhole at the tail root in the underside silhouettes; a tan tab at the hero wrist; loose strips under the arm (front-elevation close-up); broken dashes on the side-view lower wing; the front-view body reads as a block; the fingers start abruptly after the rounded inner blades; the head close-ups are captioned "B's profile" although they are three-quarter views; the "keeled wedge tail" label has no leader; the tail is lost at 24 px in three-quarter |
| ART-2 | 2.1 PASS · 2.2 PASS (weak) · 2.3 PASS · 2.4 PASS (weak) · **2.5 FAIL** (lines marking no form change, banded head, single-point fan) · 2.6 PASS |
| R1–R9 | R1, R3, R6 and R7 PASS · R2, R4, R5 and R8 PASS (weak) · **R9 FAIL** (D3 and D5 only partly fixed in the top and underside views) |

The reviewer found three overclaims in the author's "What changed" panel on the v5 details board:
- "fewer rings": the top view still has 4–5 bands;
- "each has its own width and notch": the near-hand widths are nearly equal;
- "coverts hide the wrist hub": true from below only.

The panel is labelled as a self-assessment. Its pixels were left unchanged so that the reviewed file keeps its digest. **This record supersedes those three claims.**

### 7.3 State of the flight concept

- *Later note (2026-11-27, §0.1):* the owner did **not approve** B-2 v5 and asked for a revision by a generic method. The bullets below are the state as it was recorded before that ruling.
- **B-2 is not credible yet.** v3 is not approved (ART-D3b). v4 and v5 are both NEEDS REVISION. The revision was stopped at v5 to keep the handoff bounded; it was not forced to a pass. The open defects are the §7.2 list. They are cleanup-level in the reviewer's judgement and do not need a wing redesign, but **that judgement is not an approval**.
- Every B-2 file stays **`NOT VERIFIED` for ART-1** until the owner decides. A later B-2 v6 would be a new file with a new digest and would need its own independent review. None of v3, v4 or v5 inherits anything.
- **Sheet B (perched)** stays the selected direction (ART-D3a) at `554069333c47…4f74f`. B-2 v4 and v5 reuse B's head profile but **do not change Sheet B**. B's own open caveats (§3) are still open.

## 8. Open owner decisions and feasibility hypotheses

### 8.1 What remains for the owner

| ID | Question | State |
|---|---|---|
| ART-1, B-2 | Approve, revise or reject the flight concept. **B-2 v5: NOT APPROVED** by the owner (§0.1). The next version is in §9 | open for the next version |
| ART-D3c | Numerical tolerances for ART-4 (concept README §E.0) | not authorized; open |
| B caveats | Whether B's bib, front column and dark triangles (§3) need a revision of Sheet B | open (not raised by the owner) |
| ADR 0006 | Whether moving pieces, such as a flying raven, carry hatching | open |

Not affected by this packet or by the merge of PR #13 (GOV-1):
- the Phase 3 exit (open) and P3D-2 (not given);
- Phase 4 (not authorized), and any Geometry V4 work;
- Q1–Q6 and ADR 0019 (Proposed), and ADR 0018 (Proposed);
- PR #11 (draft, untouched);
- final visual acceptance (ART-5).

### 8.2 Feasibility hypotheses for B and B-2 (proposed, not proven)

None of this is evidence for any GEO gate. These are the hypotheses a later Geometry V4 brief would have to test (GEO-0.5, GEO-0.6, GEO-1, GEO-7). Each names the open decision it depends on.

| # | Hypothesis | Depends on | Known limitation now |
|---|---|---|---|
| H1 | The wing root, wrist and finger ports can be typed seams on **non-axis edges** (fingers fan at about −43° to −7° from the span) | **Q1** (non-axis seams) | Foldon placement is quarter turns about +Y on a cell lattice (`AGENTS.md`); a non-axis seam is undecided |
| H2 | The covert leaves, the under-wing coverts and the hem attach without folding | **Q2** (`join` edge kind) | A non-folding `join` edge kind is undecided (Q2) |
| H3 | The nine blades per wing are one **parameterised family** (length, width and notch position), not nine definitions | **Q3** (parameterised families) | Definitions are immutable; whether families exist is undecided (Q3) |
| H4 | The pentagonal head and body shell can close | **Q4** (closed crease networks) | Creases form a tree (`AGENTS.md`); a closed shell leaves an open seam |
| H5 | The raven is placed in districts as a single prop or agent | **Q5** (object grammar in Genesis) | Object grammar in Genesis is undecided (Q5) |
| H6 | Its definitions version cleanly | **Q6** (catalog versioning) | Undecided |
| H7 | Collapse releases tertiary layers, then secondary tiers, then the main mass, along existing creases (bible §7) | **ADR 0019** (support and bond failure; **Proposed**, not accepted) and Phase 4, which is not authorized | Detach semantics are proposed only (ADR 0019) |
| H8 | B perched and B-2 in flight are **one folding of the same sheets** | — | **Weaker since v4.** B's folded wing has 3–5 sheets per side. B-2 v5 has about 13 parts per wing, including the under-wing coverts. Either they are hidden in the folded state, or the two poses are not one folding. Unproven |
| H9 | The maquette's planes can become valid Foldon panels | GEO-1 | **No.** The maquettes guarantee neither planarity nor convexity (the primary-covert leaf is a concave polygon). Overlapping layers have zero thickness, and collision is not checked |

**Material change rule (ART §2.5, GEO §1.10).** Any change to the silhouette, proportions, hierarchy, pose or plane language of a reviewed sheet returns its verdicts to `NOT VERIFIED`, until a reviewer inspects the new pixels. An owner approval would be voided the same way. A new version is a new file, and it inherits nothing.

## 9. Generic form method and the next B-2 version (under ART-D3b, second ruling)

Design only. No Foldon, package, app or Geometry V4 change. Nothing in this section is approved. It is filled in by the later commits of the same branch, in order: the proposed method, the briefs committed before any artwork, the cross-category design studies, the next B-2 version, and the independent reviews.

### 9.1 What was produced (round 1, evidence `57da41b`)

| Item | File | SHA-256 | Commit |
|---|---|---|---|
| Proposed method (not adopted) | [`docs/art/form-construction-method.md`](../art/form-construction-method.md) | — (text) | `449406b`, before any study or v6 artwork |
| B-2 v6 brief | [`b2-v6-flight-brief.md`](../art/raven-concepts/b2-v6-flight-brief.md) | — (text) | `a400997`, before any v6 artwork |
| Sheet B-2 v6 | `raven-concept-b2-sumi-flight-v6.png` | `793ecc828cc26496730c242367c6d515eb4bc75547e5945c8457b494929dd7ea` | `6c2334a` |
| v5 beside v6 | `raven-concept-b2-v6-compare.png` | `12ba8c8f4f208ea8a963deb742609545c6c584bd6ee461229bf9433d18b07c39` | `6c2334a` |
| v6 method board | `raven-concept-b2-v6-method.png` | `24e77fd7b9813f5659dbc5ce092f3dcbd29070b0feabc38f02bb3823f8b23440` | `6c2334a` |
| Form studies (vehicle, building, tree) | [`docs/art/form-studies/`](../art/form-studies/README.md) | listed there | `57da41b` |

### 9.2 Independent reviews, round 1

Three reviewers, each a separate agent that made none of the artwork and none of the method. The two pixel reviewers were told not to read the sources, briefs or method before writing their pixel findings. The method reviewer read the method, the adopted bible and gates, the evidence and the git history. Their crops were kept outside the repository (`/tmp/review-*`). Every verdict is a recommendation.

**B-2 v6: NEEDS REVISION.**

| Item | Finding |
|---|---|
| Fixed, and confirmed as form changes (they survive the old drawing in the control panel) | the inner arm converges to the wrist; the tail-root pinhole is gone; the underside covert panel has no straight ends; the near-hand notches are staggered |
| Partly fixed | head bands (2–3 left from the top, and the old drawing brings the rings back, so part of this was a drawing change); the front body is a faceted lump rather than a block; slivers at the mouth and a tan strip at the wrist remain; lines that end mid-panel (underside coverts, side wing, tail close-up); volume mostly from shading; finger roots still meet at one wrist point in the hero and from below; inner blades still jump to fingers on the far hand |
| Blocker | the hero crops the far wing's longest fingertips, so the label "fingers P6–P9, P7 longest" cannot be checked |
| Major | the eye is missing in every view (identity with Sheet B weakened); smooth shading across the crown, throat and belly reads as computer-modelled shells, which the reviewer calls shader rescue (ART-2.5) and a step away from B's flat planes (R5); in the top-view hierarchy diagram, wing-root and fairing parts lie over the back and halve the visible body |
| Overclaims | the sheet says 94 declared panels, the method board 102; "roots spread"; "tab and slivers to rooted covert leaf"; "head from above: crown plane" (a smooth bulge); "lines only on declared edges"; "deep breast, broad back" from above; the drawing control summarised as clean support when it is mixed |
| ART-2 | 2.1 PASS (weak) · 2.2 PASS (weak), dark-field small sizes not shown · **2.3 FAIL** · 2.4 PASS (weak) · **2.5 FAIL** · 2.6 PASS |
| R1–R9 | R1, R2, R4, R8 PASS (weak) · R6, R7 PASS · **R3, R5, R9 FAIL** |

**Form studies:** vehicle **CREDIBLE STUDY** (major: the top view runs off its panel and is at a different scale; the arch lips read as hoops standing off the body). Building **CREDIBLE STUDY** (major: the corrugation radiates from the finial through the corners, so the hips do not read and the top view is a sunburst). Tree **NEEDS REVISION** (major: the crown lies nearly in one plane, which is the heraldic-spread anti-pattern in the front and top views; the fork reads as prisms pushed into a stump). The reviewer also found README overclaims about the tree fork, the vehicle lips and the vehicle plan.

**Method: NEEDS REVISION.** The reviewer kept the layers, vocabulary, junction, envelope and attachment ideas and the "decide before the tool decides" procedure as object-generic, and found the status labels disciplined. The findings were:
- **B1:** the holdouts were not blind. The committed method already described the building and tree solutions, and the befores are reconstructions. They show that the procedure can be executed, not that the principles transfer blind.
- **M1:** the P5 revision was fitted to one example. It has no negative control, it was never computed, and it would flag the tier progressions that bible §4.3 endorses.
- **M2:** P7 flags any box in an orthographic view and misreads bible §4.5 ("two values plus line").
- **M3:** the P1 descriptors are ill-defined: normalised aspect, peak degenerate on symmetric masses, frame unstated.
- **M4:** a hidden-surface exemption was added to the tool mid-study without a §12 entry, and the building's visible soffit was classed as hidden.
- **M5:** pixel contradictions in the transfer matrix.
- **M6:** a bent panel has no Foldon representation (panels are planar), and this was not listed as open.
- **M7:** declarations (prismatic, tessellation, B junction, hidden, fold) act as escape hatches without a legitimacy test.
- Minors: brief deviations not logged; a study brief reinterpreting the bible's asymmetry rule; the §5 "every object" wording; P3 undefined at limb roots; weak threshold reasons.

### 9.3 Bounded response

One revision round answers these findings. Then one re-review, and the work stops at that result, whatever it is. The round-1 files and their digests stay unchanged as the reviewed record. The response is in §9.4.
