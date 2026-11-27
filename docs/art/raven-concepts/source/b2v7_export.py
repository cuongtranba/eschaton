"""Export the B-2 v5 and v7 design read-outs for the v7 boards. DESIGN ARTIFACT ONLY.

Usage: Blender -b --factory-startup --python b2v6_export.py -- <out.json>

v5 numbers are read from the v5 source text (c2f5_sumi_flight.py) with `ast`, so the board
shows what v5 actually used. v7 numbers come from c2f7_sumi_flight.py (exported under the key "v6" for the board layout shared with b2v6_boards.py) and formkit. These are
drawing read-outs for the method's principles P1, P2 and P5, not verdicts.
"""
import ast
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.normpath(os.path.join(HERE, "..", "..", "form-studies", "source"))]
import formkit as fk  # noqa: E402
import c2f5_sumi_flight as v5  # noqa: E402
import c2f7_sumi_flight as v6  # noqa: E402


def literal(src, fn, name):
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == fn:
            for st in ast.walk(node):
                if isinstance(st, ast.Assign) and getattr(st.targets[0], "id", None) == name:
                    return ast.literal_eval(st.value)
    raise KeyError(name)


src5 = open(os.path.join(HERE, "c2f5_sumi_flight.py")).read()
sec5 = literal(src5, "build", "head") + literal(src5, "build", "body")
fing5 = literal(src5, "hand", "fingers")
inner5 = literal(src5, "hand", "inner")

out = {"v5": {}, "v6": {}}
out["v5"]["sections"] = [{"x": x, "w": w, "h": h, "ring": v5.PENT, **fk.descriptors(v5.PENT, w, h)}
                         for x, z, w, h in sec5]
out["v6"]["sections"] = [{"x": x, "w": w, "h": h, "ring": prof, "tag": tag, **fk.descriptors(prof, w, h)}
                         for x, z, w, h, prof, tag in v6.KEYS]


def chord(le, te, u):
    return le(u) - te(u)


out["v5"]["arm_chord"] = {"root": round(chord(v5.v_le, v5.v_te, 0.06), 3), "wrist": round(chord(v5.v_le, v5.v_te, 0.40), 3)}
out["v6"]["arm_chord"] = {"root": round(chord(v6.v_le, v6.v_te, 0.06), 3), "wrist": round(chord(v6.v_le, v6.v_te, 0.40), 3)}
for k in ("v5", "v6"):
    c = out[k]["arm_chord"]
    c["ratio"] = round(c["wrist"] / c["root"], 3)
    mod = v5 if k == "v5" else v6
    out[k]["planform"] = {"le": [(u / 100, mod.v_le(u / 100)) for u in range(6, 41)],
                          "te": [(u / 100, mod.v_te(u / 100)) for u in range(6, 41)]}


def notch_stats(name, rows, bone0, bone1, e_off):
    pts, widths, angles, roots = [], [], [], []
    for r in rows:
        t, ang, L, wl, wt, e = r[0], r[1], r[2], r[3], r[4], r[7]
        rx = bone0[0] + (bone1[0] - bone0[0]) * t
        ry = bone0[1] + (bone1[1] - bone0[1]) * t
        a = math.radians(ang)
        pts.append((rx + math.cos(a) * L * (e + e_off), ry + math.sin(a) * L * (e + e_off)))
        widths.append(wl + wt)
        angles.append(ang)
        roots.append((rx, ry))
    sp = [math.dist(a, b) for a, b in zip(roots, roots[1:])]
    return fk.series_stats(name, widths, sp, angles, pts)


out["v5"]["fingers"] = notch_stats("v5 fingers P6-P9 (ends = notch points)", fing5, v5.BONE0, v5.BONE1, 0.12)
out["v5"]["inner"] = fk.series_stats("v5 inner primaries", [r[3] + r[4] for r in inner5],
                                     [abs(b[0] - a[0]) for a, b in zip(inner5, inner5[1:])],
                                     [r[1] for r in inner5], [(0, 0), (1, 1)])
out["v5"]["inner"]["ends_r2"] = None
m6, _, _ = v6.build()
out["v6"]["fingers"] = m6.series["fingers"]
out["v6"]["inner"] = m6.series["primaries.inner"]
out["v6"]["panels"] = len({(p, n) for p, n, _ in m6.faces})
Ti = (v6.Matrix.Rotation(v6.BANK, 4, "X") @ v6.Matrix.Rotation(v6.PITCH, 4, "Y")).inverted()
pts = [Ti @ q for _, _, poly in m6.faces for q in poly]
span = max(q.y for q in pts) - min(q.y for q in pts)
length = 0.525 - (-0.150 - 0.355)
body = [Ti @ q for p, _, poly in m6.faces if p == "body" for q in poly]
head = [q for q in body if q.x > 0.27]
torso = [q for q in body if q.x < 0.2]
out["v6"]["ratios"] = {"span_L": round(span / length, 3), "tail_L": round(0.355 / length, 3),
                       "bill_L": round((0.525 - 0.398) / length, 3),
                       "head_body_depth": round((max(q.z for q in head) - min(q.z for q in head)) /
                                                (max(q.z for q in torso) - min(q.z for q in torso)), 3),
                       "arm_hand_leading_edge": "wrist at u = 0.40 of a half-span of about %.2f" % (span / 2)}
args = sys.argv[sys.argv.index("--") + 1:]
json.dump(out, open(args[0], "w"), indent=1)
print("EXPORT", json.dumps({k: {"chord": out[k]["arm_chord"], "fingers": out[k]["fingers"]} for k in out}))
