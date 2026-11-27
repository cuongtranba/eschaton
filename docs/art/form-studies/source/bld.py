"""Building form study (HOLDOUT): a three-tier tower, before and after. DESIGN ARTIFACT ONLY.

Follows docs/art/form-studies/brief.md §2 with the method exactly as committed in 449406b.
Units: H = ground to finial tip; square plan centred on the origin; z up. "before": tiers that
are one box scaled, flat slab roofs with no overhang, equal spacing, decal openings. "after":
procedure steps 1-6. A generic tower in the reference's pagoda language; not a real building.
"""
import math

from mathutils import Vector as V

import formkit as fk

VIEWS = {
    "three": {"dir": (0.9, -1.1, 0.55), "dist": 4.6, "lens": 60, "res": (1000, 1100), "target": (0.0, 0.0, 0.47)},
    "side": {"dir": (0, -1, 0.0001), "ortho": 1.12, "dist": 4, "res": (800, 900), "target": (0.0, 0, 0.5)},
    "front": {"dir": (0.70711, -0.70711, 0.0001), "ortho": 1.12, "dist": 4, "res": (800, 900), "target": (0, 0, 0.5)},
    "top": {"dir": (0, 0, 1), "ortho": 1.0, "dist": 4, "res": (800, 800), "target": (0, 0, 0), "up": (0, 1, 0)},
}


def spec(extra=None):
    s = {"tones": {"wall": "body", "roof": "body", "podium": "under", "slab": "body", "open": "glass",
                   "finial": "body", "fascia": "under", "decal": "glass"},
         "crease": 165, "views": VIEWS, "sil_views": ["side", "three"], "hier": {}, "hier_views": [],
         "crease_views": ["three"]}
    s.update(extra or {})
    return s


def box(m, part, panel, x0, x1, y0, y1, z0, z1, top=True):
    c = [V((x0, y0, z0)), V((x1, y0, z0)), V((x1, y1, z0)), V((x0, y1, z0)),
         V((x0, y0, z1)), V((x1, y0, z1)), V((x1, y1, z1)), V((x0, y1, z1))]
    faces = {"s": (0, 1, 5, 4), "e": (1, 2, 6, 5), "n": (2, 3, 7, 6), "w": (3, 0, 4, 7), "t": (4, 5, 6, 7)}
    for k, idx in faces.items():
        if k == "t" and not top:
            continue
        m.face(part, f"{panel}.{k}", [c[i] for i in idx])


def build_before():
    m = fk.Model()
    box(m, "podium", "podium", -0.31, 0.31, -0.31, 0.31, 0.0, 0.10)
    z = 0.10
    for k, s in enumerate((1.0, 0.76, 0.54)):
        a = 0.22 * s
        box(m, "wall", f"wall{k}", -a, a, -a, a, z, z + 0.16, top=False)
        box(m, "slab", f"slab{k}", -a, a, -a, a, z + 0.16, z + 0.20)
        for side in range(4):
            c, sn = math.cos(side * math.pi / 2), math.sin(side * math.pi / 2)
            w, y = 0.05 * s, -a - 0.002
            q = [V((x * c - y * sn, x * sn + y * c, zz)) for x, zz in ((-w, z + 0.04), (w, z + 0.04), (w, z + 0.10),
                                                                    (-w, z + 0.10))]
            m.face("decal", f"decal{k}.{side}", q)
        z += 0.26
    box(m, "finial", "fin", -0.02, 0.02, -0.02, 0.02, z - 0.06, z + 0.12)
    strip = [("tier 1", [(0, 1.0), (1.0, 1.0), (1.0, -1.0), (0, -1.0)]),
             ("tier 2", [(0, 0.76), (0.76, 0.76), (0.76, -0.76), (0, -0.76)]),
             ("tier 3", [(0, 0.54), (0.54, 0.54), (0.54, -0.54), (0, -0.54)])]
    return m, {}, spec({"section_strip": strip})


TIERS = [  # wall half-width, wall base z, wall top z, eave half-width, eave z, corner lift, roof top half-width
    (0.220, 0.100, 0.300, 0.330, 0.330, 0.050, 0.172),
    (0.167, 0.392, 0.520, 0.252, 0.560, 0.038, 0.125),
    (0.119, 0.608, 0.700, 0.185, 0.760, 0.028, 0.030),
]
PER_SIDE = 12


def square_ring(a, z, lift, n=PER_SIDE, corrugate=0.0):
    """Points around a square of half-width a; eave corners lifted (curved eave line)."""
    pts = []
    for side in range(4):
        for i in range(n):
            t = -1 + 2 * i / n
            corner = abs(t) ** 2.2
            off = corrugate * (1 if i % 2 else -1) if 0 < i else 0.0
            x, y = t * a, -a
            c, s = math.cos(side * math.pi / 2), math.sin(side * math.pi / 2)
            pts.append(V((x * c - y * s, x * s + y * c, z + lift * corner + off)))
    return pts


