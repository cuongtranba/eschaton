"""Concept 1 — Anatomical Folded Raven (gliding). DESIGN ARTIFACT ONLY.

Units: 1.0 = bill tip to tail tip (~63 cm Common Raven). x forward, y left, z up.
"""
import math
from mathutils import Vector as V
import kit

DIH = math.radians(3)


def wing_n():
    return V((0, -math.sin(DIH), math.cos(DIH)))


def wz(y, z0=0.008):
    return z0 + max(y - 0.05, 0) * math.tan(DIH)


def lerp(a, b, t):
    return a + (b - a) * t


def lead_x(y):
    pts = [(0.05, 0.16), (0.26, 0.135), (0.46, 0.18), (0.62, 0.13)]
    for (y0, x0), (y1, x1) in zip(pts, pts[1:]):
        if y <= y1:
            return lerp(x0, x1, (y - y0) / (y1 - y0))
    return pts[-1][1]


def build():
    b = kit.Builder()
    prof = kit.profile_poly(8, 1.0, 1.0)
    up = V((0, 0, 1))
    body = [(0.392, 0.026, 0.030, 0.038), (0.372, 0.040, 0.048, 0.058), (0.342, 0.048, 0.062, 0.068),
            (0.308, 0.046, 0.064, 0.066), (0.282, 0.030, 0.052, 0.052), (0.250, 0.010, 0.050, 0.058),
            (0.205, -0.002, 0.066, 0.076), (0.14, -0.008, 0.086, 0.086), (0.06, -0.002, 0.084, 0.076),
            (-0.02, 0.006, 0.07, 0.06), (-0.09, 0.012, 0.046, 0.036), (-0.15, 0.014, 0.026, 0.016)]
    kit.loft(b, "body", [(V((x, 0, z)), w, h, up) for x, z, w, h in body], prof)
    bill = [(0.488, -0.008, 0, 0), (0.472, 0.002, 0.008, 0.012), (0.45, 0.013, 0.015, 0.022),
            (0.428, 0.021, 0.021, 0.031), (0.406, 0.027, 0.026, 0.037), (0.385, 0.030, 0.029, 0.040)]
    kit.loft(b, "bill", [(V((x, 0, z)), w, h, up) for x, z, w, h in bill], kit.profile_poly(6, 1.15, 0.8))

    # nasal bristles: a folded flap over the proximal third of the bill (both sides)
    for sgn in (1, -1):
        kit.feather(b, "bristle", V((0.382, 0.016 * sgn, 0.062)), V((1, 0.03 * sgn, -0.55)),
                    V((0, 0.6 * sgn, 1)), 0.045, 0.04, spine=0.06, tip="round")
        # eye: small inset diamond
        c = V((0.345, 0.0585 * sgn, 0.066))
        b.face("eye", [c + V((0.008, 0, 0)), c + V((0, 0.001 * sgn, 0.005)),
                       c + V((-0.008, 0, 0)), c + V((0, 0.001 * sgn, -0.004))][::sgn])
        # throat hackles: a hanging folded strip, edge on the throat, jagged slanted lower edge
        up_edge = [(0.35, 0.03, -0.012), (0.32, 0.045, -0.022), (0.29, 0.052, -0.03), (0.26, 0.055, -0.035), (0.23, 0.05, -0.035)]
        lo_edge = [(0.345, 0.026, -0.046), (0.315, 0.038, -0.07), (0.285, 0.044, -0.052), (0.255, 0.047, -0.076), (0.225, 0.044, -0.056)]
        for i in range(len(up_edge) - 1):
            q = [V((x, y * sgn, z)) for x, y, z in (up_edge[i], up_edge[i + 1], lo_edge[i + 1], lo_edge[i])]
            b.face("hackle", q if sgn > 0 else list(reversed(q)))

    n = wing_n()
    # thick leading edge (marginal coverts / patagium): airfoil loft, not a plank
    air = [(-1, 0), (-0.7, 0.75), (0.1, 0.65), (1, 0.05), (0.2, -0.3), (-0.7, -0.45)]
    le = []
    for y in [0.05, 0.12, 0.2, 0.28, 0.36, 0.44, 0.50, 0.56, 0.62]:
        w = 0.065 if y < 0.46 else lerp(0.065, 0.03, (y - 0.46) / 0.16)
        h = 0.022 if y < 0.46 else lerp(0.022, 0.008, (y - 0.46) / 0.16)
        le.append((V((lead_x(y) - w, y, wz(y) + 0.004)), w, h, n))
    kit.loft(b, "cov.R", le, air)

    # secondaries + tertials (12): blunt tips give a scalloped trailing edge
    for i in range(12):
        t = i / 11
        y = lerp(0.07, 0.45, t)
        rx = lead_x(y) - 0.10
        L = lerp(0.16, 0.20, min(t * 3, 1)) if t < 0.95 else 0.19
        d = V((-1, lerp(-0.08, 0.18, t), 0))
        kit.feather(b, "under.sec.R", V((rx, y, wz(y) - 0.002 * i)), d, n, L, 0.052,
                    spine=0.12, camber=0.04, tip="round", asym=0.5)
    # greater coverts (11): overlap the secondary bases, second tier
    for i in range(11):
        t = i / 10
        y = lerp(0.08, 0.44, t)
        d = V((-1, lerp(-0.05, 0.15, t), 0))
        kit.feather(b, "cov.R", V((lead_x(y) - 0.075, y, wz(y) + 0.006)), d, n, 0.085, 0.048,
                    spine=0.06, camber=0.02, tip="round", asym=0.5)
    # primaries (10). P6-P10 emarginated fingers, upturned, separated by angle.
    angs = [33, 40, 47, 53, 58, 63, 76, 90, 104, 116]
    lens = [0.22, 0.24, 0.26, 0.28, 0.30, 0.33, 0.37, 0.385, 0.35, 0.27]
    tips = {}
    for i in range(10):
        t = i / 9
        y = lerp(0.44, 0.60, t)
        x = lerp(0.135, 0.105, t)
        a = math.radians(angs[i])
        d = V((-math.cos(a), math.sin(a), 0))
        finger = i >= 5
        tips[i + 1] = kit.feather(b, "prim.R", V((x, y, wz(y) + 0.0015 * (9 - i) + (0.0025 * (i - 5) if finger else 0))), d, n, lens[i],
                                  0.042 if finger else 0.058, spine=0.08, camber=0.02,
                                  tipup=(0.015 + 0.008 * (i - 5)) if finger else 0.01, tip="finger" if finger else "point",
                                  asym=0.35 if finger else 0.5)
    # primary coverts over the hand
    for i in range(6):
        t = i / 5
        y = lerp(0.46, 0.60, t)
        a = math.radians(lerp(40, 92, t))
        kit.feather(b, "cov.R", V((lead_x(y) - 0.02, y, wz(y) + 0.007)),
                    V((-math.cos(a), math.sin(a), 0)), n, 0.10, 0.05, spine=0.06, tip="round")
    # alula (bastard wing) at the wrist
    kit.feather(b, "cov.R", V((0.175, 0.455, wz(0.455) + 0.003)), V((0.35, 1, 0)), n, 0.045, 0.018,
                spine=0.08, tip="point")
    for p in ("cov", "under.sec", "prim"):
        b.mirror(p + ".R", p + ".L")

    # wedge tail: 12 rectrices, central pair longest (wedge, not a fan or bell)
    tl = [0.375, 0.35, 0.32, 0.29, 0.26, 0.235]
    for k in range(6):
        for sgn in (1, -1):
            a = math.radians(1.5 + 2.2 * k) * sgn
            kit.feather(b, "tail", V((-0.135, 0.004 * sgn + 0.004 * k * sgn, 0.014 + 0.0025 * (5 - k))),
                        V((-math.cos(a), math.sin(a), -0.04)), V((0, 0, 1)), tl[k], 0.072,
                        spine=0.1, camber=0.02, tip="round", asym=0.5)
    # under-tail coverts
    kit.feather(b, "under.utc", V((-0.09, 0, -0.02)), V((-1, 0, 0.3)), V((0, 0, -1)), 0.08, 0.06,
                spine=0.1, tip="round")

    lm = {
        "bill_tip": (0.488, 0, -0.008), "nasal_bristles": (0.405, 0.02, 0.055), "forehead": (0.37, 0, 0.098),
        "nape": (0.282, 0, 0.082), "throat_hackles": (0.29, 0.03, -0.075), "eye": (0.345, 0.0585, 0.066),
        "wrist_R": (0.18, 0.46, wz(0.46) + 0.02), "alula_R": (0.22, 0.53, wz(0.5) + 0.02),
        "finger_P10_R": tuple(tips[10]), "finger_P7_R": tuple(tips[7]),
        "secondaries_R": (lead_x(0.3) - 0.29, 0.3, wz(0.3)), "coverts_R": (lead_x(0.3) - 0.11, 0.3, wz(0.3) + 0.02),
        "tail_wedge_tip": (-0.505, 0, 0.0), "tail_outer": (-0.41, 0.05, 0.0),
        "wrist_L": (0.18, -0.46, wz(0.46) + 0.02), "finger_P7_L": (tips[7].x, -tips[7].y, tips[7].z),
    }
    spec = {
        "tones": {"under": "under", "eye": "accent", "body": "body", "cov": "body",
                  "prim": "body", "tail": "body", "bill": "under", "bristle": "body", "hackle": "body"},
        "crease": 160,
        "hier": {"body": 1, "bill": 1, "tail": 1, "utc": 1, "cov": 2, "sec": 2, "prim": 2, "hackle": 3, "bristle": 3, "eye": 3},
        "hier_views": ["hero", "top"],
        "views": {
            "hero": {"dir": (0.75, -0.95, 0.55), "dist": 2.75, "lens": 58, "res": (1500, 1000),
                     "target": (0.0, 0.0, 0.03)},
            "front": {"dir": (1, 0, 0.0001), "ortho": 2.25, "dist": 4, "res": (900, 420), "target": (0, 0, 0.05)},
            "side": {"dir": (0, -1, 0.0001), "ortho": 1.18, "dist": 4, "res": (900, 420), "target": (0.0, 0, 0.02)},
            "top": {"dir": (0, 0, 1), "ortho": 2.25, "dist": 4, "res": (900, 560), "target": (-0.02, 0, 0),
                    "up": (1, 0, 0)},
            "under": {"dir": (0, 0, -1), "ortho": 2.25, "dist": 4, "res": (900, 560), "target": (-0.02, 0, 0),
                      "up": (1, 0, 0)},
            "head": {"dir": (0.75, -1, 0.2), "dist": 0.55, "lens": 55, "res": (700, 520),
                     "target": (0.36, 0, 0.03)},
            "wing": {"dir": (0.1, -0.25, 1), "dist": 1.6, "lens": 55, "res": (700, 520),
                     "target": (-0.02, 0.7, 0.06), "up": (1, 0, 0)},
            "tail": {"dir": (-0.75, -0.2, 0.8), "dist": 0.95, "lens": 55, "res": (700, 520),
                     "target": (-0.34, 0, 0.0)},
        },
        "ink_views": ["hero", "side", "under"],
        "sil_views": ["hero", "side", "under"],
    }
    return b, lm, spec
