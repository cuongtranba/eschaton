"""Concept 2 — Sumi Sculptural Raven (perched, calling). DESIGN ARTIFACT ONLY.

Few, large, deliberate planes. Units ~ bill tip to tail tip = 1.0; post top at z=0.
"""
import math
from mathutils import Vector as V
import kit

PENT = [(0, 1.0), (0.95, 0.32), (0.62, -0.85), (-0.62, -0.85), (-0.95, 0.32)]
DIAM = [(0, 1.0), (1.0, 0.0), (0, -1.0), (-1.0, 0.0)]
DROP = 0.08


def build():
    b = kit.Builder()
    up = V((0, 0, 1))
    secs = [(-0.20, 0.15, 0.03, 0.022), (-0.14, 0.20, 0.075, 0.07), (-0.06, 0.27, 0.105, 0.115),
            (0.02, 0.34, 0.13, 0.125), (0.075, 0.405, 0.112, 0.10), (0.108, 0.445, 0.074, 0.074),
            (0.14, 0.466, 0.062, 0.06), (0.175, 0.493, 0.075, 0.082), (0.215, 0.494, 0.066, 0.072),
            (0.243, 0.486, 0.048, 0.058), (0.262, 0.479, 0.034, 0.044)]
    kit.loft(b, "body", [(V((x, 0, z)), w, h, up) for x, z, w, h in secs], PENT)
    upper = [(0.258, 0.492, 0.034, 0.030), (0.29, 0.488, 0.027, 0.026), (0.32, 0.478, 0.018, 0.018),
             (0.348, 0.463, 0.009, 0.010), (0.37, 0.444, 0, 0)]
    lower = [(0.258, 0.462, 0.028, 0.016), (0.29, 0.452, 0.020, 0.012), (0.318, 0.444, 0.010, 0.007),
             (0.34, 0.438, 0, 0)]
    kit.loft(b, "bill", [(V((x, 0, z)), w, h, up) for x, z, w, h in upper], DIAM)
    kit.loft(b, "bill", [(V((x, 0, z)), w, h, up) for x, z, w, h in lower], DIAM)

    side = {}
    for sgn in (1, -1):
        c = V((0.212, 0.069 * sgn, 0.507))
        b.face("eye", [c + V((0.009, 0, 0.001)), c + V((0, 0.001 * sgn, 0.006)),
                       c + V((-0.009, 0, 0)), c + V((0, 0.001 * sgn, -0.004))][::sgn])
        # throat hackles: a hanging folded strip, edge on the throat, jagged slanted lower edge
        up_edge = [(0.25, 0.04, 0.462), (0.22, 0.055, 0.458), (0.19, 0.063, 0.45), (0.16, 0.068, 0.44), (0.13, 0.066, 0.43)]
        lo_edge = [(0.245, 0.034, 0.402), (0.212, 0.047, 0.374), (0.182, 0.054, 0.397), (0.152, 0.058, 0.364), (0.122, 0.06, 0.392)]
        for i in range(len(up_edge) - 1):
            q = [V((x, y * sgn, z)) for x, y, z in (up_edge[i], up_edge[i + 1], lo_edge[i + 1], lo_edge[i])]
            b.face("hackle", q if sgn > 0 else list(reversed(q)))
        # folded wing: covert leaf, secondary tier, one tapering primary blade group
        dwing = V((-0.8, 0.05 * sgn, -0.6)).normalized()
        nwing = V((0, sgn, 0.05))
        part = "wing" if sgn > 0 else "wing.L"
        kit.feather(b, "under." + part, V((0.04, 0.10 * sgn, 0.37)), dwing, nwing, 0.30, 0.14,
                    spine=0.2, camber=0.05, tip="blunt", asym=0.6, rootw=0.6)
        kit.feather(b, part, V((0.055, 0.107 * sgn, 0.385)), dwing, nwing, 0.23, 0.12,
                    spine=0.2, camber=0.04, tip="point", asym=0.62, rootw=0.75)
        tips = []
        for j, (L, da) in enumerate([(0.40, 0.0), (0.385, 0.02), (0.37, 0.04)]):
            dj = V((-0.8, 0.05 * sgn, -0.6 - da)).normalized()
            tips.append(kit.feather(b, "prim." + ("R" if sgn > 0 else "L"),
                                    V((0.0, (0.094 - 0.005 * j) * sgn, 0.35 - 0.008 * j)), dj, nwing, L,
                                    0.058, spine=0.22, tip="point", asym=0.45))
        side[sgn] = tips
        # stout leg, feathered thigh, gripping toes
        top = V((0.01, 0.045 * sgn, 0.20 - DROP))
        foot = V((0.028, 0.05 * sgn, 0.005))
        kit.loft(b, "under.leg", [(top, 0.021, 0.021, V((1, 0, 0))), (foot, 0.014, 0.014, V((1, 0, 0)))],
                 DIAM)
        kit.feather(b, "under.thigh", V((0.04, 0.065 * sgn, 0.27)), V((-0.2, 0.05 * sgn, -1)),
                    V((0.2, sgn, 0)), 0.08, 0.08, spine=0.25, tip="round")
        for ang, L in [(-0.35, 0.075), (0.0, 0.085), (0.35, 0.075), (math.pi, 0.06)]:
            d = V((math.cos(ang), math.sin(ang) * 0.6 * sgn, 0))
            kit.feather(b, "under.leg", foot, d, V((0, 0, 1)), L, 0.02, spine=0.2, tip="point")

    # wedge tail: three pleated blades, centre longest
    dt = V((-0.75, 0, -0.66)).normalized()
    nt = V((-0.66, 0, 0.75))
    for k, (L, a, wdt) in enumerate([(0.27, 0.0, 0.12), (0.22, 0.17, 0.10), (0.22, -0.17, 0.10)]):
        d = (dt + V((0, math.sin(a), 0))).normalized()
        kit.feather(b, "tail", V((-0.185, 0, 0.165 + 0.012 * (k == 0))), d, nt, L, wdt,
                    spine=0.75 if k == 0 else 0.5, tip="point", asym=0.5)

    # context: broken post (folded paper block, ruined top)
    s = 0.075
    topz = [0.0, -0.012, -0.05, -0.02]
    cs = [V((0.03 + s, s, 0)), V((0.03 - s, s, 0)), V((0.03 - s, -s, 0)), V((0.03 + s, -s, 0))]
    tp = [c + V((0, 0, z)) for c, z in zip(cs, topz)]
    bt = [c + V((0, 0, -0.75)) for c in cs]
    b.face("post", tp)
    for i in range(4):
        j = (i + 1) % 4
        b.face("post", [bt[i], bt[j], tp[j], tp[i]])
    b.face("post", [cs[0] + V((0.0, 0, -0.0)), cs[3] + V((0.02, 0, -0.03)), cs[3] + V((0.0, 0, -0.12))])

    for part, polys in b.parts.items():
        if part in ("post", "under.leg"):
            continue
        b.parts[part] = [[p - V((0, 0, DROP)) for p in poly] for poly in polys]

    lm = {
        "bill_tip": (0.37, 0, 0.444 - DROP), "gape": (0.315, 0.012, 0.458 - DROP), "forehead": (0.243, 0, 0.545 - DROP),
        "nape": (0.138, 0, 0.535 - DROP), "throat_hackles": (0.17, 0.06, 0.39 - DROP), "eye": (0.212, 0.069, 0.507 - DROP),
        "coverts_tier": (0.0, 0.115, 0.33 - DROP), "secondaries_tier": (-0.12, 0.11, 0.24 - DROP),
        "primary_blades": tuple(side[1][0] - V((0, 0, DROP))), "tail_wedge_tip": (-0.39, 0, -0.03 - DROP),
        "toes": (0.1, 0.05, 0.0), "post": (0.03, -0.075, -0.4),
    }
    spec = {
        "tones": {"under": "under", "eye": "accent", "body": "body", "wing": "body", "prim": "body",
                  "tail": "body", "bill": "under", "hackle": "body", "post": "under"},
        "crease": 165,
        "hier": {"body": 1, "bill": 1, "tail": 1, "wing": 2, "prim": 2, "hackle": 3, "eye": 3, "leg": 3, "thigh": 3, "post": 2},
        "hier_views": ["hero", "side"],
        "views": {
            "hero": {"dir": (0.85, -0.85, 0.12), "dist": 2.3, "lens": 58, "res": (1500, 1000),
                     "target": (-0.02, 0, 0.16)},
            "front": {"dir": (1, 0, 0.0001), "ortho": 1.15, "dist": 4, "res": (700, 700), "target": (0.0, 0, 0.2)},
            "side": {"dir": (0, -1, 0.0001), "ortho": 1.15, "dist": 4, "res": (700, 700), "target": (-0.02, 0, 0.2)},
            "back": {"dir": (-1, 0, 0.0001), "ortho": 1.15, "dist": 4, "res": (700, 700), "target": (0.0, 0, 0.2)},
            "top": {"dir": (0, 0, 1), "ortho": 1.15, "dist": 4, "res": (700, 700), "target": (-0.02, 0, 0.0),
                    "up": (1, 0, 0)},
            "head": {"dir": (0.8, -1, 0.12), "dist": 0.62, "lens": 55, "res": (700, 520),
                     "target": (0.23, 0, 0.41)},
            "wing": {"dir": (-0.3, -1, 0.35), "dist": 1.15, "lens": 55, "res": (700, 520),
                     "target": (-0.08, 0.1, 0.28)},
            "tail": {"dir": (-0.85, -0.7, 0.25), "dist": 0.95, "lens": 55, "res": (700, 520),
                     "target": (-0.3, 0, 0.02)},
        },
        "ink_views": ["hero", "side", "front"],
        "context": ["post"],
        "sil_views": ["side", "hero", "front"],
    }
    return b, lm, spec
