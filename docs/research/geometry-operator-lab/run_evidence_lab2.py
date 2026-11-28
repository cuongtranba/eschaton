"""Evidence for laboratory M2 (O2, contract v1.1) and the O1 v2 experiment (contract v2.2).

RESEARCH ARTEFACT ONLY (owner decisions D-6 and D-7). Writes evidence/m2-evidence.json and
evidence/m1b-evidence.json. Each file has three sections, kept apart:
- "exact": digests, error codes, kinds and rationals; deterministic, and recomputed by
  check_exact_evidence.py in CI;
- "float": residuals and measured angles on this platform only (no cross-platform claim);
- "timing": wall-clock medians with their conditions (never compared).
Run from the repository root:
    python3 docs/research/geometry-operator-lab/run_evidence_lab2.py
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
import o1v2  # noqa: E402
import o2  # noqa: E402


def load(name):
    with open(os.path.join(HERE, name)) as fh:
        return json.load(fh)


def sha(name):
    with open(os.path.join(HERE, name), "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def _m2_sheets():
    """Every M2 fixture sheet, by fixture id (contract v1.1 section 8)."""
    fx = load("m2-fixtures.json")
    sq = fx["square"]

    def ins(sh, face, line, assignment="valley"):
        return o2.insert_crease(sh, face, line[0], line[1], assignment)["sheet"]

    base = o2.make_sheet(sq)["sheet"]
    g1 = ins(base, "F", fx["G1"]["line"])
    out = {"G1": g1, "G1m": ins(base, "F", fx["G1"]["line"], "mountain"),
           "G3": ins(base, "F", fx["G3"]["line"]), "G4": ins(base, "F", fx["G4"]["line"]),
           "G5": ins(g1, "F.a", fx["G5"]["second_line"])}
    a, b = fx["G6"]["lines"]
    out["G6"] = ins(ins(base, "F", a), "F.b", b)
    out["G6_other_order"] = ins(ins(base, "F", b), "F.a", a)
    out["G10"] = ins(g1, "F.b", fx["G10"]["second_line"], "mountain")
    return out


def m2_exact():
    sheets = _m2_sheets()
    fx = load("m2-fixtures.json")
    sq = fx["square"]
    exact = {"sheets": {k: {"digest": o2.digest(s), "geometry_digest": o2.geometry_digest(s),
                            "faces": sorted(f["id"] for f in s["faces"] if f["children"] is None),
                            "creases": [[c["id"], c["faces"], c["assignment"]] for c in s["creases"]]}
                        for k, s in sorted(sheets.items())}}
    base = o2.make_sheet(sq)["sheet"]
    g1 = sheets["G1"]
    h = 500000
    m = 10 ** 6
    codes = {
        "X1_dart": o2.make_sheet([[0, 0], [2 * m, 0], [m, h], [m, 2 * m]]),
        "X2_midpoint": o2.make_sheet([[0, 0], [h, 0], [m, 0], [m, m], [0, m]]),
        "X3_repeat": o2.make_sheet([[0, 0], [m, 0], [m, 0], [m, m], [0, m]]),
        "X6": o2.insert_crease(base, "Z", *fx["G1"]["line"], "valley"),
        "X7": o2.insert_crease(g1, "F", *fx["G3"]["line"], "valley"),
        "X8": o2.insert_crease(base, "F", [h, h], [h, h], "valley"),
        "X9": o2.insert_crease(base, "F", [2 * m, 0], [2 * m, m], "valley"),
        "X10_edge": o2.insert_crease(base, "F", [m, 0], [m, m], "valley"),
        "X10_vertex": o2.insert_crease(base, "F", [m, m], [2 * m, 0], "valley"),
        "X11_t_junction": o2.insert_crease(g1, "F.a", [0, h], [m, h], "valley"),
        "X11_crossing_pair": o2.insert_crease(g1, "F.b", [0, h], [m, h], "valley"),
        "X12": o2.insert_crease(base, "F", [0, 1], [1, 0], "valley", min_altitude=1000),
        "X13": o2.pose(g1, {"F": 180}, "F.a"),
        "X14": o2.pose(g1, {"F": -10}, "F.a"),
        "X15_unknown": o2.pose(g1, {"F": 10, "Q": 0}, "F.a"),
        "X15_missing": o2.pose(g1, {}, "F.a"),
        "X17": o2.pose(g1, {"F": 10}, "F"),
        "X18c": o2.pose(sheets["G10"], {"F.b": -200}, "F.a"),
    }
    exact["negative_controls"] = {k: (v["error"]["code"] if not v["ok"] else "ok") for k, v in sorted(codes.items())}
    return exact


def _measured(posed, sh, cid):
    """Measured fold angle of crease cid from its posed faces (repository convention)."""
    cre = next(c for c in sh["creases"] if c["id"] == cid)
    faces = {f["id"]: f for f in sh["faces"]}
    pf = {f["id"]: f["vertices"] for f in posed["pose"]["faces"]}
    par, ch = cre["faces"]

    def newell(poly):
        n = [0.0, 0.0, 0.0]
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            n[0] += (a[1] - b[1]) * (a[2] + b[2])
            n[1] += (a[2] - b[2]) * (a[0] + b[0])
            n[2] += (a[0] - b[0]) * (a[1] + b[1])
        ln = math.sqrt(sum(c * c for c in n))
        return [c / ln for c in n]

    def cross(a, b):
        return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

    def dot(a, b):
        return sum(x * y for x, y in zip(a, b))

    ends = [tuple(e) for e in cre["endpoints"]]
    ring = [tuple(v) for v in faces[par]["vertices"]]
    ha, hb = pf[par][ring.index(ends[0])], pf[par][ring.index(ends[1])]
    n_p, n_c = newell(pf[par]), newell(pf[ch])
    h = [b - a for a, b in zip(ha, hb)]
    ln = math.sqrt(dot(h, h))
    h = [c / ln for c in h]
    u = cross(n_p, h)
    cp = [sum(v[i] for v in pf[par]) / len(pf[par]) for i in range(3)]
    if dot([c - a for c, a in zip(cp, ha)], u) < 0:
        u = [-c for c in u]
    a = cross(n_p, u)
    return math.degrees(math.atan2(dot(cross(n_p, n_c), a), dot(n_p, n_c)))


def m2_float():
    sheets = _m2_sheets()
    out = {}
    for name, angles, root in (("G1_+90", {"F": 90.0}, "F.a"), ("G1_+179.999", {"F": 179.999}, "F.a"),
                               ("G10", {"F": 30.0, "F.b": -45.0}, "F.a")):
        sh = sheets["G10" if name == "G10" else "G1"]
        res = o2.pose(sh, angles, root)
        errs = {cid: ((_measured(res, sh, cid) - th + 180.0) % 360.0) - 180.0 for cid, th in angles.items()}
        out[name] = {"measured_minus_input_deg": errs}
    return out


def m2_timing():
    rng = random.Random(20261140)
    rows = []
    for k in (1, 8, 64):
        sh = o2.make_sheet([[0, 0], [(k + 1) * 10 ** 6, 0], [(k + 1) * 10 ** 6, 10 ** 6], [0, 10 ** 6]])["sheet"]
        t0 = time.perf_counter()
        for i in range(1, k + 1):
            leaf = [f["id"] for f in sh["faces"] if f["children"] is None and
                    max(v[0][0] / v[0][1] for v in f["vertices"]) == (k + 1) * 10 ** 6][0]
            sh = o2.insert_crease(sh, leaf, [i * 10 ** 6, 0], [i * 10 ** 6, 10 ** 6], "valley")["sheet"]
        t_ins = time.perf_counter() - t0
        root = [f["id"] for f in sh["faces"] if f["children"] is None and
                min(v[0][0] / v[0][1] for v in f["vertices"]) == 0][0]
        angles = {c["id"]: rng.uniform(0, 90) for c in sh["creases"]}
        runs = []
        for _ in range(5):
            t0 = time.perf_counter()
            o2.pose(sh, angles, root)
            runs.append(time.perf_counter() - t0)
        rows.append({"creases": k, "insert_all_ms": t_ins * 1e3, "pose_median_ms": statistics.median(runs) * 1e3})
    return rows


def _m1b_fixture_bands():
    fx = load("m1b-fixtures.json")
    out = {}
    for k in ("T1", "T2", "T3", "T3t", "T4"):
        out[k] = o1v2.section_transition_v2({"vertices": fx[k]["a"]}, {"vertices": fx[k]["b"]})
    return out


def m1b_exact():
    fx = load("m1b-fixtures.json")
    bands = {}
    for k, res in sorted(_m1b_fixture_bands().items()):
        b = res["band"]
        bands[k] = {"digest": o1v2.digest(b), "kinds": [f["kind"] for f in b["faces"]],
                    "owners": [f["owner"] for f in b["faces"]], "volume": b["volume"], "axis": b["axis_direction"]}
    w = fx["W6"]
    tb = fx["T2"]["b"]

    def run(a, b, **kw):
        r = o1v2.section_transition_v2({"vertices": a}, {"vertices": b}, **kw)
        return r["error"]["code"] if not r["ok"] else "ok"

    codes = {"W1": run(fx["W1"]["a"], fx["W1"]["b"]), "W2": run(fx["W2"]["a"], fx["W2"]["b"]),
             "W3": run(fx["W3"]["a"], fx["W3"]["b"]), "W3_overlapping": run(fx["W3_overlapping"]["a"], fx["W3_overlapping"]["b"]),
             "W4a": run(fx["W4"][0]["a"], fx["W4"][0]["b"]), "W4b": run(fx["W4"][1]["a"], fx["W4"][1]["b"]),
             "W4c": run(fx["W4"][2]["a"], fx["W4"][2]["b"]), "W9": run(fx["T3t"]["a"], fx["T3t"]["b"], min_altitude=1000)}
    codes.update({"W6_" + k: run(w[k], tb) for k in sorted(w)})
    return {"bands": bands, "negative_controls": codes}


def m1b_float():
    out = {}
    for k, res in sorted(_m1b_fixture_bands().items()):
        b = res["band"]
        net = o1.cut_open_net(b)
        out[k] = {"min_altitude_q": b["min_altitude"], "min_dihedral_deg": b["min_dihedral_deg"],
                  "net_congruence_over_tau": net["congruence_residual"] / net["tau"],
                  "net_seam_over_tau": max(net["seam_residuals"]) / net["tau"], "net_classes": net["classes"]}
    sys.path.insert(0, HERE)
    import test_o1v2 as t  # noqa: E402  (reuses the seeded case lists only)
    worst, worst_seam, classes = 0.0, 0.0, {}
    pairs = t.s1_pairs(300)
    for a, b in pairs:
        net = o1.cut_open_net(o1v2.section_transition_v2({"vertices": [list(v) for v in a]}, {"vertices": [list(v) for v in b]})["band"])
        worst = max(worst, net["congruence_residual"] / net["tau"])
        worst_seam = max(worst_seam, max(net["seam_residuals"]) / net["tau"])
        for c, n in net["classes"].items():
            classes[c] = classes.get(c, 0) + n
    out["S8_random_nets"] = {"cases": len(pairs), "worst_congruence_over_tau": worst, "worst_seam_over_tau": worst_seam,
                             "pair_classes": classes}
    return out


def m1b_timing():
    rng = random.Random(20261141)
    rows = []
    for m in (8, 64, 512, 1024):
        cases = []
        while len(cases) < 3:
            a = sorted(rng.uniform(0, 2 * math.pi) for _ in range(m))
            b = sorted(rng.uniform(0, 2 * math.pi) for _ in range(m))
            r = 4 * 10 ** 8
            pa = [[int(r * math.cos(t)), int(r * math.sin(t)), 0] for t in a]
            pb = [[int(r * math.cos(t)), int(r * math.sin(t))] for t in b]
            hb = o1.section_transition({"z": 0, "vertices": [p[:2] for p in pa]}, {"z": 1, "vertices": pb})
            if not hb["ok"]:
                continue
            ra = hb["band"]["ring_a"]["vertices"]
            rb = hb["band"]["ring_b"]["vertices"]
            sa = [[x, y, 0] for x, y in ra]
            sb = [[x, y, 5 * 10 ** 8 + x] for x, y in rb]
            if o1v2.section_transition_v2({"vertices": sa}, {"vertices": sb})["ok"]:
                cases.append((sa, sb))
        runs = []
        for _ in range(5):
            t0 = time.perf_counter()
            for sa, sb in cases:
                o1v2.section_transition_v2({"vertices": sa}, {"vertices": sb})
            runs.append((time.perf_counter() - t0) / len(cases))
        rows.append({"m_equals_n_at_most": m, "vertices_used": [len(cases[0][0]), len(cases[0][1])],
                     "median_ms": statistics.median(runs) * 1e3})
    t64 = rows[1]["median_ms"]
    t1024 = rows[3]["median_ms"]
    return {"rows": rows, "fitted_exponent_64_to_1024": math.log(t1024 / t64) / math.log(16)}


def conditions():
    return "single process, CPython %s, %s %s" % (platform.python_version(), platform.system(), platform.machine())


def main():
    common = {"python": platform.python_version(), "system": platform.system(), "machine": platform.machine()}
    m2 = dict(common, artefact="laboratory M2, O2 crease insertion (contract v1.1); research only",
              sha256={n: sha(n) for n in ("o2.py", "oracles_o2.py", "test_o2.py", "m2-fixtures.json", "m2-o2-contract.md",
                                          "run_evidence_lab2.py")},
              exact=m2_exact(), float=m2_float(), timing={"conditions": conditions(), "rows": m2_timing()})
    m1b = dict(common, artefact="O1 v2 experiment, tilted section planes (contract v2.2); research only",
               sha256={n: sha(n) for n in ("o1v2.py", "oracles_o1v2.py", "test_o1v2.py", "m1b-fixtures.json",
                                           "m1b-o1v2-contract.md", "run_evidence_lab2.py")},
               exact=m1b_exact(), float=m1b_float(), timing=dict(m1b_timing(), conditions=conditions()))
    for name, obj in (("m2-evidence.json", m2), ("m1b-evidence.json", m1b)):
        with open(os.path.join(HERE, "evidence", name), "w") as fh:
            json.dump(obj, fh, indent=1, sort_keys=True)
            fh.write("\n")
    print(json.dumps({"m2_float": m2["float"], "m2_timing": m2["timing"], "m1b_S8": m1b["float"]["S8_random_nets"],
                      "m1b_timing": m1b["timing"]}, indent=1))


if __name__ == "__main__":
    main()