def roof(m, k, wall_a, eave_a, eave_z, lift, top_a, top_z, wall_top):
    """Hip roof as a bent sheet: steep upper slope, flared eave; corrugation is a declared tessellation."""
    rings = []
    for r in range(6):
        u = r / 5
        a_u = top_a + (eave_a - top_a) * u
        z_u = top_z - (top_z - eave_z) * (1 - (1 - u) ** 1.7)
        rings.append(square_ring(a_u, z_u, lift * u ** 3, corrugate=0.011 * u ** 0.6 if r else 0.0))
    n = len(rings[0])
    for r in range(5):
        for i in range(n):
            j = (i + 1) % n
            side = i // PER_SIDE
            q = [rings[r][i], rings[r][j], rings[r + 1][j], rings[r + 1][i]]
            m.face("roof", f"roof{k}.{side}.{i % PER_SIDE}", [q[0], q[1], q[2]])
            m.face("roof", f"roof{k}.{side}.{i % PER_SIDE}", [q[0], q[2], q[3]])
    hem = [p + V((0, 0, -0.018)) for p in rings[-1]]
    for i in range(n):
        j = (i + 1) % n
        m.face("fascia", f"fascia{k}.{i // PER_SIDE}", [rings[-1][i], hem[i], hem[j], rings[-1][j]])
    soffit = square_ring(wall_a, wall_top, 0.0)
    for i in range(n):
        j = (i + 1) % n
        m.face("fascia", f"soffit{k}.{i // PER_SIDE}", [hem[i], soffit[i], soffit[j], hem[j]])


def wall_with_opening(m, k, a, z0, z1, ow, oz0, oz1, depth=0.018):
    for side in range(4):
        c, s = math.cos(side * math.pi / 2), math.sin(side * math.pi / 2)

        def P(x, z, d=0.0):
            y = -a + d
            return V((x * c - y * s, x * s + y * c, z))
        pn = f"wall{k}.{side}"
        xs, zs = (-a, -ow, ow, a), (z0, oz0, oz1, z1)
        for i in range(3):
            for j in range(3):
                if i == 1 and j == 1:
                    continue
                q = [P(xs[i], zs[j]), P(xs[i + 1], zs[j]), P(xs[i + 1], zs[j + 1]), P(xs[i], zs[j + 1])]
                m.face("wall", pn, q)
        m.face("open", f"open{k}.{side}", [P(-ow, oz0, depth), P(ow, oz0, depth), P(ow, oz1, depth), P(-ow, oz1, depth)])
        da = P(0, 0, depth) - P(0, 0)
        for e, (qa, qb) in enumerate(((P(-ow, oz0), P(ow, oz0)), (P(ow, oz0), P(ow, oz1)), (P(ow, oz1), P(-ow, oz1)),
                                      (P(-ow, oz1), P(-ow, oz0)))):
            m.face("wall", f"jamb{k}.{side}.{e}", [qa, qb, qb + da, qa + da])


def build_after():
    m = fk.Model()
    box(m, "podium", "podium", -0.31, 0.31, -0.31, 0.31, 0.0, 0.085)
    box(m, "podium", "plinth", -0.285, 0.285, -0.285, 0.285, 0.085, 0.100)
    for k, (a, z0, z1, ea, ez, lift, ta) in enumerate(TIERS):
        door = (0.045, z0 + 0.0, z0 + 0.11) if k == 0 else (0.032 if k == 1 else 0.024, z0 + 0.035, z0 + 0.09 - 0.012 * k)
        wall_with_opening(m, k, a, z0, z1, *door)
        top_z = TIERS[k + 1][1] if k < 2 else 0.86
        roof(m, k, a, ea, ez, lift, ta if k < 2 else 0.03, top_z, z1)
    fin = [(0.86, 0.030), (0.90, 0.020), (0.93, 0.026), (0.96, 0.012), (1.0, 0.0)]
    ring8 = [(math.cos(2 * math.pi * i / 8), math.sin(2 * math.pi * i / 8)) for i in range(8)]
    st = [(z, 0.0, r, r, ring8, f"band{i}") for i, (z, r) in enumerate(fin)]
    fk.section_loft(m, "finial", st, lambda t, j: f"fin.{t}.{j // 2}", slice_axis=(1, 0, 0))
    m.faces = [(p, n, [V((q.y, q.z, q.x)) if p == "finial" else q for q in pts]) if p == "finial" else (p, n, pts)
               for p, n, pts in m.faces]
    strip = [("podium", [(0, 1.0), (1.0, 1.0), (1.0, -1.0), (0, -1.0)]),
             ("roof 1, upper", [(0, 0.10), (0.78, 0.0), (0.78, -0.05), (0, -0.05)]),
             ("roof 1, eave", [(0, 0.10), (1.0, -0.03), (1.0, -0.08), (0, -0.05)]),
             ("tier 2 wall", [(0, 0.76), (0.76, 0.76), (0.76, -0.76), (0, -0.76)]),
             ("tier 3 wall", [(0, 0.54), (0.54, 0.54), (0.54, -0.54), (0, -0.54)])]
    return m, {}, spec({"section_strip": strip, "hidden_panels": ["soffit", "podium.t", "plinth.t"]})
