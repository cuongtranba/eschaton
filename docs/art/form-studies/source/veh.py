"""Vehicle form study: a small sedan, before and after the method. DESIGN ARTIFACT ONLY.

Follows docs/art/form-studies/brief.md §1. Units: L = bumper to bumper (x from +0.5 at the nose
to -0.5 at the tail), y across, z up, ground at z = 0. "before" rebuilds the failure mechanism
of method §2 (one section swept, a box cabin on a slab, wheels outside the body, equal fang
slats); "after" follows procedure steps 1-6. Not a model of any real car; not geometry.
"""
import math

from mathutils import Vector as V

import formkit as fk

AXLES = (0.33, -0.28)
R_TYRE, W_TYRE, Y_TYRE = 0.085, 0.052, 0.158
R_ARCH = 0.106


def wheels(m, y_off=Y_TYRE, n=24):
    for ax in AXLES:
        for s in (1, -1):
            c = V((ax, s * y_off, R_TYRE))
            yi, yo = c.y - s * W_TYRE / 2, c.y + s * W_TYRE / 2
            ring = [(math.cos(2 * math.pi * i / n), math.sin(2 * math.pi * i / n)) for i in range(n)]
            for i in range(n):
                a, b = ring[i], ring[(i + 1) % n]
                pa = [V((c.x + R_TYRE * a[0], yi, c.z + R_TYRE * a[1])), V((c.x + R_TYRE * b[0], yi, c.z + R_TYRE * b[1])),
                      V((c.x + R_TYRE * b[0], yo, c.z + R_TYRE * b[1])), V((c.x + R_TYRE * a[0], yo, c.z + R_TYRE * a[1]))]
                m.face("tyre", f"tread.{ax}.{s}", pa if s > 0 else pa[::-1])
            side = [V((c.x + R_TYRE * a[0], yo, c.z + R_TYRE * a[1])) for a in ring]
            m.face("tyre", f"wall.{ax}.{s}", side if s < 0 else side[::-1])
            hub = [V((c.x + 0.05 * a[0], yo + s * 0.008, c.z + 0.05 * a[1])) for a in ring[::2]]
            m.face("hub", f"hub.{ax}.{s}", hub if s < 0 else hub[::-1])
            m.kind(f"tread.{ax}.{s}", f"wall.{ax}.{s}", fk.FOLD)


VIEWS = {
    "three": {"dir": (0.95, -0.85, 0.42), "dist": 3.2, "lens": 60, "res": (1400, 900), "target": (0.0, 0.0, 0.2)},
    "side": {"dir": (0, -1, 0.0001), "ortho": 1.25, "dist": 4, "res": (1100, 560), "target": (0.0, 0, 0.24)},
    "front": {"dir": (1, 0, 0.0001), "ortho": 0.62, "dist": 4, "res": (700, 560), "target": (0, 0, 0.24)},
    "top": {"dir": (0, 0, 1), "ortho": 1.25, "dist": 4, "res": (1100, 560), "target": (0, 0, 0), "up": (1, 0, 0)},
}


def spec(extra=None):
    s = {"tones": {"body": "body", "cabin": "body", "glass": "glass", "tyre": "under", "hub": "body",
                   "grille": "glass", "lip": "body", "lamp": "accent", "slat": "under", "well": "under"},
         "crease": 165, "views": VIEWS, "sil_views": ["side", "three", "front"],
         "hier": {"body": 1, "cabin": 1, "glass": 2, "tyre": 2, "hub": 3, "grille": 2, "lip": 2, "lamp": 3, "slat": 2, "well": 2},
         "hier_views": [], "crease_views": ["three"]}
    s.update(extra or {})
    return s


def build_before():
    m = fk.Model()
    half = [(0, 0.27), (0.17, 0.27), (0.19, 0.25), (0.19, 0.14), (0.17, 0.12), (0, 0.12)]
    ring = fk.mirror_half(half)
    st = [(x, 0.0, 1.0, 1.0, ring, "tub") for x in (0.5, 0.3, 0.1, -0.1, -0.3, -0.5)]
    fk.section_loft(m, "body", st, lambda t, j: f"tub.{j}", cap_start="nose", cap_end="tail", slice_axis=(-1, 0, 0))
    cab = fk.mirror_half([(0, 0.44), (0.16, 0.44), (0.16, 0.27), (0, 0.27)])
    st = [(x, 0.0, 1.0, 1.0, cab, "cab") for x in (0.08, -0.06, -0.24)]
    fk.section_loft(m, "cabin", st, lambda t, j: f"cab.{j}", cap_start="ws", cap_end="bl", slice_axis=(-1, 0, 0))
    for s in (1, -1):
        for k, x in enumerate((0.04, -0.16)):
            q = [V((x, s * 0.1605, 0.29)), V((x - 0.12, s * 0.1605, 0.29)), V((x - 0.12, s * 0.1605, 0.42)),
                 V((x, s * 0.1605, 0.42))]
            m.face("glass", f"dlo{k}.{s}", q if s < 0 else q[::-1])
    for s in (1, -1):
        for y in (0.05, 0.11):
            root = V((0.501, s * y, 0.13))
            m.face("slat", f"fang.{s}.{y}", [root + V((0, -0.015, 0)), root + V((0, 0.015, 0)), root + V((0.01, 0, -0.07))])
    wheels(m, y_off=0.215)
    sp = spec({"section_strip": [("nose", half), ("axle", half), ("cabin", half), ("tail", half)]})
    return m, {}, sp


