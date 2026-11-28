"""O1 section transition for tilted section planes, as frozen in m1b-o1v2-contract.md v2.2.

RESEARCH ARTEFACT ONLY (owner decision D-7). Not a production API; imported by nothing in packages/,
apps/ or experiments/. Python 3 standard library only. O1 v1.1 (o1.py) is unchanged and separate.

Scope: two strictly convex planar polygons with integer 3D vertices in quanta (1 q = 1e-6 L), on
distinct non-parallel planes, each strictly on one side of the other's plane. The band is the lateral
surface of their convex hull. Every topological decision is an exact integer or rational predicate;
floats appear only in the reported min_altitude and min_dihedral_deg.

Public functions: section_transition_v2, canonical_json, digest.
"""
import hashlib
import json
import math
from fractions import Fraction

VERSION = "o1-contract-v2.0"
COORD_MAX = 10 ** 9
VERTEX_MAX = 1024
ALTITUDE_MAX = 4 * 10 ** 9
FLOAT_FIELDS = ("min_altitude", "min_dihedral_deg")
SECTION_CODES = ("duplicate-vertex", "collinear-vertex", "non-planar-section", "non-convex-section")


class _Reject(Exception):
    """Internal control flow only; section_transition_v2 converts it into an error value."""

    def __init__(self, code, detail):
        Exception.__init__(self, code)
        self.code = code
        self.detail = detail


def _is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _det(a, b, c):
    return _dot(a, _cross(b, c))


