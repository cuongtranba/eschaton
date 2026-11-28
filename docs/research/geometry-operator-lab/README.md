# Geometry Operator Laboratory: M0–M1 (O1), M2 (O2), M1b (O1 v2) and D-8 seams

- Status: **research artefact.** Authorized by owner decisions D-1 (research direction only), D-3 (milestones M0 and M1 only, in isolation) and D-5 (committed reproducible scripts), recorded in [decision packet](../../review/art-1-raven-decision-packet.md) §0.3 on draft PR #14.
- Later authorizations: D-6 (M2, O2), D-7 (O1 v2 for tilted sections, proposed label M1b), D-8 (seam research, design only) and the laboratory CI job, recorded in packet §0.4. Their results are in the sections below and in packet §12.
- It is **not** a production API, a Foldon contract change, Geometry V4, object implementation or a visual approval. Nothing in `packages/`, `apps/` or `experiments/` imports these files, and no server or web UI exists. O3, M3, M4 and M5 are not started.
- Chosen path: `docs/research/geometry-operator-lab/`, next to the lab proposal [`../geometry-operator-lab.md`](../geometry-operator-lab.md). The form-method diagnostic scripts are separate, in [`docs/art/form-method-diagnostics/`](../../art/form-method-diagnostics/README.md).
- Dependencies: Python 3 standard library only. Every result here was produced with **CPython 3.9.6 on macOS arm64**.

## Chronology (frozen before code)

| Step | Commit | What |
|---|---|---|
| M0 contract v1 | `58b424f` | contract, fixtures and oracles written before any script |
| Independent math review of v1 | — | GO WITH AMENDMENTS (15 findings), contract §12 |
| **M0 freeze, contract v1.1** | `33e7f67` | amendments applied, no fixture value changed; M0 decision **GO** |
| M1 red | `0770c03` | `fixtures.json`, `oracles.py`, `test_o1.py` and a stub `o1.py`; red run in `evidence/m1-red.txt` |
| M1 green | `44cfd68` | `o1.py` implemented; green runs 1 and 2 in `evidence/m1-green.txt` |
| Independent M1 review | — | PASS WITH FINDINGS (packet §11) |
| Bounded revision after the review | the commit that records the review | count-bound error codes fixed in `o1.py` (the one implementation revision §10 allows); tests widened; run 3 in `m1-green.txt` |

## Files

| File | Role |
|---|---|
| [`m0-o1-contract.md`](m0-o1-contract.md) | the frozen contract v1.1: scope, units, bounds, exact results with proofs, canonical form, error codes and precedence, fixtures F1–F18, negative controls, oracles, corrections C1–C16 |
| `o1.py` | the implementation: `section_transition`, `chain`, `cut_open_net`, `canonical_json`, `digest` |
| `oracles.py` | independent oracles. They never import `o1.py`, and a test checks that |
| `fixtures.json` | the frozen inputs, in integer quanta (1 q = 1e-6 L), with their expected values |
| `test_o1.py` | 28 tests through the public functions only; no mocks, no sleeps, seeded generators |
| `run_evidence.py` | writes `evidence/m1-evidence.json` |
| `evidence/` | `m1-red.txt`, `m1-green.txt` and `m1-evidence.json`; `m2-red.txt`, `m2-green.txt`, `m2-evidence.json`; `m1b-red.txt`, `m1b-green.txt`, `m1b-evidence.json` |
| [`m2-o2-contract.md`](m2-o2-contract.md), `o2.py`, `oracles_o2.py`, `m2-fixtures.json`, `test_o2.py` | M2: the frozen O2 contract v1.1, the implementation, independent oracles, fixtures and 41 tests |
| [`m1b-o1v2-contract.md`](m1b-o1v2-contract.md), `o1v2.py`, `oracles_o1v2.py`, `m1b-fixtures.json`, `test_o1v2.py` | M1b: the frozen O1 v2 contract v2.2, the implementation, independent oracles, fixtures and 23 tests |
| `run_evidence_lab2.py`, `check_exact_evidence.py` | M2 and M1b evidence (exact, float and timing sections apart); the exact-evidence check used by CI |
| [`d8-modular-seams.md`](d8-modular-seams.md) | D-8 seam research (design and mathematics only) |

