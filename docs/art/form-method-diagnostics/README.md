# Form-method diagnostics (design artefact, D-5)

- Status: **design and research artefact** under owner decision D-5 ([decision packet](../../review/art-1-raven-decision-packet.md) §0.3), recorded on draft PR #14. These scripts compute the **informative** P1 and P7 read-outs of the proposed form method ([`form-construction-method.md`](../form-construction-method.md) M3.1). They are not a gate, judge no beauty, and are imported by nothing in `packages/`, `apps/` or `experiments/`. They are separate from the Geometry Operator Laboratory ([`../../research/geometry-operator-lab/`](../../research/geometry-operator-lab/README.md)).
- Dependencies: Python 3 standard library only. Produced with Python 3.9.6 on macOS.

## Files

| File | Purpose |
|---|---|
| `diagnostics.py` | profile distance `d` (P1), its measurement floor `φ` and the three-outcome conformance `p1_conformance` (method §16, D-10), single-section distance `e_v` (M3 P7, now information only), the cube-slice control, a re-implementation of `formkit.program` (Catmull-Rom stations) |
| `inputs.json` | keyframes and profiles copied verbatim from `c2f5_sumi_flight.py` @ `41c383f` and `c2f7_sumi_flight.py` @ `418e243`, with their SHA-256 |
| `run_readouts.py` | reproduces the M3 numbers and computes the M3.1 controls; writes `evidence/m31-readouts.json` |
| `test_diagnostics.py` | analytic controls: P1 conformance (a change above the floor, a re-slice within it, the R1 size regression, a straddling interval, a degenerate section); square → diamond = √2/2; aspect-only, turned and rotated profiles give 0; nested sections give 0; a translate gives its offset; the cube gives √6/12; non-convex slices are reported, not measured |
| `evidence/m31-readouts.json` | the generated read-outs, with the scripts' SHA-256 and the Python version |

## Reproduce (from the repository root)

```sh
python3 -m unittest discover -s docs/art/form-method-diagnostics -p 'test_*.py'   # 13 tests, about 18 s
python3 docs/art/form-method-diagnostics/run_readouts.py                          # about 70 s; rewrites the evidence file
```

The evidence file is deterministic for fixed inputs. It contains no timestamps.

## Method and error bounds

- **`d`.** Both boundaries are sampled at a spacing of 0.002 half-extents, and each sample's distance to the other polygon boundary is exact. Distance to a fixed set is 1-Lipschitz, so the true Hausdorff distance lies in [value, value + 0.001].
- **`e_v`.** The slices must be convex and share an interior point c, which is checked; otherwise the result is "not applicable".
  - The union of the slices is then star-shaped about c. Its boundary is sampled exactly on 3600 rays from c.
  - For a convex slice Σ contained in the union S, `H(∂S, ∂Σ) = max over q ∈ ∂S of dist(q, Σ)`. Proof: for p ∈ ∂Σ with outward normal ν, the ray from p along ν leaves S at a point q with `dist(q, Σ) ≥ |q − p| ≥ dist(p, ∂S)`. So the direction from ∂Σ to ∂S never dominates.
  - Between keyframes, sections are interpolated linearly (v5, as `kit.loft` does) or by the Catmull-Rom program (v7, as `formkit.program` does), and sampled 60 (v5) or 10 (v7) times per interval.
  - Convergence is reported: 3600 rays against 1800, and fine against coarse sampling.
- **Conventions.** As in `form-method-check.md` §5: stations are perpendicular to the spine, the `kit.loft` ring tilt and the head yaw are ignored, and the end view is along −x. The pixel figures use the hero lower bound (largest extent 400 px). They are shown **only** to explain why M3's pixel rules fail.

## D-10 corrections (2026-11-28)

- `measurement_floor`, `classify_p1` and `p1_conformance` were **added** for erratum R1 (method §16). No existing function changed.
- `evidence/m31-readouts.json` is **kept as committed** in `e26ccae`, as the record of M3.1. It pins `diagnostics.py` SHA-256 `36d4c495…5434`. After the D-10 change the script's SHA-256 is `813573aa…478e`. Regenerating the evidence with it gave a file **identical except for that hash**, which was checked and then discarded, so the committed record is unchanged.
