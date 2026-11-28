"""Independent oracles for laboratory milestone M2 (O2 crease insertion), per m2-o2-contract.md section 9.

RESEARCH ARTEFACT ONLY (owner decision D-6). This module never imports o2.py (a test checks that).
Exact parts use fractions.Fraction; the pose oracle uses quaternions, a different construction from
the implementation's. Python 3 standard library only.
"""
import math
from fractions import Fraction

Q_TO_L = Fraction(1, 10 ** 6)


def rat(v):
    return Fraction(v[0], v[1])


def point(p):
    """A contract point [[xn, xd], [yn, yd]] or [x, y] integers -> (Fraction, Fraction)."""
    if isinstance(p[0], list):
        return (rat(p[0]), rat(p[1]))
    return (Fraction(p[0]), Fraction(p[1]))


def cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def hull(points):
    """Exact monotone-chain convex hull, counter-clockwise, collinear points removed."""
    pts = sorted(set(points))
    if len(pts) < 3:
        return pts

    def half(seq):
        h = []
        for p in seq:
            while len(h) >= 2 and cross(h[-2], h[-1], p) <= 0:
                h.pop()
            h.append(p)
        return h

    lower, upper = half(pts), half(list(reversed(pts)))
    return lower[:-1] + upper[:-1]


def canonical_ring(poly):
    """Counter-clockwise from the lexicographically smallest vertex."""
    ring = list(poly)
    area2 = sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1]
                for i in range(len(ring)))
    if area2 < 0:
        ring.reverse()
    k = ring.index(min(ring))
    return ring[k:] + ring[:k]


def side(p, q, v):
    return cross(p, q, v)


def clip(face, p, q, sign):
    """Oracle CL: the piece of convex `face` on the closed side sign*side >= 0 of the line pq."""
    cand = [v for v in face if sign * side(p, q, v) >= 0]
    n = len(face)
    for i in range(n):
        a, b = face[i], face[(i + 1) % n]
        sa, sb = side(p, q, a), side(p, q, b)
        if sa * sb < 0:
            t = Fraction(sa, 1) / (sa - sb)
            cand.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
    return canonical_ring(hull(cand))


def classify_line(face, p, q):
    """Oracle classification of a line against a convex face: 'misses', 'touches' or 'splits'."""
    s = [side(p, q, v) for v in face]
    if any(x > 0 for x in s) and any(x < 0 for x in s):
        return "splits"
    if all(x > 0 for x in s) or all(x < 0 for x in s):
        return "misses"
    return "touches"


def shoelace(poly):
    n = len(poly)
    return abs(sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n))) / 2


def strictly_convex(poly):
    n = len(poly)
    turns = [cross(poly[i], poly[(i + 1) % n], poly[(i + 2) % n]) for i in range(n)]
    return n >= 3 and (all(t > 0 for t in turns) or all(t < 0 for t in turns)) and len(hull(poly)) == n


def on_segment(v, a, b):
    return cross(a, b, v) == 0 and min(a[0], b[0]) <= v[0] <= max(a[0], b[0]) and min(a[1], b[1]) <= v[1] <= max(a[1], b[1])


def on_boundary(v, outline):
    """Oracle BD: v lies on a closed edge of the outline."""
    n = len(outline)
    return any(on_segment(v, outline[i], outline[(i + 1) % n]) for i in range(n))


def _edges(poly):
    return [(poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))]


def _overlap(e, f):
    """Shared length (as a parameter interval on e) of two collinear segments, or None."""
    (a, b), (c, d) = e, f
    if cross(a, b, c) != 0 or cross(a, b, d) != 0:
        return None
    ax = 0 if a[0] != b[0] else 1

    def t(v):
        return (v[ax] - a[ax]) / (b[ax] - a[ax])

    lo, hi = max(0, min(t(c), t(d))), min(1, max(t(c), t(d)))
    return (lo, hi) if hi > lo else None


def adjacency(faces):
    """Oracle ADJ: {(id1, id2): (exact_full_edge, endpoints)} for faces sharing positive length.

    exact_full_edge is True when the shared segment is a full edge of both faces (no subdivision)."""
    ids = sorted(faces)
    out = {}
    for i, fi in enumerate(ids):
        for fj in ids[i + 1:]:
            for e in _edges(faces[fi]):
                for f in _edges(faces[fj]):
                    iv = _overlap(e, f)
                    if iv is not None:
                        full = set(e) == set(f)
                        out[(fi, fj)] = (full, tuple(sorted(set(e) & set(f))) if full else None)
    return out


def is_tree(nodes, edges):
    nodes = list(nodes)
    if len(edges) != len(nodes) - 1:
        return False
    parent = {n: n for n in nodes}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b in edges:
        ra, rb = find(a), find(b)
        if ra == rb:
            return False
        parent[ra] = rb
    return len({find(n) for n in nodes}) == 1


