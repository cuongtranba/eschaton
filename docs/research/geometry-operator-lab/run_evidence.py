"""Generate the M1 evidence file evidence/m1-evidence.json (research artefact, D-3 and D-5).

Run from the repository root:
    python3 docs/research/geometry-operator-lab/run_evidence.py
Deterministic except the "timing" section (wall-clock, reported with its conditions).
"""
import hashlib
import json
import math
import os
import platform
import random
import statistics
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import o1  # noqa: E402
import oracles as orc  # noqa: E402


def sha(name):
    return hashlib.sha256(open(os.path.join(HERE, name), "rb").read()).hexdigest()


def diagonal_distance(p, q, r, s):
    """Distance between the lines p-r and q-s (the two diagonals of quad p, q, r, s), in the same unit."""
    d1, d2 = orc.sub(r, p), orc.sub(s, q)
    n = orc.cross3(d1, d2)
    nn = math.sqrt(sum(c * c for c in n))
    return abs(orc.dot(orc.sub(q, p), n)) / nn if nn else 0.0


def circle_polygon(rng, count, radius):
    angles = sorted(rng.random() * 2 * math.pi for _ in range(count))
    pts = {(int(round(radius * math.cos(t))), int(round(radius * math.sin(t)))) for t in angles}
    return [list(p) for p in orc.hull2(list(pts))]


