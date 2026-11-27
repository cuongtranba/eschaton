# Geometry Operator Laboratory: M0–M1 (O1 section transition)

- Status: **research artefact.** Authorized by owner decisions D-1 (research direction only), D-3 (milestones M0 and M1 only, in isolation) and D-5 (committed reproducible scripts), recorded in [decision packet](../../review/art-1-raven-decision-packet.md) §0.3 on draft PR #14.
- It is **not** a production API, a Foldon contract change, Geometry V4, object implementation or a visual approval. Nothing in `packages/`, `apps/` or `experiments/` imports these files, and no server or web UI exists. O2, O3 and M2–M5 are not started.
- Chosen path: `docs/research/geometry-operator-lab/`, next to the lab proposal [`../geometry-operator-lab.md`](../geometry-operator-lab.md). The form-method diagnostic scripts are separate, in [`docs/art/form-method-diagnostics/`](../../art/form-method-diagnostics/README.md).
- Dependencies: Python 3 standard library only. Every result here was produced with **CPython 3.9.6 on macOS arm64**.

## Chronology (frozen before code)

| Step | Commit | What |
|---|---|---|
| M0 contract v1 | `58b424f` | contract, fixtures and oracles written before any script |
| Independent math review of v1 | — | GO WITH AMENDMENTS (15 findings), contract §12 |
| **M0 freeze, contract v1.1** | `33e7f67` | amendments applied, no fixture value changed; M0 decision **GO** |
| M1 red | `0770c03` | `fixtures.json`, `oracles.py`, `test_o1.py` and a stub `o1.py`; red run in `evidence/m1-red.txt` |
| M1 green | the commit that adds this README | `o1.py` implemented; green runs in `evidence/m1-green.txt` |

## Files

| File | Role |
|---|---|
| [`m0-o1-contract.md`](m0-o1-contract.md) | the frozen contract v1.1: scope, units, bounds, exact results with proofs, canonical form, error codes and precedence, fixtures F1–F18, negative controls, oracles, corrections C1–C16 |
| `o1.py` | the implementation: `section_transition`, `chain`, `cut_open_net`, `canonical_json`, `digest` |
| `oracles.py` | independent oracles. They never import `o1.py`, and a test checks that |
| `fixtures.json` | the frozen inputs, in integer quanta (1 q = 1e-6 L), with their expected values |
| `test_o1.py` | 25 tests through the public functions only; no mocks, no sleeps, seeded generators |
| `run_evidence.py` | writes `evidence/m1-evidence.json` |
| `evidence/` | `m1-red.txt`, `m1-green.txt` and `m1-evidence.json` |

## Reproduce (from the repository root)

```sh
python3 -m unittest discover -s docs/research/geometry-operator-lab -p 'test_*.py'   # 25 tests, about 20 s
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
| R1: faces equal the brute-force hull; canonical-form oracle C′ | **PASS** | 300 polygon pairs and 200 caps and wedges (degenerate section lower or upper): 0 mismatches |
| R2: face count \|D_A ∪ D_B\|, 3–4 vertices; 20 large pairs with supporting planes | **PASS** | exact; up to 1024 vertices per section |
| R3: slices at t = 1/7, 1/2, 5/6 equal the Minkowski combination | **PASS** | exact rationals, 1500 slices |
| R4: prismoidal volume = tetrahedral volume; χ, orientability, boundary loops | **PASS** | exact, on 500 random cases and all fixtures |
| R5: translation, quarter turn, mirror, scaling × 7 (volume × 343) | **PASS** | exact, 50 cases each |
| R6: allowed permutations give an identical digest | **PASS** | 150 cases, every cyclic rotation and orientation, both argument orders |
| R7: digest independent of `PYTHONHASHSEED` (0 and 12345) | **PASS** | all fixture bands |
| R8: net congruence and seam copies within τ | **PASS** | 500 nets; worst residual 5.7e-7 τ (seam 4.9e-7 τ); 0 overlapping, 0 inconclusive, 0 touching pairs |
| Timing (contract C16) | **measured** | median ms per band at m = n: 0.47 (8), 3.85 (64), 29.8 (512), 63.9 (1024). Fitted exponent 1.01 from 64 to 1024. No budget was set, and none is claimed |
| Cross-engine determinism (P3D-6) | **NOT VERIFIED** here | one engine only (CPython). See the independent review in packet §11 |
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
