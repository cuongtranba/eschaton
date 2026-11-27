"""O1 section transition, laboratory milestone M1, as frozen in m0-o1-contract.md v1.1.

RESEARCH ARTEFACT ONLY (owner decisions D-1, D-3, D-5; decision packet section 0.3). Not a production
API; imported by nothing in packages/, apps/ or experiments/. Python 3 standard library only.

Scope: two parallel, strictly separated section planes z = const; each section a strictly convex
polygon, a segment or a point (at most one degenerate). All topological decisions are exact integer
or rational predicates on integer coordinates in quanta (1 q = 1e-6 L). Floats appear only in reported
measurements (minimum altitude, minimum dihedral, net coordinates, ring vertex angles).

Public functions: section_transition, chain, cut_open_net, canonical_json, digest.
"""
import hashlib
import json
import math
from fractions import Fraction
from functools import cmp_to_key

COORD_MAX = 10 ** 9
VERTEX_MAX = 1024
STATIONS_MAX = 64
ALTITUDE_MAX = 4 * 10 ** 9
FLAT_BAND_DEG = 1e-9
NET_TAU_FACTOR = 1e-9
Q_TO_L = 1e-6
FLOAT_FIELDS = ("min_altitude", "min_dihedral_deg", "vertex_angle_deg", "vertex_flat")


class _Reject(Exception):
    """Internal control flow only; every public function converts it into an error value."""

    def __init__(self, code, detail):
        Exception.__init__(self, code)
        self.code = code
        self.detail = detail


def _is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def _sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def _cross2(a, b):
    return a[0] * b[1] - a[1] * b[0]