def main():
    fx = json.load(open(os.path.join(HERE, "fixtures.json")))
    out = {"artefact": "laboratory M1, O1 section transition (contract v1.1); research only",
           "python": platform.python_version(), "machine": platform.machine(), "system": platform.system(),
           "sha256": {n: sha(n) for n in ("o1.py", "oracles.py", "test_o1.py", "fixtures.json", "run_evidence.py",
                                          "m0-o1-contract.md")}}
    bands = {}
    worst_angle = 0.0
    for name, f in sorted(fx["bands"].items()):
        res = o1.section_transition(f["a"], f["b"], min_altitude=f.get("min_altitude"))
        entry = {"digest": o1.digest(res), "ok": res["ok"]}
        if not res["ok"]:
            entry["code"] = res["error"]["code"]
            free = o1.section_transition(f["a"], f["b"])["band"]
            entry["min_altitude_q_without_threshold"] = free["min_altitude"]
        else:
            b = res["band"]
            net = o1.cut_open_net(b)
            entry.update({"topology": b["topology"], "faces": len(b["faces"]),
                          "kinds": [x["kind"] for x in b["faces"]], "area_mid": b["area_mid"], "volume": b["volume"],
                          "min_altitude_q": b["min_altitude"], "min_dihedral_deg": b["min_dihedral_deg"],
                          "net": {"classes": net["classes"], "tau_L": net["tau"],
                                  "congruence_residual_L": net["congruence_residual"],
                                  "seam_residual_L": max(net["seam_residuals"])}})
            if name == "F1":
                faces = [x["vertices"] for x in b["faces"]]
                sums = [orc.angle_sum_deg(faces, tuple(v) + (0,)) - 150.0 for v in f["a"]["vertices"]] + \
                       [orc.angle_sum_deg(faces, tuple(v) + (10 ** 6,)) - 210.0 for v in f["b"]["vertices"]]
                worst_angle = max(worst_angle, max(abs(s) for s in sums))
                entry["net_points_L"] = [[round(x, 6), round(y, 6)] for x, y in net["points"]]
                entry["net_points_max_deviation_L"] = max(
                    max(abs(g[0] - w[0]), abs(g[1] - w[1])) for g, w in zip(net["points"], f["expect"]["net_points_L"]))
            if name == "F6":
                a, bb = f["a"]["vertices"], f["b"]["vertices"]
                za, zb = f["a"]["z"], f["b"]["z"]
                warp = max(diagonal_distance(tuple(a[j]) + (za,), tuple(a[(j + 1) % 5]) + (za,),
                                             tuple(bb[(j + 1) % 5]) + (zb,), tuple(bb[j]) + (zb,)) for j in range(5))
                entry["index_matched_loft_warp_L_idealised"] = warp * 1e-6
        bands[name] = entry
    out["bands"] = bands
    out["f1_worst_angle_sum_error_deg"] = worst_angle
    chains = {}
    for name, f in sorted(fx["chains"].items()):
        res = o1.chain(f["stations"])
        ring = res["chain"]["rings"][0]
        chains[name] = {"digest": o1.digest(res), "kind": ring["kind"], "on_path": ring["on_path"],
                        "edges": [c for _, c in ring["edges"]], "vertex_angle_deg": ring["vertex_angle_deg"],
                        "vertex_flat": ring["vertex_flat"]}
    out["chains"] = chains
    out["negative_controls"] = {name: o1.section_transition(f["a"], f["b"], min_altitude=f.get("min_altitude"))["error"]["code"]
                                for name, f in sorted(fx["negative_bands"].items())}
    out["negative_controls"].update({name: o1.chain(f["stations"])["error"]["code"]
                                     for name, f in sorted(fx["negative_chains"].items())})
    sys.path.insert(0, HERE)
    import test_o1 as t  # noqa: E402  (reuses the seeded case lists only)
    worst_res, worst_seam, overlap_pairs, inconclusive_pairs, touching_pairs = 0.0, 0.0, 0, 0, 0
    for a, b in t.R1 + t.R1_DEGENERATE:
        net = o1.cut_open_net(o1.section_transition(a, b)["band"])
        worst_res = max(worst_res, net["congruence_residual"] / net["tau"])
        worst_seam = max(worst_seam, max(net["seam_residuals"]) / net["tau"])
        overlap_pairs += net["classes"]["overlap"]
        inconclusive_pairs += net["classes"]["inconclusive"]
        touching_pairs += net["classes"]["touching"]
    out["randomized_nets"] = {"cases": len(t.R1) + len(t.R1_DEGENERATE),
                              "worst_congruence_residual_over_tau": worst_res, "worst_seam_residual_over_tau": worst_seam,
                              "overlapping_pairs": overlap_pairs, "inconclusive_pairs": inconclusive_pairs,
                              "touching_pairs": touching_pairs}
    rng = random.Random(20261201)
    timing = []
    for m in (8, 64, 512, 1024):
        cases = []
        for _ in range(3):
            while True:
                pa, pb = circle_polygon(rng, int(m * 1.3), 5 * 10 ** 8), circle_polygon(rng, int(m * 1.3), 5 * 10 ** 8)
                if len(pa) >= m and len(pb) >= m:
                    cases.append(({"z": 0, "vertices": pa[:m]}, {"z": 10 ** 8, "vertices": pb[:m]}))
                    break
        cases = [({"z": 0, "vertices": [list(p) for p in orc.hull2([tuple(v) for v in a["vertices"]])]},
                  {"z": 10 ** 8, "vertices": [list(p) for p in orc.hull2([tuple(v) for v in b["vertices"]])]})
                 for a, b in cases]
        runs = []
        for _ in range(5):
            t0 = time.perf_counter()
            for a, b in cases:
                assert o1.section_transition(a, b)["ok"]
            runs.append((time.perf_counter() - t0) / len(cases))
        timing.append({"m_equals_n_at_most": m, "vertices_used": [len(cases[0][0]["vertices"]), len(cases[0][1]["vertices"])],
                       "median_ms": statistics.median(runs) * 1e3})
    t64 = next(x for x in timing if x["m_equals_n_at_most"] == 64)["median_ms"]
    t1024 = next(x for x in timing if x["m_equals_n_at_most"] == 1024)["median_ms"]
    out["timing"] = {"conditions": "section_transition only (validation, merge, exact areas and volume, exact altitudes, "
                                   "dihedrals); single process, CPython %s, %s; median of 5 runs over 3 seeded pairs"
                                   % (platform.python_version(), platform.machine()),
                     "rows": timing, "fitted_exponent_64_to_1024": math.log(t1024 / t64) / math.log(16)}
    path = os.path.join(HERE, "evidence", "m1-evidence.json")
    with open(path, "w") as fh:
        json.dump(out, fh, indent=1, sort_keys=True)
        fh.write("\n")
    print(json.dumps({k: out[k] for k in ("f1_worst_angle_sum_error_deg", "randomized_nets", "timing")}, indent=1))


if __name__ == "__main__":
    main()
