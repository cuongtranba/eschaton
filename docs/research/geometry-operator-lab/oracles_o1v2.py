"""Independent oracles for O1 contract v2 (tilted section planes), per m1b-o1v2-contract.md section 11.

RESEARCH ARTEFACT ONLY (owner decision D-7). This module never imports o1v2.py or o1.py (a test checks
that). Exact integer and rational arithmetic only. Python 3 standard library only.
"""
import math
from fractions import Fraction
from functools import cmp_to_key
from itertools import combinations


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def prim(v):
    g = 0
    for c in v:
        g = math.gcd(g, abs(c))
    return tuple(c // g for c in v) if g else tuple(v)


def all_facets(points):
    """Oracle H3: every facet of conv(points), by brute force over triples (exact, O(N^4)).

    Returns {primitive outward normal: (offset, frozenset of the points in that plane)}."""
    pts = [tuple(p) for p in points]
    out = {}
    for i, j, k in combinations(range(len(pts)), 3):
        n = cross(sub(pts[j], pts[i]), sub(pts[k], pts[i]))
        if n == (0, 0, 0):
            continue
        d = dot(n, pts[i])
        s = [dot(n, p) - d for p in pts]
        if all(x <= 0 for x in s):
            pass
        elif all(x >= 0 for x in s):
            n, d = tuple(-c for c in n), -d
        else:
            continue
        key = prim(n)
        if key not in out:
            out[key] = (dot(key, pts[i]), frozenset(p for p in pts if dot(key, p) == dot(key, pts[i])))
    return out


def lateral_facets(a_pts, b_pts):
    """H3 with the two section facets dropped by their point sets (never by a normal)."""
    a, b = frozenset(map(tuple, a_pts)), frozenset(map(tuple, b_pts))
    return {n: v for n, v in all_facets(list(a) + list(b)).items() if v[1] not in (a, b)}


def order_face(normal, pts):
    """Counter-clockwise order of coplanar points seen from the tip of `normal` (exact comparator:
    half-turn about the reference direction first, then the sign of the cross product)."""
    pts = list(pts)
    c = tuple(Fraction(sum(p[i] for p in pts), len(pts)) for i in range(3))
    ref = sub(pts[0], c)

    def half(v):
        cr, dt = dot(cross(ref, v), normal), dot(ref, v)
        return 0 if (cr > 0 or (cr == 0 and dt > 0)) else 1

    def cmp(p, q):
        u, v = sub(p, c), sub(q, c)
        hu, hv = half(u), half(v)
        if hu != hv:
            return hu - hv
        s = dot(cross(u, v), normal)
        return -1 if s > 0 else (1 if s < 0 else 0)

    return [pts[0]] + sorted(pts[1:], key=cmp_to_key(cmp))


def volume(a_pts, b_pts):
    """Oracle V3: the volume of conv(A u B) as an exact rational in q^3, by cones from the centroid of
    all points over fans from each facet's centroid (a decomposition the implementation does not use)."""
    pts = [tuple(p) for p in a_pts] + [tuple(p) for p in b_pts]
    g = tuple(Fraction(sum(p[i] for p in pts), len(pts)) for i in range(3))
    total = Fraction(0)
    for n, (_, face) in all_facets(pts).items():
        ring = order_face(n, face)
        fc = tuple(Fraction(sum(p[i] for p in ring), len(ring)) for i in range(3))
        for i in range(len(ring)):
            p, q = ring[i], ring[(i + 1) % len(ring)]
            total += abs(Fraction(dot(sub(p, g), cross(sub(q, g), sub(fc, g))))) / 6
    return total


def surface_topology(faces):
    """Oracle E: chi = V - E + F, orientability (each interior edge once in each direction) and the
    boundary edges, from face vertex lists alone."""
    verts, directed = set(), {}
    for f in faces:
        vs = [tuple(v) for v in f]
        verts.update(vs)
        for i in range(len(vs)):
            e = (vs[i], vs[(i + 1) % len(vs)])
            directed[e] = directed.get(e, 0) + 1
    undirected = {}
    for (u, v), c in directed.items():
        k = frozenset((u, v))
        undirected[k] = undirected.get(k, 0) + c
    orientable = all(c == 1 for c in directed.values()) and all(
        directed.get((v, u), 0) == 1 for (u, v) in directed if undirected[frozenset((u, v))] == 2)
    boundary = {k for k, c in undirected.items() if c == 1}
    return {"chi": len(verts) - len(undirected) + len(faces), "orientable": orientable, "boundary": boundary}


def loop_edges(ring):
    vs = [tuple(v) for v in ring]
    return {frozenset((vs[i], vs[(i + 1) % len(vs)])) for i in range(len(vs))}


def plane_of(ring):
    """Primitive integer Newell normal and offset of a planar integer ring."""
    n = [0, 0, 0]
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]
        n[0] += (a[1] - b[1]) * (a[2] + b[2])
        n[1] += (a[2] - b[2]) * (a[0] + b[0])
        n[2] += (a[0] - b[0]) * (a[1] + b[1])
    p = prim(tuple(n))
    return p, dot(p, ring[0])