## Reproduce (from the repository root)

```sh
python3 -m unittest discover -s docs/research/geometry-operator-lab -p 'test_*.py'   # 28 tests, about 20 s
python3 docs/research/geometry-operator-lab/run_evidence.py                          # about 3 s; rewrites evidence/m1-evidence.json
```

The evidence file is deterministic except its `timing` section, which is wall-clock time.

## Verdicts per contract item (M1, at the green commit)

PASS means the contract item held on every case listed, against its oracle. It is not ART or GEO approval (lab proposal §1).

| Contract item | Verdict | Evidence |
|---|---|---|
| Fixtures F1–F9, F16, F18: topology, face counts, kinds, owners, areas, volumes, χ | **PASS** | exact. Examples: F1 V = 10/3 L³, \|M\| = 7/2; F6 has 9 faces (1 trapezoid at direction (0, −1), 8 triangles) |
| F1 planes, angle sums 150° and 210°, the 10 net points | **PASS** | worst angle error 0.0°; largest net deviation 7.6e-5 L (band 5e-4); no overlap, no inconclusive pair |
| F15 thin panel; F16 not thin, minimum dihedral | **PASS** | F15: `thin-panel` at 1000 q, minimum altitude 1.4142 q. F16: 0.22347° |
| Chains F10–F14, F17: ring kind, exact `on_path`, edge classes, vertex angles | **PASS** | 360°, 420°, 306.8699°, 456.3794°, 263.6206°, 327.4796° |
| On-path consistency (contract §5) | **PASS** | 40 seeded on-path chains: every edge dissolvable, every vertex flat within 1e-9°. *This test was added after the first green run* (`m1-green.txt`) |
| Negative controls N1–N14, plus the precedence cases P1 and P2, in both argument orders | **PASS** | each control returns exactly its code |
| Count bounds (contract §2): an empty vertex list; fewer than 2 stations | **FAIL at `44cfd68`, PASS after the revision** | returned `malformed-input` instead of `out-of-bounds`. Found by the independent review; fixed in the bounded revision, with a regression test |
| R1: faces equal the brute-force hull; canonical-form oracle C′ | **PASS** | 300 polygon pairs and 200 caps and wedges (degenerate section lower or upper): 0 mismatches |
| R2: face count \|D_A ∪ D_B\|, 3–4 vertices; 20 large pairs with supporting planes | **PASS** | exact; up to 1024 vertices per section |
| R3: slices at t = 1/7, 1/2, 5/6 equal the Minkowski combination | **PASS** | exact rationals, 1500 slices |
| R4: prismoidal volume = tetrahedral volume; χ, orientability, boundary loops | **PASS** | exact, on 500 random cases and all fixtures |
| R5: translation, quarter turn, mirror, scaling × 7 (volume × 343) | **PASS** | exact, 50 cases each |
| R6: allowed permutations give an identical digest | **PASS** | 150 cases; every cyclic rotation and orientation of **each** section, in both argument orders. At `44cfd68` only the first section was permuted; widened after the review |
| R7: digest independent of `PYTHONHASHSEED` (0 and 12345) | **PASS** | all fixture bands and chains (chains added after the review) |
| Areas against oracle Ar and the Minkowski hull | **PASS** | `area_a`, `area_b` and `area_mid` on all 500 random cases (added after the review) |
| R8: net congruence and seam copies within τ | **PASS** | 500 nets; worst residual 5.7e-7 τ (seam 4.9e-7 τ). On these 500 nets: 0 overlapping, 0 inconclusive, 0 touching pairs. **Non-overlap is not a property of O1 nets.** The reviewer found 104 overlapping nets among 9000 nearly flat bands, all flagged. A frozen overlapping case is now a test. The `inconclusive` class has never occurred, so it is untested |
| Timing (contract C16) | **measured** | median ms per band at m = n, as in the committed `evidence/m1-evidence.json`: 0.58 (8), 4.19 (64), 33.6 (512), 63.3 (1024). Fitted exponent 0.98 from 64 to 1024. Reruns vary by about ±15% (the reviewer measured exponents 1.03–1.05). No budget was set, and none is claimed |
| Cross-engine agreement (P3D-6, tested property) | **PASS for 806 inputs** | the independent reviewer's own BigInt implementation on Node 24 (V8), written from the contract alone, against `o1.py` on CPython 3.9.6. 736 `ok` digests were byte-identical, often from permuted inputs, and 70 error codes were identical. This is evidence for exactly those inputs: floats, error details, other Python versions and other platforms were not compared (packet §11) |
| Rigid folding path, collision, physical seam closure, single-sheet foldability of a chain | **NOT VERIFIED; not claimed** | contract §6.3. A non-overlapping net is only a flat layout of one band cut open |
| Hausdorff approximation bound against a design target | **NOT VERIFIED** | out of M1 scope (contract §1) |
| Non-parallel planes, non-convex sections, matched partitions | **rejected or deferred** | `unsupported-plane`, `non-convex-section`; partitions deferred (contract §1) |