def interiors_disjoint(p, q):
    """Oracle CV: exact separating axis among the edge normals of two convex polygons (gap >= 0)."""
    for poly in (p, q):
        for a, b in _edges(poly):
            n = (b[1] - a[1], a[0] - b[0])
            pp = [v[0] * n[0] + v[1] * n[1] for v in p]
            qq = [v[0] * n[0] + v[1] * n[1] for v in q]
            if max(pp) <= min(qq) or max(qq) <= min(pp):
                return True
    return False


def altitude2_below(poly, t):
    """Exact: the O1 v1.1 section 3.4 altitude of poly is below t (in quanta)."""
    n = len(poly)
    alt2 = None
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        e2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2
        h2 = max(cross(a, b, r) ** 2 for r in poly) / e2
        alt2 = h2 if alt2 is None else min(alt2, h2)
    return alt2 < t * t


# ---- pose oracle (quaternions) ------------------------------------------------------------

def _qmul(a, b):
    w1, x1, y1, z1 = a
    w2, x2, y2, z2 = b
    return (w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2, w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
            w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2, w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2)


def _qrot(q, v):
    w, x, y, z = q
    r = _qmul(_qmul(q, (0.0, v[0], v[1], v[2])), (w, -x, -y, -z))
    return (r[1], r[2], r[3])


def _fl(v):
    return (float(v[0] * Q_TO_L), float(v[1] * Q_TO_L), 0.0)


def _centroid(poly):
    return (sum(v[0] for v in poly) / len(poly), sum(v[1] for v in poly) / len(poly))


def pose(faces, creases, angles_deg, root):
    """Oracle PO. faces: {id: ring of Fraction points}; creases: {id: (face1, face2, P, Q)}.

    The child of each crease (the face away from root) moves by +theta about the crease direction
    oriented with the parent on its right (contract 4.2). Returns {id: [float (x, y, z) in L]}."""
    nbr = {f: [] for f in faces}
    for cid, (f1, f2, p, q) in creases.items():
        nbr[f1].append((f2, cid))
        nbr[f2].append((f1, cid))
    tf = {root: ((1.0, 0.0, 0.0, 0.0), (0.0, 0.0, 0.0))}
    queue = [root]
    while queue:
        par = queue.pop(0)
        for child, cid in nbr[par]:
            if child in tf:
                continue
            _, _, p, q = creases[cid]
            c = _centroid(faces[par])
            u = (q[0] - p[0], q[1] - p[1])
            if cross(p, q, c) > 0:
                u = (-u[0], -u[1])
            ln = math.hypot(float(u[0]), float(u[1]))
            ux, uy = float(u[0]) / ln, float(u[1]) / ln
            th = math.radians(angles_deg[cid])
            rq = (math.cos(th / 2), math.sin(th / 2) * ux, math.sin(th / 2) * uy, 0.0)
            pf = _fl(p)
            qp, tp = tf[par]
            rp = _qrot(rq, (-pf[0], -pf[1], -pf[2]))
            local_t = (rp[0] + pf[0], rp[1] + pf[1], rp[2] + pf[2])
            moved = _qrot(qp, local_t)
            tf[child] = (_qmul(qp, rq), (moved[0] + tp[0], moved[1] + tp[1], moved[2] + tp[2]))
            queue.append(child)
    out = {}
    for f, ring in faces.items():
        qf, tt = tf[f]
        out[f] = [tuple(a + b for a, b in zip(_qrot(qf, _fl(v)), tt)) for v in ring]
    return out


def _sub3(a, b):
    return tuple(x - y for x, y in zip(a, b))


def _cross3(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot3(a, b):
    return sum(x * y for x, y in zip(a, b))


def _unit(v):
    n = math.sqrt(_dot3(v, v))
    return tuple(c / n for c in v)


def newell(poly3):
    n = [0.0, 0.0, 0.0]
    for i in range(len(poly3)):
        a, b = poly3[i], poly3[(i + 1) % len(poly3)]
        n[0] += (a[1] - b[1]) * (a[2] + b[2])
        n[1] += (a[2] - b[2]) * (a[0] + b[0])
        n[2] += (a[0] - b[0]) * (a[1] + b[1])
    return _unit(tuple(n))


def measured_angle_deg(parent3, child3, hinge_a, hinge_b):
    """Oracle ANG: the repository fold-angle convention (AGENTS.md) from posed geometry."""
    n_p, n_c = newell(parent3), newell(child3)
    h = _unit(_sub3(hinge_b, hinge_a))
    u_p = _unit(_cross3(n_p, h))
    cp = tuple(sum(v[i] for v in parent3) / len(parent3) for i in range(3))
    if _dot3(_sub3(cp, hinge_a), u_p) < 0:
        u_p = tuple(-c for c in u_p)
    a = _unit(_cross3(n_p, u_p))
    return math.degrees(math.atan2(_dot3(_cross3(n_p, n_c), a), _dot3(n_p, n_c)))


def dist3(a, b):
    return math.sqrt(_dot3(_sub3(a, b), _sub3(a, b)))
