"""Form-method read-outs P1 (profile distance) and P7 (single-section distance), as design artefacts.

DESIGN AND RESEARCH ARTEFACT ONLY (owner decision D-5, decision packet section 0.3). Standalone,
Python 3 standard library only, imported by nothing in packages/, apps/ or experiments/. It computes
informative read-outs for the proposed form method; it is not a gate and judges no beauty.

Units: model units of the object (L for the raven). Every distance is returned together with a
numerical bound or a convergence figure, because boundaries are sampled.
"""
import math

Point = tuple


def polygon_edges(poly):
    return [(poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))]


def _seg_dist(p, a, b):
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    ll = dx * dx + dy * dy
    if ll == 0.0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / ll
    t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def boundary_distance(p, poly):
    return min(_seg_dist(p, a, b) for a, b in polygon_edges(poly))


def sample_boundary(poly, step):
    pts = []
    for a, b in polygon_edges(poly):
        n = max(1, int(math.ceil(math.hypot(b[0] - a[0], b[1] - a[1]) / step)))
        for k in range(n):
            t = k / n
            pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return pts


def hausdorff_boundaries(p, q, step):
    """Hausdorff distance between the boundaries of polygons p and q.

    Each boundary is sampled at spacing <= step; distance to the other boundary is exact for each
    sample. Distance to a fixed set is 1-Lipschitz along a boundary, so the true value lies in
    [value, value + step / 2]. Returns (value, bound)."""
    d1 = max(boundary_distance(s, q) for s in sample_boundary(p, step))
    d2 = max(boundary_distance(s, p) for s in sample_boundary(q, step))
    return max(d1, d2), step / 2.0


def normalise(poly):
    """Bounding-box centre to the origin, each axis scaled so the box is [-1, 1]^2 (method P1)."""
    xs = [x for x, _ in poly]
    ys = [y for _, y in poly]
    cx, cy = (max(xs) + min(xs)) / 2.0, (max(ys) + min(ys)) / 2.0
    hx, hy = (max(xs) - min(xs)) / 2.0, (max(ys) - min(ys)) / 2.0
    return [((x - cx) / hx, (y - cy) / hy) for x, y in poly]


def profile_distance(a, b, symmetric=True, step=0.002, rotation_steps=720):
    """P1 profile distance d in half-extents, minimised over admissible frame changes.

    symmetric=True: identity and the mirror x -> -x. symmetric=False: rotations in the plane on a
    grid of rotation_steps (the grid adds at most pi/rotation_steps * sqrt(2) to the bound).
    Returns (d, bound)."""
    na = normalise(a)
    candidates = []
    if symmetric:
        nb = normalise(b)
        candidates = [nb, [(-x, y) for x, y in nb]]
        extra = 0.0
    else:
        for k in range(rotation_steps):
            t = 2.0 * math.pi * k / rotation_steps
            c, s = math.cos(t), math.sin(t)
            candidates.append(normalise([(c * x - s * y, s * x + c * y) for x, y in b]))
        extra = math.pi / rotation_steps * math.sqrt(2.0) * 2.0
    best = (math.inf, 0.0)
    for cand in candidates:
        d, bound = hausdorff_boundaries(na, cand, step)
        if d < best[0]:
            best = (d, bound)
    return best[0], best[1] + extra


def is_convex(poly):
    sign = 0
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        cx, cy = poly[(i + 2) % n]
        cr = (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
        if abs(cr) < 1e-15:
            continue
        s = 1 if cr > 0 else -1
        if sign == 0:
            sign = s
        elif s != sign:
            return False
    return True


def _ccw(poly):
    area = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1]
               for i in range(len(poly)))
    return poly if area > 0 else list(reversed(poly))


def _ray_exit(c, theta, poly):
    """Distance from c along direction theta to the boundary of a convex polygon containing c."""
    dx, dy = math.cos(theta), math.sin(theta)
    best = math.inf
    for (ax, ay), (bx, by) in polygon_edges(poly):
        ex, ey = bx - ax, by - ay
        den = dx * ey - dy * ex
        if abs(den) < 1e-18:
            continue
        t = ((ax - c[0]) * ey - (ay - c[1]) * ex) / den
        u = ((ax - c[0]) * dy - (ay - c[1]) * dx) / den
        if t >= 0.0 and -1e-12 <= u <= 1.0 + 1e-12:
            best = min(best, t)
    return best


def _inside_convex(p, poly):
    for (ax, ay), (bx, by) in polygon_edges(poly):
        if (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) < 0.0:
            return False
    return True


def _dist_to_convex(p, poly):
    return 0.0 if _inside_convex(p, poly) else boundary_distance(p, poly)


def common_point(polys):
    """A point inside every polygon on the vertical line x = 0, or None."""
    lo = max(min(y for _, y in p) for p in polys)
    hi = min(max(y for _, y in p) for p in polys)
    if lo >= hi:
        return None
    c = (0.0, (lo + hi) / 2.0)
    return c if all(_inside_convex(c, _ccw(p)) for p in polys) else None