## What this shows and what it does not

- **Shows.** Within contract v1.1 (two parallel planes, strictly convex sections or one point or segment, integer inputs), the O1 band is computed exactly and deterministically.
  - It agrees with an independent brute-force hull, with Minkowski slices and with tetrahedral volumes on every tested case.
  - It rejects every specified invalid input with its exact code.
  - Rings between bands are classified exactly as tessellation rings (on the path), seams or mixed rings. That reconciles on-path refinement, which dissolves, with off-path seams between separate sheets.
- **Does not show:**
  - that the band is foldable from one sheet. A closed band is a closed crease ring: it needs Q4, or a seam under Q1 or Q2;
  - anything about collision, thickness, rigidity or a folding motion;
  - anything about tilted section planes, non-convex profiles or attachments (O3, multi-host);
  - any visual quality.

## M2: O2 crease insertion (D-6)

### Chronology

| Step | Commit | What |
|---|---|---|
| Contract v1 | `fc646c7` | written before any M2 script; camber table of operators §3.2 re-derived (correct) |
| Independent math review of v1 | — | GO WITH AMENDMENTS (3 majors, 7 minors), contract §14. Draft test files existed uncommitted during it (disclosed) |
| **Freeze, contract v1.1** | `18fd118` | amendments applied; no fixture value changed |
| Red | `46d92f2` | `m2-fixtures.json`, `oracles_o2.py`, `test_o2.py`, stub `o2.py`: 34 tests, 32 failures, 1 error (`evidence/m2-red.txt`) |
| Green | `d326816` | `o2.py` by a **separate implementation agent** that wrote no contract, test or oracle: 34 tests pass on its first run (`evidence/m2-green.txt`) |
| Independent M2 review | — | **PASS WITH FINDINGS** (below) |
| Bounded revision | `6861a19` | tests widened only (41 tests); `o2.py` unchanged |

### Supported scope and verdicts

**Supported (exact):** one strictly convex integer outline in its rest plane; splits of current faces by integer lines, with vertex, edge and fan hits; the boundary invariant, the tree and lineage; `splits-crease`, so that T-junctions and crossings are rejected; area conservation; canonical JSON and digests. **Supported (float, banded):** the pose by rigid rotations about the exact crease axes, |θ| < 180°.

