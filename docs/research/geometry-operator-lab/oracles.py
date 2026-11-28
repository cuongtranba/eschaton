"""Independent oracles for laboratory milestone M1 (O1 section transition), contract v1.1 section 8.

RESEARCH ARTEFACT ONLY (owner decisions D-3 and D-5). Python 3 standard library only. This module must
not import the implementation (o1.py); a test checks that. Each oracle uses a different algorithm from
the implementation: brute-force hulls instead of the edge merge, tetrahedra instead of the prismoidal
formula, direct support sets instead of the merge pointer. Exact oracles use integers and Fractions.
"""
import math
from fractions import Fraction
from itertools import combinations


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def cross3(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def prim(v):
    g = 0
    for c in v:
        g = math.gcd(g, abs(c))
    return tuple(c // g for c in v)


def cross2(a, b):
    return a[0] * b[1] - a[1] * b[0]


def hull2(points):
    """Exact monotone-chain convex hull, collinear points removed, counter-clockwise."""
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross2(sub(lower[-1], lower[-2]), sub(p, lower[-1])) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross2(sub(upper[-1], upper[-2]), sub(p, upper[-1])) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def lateral_facets(points3):
    """Oracle H: brute-force convex hull facets of a 3D point set, minus facets with normal (0, 0, +-1).

    Every triple spanning a plane with all points on one side gives a supporting plane; triples are
    grouped by their primitive outward plane; the facet is the set of extreme points of each group."""
    pts = sorted(set(tuple(p) for p in points3))
    planes = {}
    for p, q, r in combinations(pts, 3):
        n = cross3(sub(q, p), sub(r, p))
        if n == (0, 0, 0):
            continue
        d = dot(n, p)
        side = [dot(n, s) - d for s in pts]
        if all(v <= 0 for v in side):
            pass
        elif all(v >= 0 for v in side):
            n, d = tuple(-c for c in n), -d
        else:
            continue
        g = 0
        for c in n:
            g = math.gcd(g, abs(c))
        key = (tuple(c // g for c in n), d // g)
        planes.setdefault(key, set()).update([p, q, r])
    facets = set()
    for (n, d), group in planes.items():
        if n[0] == 0 and n[1] == 0:
            continue
        on = [s for s in pts if dot(n, s) == d]
        drop = max(range(3), key=lambda i: abs(n[i]))
        keep = [i for i in range(3) if i != drop]
        proj = {tuple(s[i] for i in keep): s for s in on}
        facets.add(frozenset(proj[v] for v in hull2(list(proj))))
    return facets


def support(points2, n):
    return max(dot(n, p) for p in points2)


def support_set(points2, n):
    h = support(points2, n)
    return sorted(tuple(p) for p in points2 if dot(n, p) == h)


def minkowski_hull(a, b, t):
    """Oracle K: (1 - t) A + t B by all pairwise sums and an exact hull (t a Fraction)."""
    return hull2([((1 - t) * p[0] + t * q[0], (1 - t) * p[1] + t * q[1]) for p in a for q in b])


def shoelace(poly):
    """Oracle Ar: signed area (Fraction) of a polygon given as a vertex list."""
    s = 0
    n = len(poly)
    for i in range(n):
        s += Fraction(poly[i][0]) * poly[(i + 1) % n][1] - Fraction(poly[(i + 1) % n][0]) * poly[i][1]
    return s / 2


def slice_band(faces, z):
    """The polygon cut from the band surface by the plane at height z (exact; Fractions)."""
    pts = []
    for f in faces:
        n = len(f)
        for i in range(n):
            p, q = f[i], f[(i + 1) % n]
            if (p[2] - z) * (q[2] - z) < 0:
                t = Fraction(z - p[2], q[2] - p[2])
                pts.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
            elif p[2] == z:
                pts.append((Fraction(p[0]), Fraction(p[1])))
    return hull2(pts)


def tet_volume(faces, ring_a, ring_b):
    """Oracle Vt: volume as the sum of det(p0, p1, p2) / 6 over fan triangles of every face, A's cap
    reversed (outward is down) and B's cap as given (counter-clockwise from above). Exact."""
    def fan(poly):
        return sum(Fraction(dot(poly[0], cross3(poly[i], poly[i + 1]))) for i in range(1, len(poly) - 1))
    total = sum(fan([tuple(v) for v in f]) for f in faces)
    za, zb = ring_a["z"], ring_b["z"]
    if len(ring_a["vertices"]) >= 3:
        total += fan([(x, y, za) for x, y in reversed(ring_a["vertices"])])
    if len(ring_b["vertices"]) >= 3:
        total += fan([(x, y, zb) for x, y in ring_b["vertices"]])
    return total / 6


def surface_topology(faces):
    """Oracle E: Euler characteristic, orientability and boundary edges from face vertex lists alone."""
    verts, directed, undirected = set(), {}, {}
    for f in faces:
        f = [tuple(v) for v in f]
        verts.update(f)
        for i in range(len(f)):
            e = (f[i], f[(i + 1) % len(f)])
            directed[e] = directed.get(e, 0) + 1
            k = frozenset(e)
            undirected[k] = undirected.get(k, 0) + 1
    oriented = all(c == 1 for c in directed.values()) and all(
        directed.get((b, a), 0) == 1 for (a, b) in directed if undirected[frozenset((a, b))] == 2)
    boundary = {k for k, c in undirected.items() if c == 1}
    manifold = all(c <= 2 for c in undirected.values())
    return {"chi": len(verts) - len(undirected) + len(faces), "oriented": oriented, "manifold": manifold,
            "boundary": boundary}


def loop_edges(ring):
    v = [(x, y, ring["z"]) for x, y in ring["vertices"]]
    if len(v) < 3:
        return set()
    return {frozenset((v[i], v[(i + 1) % len(v)])) for i in range(len(v))}


def newell(poly):
    n = [0, 0, 0]
    for i in range(len(poly)):
        p, q = poly[i], poly[(i + 1) % len(poly)]
        n[0] += (p[1] - q[1]) * (p[2] + q[2])
        n[1] += (p[2] - q[2]) * (p[0] + q[0])
        n[2] += (p[0] - q[0]) * (p[1] + q[1])
    return tuple(n)


def half(v):
    return 0 if (v[1] > 0 or (v[1] == 0 and v[0] > 0)) else 1


def strictly_before(u, v):
    """u strictly before v in the angle order of contract section 4.2."""
    hu, hv = half(u), half(v)
    if hu != hv:
        return hu < hv
    return cross2(u, v) > 0


def canonical_form_errors(band, a_pts, b_pts, za, zb):
    """Oracle C': every canonical-form rule of contract section 4.2, checked from direct computations.
    a_pts and b_pts are the input vertex lists of the lower and the upper section. Returns a list of
    violated rules (empty when the band is canonical)."""
    errs = []
    h = zb - za
    faces = band["faces"]
    for k in range(len(faces) - 1):
        if not strictly_before(faces[k]["direction"], faces[k + 1]["direction"]):
            errs.append(("order", k))
    for k, f in enumerate(faces):
        n = tuple(f["direction"])
        if prim(n) != n:
            errs.append(("direction-not-primitive", k))
        ha, hb = support(a_pts, n), support(b_pts, n)
        want = prim((h * n[0], h * n[1], ha - hb))
        if tuple(f["normal"]) != want:
            errs.append(("normal", k))
        nw = newell(f["vertices"])
        if cross3(nw, want) != (0, 0, 0) or dot(nw, want) <= 0:
            errs.append(("newell", k))
        sa, sb = support_set(a_pts, n), support_set(b_pts, n)
        owner = ("A" if len(sa) == 2 else "") + ("B" if len(sb) == 2 else "")
        if f["owner"] != owner:
            errs.append(("owner", k))
        if f["kind"] != ("trapezoid" if owner == "AB" else "triangle"):
            errs.append(("kind", k))
        v = [tuple(x) for x in f["vertices"]]
        if v[0][2] != za:
            errs.append(("first-vertex-not-A", k))
        bottom = [p[:2] for p in v if p[2] == za]
        top = [p[:2] for p in v if p[2] == zb]
        if sorted(bottom) != sa or sorted(top) != sb:
            errs.append(("support-sets", k))
        if len(bottom) == 2 and cross2(sub(bottom[1], bottom[0]), n) >= 0:
            errs.append(("a-edge-orientation", k))
        if len(top) == 2 and cross2(sub(top[0], top[1]), n) >= 0:
            errs.append(("b-edge-orientation", k))
    ra = [tuple(p) + (za,) for p in band["ring_a"]["vertices"]]
    rb = [tuple(p) + (zb,) for p in band["ring_b"]["vertices"]]
    for k, (ia, ib) in enumerate(band["lateral_edges"]):
        f0 = {tuple(x) for x in faces[k]["vertices"]}
        f1 = {tuple(x) for x in faces[(k + 1) % len(faces)]["vertices"]}
        if f0 & f1 != {ra[ia], rb[ib]}:
            errs.append(("lateral-edge", k))
    for ring, z in ((band["ring_a"], za), (band["ring_b"], zb)):
        vs = [tuple(p) for p in ring["vertices"]]
        if ring["z"] != z or (vs and vs[0] != min(vs)):
            errs.append(("ring-start", z))
        if len(vs) >= 3 and shoelace(vs) <= 0:
            errs.append(("ring-orientation", z))
    return errs


def face_angle_deg(poly, v):
    """Interior angle (degrees) of a convex 3D polygon at its vertex v, by atan2(|u x w|, u . w)."""
    i = [tuple(p) for p in poly].index(tuple(v))
    p, a, b = poly[i], poly[i - 1], poly[(i + 1) % len(poly)]
    u, w = sub(a, p), sub(b, p)
    c = cross3(u, w)
    return math.degrees(math.atan2(math.sqrt(float(dot(c, c))), float(dot(u, w))))


def angle_sum_deg(face_lists, v):
    return sum(face_angle_deg(f, v) for f in face_lists if tuple(v) in {tuple(p) for p in f})


def sat_separation(p, q):
    """Oracle X: largest separating-axis gap between two convex 2D polygons (negative = penetration)."""
    best = -math.inf
    for poly in (p, q):
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            nx, ny = b[1] - a[1], a[0] - b[0]
            ln = math.hypot(nx, ny)
            if ln == 0.0:
                continue
            nx, ny = nx / ln, ny / ln
            pp = [x * nx + y * ny for x, y in p]
            qq = [x * nx + y * ny for x, y in q]
            best = max(best, min(qq) - max(pp), min(pp) - max(qq))
    return best


def net_pairs_overlapping(net_faces, tau):
    """Independent overlap list for a net: every pair of placed faces whose separating-axis gap is
    below -tau, that is, whose interiors penetrate by more than tau. Legal shared edges and vertices
    touch at gap 0 and are never listed."""
    over = []
    for i in range(len(net_faces)):
        for j in range(i + 1, len(net_faces)):
            s = sat_separation(net_faces[i], net_faces[j])
            if s < -tau:
                over.append((i, j, s))
    return over