def single_section_distance(slices, rays=3600):
    """P7 (M3) e_v for one view: min over slices of H(boundary of the union, boundary of the slice).

    Preconditions, checked: every slice is convex and all slices share an interior point c, so the
    union is star-shaped about c and its boundary is sampled exactly on `rays` rays. For a convex
    slice contained in the union, H equals the one-sided distance from the union's boundary to the
    slice (proof in the README), which is what is computed. Returns a dict with e_v, the index of the
    best slice, and the number of rays."""
    polys = [_ccw(list(p)) for p in slices]
    if not all(is_convex(p) for p in polys):
        return {"applicable": False, "reason": "a slice is not convex"}
    c = common_point(polys)
    if c is None:
        return {"applicable": False, "reason": "no common interior point on x = 0"}
    boundary = []
    for k in range(rays):
        th = 2.0 * math.pi * k / rays
        r = max(_ray_exit(c, th, p) for p in polys)
        boundary.append((c[0] + r * math.cos(th), c[1] + r * math.sin(th)))
    best_i, best = None, math.inf
    for i, p in enumerate(polys):
        worst = 0.0
        for q in boundary:
            d = _dist_to_convex(q, p)
            if d > worst:
                worst = d
                if worst >= best:
                    break
        if worst < best:
            best_i, best = i, worst
    return {"applicable": True, "e_v": best, "best_slice": best_i, "rays": rays}


def cube_diagonal_slices(n=300):
    """Slices of the unit cube [0,1]^3 perpendicular to the body diagonal, projected onto the view plane.

    n must be a multiple of 6 so that the levels through the six side vertices (1/3 and 2/3 of the
    diagonal) and the middle hexagon (1/2) are sampled exactly."""
    d = (1 / math.sqrt(3),) * 3
    e1 = (1 / math.sqrt(2), -1 / math.sqrt(2), 0.0)
    e2 = (1 / math.sqrt(6), 1 / math.sqrt(6), -2 / math.sqrt(6))
    verts = [(x, y, z) for x in (0, 1) for y in (0, 1) for z in (0, 1)]
    edges = [(a, b) for a in verts for b in verts if a < b and sum(abs(a[i] - b[i]) for i in range(3)) == 1]
    out = []
    for k in range(1, n):
        level = math.sqrt(3) * k / n
        pts = []
        for a, b in edges:
            da = sum(a[i] * d[i] for i in range(3)) - level
            db = sum(b[i] * d[i] for i in range(3)) - level
            if da == db or da * db > 0:
                continue
            t = da / (da - db)
            p = [a[i] + (b[i] - a[i]) * t for i in range(3)]
            pts.append((sum(p[i] * e1[i] for i in range(3)) - (0.5 * e1[0] + 0.5 * e1[1] + 0.5 * e1[2]),
                        sum(p[i] * e2[i] for i in range(3)) - (0.5 * e2[0] + 0.5 * e2[1] + 0.5 * e2[2])))
        uniq = []
        for p in pts:
            if all(math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-12 for q in uniq):
                uniq.append(p)
        if len(uniq) >= 3:
            cx = sum(p[0] for p in uniq) / len(uniq)
            cy = sum(p[1] for p in uniq) / len(uniq)
            uniq.sort(key=lambda p: math.atan2(p[1] - cy, p[0] - cx))
            out.append(uniq)
    return out


def coefficient_of_variation(values):
    m = sum(values) / len(values)
    if m == 0:
        return 0.0
    var = sum((v - m) ** 2 for v in values) / len(values)
    return math.sqrt(var) / abs(m)


def catmull_rom(p0, p1, p2, p3, t):
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                  + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)


def program_stations(keys, sub):
    """Re-implementation of formkit.program (docs/art/form-studies/source/formkit.py lines 70-94):
    keys are (x, zc, w, h, ring, tag); Catmull-Rom inside each run of one tag."""
    out = []
    i, n = 0, len(keys)
    flat = [[k[0], k[1], k[2], k[3]] + [c for pt in k[4] for c in pt] for k in keys]
    while i < n - 1:
        j = i
        while j + 1 < n - 1 and keys[j + 1][5] == keys[i][5]:
            j += 1
        seg = flat[i:j + 2]
        ext = [[2 * a - b for a, b in zip(seg[0], seg[1])]] + seg + [[2 * a - b for a, b in zip(seg[-1], seg[-2])]]
        for q in range(len(seg) - 1):
            for s_ in range(sub):
                t = s_ / sub
                vals = [catmull_rom(ext[q][c], ext[q + 1][c], ext[q + 2][c], ext[q + 3][c], t)
                        for c in range(len(seg[0]))]
                ring = [(vals[4 + 2 * r], vals[5 + 2 * r]) for r in range(len(keys[0][4]))]
                out.append((vals[0], vals[1], vals[2], vals[3], ring, keys[i][5]))
        i = j + 1
    out.append(tuple(keys[-1]))
    return out


def section_polygon(w, h, zc, ring):
    """End-view polygon of one station: profile (s, u) scaled by (w, h), raised by zc."""
    return [(s * w, zc + u * h) for s, u in ring]


def linear_slices(stations, per_interval):
    """Stations (w, h, zc, ring) joined by linear interpolation, sampled per_interval times."""
    out = []
    for (w0, h0, z0, r0), (w1, h1, z1, r1) in zip(stations, stations[1:]):
        for k in range(per_interval):
            t = k / per_interval
            ring = [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) for a, b in zip(r0, r1)]
            out.append(section_polygon(w0 + (w1 - w0) * t, h0 + (h1 - h0) * t, z0 + (z1 - z0) * t, ring))
    w, h, z, r = stations[-1]
    out.append(section_polygon(w, h, z, r))
    return out