| Item | Verdict | Evidence |
|---|---|---|
| G1–G15, X1–X18, Q1–Q7 | **PASS** | 41 tests; the clip, tree, cover and quaternion-pose oracles are independent of `o2.py` |
| Camber G7 (k = 1, 2, 3, 5) | **PASS** | the reviewer's posed errors: chord ≤ 1.55e-6 L, radius ≤ 3.0e-7 L, deviation ≤ 1.6e-7 L (band 1e-5 L) |
| Pose residuals | **PASS** | worst against the oracle 7.2e-4 τ; rigidity 1.7e-4 τ; shared axis 2.3e-4 τ; judged angle roundtrip 1.2e-11° (band 1e-7°) |
| Exact cross-engine agreement (P3D-6, a tested property) | **PASS for the compared inputs** | the reviewer's own Node 24 BigInt implementation, written from the contract alone: 11,156 of 11,156 `ok` results byte-identical (canonical JSON, `digest`, `geometry_digest`), 50,684 insert and make codes and 1,549 pose codes identical. CI also matches the exact evidence on CPython 3.9.25 and 3.12.16 on Linux x86_64. Floats are **not** compared or claimed |
| No exception on expected failures | **PASS** on module-produced sheets (13,403 fuzz calls, 0 exceptions) | hand-tampered sheets with inconsistent geometry can raise (finding F6; outside the contract, which trusts sheet geometry) |
| Global folding, collision, self-intersection, a folding motion, thickness | **NOT VERIFIED; not claimed** | contract §4.6 |

**Review findings (the review of `d326816`).**
- F1–F5 and F8–F9 were test gaps: 17 of 53 mutants survived. Pinned digests, canonical fields, the far short-crease axis, a thin `.b` piece, precedence, inclusive bounds and vertex counts were added in the bounded revision. The digest pins are values that the independent Node engine reproduced byte for byte; this agent re-ran that engine on G1 and G5 before pinning them.
- Recorded and not changed:
  - F6: tampered sheets can raise `StopIteration` or `KeyError`, and a disconnected crease set is reported late.
  - F7: `canonical_json` and `digest` raise `TypeError` on non-JSON values, and `geometry_digest` of a malformed value hashes only its code.
  - F10: the digest encoding (lower-case hex) is not stated in the contract.

## M1b: O1 v2, tilted section planes (D-7, proposed label)

### Chronology

| Step | Commit | What |
|---|---|---|
| Contract v2.0 | `c1bdd6e` | before any v2 script; v1.1 unchanged |
| Independent math review of v2.0 | — | GO WITH AMENDMENTS (4 majors, 12 minors), contract §14; the uncommitted oracle draft was disclosed |
| **Freeze, contract v2.1** | `6b2aa39` | amendments applied; no fixture value changed |
| Contract v2.2 | `16d0a0f` | a generator amendment found while writing the red tests, before any implementation: S1b gave no trapezoid. **Not re-reviewed before the experiment**; the final review checked it |
| Red | `4ebd2c8` | fixtures, oracles, tests, stub: 19 tests, 17 failures, 1 error (`evidence/m1b-red.txt`) |
| Green | `21928d8` | `o1v2.py` by a **separate implementation agent**. First run: 1 failure, because the T3 fixture literal `[15e18, 4]` was not in lowest terms; the value was equal and the oracle check had passed. The literal was corrected to `[3.75e18, 1]` and disclosed. 19 tests pass; the v1.1 suite (28) passes unchanged |
| Independent O1 v2 review | — | **PASS WITH FINDINGS** (below) |
| Bounded revision | `57a5971` | tests widened only (23 tests); `o1v2.py` and the oracles unchanged |

### Supported scope and verdicts

**Supported (exact):** two strictly convex planar integer sections on distinct, non-parallel planes with mutual strict separation; the closed band with `triangle`, `trapezoid` and `quadrilateral` faces; the count m + n − (two-edge faces); the exact tetrahedral volume; the canonical form, total precedence and digest; nets through v1.1's unchanged builder. **Not supported:** parallel planes (v1.1's domain), caps and wedges, chains of tilted bands, and non-convex sections.

