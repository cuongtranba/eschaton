# Gate evidence — hero bird V2 (experimental)

- Spec: [`../geometry-quality-gates.md`](../geometry-quality-gates.md) (proposal, not adopted).
- Geometry commit: `e8082a8`, branch `experiment/origami-lab-v2`, pushed to the draft PR #11 branch `experiment/origami-expressiveness-lab`. All screenshots and `evidence.json` were captured from a page whose banner reads `experiment/origami-lab-v2 @ e8082a8` with no uncommitted marker (§5.3).
- Status: **no gate is closed.** The [A] results are machine output. The [H] verdicts are the *independent reviewer's* (§7), not the implementer's. Owner approval is pending for everything.

## Summary

| Gate | Verdict | Why (short) |
|---|---|---|
| GEO-0 Principle and brief | **PASS** (A + H self-check; owner review pending) | Brief, references and 3-view target were committed before or with the first geometry code. The iteration log records the design changes |
| GEO-1 Geometric validity | **NOT VERIFIED** (no FAIL) | 0 collisions, 0 invalid panels, 0 invalid definitions on 14 variants. 24–30 vertex-sharing pairs per variant are certified only up to u ≈ 0.95 of their fold, or not at all for 3 variants (see §GEO-1) |
| GEO-2 Morphology | see the round-2 review below | [H] |
| GEO-3 Expressiveness | **NOT VERIFIED** | Depends on GEO-1 being PASS and GEO-2 being accepted. Diversity is measured; reuse in a second object is not demonstrated |
| GEO-4 Motion and fold | **NOT VERIFIED** | Crease transforms, fixed joints and symmetric flap are tested. Fold sweeps are not fully certified (GEO-1) |
| GEO-5 Visual evidence | see the round-2 review below | [H]; the reproducibility parts are A-PASS |
| GEO-6 Engineering readiness | **NOT VERIFIED** | Production untouched, deterministic, tested. CI on the exact head is recorded at push time; it is not production-ready by design (Q1–Q6 undecided) |

## GEO-0 — Principle and brief

| # | Verdict | Evidence |
|---|---|---|
| 0.1 | PASS [A] | `git log --follow docs/research/origami-lab-v2/bird-design-brief.md`: the brief is in the first V2 commit `0df8d54`, together with the code. The 3-view target was plotted from the brief's tables before implementation |
| 0.2 | PASS [H, self] | Brief §3: R1–R8. Crow, gull and sparrow data (RSPB, Wildlife Trusts, NHM); Mitani & Suzuki 2004; Demaine & O'Rourke 2007; Tachi 2009; Belcastro & Hull 2002; Lang 2011. No asset was imported or traced |
| 0.3–0.6 | PASS [H, self] | Brief §4–§8 (shape language; ratios; topology table with the reason for each fold; modular papercraft vs one-sheet stated; non-claims listed) |
| 0.7 | PASS [H, self] | Brief §7: three rejected alternatives |

## GEO-1 — Geometric validity (automated; `evidence.json`, `test/v2.test.ts`)

Per-variant results at `e8082a8`.

- Pair counts are `analytic / static / certified / sampled` over every sweep: the fold of each piece, the articulation, and the rest pose.
- "certified until" is the smallest u from which some pair is only sampled.

