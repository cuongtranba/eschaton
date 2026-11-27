"""Tree form study (HOLDOUT): a dead tree, before and after. DESIGN ARTIFACT ONLY.

Follows docs/art/form-studies/brief.md §3 with the method exactly as committed in 449406b.
Units: H = ground to the highest tip; z up. "before": a cylinder trunk with one profile, equal
sticks at equal angles and heights, butt-joined with gaps. "after": procedure steps 1-6.
"""
import math

from mathutils import Vector as V

import formkit as fk

VIEWS = {
    "three": {"dir": (0.75, -1.0, 0.25), "dist": 4.0, "lens": 60, "res": (1000, 1100), "target": (0.0, 0.0, 0.46)},
    "side": {"dir": (0, -1, 0.0001), "ortho": 1.15, "dist": 4, "res": (800, 900), "target": (0.0, 0, 0.47)},
    "front": {"dir": (1, 0, 0.0001), "ortho": 1.15, "dist": 4, "res": (800, 900), "target": (0, 0, 0.47)},
    "top": {"dir": (0, 0, 1), "ortho": 0.9, "dist": 4, "res": (800, 800), "target": (0, 0, 0), "up": (0, 1, 0)},
}
HEX = [(math.cos(2 * math.pi * i / 6 + 0.3), math.sin(2 * math.pi * i / 6 + 0.3)) for i in range(6)]


def spec(extra=None):
    s = {"tones": {"bark": "body", "stick": "body", "break": "under"}, "crease": 165, "views": VIEWS,
         "sil_views": ["side", "three"], "hier": {}, "hier_views": [], "crease_views": ["three"]}
    s.update(extra or {})
    return s


def tube(m, part, name, spine, radii, ring=HEX, flat=None, panel_of=None, cap=True, sub=4):
    """A limb: rings perpendicular to a polyline spine. radii per spine point; flat = (w, h) scales."""
    pts, rs, fl = [], [], []
    for i in range(len(spine) - 1):
        for s_ in range(sub):
            t = s_ / sub
            pts.append(spine[i].lerp(spine[i + 1], t))
            rs.append(radii[i] + (radii[i + 1] - radii[i]) * t)
            f0 = flat[i] if flat else (1, 1)
            f1 = flat[i + 1] if flat else (1, 1)
            fl.append((f0[0] + (f1[0] - f0[0]) * t, f0[1] + (f1[1] - f0[1]) * t))
    pts.append(spine[-1])
    rs.append(radii[-1])
    fl.append(flat[-1] if flat else (1, 1))
    n = len(pts)
    rings = []
    for i in range(n):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, n - 1)]
        t = (b - a).normalized()
        ref = V((0, 1, 0)) if abs(t.y) < 0.9 else V((1, 0, 0))
        s = ref.cross(t).normalized()
        u = t.cross(s).normalized()
        rings.append([pts[i] + s * (y * rs[i] * fl[i][0]) + u * (z * rs[i] * fl[i][1]) for y, z in ring])
    k = len(ring)
    for i in range(n - 1):
        for j in range(k):
            jj = (j + 1) % k
            pn = panel_of(i, j) if panel_of else f"{name}.{j}"
            q = [rings[i][j], rings[i][jj], rings[i + 1][jj], rings[i + 1][j]]
            m.face(part, pn, [q[0], q[1], q[2]])
            m.face(part, pn, [q[0], q[2], q[3]])
    if cap:
        m.face("break" if part == "bark" else part, f"{name}.end", rings[-1])
    return pts


def build_before():
    m = fk.Model()
    trunk = [V((0, 0, 0)), V((0, 0, 0.75))]
    tube(m, "stick", "trunk", trunk, [0.04, 0.04], ring=HEX)
    for z in (0.45, 0.65):
        for k in range(4):
            a = k * math.pi / 2
            d = V((math.cos(a) * 0.7071, math.sin(a) * 0.7071, 0.7071))
            p0 = V((0, 0, z)) + V((math.cos(a), math.sin(a), 0)) * 0.048
            tube(m, "stick", f"stick{z}.{k}", [p0, p0 + d * 0.25], [0.012, 0.012])
    hexr = [(0.04 * x, 0.04 * y) for x, y in HEX]
    strip = [("base", hexr), ("mid", hexr), ("below fork", hexr)]
    return m, {}, spec({"section_strip": strip})


LOBED = [(math.cos(2 * math.pi * i / 10) * (1.0 if i % 2 == 0 else 0.72),
          math.sin(2 * math.pi * i / 10) * (1.0 if i % 2 == 0 else 0.72)) for i in range(10)]
