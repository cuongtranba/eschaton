# ART-1 Raven: owner decision packet (2026-11-27)

- Status: **PARTLY DECIDED.** The owner decided ART-D1, ART-D2, ART-D3a and ART-D3b on 2026-11-27 (§0). ART-D3c is not authorized. A revised B-2 flight concept is pending a new owner ART-1 decision (§7). §1–§6 are the original decision request, kept unchanged as the record of what the owner was shown.

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

The original request follows.

- Original status (before §0): **DECISION REQUEST. Nothing here is decided, approved or adopted.** This packet asks the owner for three separate decisions:
  - an ART-1 concept choice;
  - whether to adopt the ART gates;
  - whether to adopt the Visual Bible.

  None of them is implied by the owner having asked for this work, by the independent reviewer's recommendation, or by a merge of this documentation (GOV-1).
- Base: `main` @ `583d56328016c7529fcb405900f09ba4492c9a9a` (main CI run 45945237316, green). Branch `docs/art-direction-visual-bible`. This is a docs and artwork change only. `packages/*`, `apps/*`, `experiments/*`, `AGENTS.md` and the adopted GEO gates are unchanged.
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
- **Finger count.** "About four fingers" comes from one verified source (Corvid Research) and has not been checked against specimens.
- **Unavailable sources.** Cornell All About Birds pages could not be opened.
- **Preview.** No local gallery is running. Another Eschaton chat reported, on 2026-11-27, that the owner had asked for every preview server to be stopped. The images are viewable directly from the paths above. A restart command for an optional loopback gallery is in the PR description.