| Variant | Faces | Pieces | Collisions | analytic / static / certified / sampled | Certified until | Invalid panels | Thin annotated | Seam gap | Rigidity | Flat off-plane | Invalid defs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| crow | 243 | 48 | 0 | 859 / 38655 / 20410 / 26 | 0.953 | 0 | 0 | 5.3e-10 | 5.7e-10 | 1.3e-09 | 0 |
| seed 1 | 243 | 48 | 0 | 859 / 38655 / 20412 / 24 | 0.953 | 0 | 2 | 1.2e-09 | 5.4e-10 | 6.2e-10 | 0 |
| seed 2 | 215 | 44 | 0 | 771 / 31555 / 14624 / 26 | 0.953 | 0 | 0 | 1.6e-09 | 6.1e-10 | 7.7e-10 | 0 |
| seed 3 | 243 | 48 | 0 | 859 / 38655 / 20412 / 24 | 0.953 | 0 | 2 | 1.0e-09 | 5.7e-10 | 9.7e-10 | 0 |
| seed 4 | 243 | 47 | 0 | 860 / 38655 / 20415 / 30 | 0.891 | 0 | 6 | 1.1e-09 | 4.7e-10 | 1.2e-09 | 0 |
| seed 5 | 231 | 46 | 0 | 821 / 35465 / 17876 / 26 | 0.953 | 0 | 0 | 1.2e-09 | 5.3e-10 | 7.2e-10 | 0 |
| seed 6 | 231 | 46 | 0 | 821 / 35465 / 17876 / 26 | 0.953 | 0 | 0 | 9.3e-10 | 4.8e-10 | 6.2e-10 | 0 |
| seed 7 | 231 | 46 | 0 | 821 / 35465 / 17878 / 24 | 0.953 | 0 | 0 | 1.3e-09 | 6.0e-10 | 7.2e-10 | 0 |
| seed 8 | 243 | 48 | 0 | 859 / 38655 / 20410 / 26 | 0.953 | 0 | 6 | 1.1e-09 | 4.7e-10 | 9.0e-10 | 0 |
| seed 101 | 231 | 46 | 0 | 821 / 35465 / 17877 / 25 | 0.953 | 0 | 0 | 1.9e-09 | 5.2e-10 | 5.2e-10 | 0 |
| seed 202 | 243 | 47 | 0 | 860 / 38655 / 20417 / 28 | 0.000 | 0 | 0 | 1.1e-09 | 5.4e-10 | 8.5e-10 | 0 |
| seed 303 | 215 | 44 | 0 | 771 / 31549 / 14630 / 26 | 0.953 | 0 | 0 | 1.4e-09 | 5.9e-10 | 8.6e-10 | 0 |
| extreme min | 215 | 43 | 0 | 772 / 31549 / 14637 / 28 | 0.000 | 0 | 2 | 1.5e-09 | 5.8e-10 | 6.7e-10 | 0 |
| extreme max | 243 | 47 | 0 | 860 / 38655 / 20418 / 27 | 0.000 | 0 | 0 | 1.1e-09 | 5.3e-10 | 8.4e-10 | 0 |

Reading the numbers honestly:

- **0 collisions** means none was found by the certificates *or* by exact tests at 1/64-interval midpoints. It is not a proof for the sampled pairs.
- **Sampled-only pairs (24–30 per variant)** all share a design vertex. They are strip panels that meet only at a glue seam when the strip closes (u → 1), where any distance certificate must run out. For seed 202 and both extremes, one tail-fan pair at the fork notch is near-touching from u = 0; exact tests found no contact.
- **The articulation sweep** (shoulder −30°…+35° plus wrist −20°…+25°, both wings) and the **assembled rest pose** have no sampled pairs: they are fully certified (analytic, static or certified).
- **Thin annotated faces** are primaries and tail vanes the brief marks as intended (GEO-1.2).
- **48 pieces** is a lot of paper. This is the price of collision-free linear fold paths with strip unfolding. A sequenced (non-linear) fold schedule could merge pieces; it is not attempted.

Negative controls (GEO-1.11), all in `test/v2.test.ts` and all passing:

1. A flap folded flat onto its parent: V1's exemption blind spot, now reported.
2. A vertex-sharing fan crossing.
3. Coplanar overlap, with the edge-sharing control.
4. A collision confined between the five V1 sample times, invisible to them and found by the swept check.
5. A V1 mount at lift 0.
6. An articulated edge that would be cut.
7. Regression: the flap was a roll.
8. Regression: V1's 4 % shrink hid a roof/wall interpenetration in the V1 house.

The V1 scan with the exact contact test (`evidence.json → v1ContactScan`, seeds 1–8 at t ∈ {0, .25, .5, .75, 1}):

| Object | Crossing | Edge-touch | Comment |
|---|---|---|---|
| bird | 0 | 0 | — |
| vehicle | 0 | 50 | unglued "closing" seams resting on faces |
| house | 6 | 54 | the roof overhang interpenetrates the right wall at t = 1. V1 reported 0 because of its 4 % shrink; the pair is not in V1's exempt set |
| pine | 0 | 0 | — |

The lattice and the 10° rule: see the spec §3.1. The equilateral counterexample is tested. V2 identity is the hash of the quantised parameters (`id`), and seams are shared vertex indices.

## GEO-2, GEO-3 (H parts), GEO-5 — independent review