OVAL = [(math.cos(2 * math.pi * i / 10) * (1.0 if i % 2 == 0 else 0.70),
         math.sin(2 * math.pi * i / 10) * (1.0 if i % 2 == 0 else 0.70)) for i in range(10)]


def branch(m, name, root, d, length, r0, r1, bend=V((0, 0, 0.0)), steps=3):
    d = d.normalized()
    spine = [root + d * (length * i / steps) + bend * (length * (i / steps) ** 2) for i in range(steps + 1)]
    radii = [r0 + (r1 - r0) * i / steps for i in range(steps + 1)]
    return tube(m, "bark", name, spine, radii)


def at(path, t):
    seg = (len(path) - 1) * t
    i = min(int(seg), len(path) - 2)
    return path[i].lerp(path[i + 1], seg - i)


def build_after():
    m = fk.Model()
    keys = [(0.00, -0.000, 0.088, 0.088, LOBED, "trunk"), (0.06, -0.004, 0.056, 0.054, LOBED, "trunk"),
            (0.25, -0.018, 0.039, 0.046, OVAL, "trunk"), (0.40, -0.040, 0.032, 0.054, OVAL, "trunk"),
            (0.45, -0.050, 0.029, 0.048, OVAL, "trunk")]
    st, _ = fk.program(keys, sub=5)
    lo = [(z, x, w, h, ring, tag) for z, x, w, h, ring, tag in st]
    fk.section_loft(m, "bark", lo, lambda t, j: f"trunk.{j}", slice_axis=(1, 0, 0), up=V((0, 0, 1)),
                    cap_start="trunk.base")
    m.faces = [(p, n, [V((-q.z, q.y, q.x)) for q in pts]) for p, n, pts in m.faces]
    fork = V((0.05, 0.0, 0.43))
    a = [fork, V((0.15, 0.02, 0.60)), V((0.235, 0.0, 0.78)), V((0.262, -0.012, 0.88))]
    tube(m, "bark", "limbA", a, [0.036, 0.028, 0.018, 0.013])
    b = [fork + V((-0.01, 0.0, 0.0)), V((-0.07, 0.05, 0.57)), V((-0.17, 0.085, 0.68)), V((-0.27, 0.10, 0.73))]
    tube(m, "bark", "limbB", b, [0.031, 0.023, 0.014, 0.007])
    g2 = [("a1", a, 0.33, V((-0.35, -0.55, 1.0)), 0.23, 0.016, 0.005, V((0.1, 0, -0.15))),
          ("a2", a, 0.64, V((1.0, 0.25, 0.55)), 0.17, 0.012, 0.004, V((0, 0, 0.25))),
          ("a3", a, 0.86, V((-0.4, 0.6, 0.9)), 0.09, 0.008, 0.003, V((0, 0, 0))),
          ("b1", b, 0.42, V((0.15, 0.35, 1.0)), 0.20, 0.013, 0.004, V((-0.15, 0, 0))),
          ("b2", b, 0.76, V((-0.8, -0.3, -0.25)), 0.13, 0.009, 0.003, V((0, 0, 0.3)))]
    paths = {}
    for nm, par, t, d, L, r0, r1, bend in g2:
        paths[nm] = branch(m, nm, at(par, t), d, L, r0, r1, bend)
    g3 = [("a1t", "a1", 0.55, V((0.6, -0.2, 0.8)), 0.085, 0.006, 0.0025),
          ("a2t", "a2", 0.5, V((0.4, -0.5, 1.0)), 0.07, 0.005, 0.002),
          ("b1t", "b1", 0.6, V((-0.7, 0.3, 0.6)), 0.08, 0.005, 0.002)]
    for nm, par, t, d, L, r0, r1 in g3:
        branch(m, nm, at(paths[par], t), d, L, r0, r1)
    strip = [("root flare", [(x * 0.088, y * 0.088) for x, y in LOBED]),
             ("lower trunk", [(x * 0.056, y * 0.054) for x, y in LOBED]),
             ("mid trunk, fluted oval", [(x * 0.039, y * 0.046) for x, y in OVAL]),
             ("below fork, flattened", [(x * 0.032, y * 0.054) for x, y in OVAL])]
    series = {"generations": "gen1: 2 limbs (0.47, 0.39); gen2: 5 branches, 0.09-0.23, at uneven stations "
                             "0.33/0.64/0.86 and 0.42/0.76; gen3: 3 twigs, 0.07-0.085"}
    return m, {}, spec({"section_strip": strip, "series_note": series})