| Item | Verdict | Evidence |
|---|---|---|
| T1–T5, W1–W10, S1–S8 | **PASS** | 23 tests against a brute-force exact hull, an independent volume decomposition, topology and canonical-form oracles |
| Fuzz | **PASS** | the reviewer: about 71,000 inputs (near-parallel to a 1/(5·10⁸) tilt, vertices 1 q off the other plane, sections near the common line, ±10⁹ coordinates, 1024 × 1024 sections, cut prisms and pyramids, permutations), 0 mismatches, 0 exceptions. The internal `RuntimeError` was argued unreachable and was not reached |
| Exact cross-engine agreement (P3D-6) | **PASS for the compared inputs** | the reviewer's Node 24 BigInt implementation, from the contract alone: 11,246 `ok` results byte-identical, 59,645 error codes identical. CI exact-evidence match on CPython 3.9.25 and 3.12.16 on Linux x86_64. Floats are not claimed |
| Nets | **PASS** | worst congruence 5.4e-7 τ and seam 4.8e-7 τ on 300 random bands (`evidence/m1b-evidence.json`); the reviewer found 2 overlapping near-parallel nets, 1 `inconclusive` and 1 `touching`. **Non-overlap is not a property** |
| Timing | **measured only** | median ms per band at m = n = 8, 64, 512, 1024 on CPython 3.9.6, macOS arm64 (shared, noisy): 0.39, 4.32, 40.8, 89.9 in the committed evidence (fitted exponent 1.10 from 64 to 1024). An earlier run gave 0.35, 2.57, 20.7, 42.1, and the reviewer measured 56–62 ms at 1024. No budget |
| Chains of tilted bands | **NOT VERIFIED; not claimed** | counterexamples CE1 and CE2 (contract §7), reproduced in 3D by the v2.0 review |
| U1 (the real `kit.loft` rings are admissible) | **NOT VERIFIED** | contract §1 |
| Parallel approximation bound (§10) | **proven, not tested** | — |

**Review findings (the review of `21928d8`), recorded as errata of contract v2.2. The frozen contract is not edited:**
- F1 and F2 were test gaps: 14 of 40 mutants survived. Closed in the bounded revision. M35 is equivalent: the turn check already rejects the bow tie.
- F3: §5.4 should state that rationals are in **lowest terms**. That rule is inherited from v1.1 §4.1, which v2 does not cite, and its absence caused the T3 literal error.
- F4: the digest covers the **band**, with its float fields removed. The digest of an error result as `{"error": code}` is the implementation's choice.
- F5: the v2.2 sentence "S1b as frozen cannot produce a trapezoid" is too strong: a trapezoid is possible, though rare. The v2.1 counts were measured on the uncommitted draft generator, so they cannot be reproduced; the reviewer's reconstruction gave 0 trapezoids, 330 quadrilaterals and 1555 triangles.
- F6: in §10, the rounding term is up to √3/2 q (Euclidean), and A must also be rotated and re-quantised unless plane(A) is axis-aligned.
- F7: the status bullet of the contract still reads "v2.1 (frozen)", whereas the frozen version is v2.2. S1's redraw count is not reported by the test; the reviewer measured 467 draws for 300 pairs.

## D-8: modular seams (design only)

[`d8-modular-seams.md`](d8-modular-seams.md): sheet identity, canonical boundary ids, seam conditions S-1 to S-6, worked examples and counterexamples. Nothing is implemented. The D-9 deferred topics are listed in the lab proposal §10.1.

## Independent CI (`.github/workflows/math-lab.yml`)

- **What it runs.** A separate workflow, "Math lab", with path filters on this directory, the diagnostics and the workflow itself. It runs on CPython 3.9 and 3.12 on ubuntu-24.04, standard library only. Each job:
  - runs `python -m unittest discover` on this directory (92 tests) and on the form-method diagnostics (13 tests), with `pipefail` and an exact count check;
  - then runs `check_exact_evidence.py`, which recomputes the exact parts of `m1-`, `m2-` and `m1b-evidence.json` and compares them byte for byte.
- **What it leaves alone.** `ci.yml` is unchanged. A separate file is used because a path filter on `ci.yml` would also skip the production checks.
- **Failure detection, tested locally** on a copy in /tmp, with the same step scripts: an injected failing test, a count mismatch and an altered evidence digest each exit 1; the clean copy exits 0. No red artefact was committed.

## Reproduce (from the repository root), all tracks

```sh
python3 -m unittest discover -s docs/research/geometry-operator-lab -p 'test_*.py'   # 92 tests, about 40 s
python3 docs/research/geometry-operator-lab/check_exact_evidence.py                 # exact evidence, about 2 s
python3 docs/research/geometry-operator-lab/run_evidence_lab2.py                    # rewrites m2-/m1b-evidence.json (timing varies)
```