BODY_KEYS = [
    (0.500, [(0, 0.220), (0.140, 0.236), (0.172, 0.205), (0.168, 0.125), (0.150, 0.075), (0, 0.075)], "front"),
    (0.330, [(0, 0.268), (0.172, 0.292), (0.186, 0.262), (0.186, 0.150), (0.172, 0.075), (0, 0.075)], "front"),
    (0.140, [(0, 0.300), (0.168, 0.312), (0.186, 0.292), (0.188, 0.160), (0.176, 0.078), (0, 0.078)], "door1"),
    (-0.070, [(0, 0.308), (0.162, 0.318), (0.181, 0.300), (0.188, 0.160), (0.173, 0.080), (0, 0.080)], "door2"),
    (-0.170, [(0, 0.310), (0.166, 0.324), (0.183, 0.302), (0.188, 0.155), (0.172, 0.080), (0, 0.080)], "rear"),
    (-0.280, [(0, 0.312), (0.176, 0.334), (0.186, 0.304), (0.186, 0.150), (0.170, 0.080), (0, 0.080)], "rear"),
    (-0.500, [(0, 0.282), (0.150, 0.300), (0.166, 0.272), (0.160, 0.150), (0.140, 0.085), (0, 0.085)], "rear"),
]
STRIP = {0: "deck", 1: "shoulder.R", 2: "side.R", 3: "rocker.R", 4: "under", 5: "under", 6: "rocker.L",
         7: "side.L", 8: "shoulder.L", 9: "deck"}
GLASS_KEYS = [
    (0.150, [(0, 0.306), (0.150, 0.304), (0.168, 0.300), (0, 0.290)], "ws"),
    (0.020, [(0, 0.468), (0.118, 0.458), (0.160, 0.300), (0, 0.290)], "front"),
    (-0.075, [(0, 0.474), (0.116, 0.465), (0.160, 0.300), (0, 0.290)], "rear"),
    (-0.170, [(0, 0.470), (0.112, 0.460), (0.158, 0.300), (0, 0.290)], "bl"),
    (-0.340, [(0, 0.318), (0.120, 0.314), (0.150, 0.304), (0, 0.290)], "bl"),
]


def arch_clip(x, z):
    for ax in AXLES:
        dx = x - ax
        if abs(dx) < R_ARCH:
            za = R_TYRE + math.sqrt(R_ARCH * R_ARCH - dx * dx)
            return max(z, za)
    return z