def _prim(v):
    g = 0
    for c in v:
        g = math.gcd(g, abs(c))
    return tuple(c // g for c in v) if g else tuple(v)


def _newell(ring):
    n = (0, 0, 0)
    for i in range(len(ring)):
        c = _cross(ring[i], ring[(i + 1) % len(ring)])
        n = (n[0] + c[0], n[1] + c[1], n[2] + c[2])
    return n


def _half(v):
    return 0 if (v[1] > 0 or (v[1] == 0 and v[0] > 0)) else 1


# ------------------------------------------------------------------ input checks (contract 2, 6)

def _parse(sec, label):
    if not isinstance(sec, dict):
        raise _Reject("malformed-input", "%s: not an object" % label)
    if set(sec) != {"vertices"}:
        raise _Reject("malformed-input", "%s: the only key must be vertices" % label)
    vs = sec["vertices"]
    if not isinstance(vs, list):
        raise _Reject("malformed-input", "%s: vertices is not a list" % label)
    for i, v in enumerate(vs):
        if not isinstance(v, list) or len(v) != 3 or not all(_is_int(c) for c in v):
            raise _Reject("malformed-input", "%s: vertex %d is not three integers" % (label, i))


def _parse_altitude(t):
    if t is not None and (not _is_int(t) or t < 1):
        raise _Reject("malformed-input", "min_altitude must be an integer >= 1")


def _bounds(sec, label):
    if not 1 <= len(sec["vertices"]) <= VERTEX_MAX:
        raise _Reject("out-of-bounds", "%s: vertex count outside 1..%d" % (label, VERTEX_MAX))
    if any(abs(c) > COORD_MAX for v in sec["vertices"] for c in v):
        raise _Reject("out-of-bounds", "%s: a coordinate beyond %d q" % (label, COORD_MAX))


def _bounds_altitude(t):
    if t is not None and t > ALTITUDE_MAX:
        raise _Reject("out-of-bounds", "min_altitude beyond %d q" % ALTITUDE_MAX)


def _section_failure(pts, label):
    """First failing per-section check (contract 5.2, 6 item 4), as (rank, code, detail), or the plane
    normal c and offset when the section is a strictly convex planar polygon."""
    n = len(pts)
    seen = set()
    for i, p in enumerate(pts):
        if p in seen:
            return (0, SECTION_CODES[0], "%s: vertex %d repeats" % (label, i)), None
        seen.add(p)
    for i in range(n):
        c = _cross(_sub(pts[(i + 1) % n], pts[i]), _sub(pts[(i + 2) % n], pts[(i + 1) % n]))
        if c == (0, 0, 0):
            return (1, SECTION_CODES[1], "%s: zero turn at vertex %d" % (label, (i + 1) % n)), None
    c = _cross(_sub(pts[1], pts[0]), _sub(pts[2], pts[1]))
    for i, p in enumerate(pts):
        if _dot(c, _sub(p, pts[0])) != 0:
            return (2, SECTION_CODES[2], "%s: vertex %d is off the plane of the first three" % (label, i)), None
    if _newell(pts) == (0, 0, 0):
        return (3, SECTION_CODES[3], "%s: zero vector area" % label), None
    k = max(range(3), key=lambda i: (abs(c[i]), -i))
    q = [(p[(k + 1) % 3], p[(k + 2) % 3]) for p in pts]
    turns = []
    for i in range(n):
        u = (q[(i + 1) % n][0] - q[i][0], q[(i + 1) % n][1] - q[i][1])
        w = (q[(i + 2) % n][0] - q[(i + 1) % n][0], q[(i + 2) % n][1] - q[(i + 1) % n][1])
        turns.append(u[0] * w[1] - u[1] * w[0])
    if not (all(t > 0 for t in turns) or all(t < 0 for t in turns)):
        return (3, SECTION_CODES[3], "%s: turns change sign" % label), None
    if turns[0] < 0:
        q = q[::-1]
    halves = [_half((q[(i + 1) % n][0] - q[i][0], q[(i + 1) % n][1] - q[i][1])) for i in range(n)]
    wraps = sum(1 for i in range(n) if halves[i] == 1 and halves[(i + 1) % n] == 0)
    if wraps != 1:
        return (3, SECTION_CODES[3], "%s: edge directions turn %d times" % (label, wraps)), None
    p = _prim(c)
    return None, (p, _dot(p, pts[0]))


def _canonical_ring(pts, normal):
    """Counter-clockwise about the oriented normal (sign of Newell . normal), from the smallest vertex."""
    ring = list(pts) if _dot(_newell(pts), normal) > 0 else list(reversed(pts))
    k = ring.index(min(ring))
    return ring[k:] + ring[:k]


# ------------------------------------------------------------------ the band (contract 3, 5)

def _first_support(ra, rb):
    """Index j of the B vertex paired with a_0 in the lateral facet through A's edge a_0 a_1: the B
    vertex extreme for the rotation of plane(A) about that edge, the first of an extreme edge."""
    a0, e = ra[0], _sub(ra[1], ra[0])
    n = len(rb)
    cur = 0
    for k in range(1, n):
        if _det(e, _sub(rb[cur], a0), _sub(rb[k], a0)) > 0:
            cur = k
    ties = [k for k in range(n) if _det(e, _sub(rb[cur], a0), _sub(rb[k], a0)) == 0]
    if len(ties) == 1:
        return ties[0]
    lo, hi = ties
    return hi if (lo, hi) == (0, n - 1) else lo


def _walk(ra, rb):
    """Lateral faces in canonical order and their shared lateral edges. From the lateral edge
    (a_i, b_j), the next face is (a_i, a_i+1, b_j) or (a_i, b_j+1, b_j); one 4-point orientation decides
    which, and zero means both section edges lie in one face (contract 3.2)."""
    m, n = len(ra), len(rb)
    i, j = 0, _first_support(ra, rb)
    da = db = 0
    faces, laterals = [], []
    while da < m or db < n:
        if da > m or db > n or len(faces) >= m + n:
            raise RuntimeError("O1 v2 walk did not close")
        ai, ai1, bj, bj1 = ra[i], ra[(i + 1) % m], rb[j], rb[(j + 1) % n]
        d = _det(_sub(ai1, ai), _sub(bj, ai), _sub(bj1, ai))
        if d < 0:
            verts, owner, kind = [ai, ai1, bj], "A", "triangle"
            normal = _cross(_sub(ai1, ai), _sub(bj, ai))
            i, da = (i + 1) % m, da + 1
        elif d > 0:
            verts, owner, kind = [ai, bj1, bj], "B", "triangle"
            normal = _cross(_sub(bj1, ai), _sub(bj, ai))
            j, db = (j + 1) % n, db + 1
        else:
            parallel = _cross(_sub(ai1, ai), _sub(bj1, bj)) == (0, 0, 0)
            verts, owner, kind = [ai, ai1, bj1, bj], "AB", "trapezoid" if parallel else "quadrilateral"
            normal = _cross(_sub(ai1, ai), _sub(bj, ai))
            i, da, j, db = (i + 1) % m, da + 1, (j + 1) % n, db + 1
        faces.append({"kind": kind, "normal": list(_prim(normal)), "owner": owner,
                      "vertices": [list(v) for v in verts]})
        laterals.append([i, j])
    if (da, db) != (m, n):
        raise RuntimeError("O1 v2 walk did not close")
    return faces, laterals


def _volume(ra, rb, faces):
    """Exact signed tetrahedral sum over all faces oriented outward (contract 3.3)."""
    total = 0
    polys = [[tuple(v) for v in f["vertices"]] for f in faces] + [list(reversed(ra)), list(rb)]
    for poly in polys:
        for k in range(1, len(poly) - 1):
            total += _det(poly[0], poly[k], poly[k + 1])
    return Fraction(total, 6)


def _altitude2(face):
    """Exact squared altitude: the minimum over edges of the largest squared distance of a face vertex
    from the edge line (v1.1 section 3.4)."""
    best = None
    for i in range(len(face)):
        p, q = face[i], face[(i + 1) % len(face)]
        e = _sub(q, p)
        ee = _dot(e, e)
        far = max(Fraction(_dot(c, c), ee) for c in (_cross(e, _sub(r, p)) for r in face))
        best = far if best is None or far < best else best
    return best


def _angle_deg(u, v):
    c = _cross(u, v)
    return math.degrees(math.atan2(math.sqrt(float(_dot(c, c))), float(_dot(u, v))))


def _band(ra, pa, rb, pb):
    faces, laterals = _walk(ra, rb)
    volume = _volume(ra, rb, faces)
    alt2 = min(_altitude2([tuple(v) for v in f["vertices"]]) for f in faces)
    dihedral = min(_angle_deg(tuple(faces[k]["normal"]), tuple(faces[(k + 1) % len(faces)]["normal"]))
                   for k in range(len(faces)))
    return {
        "version": VERSION,
        "topology": "closed-band",
        "ring_a": {"vertices": [list(v) for v in ra], "plane": list(pa[0]) + [pa[1]]},
        "ring_b": {"vertices": [list(v) for v in rb], "plane": list(pb[0]) + [pb[1]]},
        "axis_direction": list(_prim(_cross(pa[0], pb[0]))),
        "faces": faces,
        "lateral_edges": laterals,
        "newell_a": list(_newell(ra)),
        "newell_b": list(_newell(rb)),
        "volume": [volume.numerator, volume.denominator],
        "min_altitude": math.sqrt(alt2.numerator / alt2.denominator),
        "min_dihedral_deg": dihedral,
    }


def _signs(normal, offset, pts):
    s = [_dot(normal, p) - offset for p in pts]
    if all(x > 0 for x in s):
        return 1
    if all(x < 0 for x in s):
        return -1
    return 0


def _transition(a, b, min_altitude):
    _parse(a, "first argument")
    _parse(b, "second argument")
    _parse_altitude(min_altitude)
    _bounds(a, "first argument")
    _bounds(b, "second argument")
    _bounds_altitude(min_altitude)
    pts = []
    for sec, label in ((a, "first argument"), (b, "second argument")):
        if len(sec["vertices"]) <= 2:
            raise _Reject("degenerate-section", "%s: %d vertices" % (label, len(sec["vertices"])))
        pts.append([tuple(v) for v in sec["vertices"]])
    checks = [_section_failure(p, label) for p, label in zip(pts, ("first argument", "second argument"))]
    failures = [f for f, _ in checks if f is not None]
    if failures:
        rank, code, detail = min(failures, key=lambda f: f[0])
        raise _Reject(code, detail)
    (n1, d1), (n2, d2) = checks[0][1], checks[1][1]
    if _cross(n1, n2) == (0, 0, 0):
        if all(_dot(n1, p) == d1 for p in pts[1]):
            raise _Reject("coincident-planes", "both sections lie in one plane")
        raise _Reject("parallel-planes", "the section planes are parallel")
    if min(pts[0]) < min(pts[1]):
        A, B, (na, da), (nb, db) = pts[0], pts[1], (n1, d1), (n2, d2)
    else:
        A, B, (na, da), (nb, db) = pts[1], pts[0], (n2, d2), (n1, d1)
    sb = _signs(na, da, B)
    if sb == 0:
        raise _Reject("sections-not-separated", "section B touches or crosses plane(A)")
    sa = _signs(nb, db, A)
    if sa == 0:
        raise _Reject("sections-not-separated", "section A touches or crosses plane(B)")
    if sb < 0:
        na, da = tuple(-c for c in na), -da
    if sa > 0:
        nb, db = tuple(-c for c in nb), -db
    ra, rb = _canonical_ring(A, na), _canonical_ring(B, nb)
    band = _band(ra, (na, da), rb, (nb, db))
    if min_altitude is not None:
        for k, f in enumerate(band["faces"]):
            if _altitude2([tuple(v) for v in f["vertices"]]) < min_altitude * min_altitude:
                raise _Reject("thin-panel", "face %d has an altitude below %d q" % (k, min_altitude))
    return band


def section_transition_v2(a, b, min_altitude=None):
    """O1 v2(A, B) for two sections {"vertices": [[x, y, z], ...]}; contract v2.2."""
    try:
        return {"ok": True, "band": _transition(a, b, min_altitude)}
    except _Reject as r:
        return {"ok": False, "error": {"code": r.code, "detail": r.detail}}


# ------------------------------------------------------------------ canonical form and digest (contract 5.3)

def canonical_json(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _strip(obj):
    if isinstance(obj, dict):
        return {k: _strip(v) for k, v in obj.items() if k not in FLOAT_FIELDS}
    if isinstance(obj, list):
        return [_strip(v) for v in obj]
    return obj


def digest(band):
    """SHA-256 of the canonical JSON without float fields. Accepts a band or a full result; an error
    result digests its code only."""
    if isinstance(band, dict) and "ok" in band:
        body = _strip(band) if band["ok"] else {"error": band["error"]["code"]}
    else:
        body = _strip(band)
    return hashlib.sha256(canonical_json(body).encode("ascii")).hexdigest()