Reviewer: a separate agent with no access to the implementation code, judging image pixels against the spec. Round 1 (at `0df8d54` with an uncommitted tree, so provisional) found:

- **Direction GO; bird NO-GO.** It failed 2.3 (side), layering, 2.5 and 2.6.
- **A flap that rolled.**

Round-1 findings and the responses are in the brief §10. The round-2 verdicts on the clean commit are recorded below.

ROUND2_PLACEHOLDER

## GEO-3 (automated parts)

- **Family [A]:** every face carries a module and part and comes from `ringLoft`, `stitch`, `fan`, `quad` or `face` (`objectInspection`-style listing in the page inspector). The body, wings and tail reuse the same primitives.
- **Variants [A]:** crow, seeds 1–8, out-of-sample seeds 101 / 202 / 303 and both parameter-box corners all build and are non-FAIL on GEO-1 (table above). Contact sheets: `docs/screenshots/exp-origami-v2-sheet-seeds-1-8.png`, `…-sheet-extremes.png`.
- **Diversity [A, diagnostic]:**
  - Measured span/L 1.49–2.46.
  - Tail/L 0.28–0.44.
  - Beak/L 0.075–0.132.
  - Wing aspect (half-span² / planform) 2.95–5.92.
  - Top-silhouette IoU over seeds 1–8: min 0.535, median 0.695, max 0.869.

  These are not beauty scores.
- **Mechanism [H]:** `birdParams(seed)` is a **bounded random parameter sampler**. There is no WFC and no grammar search, and nothing claims one.
- **3.7, reuse in a second object type: NOT DONE.** The same primitives (ring loft, strip, fan) are the obvious basis for a vehicle body and wheels, as the reviewer also suggests, but that is not demonstrated here.

## GEO-4 — Motion and fold

| # | Verdict | Evidence |
|---|---|---|
| 4.1 | PASS [A] | `posePieces` sets Foldon crease angles (`t × (rest + articulation)`) and `poseGeometry` moves the panels. No mesh is interpolated |
| 4.2 | PASS [A] | Test "flap articulation moves the wing tip continuously while the shoulder hinge stays fixed" (drift < 1e-6); seam gap at both articulation ends ≤ 1.9e-9 |
| 4.3 | PASS [A] | Same test: step ≤ 0.4 cells per 1/32 phase; rigidity ≤ 5.7e-10 |
| 4.4 | NOT VERIFIED [A] | The articulation is fully certified; the fold sweeps are sampled-only near seam closure (GEO-1) |
| 4.5 | PASS [A] | Shoulder joint plus wrist crease, both direction-resolved; the regression test checks symmetry |
| 4.6 | see review | `docs/screenshots/exp-origami-v2-fold-crow.png` (t = 0…1 exploded, flap sheet, flat nets of all pieces); inspector shows joints |

## GEO-6 — Engineering

| # | Verdict | Evidence |
|---|---|---|
| 6.1 | PASS [A] | `git diff --stat 6024a1b..HEAD -- packages apps tools benchmarks` is empty |
| 6.2 | PASS [A] | Test "the same parameters build the same id and geometry…" |
| 6.3 | PASS [A] | Lab README V2 section |
| 6.4 | PASS [A + H self] | 14 V2 tests at the public entry point, no mocks |
| 6.5 | PASS [A] | Verify 0.3–0.5 s per variant in the browser (`verifyMs`); the full V2 test file ≈ 20 s |
| 6.6 | PASS [H self] | Q6 (catalog fingerprint) unchanged: nothing enters the catalog |
| 6.7 | recorded at push | See the PR #11 comment for the CI run id and head SHA |
| 6.9 | PASS [H] | Phase 4 is not touched; Q1–Q6 open; no merge |

## Approval needed from the owner

1. Adopt, edit or reject the gate spec (`geometry-quality-gates.md` §9). The one-line instruction change is proposed and **not applied**.
2. A GEO-2 / GEO-5 verdict on the bird from the images, and whether "modular papercraft with strip unfolding" is the accepted construction philosophy (vs one-sheet).
3. Whether the next step is the vehicle with the same family (GEO-3.7), and whether GEO-1 must reach full PASS (no sampled pairs) before that.
4. Nothing here closes P3D-2, adopts an ADR or starts Phase 4.
