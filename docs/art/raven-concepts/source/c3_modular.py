"""Concept 3 — Modular Tessellated Raven (upstroke). DESIGN ARTIFACT ONLY.

One folded kite module (valley/mountain on its long diagonal) in three sizes
S/M/L, laid in brick-offset rows over a dark hull. Units as concept 1.
"""
import math
from mathutils import Vector as V
import kit

S, M, L = (0.07, 0.06), (0.13, 0.085), (0.30, 0.085)
ARM_DIH, HAND_DIH, HAND_SWEEP = math.radians(16), math.radians(10), math.radians(18)
SECS = [(0.392, 0.026, 0.030, 0.038), (0.372, 0.040, 0.048, 0.058), (0.342, 0.048, 0.062, 0.068),
        (0.308, 0.046, 0.064, 0.066), (0.282, 0.030, 0.052, 0.052), (0.250, 0.010, 0.050, 0.058),
        (0.205, -0.004, 0.066, 0.078), (0.14, -0.014, 0.088, 0.094), (0.06, -0.012, 0.088, 0.088),
        (-0.02, -0.002, 0.072, 0.07), (-0.09, 0.008, 0.048, 0.042), (-0.15, 0.014, 0.026, 0.016)]


def interp(x):
    for a, b in zip(SECS, SECS[1:]):
        if b[0] <= x <= a[0]:
            t = (a[0] - x) / (a[0] - b[0])
            return [a[i] + (b[i] - a[i]) * t for i in range(1, 4)]
    return list(SECS[-1][1:])


def module(b, part, size, root, d, n, rise=0.14):
    Ls, ws = size
    return kit.shingle(b, part, root, d, n, Ls, ws, rise=rise)


def arm_pt(x, yl, z0=0.035):
    return V((x, 0.06 + yl * math.cos(ARM_DIH), z0 + yl * math.sin(ARM_DIH)))