def _cross3(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def _prim(v):
    g = 0
    for c in v:
        g = math.gcd(g, abs(c))
    return tuple(c // g for c in v)


def _half(v):
    return 0 if (v[1] > 0 or (v[1] == 0 and v[0] > 0)) else 1


def _cmp_dir(u, v):
    hu, hv = _half(u), _half(v)
    if hu != hv:
        return hu - hv
    c = _cross2(u, v)
    return -1 if c > 0 else (1 if c < 0 else 0)


# ------------------------------------------------------------------ input checks (contract 2, 7)

def _parse(sec, label):
    if not isinstance(sec, dict):
        raise _Reject("malformed-input", "%s: not an object" % label)
    if set(sec) - {"z", "vertices", "normal"} or "z" not in sec or "vertices" not in sec:
        raise _Reject("malformed-input", "%s: keys must be z, vertices and an optional normal" % label)
    if not _is_int(sec["z"]):
        raise _Reject("malformed-input", "%s: z is not an integer" % label)
    vs = sec["vertices"]
    if not isinstance(vs, list) or not vs:
        raise _Reject("malformed-input", "%s: vertices is not a non-empty list" % label)
    for i, v in enumerate(vs):
        if not isinstance(v, list) or len(v) != 2 or not all(_is_int(c) for c in v):
            raise _Reject("malformed-input", "%s: vertex %d is not two integers" % (label, i))
    if "normal" in sec:
        n = sec["normal"]
        if not isinstance(n, list) or len(n) != 3 or not all(_is_int(c) for c in n):
            raise _Reject("malformed-input", "%s: normal is not three integers" % label)


def _parse_altitude(t):
    if t is not None and (not _is_int(t) or t < 1):
        raise _Reject("malformed-input", "min_altitude must be an integer >= 1")


def _bounds(sec, label):
    if len(sec["vertices"]) > VERTEX_MAX:
        raise _Reject("out-of-bounds", "%s: more than %d vertices" % (label, VERTEX_MAX))
    if abs(sec["z"]) > COORD_MAX or any(abs(c) > COORD_MAX for v in sec["vertices"] for c in v):
        raise _Reject("out-of-bounds", "%s: a coordinate beyond %d q" % (label, COORD_MAX))


def _bounds_altitude(t):
    if t is not None and t > ALTITUDE_MAX:
        raise _Reject("out-of-bounds", "min_altitude beyond %d q" % ALTITUDE_MAX)


def _plane(sec, label):
    if "normal" in sec and sec["normal"] != [0, 0, 1]:
        raise _Reject("unsupported-plane", "%s: normal %r is outside contract v1.1" % (label, sec["normal"]))


def _validate(vs, label):
    """Canonical ring: a strictly convex polygon counter-clockwise from its lexicographic minimum, a
    segment as [min, max], or a point. Never repairs: duplicates, zero turns, sign changes and more
    than one turn of the edge directions are rejected (contract 3.1)."""
    pts = [tuple(v) for v in vs]
    seen = set()
    for i, p in enumerate(pts):
        if p in seen:
            raise _Reject("duplicate-vertex", "%s: vertex %d repeats" % (label, i))
        seen.add(p)
    n = len(pts)
    if n <= 2:
        return sorted(pts)
    turns = []
    for i in range(n):
        c = _cross2(_sub(pts[(i + 1) % n], pts[i]), _sub(pts[(i + 2) % n], pts[(i + 1) % n]))
        if c == 0:
            raise _Reject("collinear-vertex", "%s: zero turn at vertex %d" % (label, (i + 1) % n))
        turns.append(c)
    if not (all(c > 0 for c in turns) or all(c < 0 for c in turns)):
        raise _Reject("non-convex-section", "%s: turns change sign" % label)
    if turns[0] < 0:
        pts = pts[::-1]
    halves = [_half(_sub(pts[(i + 1) % n], pts[i])) for i in range(n)]
    wraps = sum(1 for i in range(n) if halves[i] == 1 and halves[(i + 1) % n] == 0)
    if wraps != 1:
        raise _Reject("non-convex-section", "%s: edge directions turn %d times" % (label, wraps))
    k = pts.index(min(pts))
    return pts[k:] + pts[:k]


# ------------------------------------------------------------------ the band (contract 3, 4)

def _edges(ring):
    """(start, end, primitive outward normal) of a canonical ring, in angle order from the smallest.
    A convex polygon's edges are already in angle order up to a rotation; a segment has two opposite
    edges; a point has none."""
    n = len(ring)
    if n == 1:
        return []
    pairs = [(0, 1), (1, 0)] if n == 2 else [(i, (i + 1) % n) for i in range(n)]
    es = []
    for i, j in pairs:
        e = _sub(ring[j], ring[i])
        es.append((i, j, _prim((e[1], -e[0]))))
    k = min(range(len(es)), key=cmp_to_key(lambda x, y: _cmp_dir(es[x][2], es[y][2])))
    return es[k:] + es[:k]


def _merge(ea, eb):
    """Linear merge of two angle-sorted edge lists into (direction, A edge, B edge, pointer) where the
    pointer is the index of the other section's next edge when only one section owns the direction."""
    i = j = 0
    out = []
    while i < len(ea) or j < len(eb):
        c = 0 if (i < len(ea) and j < len(eb) and _cmp_dir(ea[i][2], eb[j][2]) == 0) else None
        if c is None and (j == len(eb) or (i < len(ea) and _cmp_dir(ea[i][2], eb[j][2]) < 0)):
            out.append((ea[i][2], ea[i], None, j))
            i += 1
        elif c is None:
            out.append((eb[j][2], None, eb[j], i))
            j += 1
        else:
            out.append((ea[i][2], ea[i], eb[j], None))
            i += 1
            j += 1
    return out


def _support(edges, pointer):
    """Support vertex for a direction strictly between edges[pointer - 1] and edges[pointer]: the start
    of edges[pointer], cyclically. A point's only vertex has index 0."""
    return edges[pointer % len(edges)][0] if edges else 0


def _area(poly):
    s = sum(_cross2(poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly)))
    return Fraction(abs(s), 2)


def _combo_walk(ra, rb, wa, wb):
    """Vertices of wa*A + wb*B (exact) by walking the merged edge sequence from the sum of the two
    support vertices of the first direction."""
    ea, eb = _edges(ra), _edges(rb)
    merged = _merge(ea, eb)
    _, fa, fb, _ = merged[0]
    sa = fa[0] if fa else _support(ea, 0)
    sb = fb[0] if fb else _support(eb, 0)
    p = (wa * ra[sa][0] + wb * rb[sb][0], wa * ra[sa][1] + wb * rb[sb][1])
    out = []
    for _, a_e, b_e, _ in merged:
        out.append(p)
        dx = dy = 0
        if a_e:
            e = _sub(ra[a_e[1]], ra[a_e[0]])
            dx, dy = dx + wa * e[0], dy + wa * e[1]
        if b_e:
            e = _sub(rb[b_e[1]], rb[b_e[0]])
            dx, dy = dx + wb * e[0], dy + wb * e[1]
        p = (p[0] + dx, p[1] + dy)
    return out


def _altitude2(face):
    """Exact squared altitude of a planar convex face: the minimum over edges of the maximum squared
    distance of the face's vertices from the edge line (contract 3.4)."""
    best = None
    for i in range(len(face)):
        p, q = face[i], face[(i + 1) % len(face)]
        e = _sub(q, p)
        far = max(Fraction(_dot(c, c), _dot(e, e)) for c in (_cross3(e, _sub(r, p)) for r in face))
        best = far if best is None or far < best else best
    return best


def _angle_deg(u, v):
    c = _cross3(u, v)
    return math.degrees(math.atan2(math.sqrt(float(_dot(c, c))), float(_dot(u, v))))


def _band(ra, za, rb, zb):
    """Lateral faces of conv(A u B), canonical rings ra at za and rb at zb, za < zb (contract 3.2)."""
    h = zb - za
    ea, eb = _edges(ra), _edges(rb)
    faces, laterals = [], []
    for n, a_e, b_e, pointer in _merge(ea, eb):
        if a_e and b_e:
            idx, owner, right = [("a", a_e[0]), ("a", a_e[1]), ("b", b_e[1]), ("b", b_e[0])], "AB", (a_e[1], b_e[1])
            sa, sb = a_e[0], b_e[0]
        elif a_e:
            sb = _support(eb, pointer)
            idx, owner, right = [("a", a_e[0]), ("a", a_e[1]), ("b", sb)], "A", (a_e[1], sb)
            sa = a_e[0]
        else:
            sa = _support(ea, pointer)
            idx, owner, right = [("a", sa), ("b", b_e[1]), ("b", b_e[0])], "B", (sa, b_e[1])
            sb = b_e[0]
        verts = [list(ra[k]) + [za] if s == "a" else list(rb[k]) + [zb] for s, k in idx]
        faces.append({"direction": list(n), "kind": "trapezoid" if owner == "AB" else "triangle",
                      "normal": list(_prim((h * n[0], h * n[1], _dot(n, ra[sa]) - _dot(n, rb[sb])))),
                      "owner": owner, "vertices": verts})
        laterals.append(list(right))
    if len(ra) >= 3 and len(rb) >= 3:
        topology = "closed-band"
    elif len(ra) == 1 or len(rb) == 1:
        topology = "disc-cap"
    else:
        topology = "disc-wedge"
    area_a = _area(ra) if len(ra) >= 3 else Fraction(0)
    area_b = _area(rb) if len(rb) >= 3 else Fraction(0)
    area_mid = _area(_combo_walk(ra, rb, 1, 1)) / 4
    volume = Fraction(h, 6) * (area_a + 4 * area_mid + area_b)
    alt2 = min(_altitude2([tuple(v) for v in f["vertices"]]) for f in faces)
    dihedral = min(_angle_deg(tuple(faces[k]["normal"]), tuple(faces[(k + 1) % len(faces)]["normal"]))
                   for k in range(len(faces)))
    return {
        "topology": topology,
        "ring_a": {"vertices": [list(p) for p in ra], "z": za},
        "ring_b": {"vertices": [list(p) for p in rb], "z": zb},
        "faces": faces,
        "lateral_edges": laterals,
        "area_a": [area_a.numerator, area_a.denominator],
        "area_b": [area_b.numerator, area_b.denominator],
        "area_mid": [area_mid.numerator, area_mid.denominator],
        "volume": [volume.numerator, volume.denominator],
        "min_altitude": math.sqrt(alt2.numerator / alt2.denominator),
        "min_dihedral_deg": dihedral,
    }


def _thin(band, t, label):
    for k, f in enumerate(band["faces"]):
        if _altitude2([tuple(v) for v in f["vertices"]]) < t * t:
            raise _Reject("thin-panel", "%s: face %d has an altitude below %d q" % (label, k, t))


def section_transition(a, b, min_altitude=None):
    """O1(A, B) for two sections {"z": int, "vertices": [[x, y], ...]}; contract v1.1."""
    try:
        _parse(a, "first argument")
        _parse(b, "second argument")
        _parse_altitude(min_altitude)
        _bounds(a, "first argument")
        _bounds(b, "second argument")
        _bounds_altitude(min_altitude)
        _plane(a, "first argument")
        _plane(b, "second argument")
        if a["z"] == b["z"]:
            raise _Reject("coincident-planes", "both sections at z = %d" % a["z"])
        lo, hi = (a, b) if a["z"] < b["z"] else (b, a)
        ra = _validate(lo["vertices"], "lower section")
        rb = _validate(hi["vertices"], "upper section")
        if len(ra) <= 2 and len(rb) <= 2:
            raise _Reject("degenerate-band", "both sections are points or segments")
        band = _band(ra, lo["z"], rb, hi["z"])
        if min_altitude is not None:
            _thin(band, min_altitude, "band")
        return {"ok": True, "band": band}
    except _Reject as r:
        return {"ok": False, "error": {"code": r.code, "detail": r.detail}}


# ------------------------------------------------------------------ chains and rings (contract 3.5, 5)

def _ring(k, below, above, ra, za, rk, zk, rb, zb):
    s = Fraction(zk - za, zb - za)
    on_path = set(_combo_walk(ra, rb, 1 - s, s)) == {(Fraction(x), Fraction(y)) for x, y in rk}
    face_below = {tuple(f["direction"]): f for f in below["faces"]}
    face_above = {tuple(f["direction"]): f for f in above["faces"]}
    edges = []
    for i, j, n in _edges(rk):
        fb, fa = face_below[n], face_above[n]
        p = [tuple(v) for v in fb["vertices"]]
        normal = _cross3(_sub(p[1], p[0]), _sub(p[2], p[0]))
        coplanar = all(_dot(normal, _sub(tuple(r), p[0])) == 0 for r in fa["vertices"])
        same_side = _dot(fb["normal"], fa["normal"]) > 0
        edges.append([[i, j], "dissolvable" if coplanar and same_side else "seam-dihedral"])
    edges.sort(key=lambda e: e[0][0])
    angles = []
    for v in rk:
        v3 = v + (zk,)
        total = 0.0
        for f in below["faces"] + above["faces"]:
            poly = [tuple(x) for x in f["vertices"]]
            if v3 in poly:
                i = poly.index(v3)
                total += _angle_deg(_sub(poly[i - 1], v3), _sub(poly[(i + 1) % len(poly)], v3))
        angles.append(total)
    dissolvable = sum(1 for _, c in edges if c == "dissolvable")
    kind = "tessellation-ring" if on_path else ("seam-ring" if dissolvable == 0 else "mixed-ring")
    return {"station": k, "on_path": on_path, "edges": edges, "kind": kind, "vertex_angle_deg": angles,
            "vertex_flat": [abs(x - 360.0) <= FLAT_BAND_DEG for x in angles]}


def chain(stations, min_altitude=None):
    """Bands between consecutive stations at strictly monotone heights, and a classification of every
    interior ring; contract v1.1 sections 3.5 and 5."""
    try:
        if not isinstance(stations, list) or len(stations) < 2:
            raise _Reject("malformed-input", "stations must be a list of at least two sections")
        for i, s in enumerate(stations):
            _parse(s, "station %d" % i)
        _parse_altitude(min_altitude)
        if len(stations) > STATIONS_MAX:
            raise _Reject("out-of-bounds", "more than %d stations" % STATIONS_MAX)
        for i, s in enumerate(stations):
            _bounds(s, "station %d" % i)
        _bounds_altitude(min_altitude)
        for i, s in enumerate(stations):
            _plane(s, "station %d" % i)
        zs = [s["z"] for s in stations]
        if all(x < y for x, y in zip(zs, zs[1:])):
            ordered = list(stations)
        elif all(x > y for x, y in zip(zs, zs[1:])):
            ordered = stations[::-1]
        else:
            raise _Reject("non-monotone-stations", "heights %r are not strictly monotone" % zs)
        rings = [_validate(s["vertices"], "station of z rank %d" % i) for i, s in enumerate(ordered)]
        for i in range(1, len(rings) - 1):
            if len(rings[i]) <= 2:
                raise _Reject("degenerate-interior-station", "station of z rank %d is a point or segment" % i)
        for i in range(len(rings) - 1):
            if len(rings[i]) <= 2 and len(rings[i + 1]) <= 2:
                raise _Reject("degenerate-band", "band %d joins two points or segments" % i)
        zs = [s["z"] for s in ordered]
        bands = [_band(rings[i], zs[i], rings[i + 1], zs[i + 1]) for i in range(len(rings) - 1)]
        if min_altitude is not None:
            for i, b in enumerate(bands):
                _thin(b, min_altitude, "band %d" % i)
        reports = [_ring(k, bands[k - 1], bands[k], rings[k - 1], zs[k - 1], rings[k], zs[k], rings[k + 1], zs[k + 1])
                   for k in range(1, len(rings) - 1)]
        return {"ok": True, "chain": {"bands": bands, "rings": reports}}
    except _Reject as r:
        return {"ok": False, "error": {"code": r.code, "detail": r.detail}}


# ------------------------------------------------------------------ canonical form and digest (contract 4.2)

def canonical_json(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _strip(obj):
    if isinstance(obj, dict):
        return {k: _strip(v) for k, v in obj.items() if k not in FLOAT_FIELDS}
    if isinstance(obj, list):
        return [_strip(v) for v in obj]
    return obj


def digest(result):
    """SHA-256 of the canonical JSON without float fields. An error digests its code only."""
    body = _strip(result) if result.get("ok") else {"error": result["error"]["code"]}
    return hashlib.sha256(canonical_json(body).encode("ascii")).hexdigest()


# ------------------------------------------------------------------ cut-open net (contract 6; floats)

def _fl(v):
    return tuple(c * Q_TO_L for c in v)


def _fsub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def _flen(v):
    return math.sqrt(sum(c * c for c in v))


def _local(face, normal, p, q):
    """2D coordinates of a face in the frame with origin p, x along p->q and y = N x x: the outward side
    faces up, so the development keeps orientation and adjacent faces land on opposite sides."""
    x = tuple(c / _flen(_fsub(q, p)) for c in _fsub(q, p))
    nn = tuple(c / _flen(normal) for c in normal)
    y = (nn[1] * x[2] - nn[2] * x[1], nn[2] * x[0] - nn[0] * x[2], nn[0] * x[1] - nn[1] * x[0])
    return [(sum(a * b for a, b in zip(_fsub(v, p), x)), sum(a * b for a, b in zip(_fsub(v, p), y))) for v in face]


def _place(local, origin, axis):
    ux, uy = axis
    return [(origin[0] + a * ux - b * uy, origin[1] + a * uy + b * ux) for a, b in local]


def _sat(p, q):
    best = -math.inf
    for poly in (p, q):
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            nx, ny = b[1] - a[1], a[0] - b[0]
            ln = math.hypot(nx, ny)
            pp = [(x * nx + y * ny) / ln for x, y in p]
            qq = [(x * nx + y * ny) / ln for x, y in q]
            best = max(best, min(qq) - max(pp), min(pp) - max(qq))
    return best


def _classify_pair(i, j, keys, placed, tau):
    common = set(keys[i]) & set(keys[j])
    legal = {v for v in common if all(v in keys[m] for m in range(i, j + 1))}
    sigma = _sat(placed[i], placed[j])
    if sigma > tau:
        c = "disjoint"
    elif sigma < -tau:
        c = "overlap"
    else:
        c = "legal-contact" if legal else "touching"
    if len(legal) == 2 and c != "overlap":
        p, q = (placed[i][keys[i].index(v)] for v in sorted(legal))
        ex, ey = q[0] - p[0], q[1] - p[1]
        ln = math.hypot(ex, ey)
        si = [((pt[0] - p[0]) * ey - (pt[1] - p[1]) * ex) / ln for pt, v in zip(placed[i], keys[i]) if v not in legal]
        sj = [((pt[0] - p[0]) * ey - (pt[1] - p[1]) * ex) / ln for pt, v in zip(placed[j], keys[j]) if v not in legal]
        opposite = (min(si) > tau and max(sj) < -tau) or (max(si) < -tau and min(sj) > tau)
        same = (min(si) > tau and min(sj) > tau) or (max(si) < -tau and max(sj) < -tau)
        c = c if opposite else ("overlap" if same else "inconclusive")
    return c, sigma


def cut_open_net(band, first_face=0):
    """Develop a band into the plane, cut at the lateral edge before face first_face (contract 6.1).
    A wedge is also cut along its ridge, and a cap is a fan about its apex. Returns the placed faces in
    placement order, the placement point list, tau, residuals and the overlap classification."""
    faces = band["faces"]
    nf = len(faces)
    order = [(first_face + k) % nf for k in range(nf)]
    keys = [[tuple(v) for v in faces[i]["vertices"]] for i in order]
    f3 = [[_fl(v) for v in key] for key in keys]
    normals = [tuple(float(c) for c in faces[i]["normal"]) for i in order]
    placed = [_place(_local(f3[0], normals[0], f3[0][0], f3[0][1]), (0.0, 0.0), (1.0, 0.0))]
    points = list(placed[0])
    for k in range(1, nf):
        shared = [v for v in keys[k] if v in keys[k - 1]]
        p, q = shared[0], shared[1]
        pp, pq = placed[k - 1][keys[k - 1].index(p)], placed[k - 1][keys[k - 1].index(q)]
        d = (pq[0] - pp[0], pq[1] - pp[1])
        ln = math.hypot(*d)
        loc = _local(f3[k], normals[k], f3[k][keys[k].index(p)], f3[k][keys[k].index(q)])
        placed.append(_place(loc, pp, (d[0] / ln, d[1] / ln)))
        points.extend(pt for v, pt in zip(keys[k], placed[k]) if v not in shared)
    allv = {v for key in keys for v in key}
    tau = NET_TAU_FACTOR * max(1.0, max(_flen(_fsub(_fl(a), _fl(b))) for a in allv for b in allv))
    residual = 0.0
    for k in range(nf):
        for i in range(len(f3[k])):
            for j in range(i + 1, len(f3[k])):
                d2 = math.hypot(placed[k][i][0] - placed[k][j][0], placed[k][i][1] - placed[k][j][1])
                residual = max(residual, abs(_flen(_fsub(f3[k][i], f3[k][j])) - d2))
    copies = [[v for v in keys[0] if v in keys[-1]][:2]]
    if band["topology"] == "disc-wedge":
        seg = band["ring_b"] if len(band["ring_b"]["vertices"]) == 2 else band["ring_a"]
        copies.append([tuple(v) + (seg["z"],) for v in seg["vertices"]])
    seams = []
    for e in copies:
        d3 = _flen(_fsub(_fl(e[0]), _fl(e[1])))
        for k in range(nf):
            if e[0] in keys[k] and e[1] in keys[k]:
                a, b = placed[k][keys[k].index(e[0])], placed[k][keys[k].index(e[1])]
                seams.append(abs(math.hypot(a[0] - b[0], a[1] - b[1]) - d3))
    classes = {"disjoint": 0, "legal-contact": 0, "touching": 0, "overlap": 0, "inconclusive": 0}
    pairs = []
    for i in range(nf):
        for j in range(i + 1, nf):
            c, sigma = _classify_pair(i, j, keys, placed, tau)
            classes[c] += 1
            pairs.append([order[i], order[j], c, sigma])
    return {"first_face": first_face, "order": order, "faces": placed, "points": points, "tau": tau,
            "congruence_residual": residual, "seam_residuals": seams, "classes": classes, "pairs": pairs}