def separated(a_pts, b_pts):
    """Mutual strict separation (contract 2 item 3), by direct sign counts."""
    (na, da), (nb, db) = plane_of(a_pts), plane_of(b_pts)
    sb = [dot(na, p) - da for p in b_pts]
    sa = [dot(nb, p) - db for p in a_pts]
    return (all(x > 0 for x in sb) or all(x < 0 for x in sb)) and (all(x > 0 for x in sa) or all(x < 0 for x in sa))


def canonical_form_errors(band, a_pts, b_pts):
    """Oracle C'2: the contract 5.3 canonical form, recomputed from the inputs (exact). Returns a list
    of error strings (empty when the band is canonical)."""
    errs = []
    sa, sb = min(map(tuple, a_pts)), min(map(tuple, b_pts))
    A, B = (a_pts, b_pts) if sa < sb else (b_pts, a_pts)
    ra = [tuple(v) for v in band["ring_a"]["vertices"]]
    rb = [tuple(v) for v in band["ring_b"]["vertices"]]
    if set(ra) != set(map(tuple, A)) or set(rb) != set(map(tuple, B)):
        errs.append("A is not the section with the smaller smallest vertex")
        return errs
    for name, ring, other, toward in (("a", ra, rb, True), ("b", rb, ra, False)):
        plane = list(band["ring_" + name]["plane"])
        n, d = tuple(plane[:3]), plane[3]
        if prim(n) != n or any(dot(n, v) != d for v in ring):
            errs.append("ring %s plane is not its primitive plane" % name)
        side = [dot(n, v) - d for v in other]
        if not (all(x > 0 for x in side) if toward else all(x < 0 for x in side)):
            errs.append("ring %s normal is not oriented %s the other section" % (name, "toward" if toward else "away from"))
        nw, _ = plane_of(ring)
        if dot(nw, n) <= 0:
            errs.append("ring %s is not counter-clockwise about its oriented normal" % name)
        if ring[0] != min(ring):
            errs.append("ring %s does not start at its smallest vertex" % name)
    allpts = ra + rb
    faces = band["faces"]
    for k, f in enumerate(faces):
        vs = [tuple(v) for v in f["vertices"]]
        n = tuple(f["normal"])
        d = dot(n, vs[0])
        if any(dot(n, v) != d for v in vs):
            errs.append("face %d is not planar on its normal" % k)
        if any(dot(n, p) > d for p in allpts):
            errs.append("face %d normal is not outward" % k)
        if vs[0] not in ra:
            errs.append("face %d does not start at an A vertex" % k)
        nw = [0, 0, 0]
        for i in range(len(vs)):
            c = cross(vs[i], vs[(i + 1) % len(vs)])
            nw = [nw[j] + c[j] for j in range(3)]
        if dot(tuple(nw), n) <= 0:
            errs.append("face %d is not counter-clockwise seen from outside" % k)
        na = sum(1 for v in vs if v in ra)
        nb = len(vs) - na
        owner = {(2, 1): "A", (1, 2): "B", (2, 2): "AB"}.get((na, nb))
        if owner != f["owner"]:
            errs.append("face %d owner" % k)
        if (na, nb) == (2, 2):
            ea = [v for v in vs if v in ra]
            eb = [v for v in vs if v in rb]
            par = cross(sub(ea[1], ea[0]), sub(eb[1], eb[0])) == (0, 0, 0)
            kind = "trapezoid" if par else "quadrilateral"
        else:
            kind = "triangle"
        if kind != f["kind"]:
            errs.append("face %d kind" % k)
    if faces and not ({tuple(faces[0]["vertices"][0]), tuple(faces[0]["vertices"][1])} == {ra[0], ra[1]}):
        errs.append("face 0 does not hold ring A's first edge")
    for k, (ia, ib) in enumerate(band["lateral_edges"]):
        e = {ra[ia], rb[ib]}
        f1 = {tuple(v) for v in faces[k]["vertices"]}
        f2 = {tuple(v) for v in faces[(k + 1) % len(faces)]["vertices"]}
        if not (e <= f1 and e <= f2):
            errs.append("lateral edge %d is not shared by faces %d and %d" % (k, k, (k + 1) % len(faces)))
    return errs