def build():
    b = kit.Builder()
    up = V((0, 0, 1))
    kit.loft(b, "hull", [(V((x, 0, z)), w, h, up) for x, z, w, h in SECS], kit.profile_poly(8))
    bill = [(0.482, -0.024, 0, 0), (0.468, -0.008, 0.008, 0.012), (0.448, 0.007, 0.015, 0.022),
            (0.428, 0.018, 0.021, 0.031), (0.408, 0.025, 0.026, 0.037), (0.385, 0.029, 0.029, 0.040)]
    kit.loft(b, "bill", [(V((x, 0, z)), w, h, up) for x, z, w, h in bill],
             [(0, 1.0), (1.0, 0.0), (0, -1.0), (-1.0, 0.0)])

    count = {"S": 0, "M": 0, "L": 0}
    for sgn in (1, -1):
        c = V((0.345, 0.0585 * sgn, 0.066))
        b.face("eye", [c + V((0.008, 0, 0)), c + V((0, 0.003 * sgn, 0.005)),
                       c + V((-0.008, 0, 0)), c + V((0, 0.003 * sgn, -0.004))][::sgn])
        for i in range(5):
            r = V((0.335 - 0.022 * i, 0.026 * sgn, -0.03 - 0.005 * i))
            module(b, "hackle", S, r, V((-0.75, 0.3 * sgn, -0.6)), V((0.1, sgn, -0.2)), rise=0.1)
            count["S"] += 1

    n_arm = V((0, -math.sin(ARM_DIH), math.cos(ARM_DIH)))
    wrist = arm_pt(0.13, 0.36)
    hand_dir = V((-math.sin(HAND_SWEEP), math.cos(HAND_DIH) * math.cos(HAND_SWEEP), math.sin(HAND_DIH)))
    n_hand = V((0, -math.sin(HAND_DIH), math.cos(HAND_DIH)))
    tips = {}
    # arm rows: S leading edge, M coverts, L secondaries
    for i in range(10):
        yl = 0.02 + 0.034 * i
        module(b, "cov.R", S, arm_pt(0.16 - 0.01 * (i / 9), yl) + n_arm * 0.012, V((-1, 0, 0)), n_arm)
        count["S"] += 1
    for i in range(7):
        yl = 0.03 + 0.05 * i + 0.025
        module(b, "cov.R", M, arm_pt(0.11, yl) + n_arm * 0.008, V((-1, 0.05, 0)), n_arm)
        count["M"] += 1
    for i in range(9):
        yl = 0.03 + 0.042 * i
        t = i / 8
        module(b, "under.sec.R", L, arm_pt(0.045 + 0.17 * (1 - t) ** 2 + 0.06 * t ** 3, yl),
               V((-1, 0.18 * t - 0.05, 0)), n_arm, rise=0.1)
        count["L"] += 1
    # hand: S primary coverts, then nine L primaries; outer five spread as fingers
    for i in range(4):
        r = wrist + hand_dir * (0.03 + 0.04 * i) + V((0.02, 0, 0))
        module(b, "cov.R", S, r + n_hand * 0.012, V((-1, 0.3, 0)), n_hand)
        count["S"] += 1
    angs = [20, 30, 40, 50, 62, 74, 86, 98, 110]
    for i, a in enumerate(angs):
        r = wrist + hand_dir * (0.02 + 0.02 * i)
        ar = math.radians(a) - HAND_SWEEP
        d = V((-math.cos(ar), math.sin(ar) * math.cos(HAND_DIH), math.sin(ar) * math.sin(HAND_DIH)))
        tips[i + 1] = module(b, "prim.R", L, r + n_hand * 0.002 * (9 - i), d, n_hand, rise=0.12)
        count["L"] += 1
    for p in ("cov", "under.sec", "prim"):
        b.mirror(p + ".R", p + ".L")
    wing = {"S": 14, "M": 7, "L": 18}  # one wing; mirrored
    count = {k: count[k] + wing[k] for k in count}

    # tail: wedge assembled from module placement (staggered roots), not a scaled fan
    for x, a, size, key in [(-0.17, 0, L, "L"), (-0.15, 8, L, "L"), (-0.15, -8, L, "L"),
                            (-0.13, 17, L, "L"), (-0.13, -17, L, "L"), (-0.12, 26, M, "M"), (-0.12, -26, M, "M")]:
        ar = math.radians(a)
        module(b, "tail", size,
               V((x, 0.004 * math.copysign(1, a or 1), 0.02 - 0.002 * abs(a) / 7)),
               V((-math.cos(ar), math.sin(ar), -0.03)), V((0, 0, 1)), rise=0.1)
        count[key] += 1

    lm = {
        "bill_tip": (0.482, 0, -0.024), "head_helmet": (0.34, 0, 0.115), "nape_ring": (0.282, 0, 0.082),
        "throat_hackles": (0.3, 0.035, -0.075), "eye": (0.345, 0.0585, 0.066),
        "leading_edge_S": tuple(arm_pt(0.16, 0.2) + n_arm * 0.02), "coverts_M": tuple(arm_pt(0.07, 0.25)),
        "secondaries_L": tuple(arm_pt(-0.12, 0.2)), "wrist_R": tuple(wrist),
        "finger_P9_R": tuple(tips[9]), "finger_P6_R": tuple(tips[6]),
        "tail_wedge_tip": (-0.5, 0, 0.0), "hull_seam": (0.06, 0.088, -0.03),
    }
    spec = {
        "tones": {"under": "under", "eye": "accent", "body": "body", "cov": "body", "prim": "body",
                  "tail": "body", "bill": "under", "hackle": "body"},
        "crease": 165,
        "module_counts": count,
        "hier": {"hull": 1, "body": 1, "bill": 1, "tail": 1, "cov": 2, "sec": 2, "prim": 2, "hackle": 3, "eye": 3},
        "hier_views": ["hero", "top"],
        "views": {
            "hero": {"dir": (0.8, -0.95, 0.45), "dist": 2.6, "lens": 58, "res": (1500, 1000),
                     "target": (0.0, 0.0, 0.12)},
            "front": {"dir": (1, 0, 0.0001), "ortho": 2.0, "dist": 4, "res": (900, 560), "target": (0, 0, 0.15)},
            "side": {"dir": (0, -1, 0.0001), "ortho": 1.18, "dist": 4, "res": (900, 560), "target": (0.0, 0, 0.12)},
            "top": {"dir": (0, 0, 1), "ortho": 2.0, "dist": 4, "res": (900, 560), "target": (-0.05, 0, 0),
                    "up": (1, 0, 0)},
            "under": {"dir": (0, 0, -1), "ortho": 2.0, "dist": 4, "res": (900, 560), "target": (-0.05, 0, 0),
                      "up": (1, 0, 0)},
            "head": {"dir": (0.75, -1, 0.25), "dist": 0.6, "lens": 55, "res": (700, 520),
                     "target": (0.35, 0, 0.03)},
            "wing": {"dir": (0.1, -0.5, 1), "dist": 1.6, "lens": 55, "res": (700, 520),
                     "target": (0.0, 0.55, 0.22)},
            "tail": {"dir": (-0.75, -0.2, 0.8), "dist": 0.95, "lens": 55, "res": (700, 520),
                     "target": (-0.33, 0, 0.0)},
        },
        "ink_views": ["hero", "side", "under"],
        "sil_views": ["hero", "side", "under"],
    }
    return b, lm, spec