def build_after():
    m = fk.Model()
    keys = [(x, 0.0, 1.0, 1.0, fk.mirror_half(h), t) for x, h, t in BODY_KEYS]
    st, _ = fk.program(keys, sub=10)
    clipped = []
    for x, zc, w, h, ring, tag in st:
        r = []
        for j, (y, z) in enumerate(ring):
            if j in (3, 4, 6, 7):
                z2 = arch_clip(x, z)
                r.append((y, min(z2, ring[2][1] - 0.006) if j in (3, 7) else min(z2, ring[2][1] - 0.004)))
            else:
                r.append((y, z))
        clipped.append((x, zc, w, h, r, tag))

    def body_panel(tag, j):
        name = STRIP[j]
        if name.startswith("side") or name.startswith("rocker"):
            return f"{name}.{tag}"
        return name
    fk.section_loft(m, "body", clipped, body_panel, cap_start="fascia", cap_end="tailpanel", slice_axis=(-1, 0, 0))
    for side in ("R", "L"):
        for a, b in (("door1", "door2"), ("front", "door1"), ("door2", "rear")):
            for part in ("side", "rocker"):
                m.kind(f"{part}.{side}.{a}", f"{part}.{side}.{b}", fk.SEAM)
    gkeys = [(x, 0.0, 1.0, 1.0, fk.mirror_half(h), t) for x, h, t in GLASS_KEYS]
    gst, _ = fk.program(gkeys, sub=6)

    def glass_panel(tag, j):
        top = j in (0, 5)
        if j in (2, 3):
            return "cabin.base"
        side = "R" if j < 3 else "L"
        if tag == "ws":
            return "ws.glass" if top else f"dlo.quarter.{side}"
        if tag == "bl":
            return "bl.glass" if top else f"cpillar.{side}"
        return "roof" if top else f"dlo.{tag}.{side}"
    rings = fk.section_loft(m, "cabin", gst, glass_panel, slice_axis=(-1, 0, 0))
    m.faces = [("glass" if (n.endswith("glass") or n.startswith("dlo")) else p, n, pts) if p == "cabin" else (p, n, pts)
               for p, n, pts in m.faces]
    for side in ("R", "L"):
        for a, b in ((f"dlo.front.{side}", "roof"), (f"dlo.rear.{side}", "roof"), (f"dlo.front.{side}", f"dlo.rear.{side}"),
                     (f"dlo.rear.{side}", f"cpillar.{side}"), (f"dlo.front.{side}", "ws.glass"), (f"cpillar.{side}", "roof"),
                     (f"cpillar.{side}", "bl.glass"), (f"dlo.quarter.{side}", f"dlo.front.{side}"),
                     (f"dlo.quarter.{side}", "ws.glass"), (f"dlo.quarter.{side}", "roof")):
            m.kind(a, b, fk.SEAM)
    for a, b in (("roof", "ws.glass"), ("roof", "bl.glass")):
        m.kind(a, b, fk.SEAM)
    wells = []
    for p, n, pts in m.faces:
        if p == "body" and n.split(".")[0] in ("rocker", "under"):
            cx = sum(q.x for q in pts) / len(pts)
            cz = sum(q.z for q in pts) / len(pts)
            ax = next((a for a in AXLES if abs(cx - a) < R_ARCH), None)
            if ax is not None and cz > 0.09:
                wells.append(("well", f"well.{ax}", pts))
                continue
        wells.append((p, n, pts))
    m.faces = wells
    for s in (1, -1):
        for ax in AXLES:
            n = 14
            pts_o, pts_i = [], []
            for i in range(n + 1):
                a = math.radians(-8 + (196 * i / n))
                x = ax + math.cos(a) * R_ARCH
                z = R_TYRE + math.sin(a) * R_ARCH
                yb = 0.188
                pts_i.append(V((x, s * yb, z)))
                pts_o.append(V((x + math.cos(a) * 0.014, s * (yb + 0.01), z + math.sin(a) * 0.014)))
            for i in range(n):
                q = [pts_i[i], pts_i[i + 1], pts_o[i + 1], pts_o[i]]
                m.face("lip", f"lip.{ax}.{s}", q if s > 0 else q[::-1])
    gr = [(0.06, 0.115), (0.1, 0.112), (0.118, 0.13), (0.118, 0.19), (0.1, 0.205), (0.06, 0.208),
          (-0.06, 0.208), (-0.1, 0.205), (-0.118, 0.19), (-0.118, 0.13), (-0.1, 0.112), (-0.06, 0.115)]
    m.face("grille", "grille", [V((0.5025, y, z)) for y, z in gr][::-1])
    for k, (z, half_w) in enumerate(((0.135, 0.085), (0.16, 0.104), (0.185, 0.094))):
        m.face("slat", f"bar{k}", [V((0.505, half_w, z - 0.004)), V((0.505, -half_w, z - 0.004)),
                                    V((0.505, -half_w, z + 0.004)), V((0.505, half_w, z + 0.004))])
    for s in (1, -1):
        c = V((0.494, s * 0.140, 0.205))
        lamp = [c + V((0, s * 0.022 * math.cos(2 * math.pi * i / 8), 0.018 * math.sin(2 * math.pi * i / 8)))
                for i in range(8)]
        m.face("lamp", f"lamp.{s}", lamp if s < 0 else lamp[::-1])
        bump = [V((0.508, s * 0.0, 0.075)), V((0.508, s * 0.16, 0.075)), V((0.49, s * 0.172, 0.095)),
                V((0.506, s * 0.0, 0.095))]
        m.face("lip", "bumper", bump if s < 0 else bump[::-1])
    wheels(m)
    def with_glass(body, glass):
        return [glass[0], glass[1], glass[2]] + body[2:]
    labels = ("nose", "front axle", "cowl", "B-pillar + glass", "rear door + glass", "rear axle", "tail")
    halves = [k[1] for k in BODY_KEYS]
    halves[3] = with_glass(halves[3], GLASS_KEYS[2][1])
    halves[4] = with_glass(halves[4], GLASS_KEYS[3][1])
    strip = list(zip(labels, halves))
    strip_glass = [("windscreen head", GLASS_KEYS[1][1]), ("roof rear", GLASS_KEYS[3][1])]
    sections = {lab: fk.descriptors(fk.mirror_half(h), max(p[0] for p in h), max(p[1] for p in h) - min(p[1] for p in h))
                for lab, h in strip}
    return m, {}, spec({"section_strip": strip, "glass_strip": strip_glass, "sections": sections,
                        "hidden_panels": ["well", "under", "cabin.base", "fascia", "tailpanel"]})
