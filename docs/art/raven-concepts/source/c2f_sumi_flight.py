"""Concept B flight study — Sumi Sculptural Raven, banked glide. DESIGN ARTIFACT ONLY.

Same plane language as c2_sumi: pentagonal body, few large folded planes,
four long finger blades plus a short P10, three-blade keeled wedge tail.
"""
import math
from mathutils import Vector as V, Matrix
import kit

PENT = [(0, 1.0), (0.95, 0.32), (0.62, -0.85), (-0.62, -0.85), (-0.95, 0.32)]
DIAM = [(0, 1.0), (1.0, 0.0), (0, -1.0), (-1.0, 0.0)]
DIH = math.radians(6)
BANK = math.radians(14)


def build():
    b = kit.Builder()
    up = V((0, 0, 1))
    secs = [(0.385, 0.03, 0.03, 0.04), (0.36, 0.044, 0.05, 0.06), (0.325, 0.05, 0.064, 0.07),
            (0.29, 0.046, 0.066, 0.068), (0.262, 0.032, 0.054, 0.054), (0.23, 0.014, 0.058, 0.064),
            (0.17, 0.0, 0.085, 0.09), (0.08, -0.008, 0.10, 0.096), (-0.02, 0.0, 0.08, 0.072),
            (-0.10, 0.01, 0.045, 0.04), (-0.15, 0.014, 0.026, 0.018)]
    kit.loft(b, "body", [(V((x, 0, z)), w, h, up) for x, z, w, h in secs], PENT)
    bill = [(0.385, 0.03, 0.03, 0.04), (0.41, 0.026, 0.026, 0.034), (0.44, 0.016, 0.018, 0.024),
            (0.465, 0.0, 0.009, 0.012), (0.48, -0.018, 0, 0)]
    kit.loft(b, "bill", [(V((x, 0, z)), w, h, up) for x, z, w, h in bill], DIAM)
    n = V((0, -math.sin(DIH), math.cos(DIH)))
    tips = {}
    for sgn in (1, -1):
        c = V((0.322, 0.066 * sgn, 0.064))
        b.face("eye", [c + V((0.009, 0, 0.001)), c + V((0, 0.001 * sgn, 0.006)),
                       c + V((-0.009, 0, 0)), c + V((0, 0.001 * sgn, -0.004))][::sgn])
    nr = n
    for sgn in (1, -1):
        ruff = [(0.335, 0.03, 0.0), (0.29, 0.05, -0.012), (0.24, 0.058, -0.03), (0.228, 0.05, -0.058),
                (0.25, 0.042, -0.05), (0.262, 0.036, -0.066), (0.285, 0.032, -0.052), (0.3, 0.028, -0.062),
                (0.322, 0.024, -0.045)]
        pts = [V((x, y * sgn, z)) for x, y, z in ruff]
        mid = V((0.285, 0.056 * sgn, -0.03))
        poly = pts if sgn > 0 else list(reversed(pts))
        for i in range(len(poly) - 1):
            b.face("hackle", [mid, poly[i], poly[i + 1]] if sgn > 0 else [poly[i], mid, poly[i + 1]])
    # sleeked hackles in flight: one folded throat plane along the jaw line
    kit.feather(b, "hackle", V((0.335, 0, 0.004)), V((-1, 0, -0.18)), V((0, 0, -1)), 0.11, 0.075,
                spine=0.22, tip="point", asym=0.5, rootw=0.7)
    # arm: covert band folded over a tapered secondary plane with three notched pleats
    def P(x, y, lift=0.0):
        return V((x, y, 0.02 + (y - 0.05) * math.tan(DIH))) + nr * lift
    a0, a1, a2 = P(0.165, 0.055, 0.006), P(0.20, 0.24, 0.016), P(0.18, 0.46, 0.008)
    c0, c1, c2 = P(0.08, 0.055, 0.02), P(0.11, 0.24, 0.03), P(0.125, 0.46, 0.016)
    t0, t1, n1, t2, n2, t3, t4 = (P(-0.11, 0.06), P(-0.14, 0.15), P(-0.105, 0.185), P(-0.13, 0.27),
                                  P(-0.085, 0.305), P(-0.075, 0.39), P(0.03, 0.47))
    b.face("wing.R", [a0, a1, c1, c0])
    b.face("wing.R", [a1, a2, c2, c1])
    b.face("under.wing.R", [c0, c1, n1, t1, t0])
    b.face("under.wing.R", [c1, c2, t4, t3, n2, t2, n1])
    # hand: inner primaries continue the arm's trailing edge as one tapering plane;
    # four long narrow fingers (P6-P9) and a short leading P10 run beyond it
    hand = [a2, P(0.165, 0.645, 0.012), P(0.02, 0.665, 0.008), P(-0.01, 0.56, 0.004), t4]
    b.face("wing.R", hand)
    for i, (x, y, a, L, w) in enumerate([(0.15, 0.64, 106, 0.17, 0.045), (0.12, 0.645, 94, 0.33, 0.048),
                                         (0.09, 0.65, 81, 0.36, 0.05), (0.06, 0.655, 68, 0.32, 0.05),
                                         (0.03, 0.66, 56, 0.26, 0.052)]):
        ar = math.radians(a)
        d = V((-math.cos(ar), math.sin(ar), 0.015))
        tips[i] = kit.feather(b, "prim.R", P(x, y, 0.004 + 0.002 * i), d, nr, L, w, spine=0.12, camber=0.02,
                              tipup=0.008 * i, tip="finger" if i else "point", asym=0.4)
    for p in ("under.wing", "wing", "prim"):
        b.mirror(p + ".R", p + ".L")
    # keeled wedge tail
    for k, (L, a, wdt) in enumerate([(0.36, 0.0, 0.12), (0.29, 0.15, 0.11), (0.29, -0.15, 0.11)]):
        d = V((-math.cos(a), math.sin(a), -0.03))
        kit.feather(b, "tail", V((-0.135, 0, 0.016 + 0.006 * (k == 0))), d, V((0, 0, 1)), L, wdt,
                    spine=0.45 if k == 0 else 0.3, tip="point", asym=0.5)
    T = Matrix.Rotation(BANK, 4, "X")
    for part, polys in b.parts.items():
        b.parts[part] = [[T @ p for p in poly] for poly in polys]
    lm = {"bill_tip": tuple(T @ V((0.48, 0, -0.018))), "finger_R": tuple(T @ tips[2]),
          "tail_wedge_tip": tuple(T @ V((-0.5, 0, 0.0))), "throat_hackles": tuple(T @ V((0.29, 0.04, -0.07)))}
    spec = {
        "tones": {"under": "under", "eye": "accent", "body": "body", "wing": "body", "prim": "body",
                  "tail": "body", "bill": "under", "hackle": "body"},
        "crease": 165,
        "hier": {"body": 1, "bill": 1, "tail": 1, "wing": 2, "prim": 2, "hackle": 3, "eye": 3},
        "hier_views": ["top"],
        "views": {
            "hero": {"dir": (0.7, -1.0, 0.35), "dist": 2.8, "lens": 58, "res": (1500, 1000), "target": (0.0, 0, 0.03)},
            "front": {"dir": (1, 0, 0.0001), "ortho": 2.25, "dist": 4, "res": (900, 420), "target": (0, 0, 0.05)},
            "side": {"dir": (0, -1, 0.0001), "ortho": 1.2, "dist": 4, "res": (900, 420), "target": (0.0, 0, 0.02)},
            "top": {"dir": (0, 0, 1), "ortho": 2.25, "dist": 4, "res": (900, 560), "target": (-0.02, 0, 0), "up": (1, 0, 0)},
            "under": {"dir": (0, 0, -1), "ortho": 2.25, "dist": 4, "res": (900, 560), "target": (-0.02, 0, 0), "up": (1, 0, 0)},
            "head": {"dir": (0.75, -1, 0.25), "dist": 0.6, "lens": 55, "res": (700, 520), "target": (0.36, 0.0, 0.05)},
            "wing": {"dir": (0.05, -0.2, 1), "dist": 1.5, "lens": 55, "res": (700, 520), "target": (0.02, -0.55, -0.12), "up": (1, 0, 0)},
            "tail": {"dir": (-0.75, -0.2, 0.8), "dist": 0.95, "lens": 55, "res": (700, 520), "target": (-0.3, 0, 0.0)},
        },
        "ink_views": ["hero", "under"],
        "sil_views": ["hero", "under", "side"],
    }
    return b, lm, spec
