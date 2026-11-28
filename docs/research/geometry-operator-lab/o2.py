"""O2 crease insertion, laboratory milestone M2, as frozen in m2-o2-contract.md v1.1.

RESEARCH ARTEFACT ONLY (owner decision D-6; decision packet section 0.4). Not a production API;
imported by nothing in packages/, apps/ or experiments/. Python 3 standard library only.

Scope: one strictly convex outline in its rest plane z = 0, split by straight chords into a tree of
strictly convex faces joined by creases, and a rigid pose of that tree from one fold angle per crease
and a root face. All topological decisions are exact integer or rational predicates on integer input
coordinates in quanta (1 q = 1e-6 L). Floats appear only in posed coordinates.

Public functions: make_sheet, insert_crease, pose, canonical_json, digest, geometry_digest.
"""
import hashlib
import json
import math
from fractions import Fraction

VERSION = "o2-contract-v1"
COORD_MAX = 10 ** 9
VERTEX_MIN = 3
VERTEX_MAX = 1024
CREASE_MAX = 64
ALTITUDE_MAX = 4 * 10 ** 9
ANGLE_LIMIT = 180
QUANTA_PER_L = 10 ** 6
ASSIGNMENTS = ("valley", "mountain")
FACE_KEYS = {"id", "parent", "children", "crease", "vertices", "area"}
CREASE_KEYS = {"id", "endpoints", "assignment", "faces"}
SHEET_KEYS = {"version", "outline", "faces", "creases"}
ROOT_ID = "F"


class _Reject(Exception):
    """Internal control flow only; every public function converts it into an error value."""

    def __init__(self, code, detail):
        Exception.__init__(self, code)
        self.code = code
        self.detail = detail


def _error(r):
    return {"ok": False, "error": {"code": r.code, "detail": r.detail}}


def _is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def _sign(v):
    return (v > 0) - (v < 0)


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def _cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def _half(v):
    return 0 if (v[1] > 0 or (v[1] == 0 and v[0] > 0)) else 1


# ------------------------------------------------------------------ exact rings (contract 3, 5)

def _area2(ring):
    n = len(ring)
    return sum(_cross(ring[i], ring[(i + 1) % n]) for i in range(n))


def _canonical(ring):
    """Counter-clockwise seen from +z, starting at the lexicographically smallest vertex."""
    pts = list(ring)
    if _area2(pts) < 0:
        pts.reverse()
    k = pts.index(min(pts))
    return pts[k:] + pts[:k]


def _altitude2(ring):
    """Exact squared altitude (O1 v1.1 section 3.4): min over edges of the max squared distance of the
    ring's vertices from the edge line."""
    best = None
    n = len(ring)
    for i in range(n):
        p, q = ring[i], ring[(i + 1) % n]
        e = _sub(q, p)
        far = max(Fraction(_cross(e, _sub(r, p)) ** 2) / (e[0] * e[0] + e[1] * e[1]) for r in ring)
        best = far if best is None or far < best else best
    return best


def _validate_outline(pts):
    """Canonical integer ring of a strictly convex outline; never repairs (contract 6, O1 v1.1 3.1)."""
    seen = set()
    for i, p in enumerate(pts):
        if p in seen:
            raise _Reject("duplicate-vertex", "outline vertex %d repeats" % i)
        seen.add(p)
    n = len(pts)
    turns = []
    for i in range(n):
        c = _cross(_sub(pts[(i + 1) % n], pts[i]), _sub(pts[(i + 2) % n], pts[(i + 1) % n]))
        if c == 0:
            raise _Reject("collinear-vertex", "zero turn at outline vertex %d" % ((i + 1) % n))
        turns.append(c)
    if not (all(c > 0 for c in turns) or all(c < 0 for c in turns)):
        raise _Reject("non-convex-panel", "outline turns change sign")
    ccw = pts if turns[0] > 0 else pts[::-1]
    halves = [_half(_sub(ccw[(i + 1) % n], ccw[i])) for i in range(n)]
    wraps = sum(1 for i in range(n) if halves[i] == 1 and halves[(i + 1) % n] == 0)
    if wraps != 1:
        raise _Reject("non-convex-panel", "outline edge directions turn %d times" % wraps)
    k = ccw.index(min(ccw))
    return ccw[k:] + ccw[:k]


# ------------------------------------------------------------------ serialization of exact values

def _rat_out(x):
    return [x.numerator, x.denominator]


def _pt_out(p):
    return [_rat_out(Fraction(p[0])), _rat_out(Fraction(p[1]))]


def _rat_in(v, label):
    if not isinstance(v, list) or len(v) != 2 or not all(_is_int(c) for c in v) or v[1] <= 0:
        raise _Reject("malformed-input", "%s is not a rational [num, den > 0]" % label)
    return Fraction(v[0], v[1])


def _pt_in(v, label):
    if not isinstance(v, list) or len(v) != 2:
        raise _Reject("malformed-input", "%s is not a rational point" % label)
    return (_rat_in(v[0], label), _rat_in(v[1], label))


def _int_pair(v, label):
    if not isinstance(v, list) or len(v) != 2 or not all(_is_int(c) for c in v):
        raise _Reject("malformed-input", "%s is not two integers" % label)
    return (v[0], v[1])


def _opt_str(v, label):
    if v is not None and not isinstance(v, str):
        raise _Reject("malformed-input", "%s is neither a string nor null" % label)
    return v


def _parse_sheet(sheet):
    """Internal form of a sheet value. Its structure is checked; its geometry is trusted (contract 6)."""
    if not isinstance(sheet, dict) or set(sheet) != SHEET_KEYS:
        raise _Reject("malformed-input", "sheet must be an object with keys %s" % sorted(SHEET_KEYS))
    if sheet["version"] != VERSION:
        raise _Reject("malformed-input", "sheet version is not %s" % VERSION)
    if not isinstance(sheet["outline"], list) or len(sheet["outline"]) < VERTEX_MIN:
        raise _Reject("malformed-input", "sheet outline is not a ring")
    outline = [_int_pair(v, "outline vertex %d" % i) for i, v in enumerate(sheet["outline"])]
    if not isinstance(sheet["faces"], list) or not isinstance(sheet["creases"], list):
        raise _Reject("malformed-input", "sheet faces and creases must be lists")
    faces = {}
    for i, f in enumerate(sheet["faces"]):
        label = "face %d" % i
        if not isinstance(f, dict) or set(f) != FACE_KEYS or not isinstance(f["id"], str):
            raise _Reject("malformed-input", "%s is not a face record" % label)
        if f["id"] in faces:
            raise _Reject("malformed-input", "face id %r repeats" % f["id"])
        children = f["children"]
        if children is not None and (not isinstance(children, list) or len(children) != 2
                                     or not all(isinstance(c, str) for c in children)):
            raise _Reject("malformed-input", "%s children are not two ids or null" % label)
        if not isinstance(f["vertices"], list) or len(f["vertices"]) < VERTEX_MIN:
            raise _Reject("malformed-input", "%s vertices are not a ring" % label)
        faces[f["id"]] = {
            "parent": _opt_str(f["parent"], label + " parent"),
            "children": None if children is None else list(children),
            "crease": _opt_str(f["crease"], label + " crease"),
            "vertices": [_pt_in(v, label + " vertex") for v in f["vertices"]],
            "area": _rat_in(f["area"], label + " area"),
        }
    if ROOT_ID not in faces:
        raise _Reject("malformed-input", "sheet has no face %s" % ROOT_ID)
    for fid, f in faces.items():
        if f["children"] is not None and not all(c in faces for c in f["children"]):
            raise _Reject("malformed-input", "face %s names a missing child" % fid)
    creases = {}
    for i, c in enumerate(sheet["creases"]):
        label = "crease %d" % i
        if not isinstance(c, dict) or set(c) != CREASE_KEYS or not isinstance(c["id"], str):
            raise _Reject("malformed-input", "%s is not a crease record" % label)
        if c["id"] in creases:
            raise _Reject("malformed-input", "crease id %r repeats" % c["id"])
        if c["assignment"] not in ASSIGNMENTS:
            raise _Reject("malformed-input", "%s assignment is not valley or mountain" % label)
        ends, sides = c["endpoints"], c["faces"]
        if not isinstance(ends, list) or len(ends) != 2:
            raise _Reject("malformed-input", "%s endpoints are not two points" % label)
        if (not isinstance(sides, list) or len(sides) != 2 or not all(isinstance(s, str) for s in sides)
                or not all(s in faces and faces[s]["children"] is None for s in sides)):
            raise _Reject("malformed-input", "%s faces are not two current faces" % label)
        creases[c["id"]] = {
            "endpoints": [_pt_in(e, label + " endpoint") for e in ends],
            "assignment": c["assignment"],
            "faces": list(sides),
        }
    return {"outline": outline, "faces": faces, "creases": creases}


def _sheet_out(st):
    faces = []
    for fid in sorted(st["faces"]):
        f = st["faces"][fid]
        faces.append({
            "id": fid,
            "parent": f["parent"],
            "children": None if f["children"] is None else list(f["children"]),
            "crease": f["crease"],
            "vertices": [_pt_out(v) for v in f["vertices"]],
            "area": _rat_out(f["area"]),
        })
    creases = []
    for cid in sorted(st["creases"]):
        c = st["creases"][cid]
        creases.append({
            "id": cid,
            "endpoints": [_pt_out(e) for e in sorted(c["endpoints"])],
            "assignment": c["assignment"],
            "faces": sorted(c["faces"]),
        })
    return {"version": VERSION, "outline": [[x, y] for x, y in st["outline"]], "faces": faces, "creases": creases}


# ------------------------------------------------------------------ make_sheet (contract 2, 6)

def make_sheet(outline):
    """The one-face sheet of a strictly convex integer outline; contract v1.1 sections 2 and 5."""
    try:
        if not isinstance(outline, list):
            raise _Reject("malformed-input", "outline must be a list of [x, y] integer pairs")
        pts = [_int_pair(v, "outline vertex %d" % i) for i, v in enumerate(outline)]
        if not VERTEX_MIN <= len(pts) <= VERTEX_MAX:
            raise _Reject("out-of-bounds", "outline vertex count outside %d..%d" % (VERTEX_MIN, VERTEX_MAX))
        if any(abs(c) > COORD_MAX for p in pts for c in p):
            raise _Reject("out-of-bounds", "an outline coordinate beyond %d q" % COORD_MAX)
        ring = _validate_outline(pts)
        face = [(Fraction(x), Fraction(y)) for x, y in ring]
        st = {"outline": ring, "creases": {},
              "faces": {ROOT_ID: {"parent": None, "children": None, "crease": None, "vertices": face,
                                  "area": Fraction(_area2(face), 2)}}}
        return {"ok": True, "sheet": _sheet_out(st)}
    except _Reject as r:
        return _error(r)


# ------------------------------------------------------------------ insert_crease (contract 3, 6)

def _split(ring, p, q):
    """Exact split of a canonical ring by the line pq: the closed pieces on the positive and negative
    sides (counter-clockwise), the sides of every vertex, and the two chord endpoints, each with the
    edge whose relative interior it lies in (None at a vertex)."""
    d = _sub(q, p)
    vals = [_cross(d, _sub(v, p)) for v in ring]
    signs = [_sign(v) for v in vals]
    if all(s > 0 for s in signs) or all(s < 0 for s in signs):
        raise _Reject("line-misses-panel", "every vertex lies strictly on one side of the line")
    if not (any(s > 0 for s in signs) and any(s < 0 for s in signs)):
        raise _Reject("line-touches-boundary", "the line meets the face only in its boundary")
    pos, neg, ends = [], [], []
    n = len(ring)
    for i in range(n):
        a, b = ring[i], ring[(i + 1) % n]
        sa, sb = signs[i], signs[(i + 1) % n]
        if sa >= 0:
            pos.append(a)
        if sa <= 0:
            neg.append(a)
        if sa == 0:
            ends.append((a, None))
        if sa * sb < 0:
            t = Fraction(vals[i]) / (vals[i] - vals[(i + 1) % n])
            x = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
            pos.append(x)
            neg.append(x)
            ends.append((x, (a, b)))
    return _canonical(pos), _canonical(neg), signs, ends


def insert_crease(sheet, face_id, p, q, assignment, min_altitude=None):
    """Split one current face along the line pq; a new sheet with one more crease (contract v1.1)."""
    try:
        st = _parse_sheet(sheet)
        if not isinstance(face_id, str):
            raise _Reject("malformed-input", "face id must be a string")
        p = _int_pair(p, "p")
        q = _int_pair(q, "q")
        if assignment not in ASSIGNMENTS or not isinstance(assignment, str):
            raise _Reject("malformed-input", "assignment must be valley or mountain")
        if min_altitude is not None and (not _is_int(min_altitude) or min_altitude < 1):
            raise _Reject("malformed-input", "min_altitude must be an integer >= 1")
        if any(abs(c) > COORD_MAX for c in p + q):
            raise _Reject("out-of-bounds", "a line point coordinate beyond %d q" % COORD_MAX)
        if len(st["creases"]) >= CREASE_MAX:
            raise _Reject("out-of-bounds", "the sheet already has %d creases" % CREASE_MAX)
        if min_altitude is not None and min_altitude > ALTITUDE_MAX:
            raise _Reject("out-of-bounds", "min_altitude beyond %d q" % ALTITUDE_MAX)
        faces, creases = st["faces"], st["creases"]
        if face_id not in faces:
            raise _Reject("unknown-face", "face %r never existed" % face_id)
        if faces[face_id]["children"] is not None:
            raise _Reject("not-a-leaf", "face %r was already split" % face_id)
        if p == q:
            raise _Reject("degenerate-line", "p equals q")
        ring = faces[face_id]["vertices"]
        pos, neg, signs, ends = _split(ring, (Fraction(p[0]), Fraction(p[1])), (Fraction(q[0]), Fraction(q[1])))
        own = {frozenset(c["endpoints"]): cid for cid, c in creases.items() if face_id in c["faces"]}
        for x, edge in ends:
            if edge is not None and frozenset(edge) in own:
                raise _Reject("splits-crease", "the chord ends inside crease %r" % own[frozenset(edge)])
        first_off = min(v for v, s in zip(ring, signs) if s != 0)
        first_sign = signs[ring.index(first_off)]
        piece_a, piece_b = (pos, neg) if first_sign > 0 else (neg, pos)
        id_a, id_b = face_id + ".a", face_id + ".b"
        if min_altitude is not None:
            for pid, piece in ((id_a, piece_a), (id_b, piece_b)):
                if _altitude2(piece) < min_altitude * min_altitude:
                    raise _Reject("thin-panel", "piece %s has an altitude below %d q" % (pid, min_altitude))
        side_of = dict(zip(ring, signs))
        new_faces = {fid: dict(f) for fid, f in faces.items()}
        new_creases = {cid: dict(c) for cid, c in creases.items()}
        for cid, c in new_creases.items():
            if face_id in c["faces"]:
                strict = [side_of[e] for e in c["endpoints"] if side_of[e] != 0]
                to = id_a if strict[0] == first_sign else id_b
                c["faces"] = sorted(to if f == face_id else f for f in c["faces"])
        new_faces[face_id]["children"] = [id_a, id_b]
        new_faces[face_id]["crease"] = face_id
        for pid, piece in ((id_a, piece_a), (id_b, piece_b)):
            new_faces[pid] = {"parent": face_id, "children": None, "crease": None, "vertices": piece,
                              "area": Fraction(_area2(piece), 2)}
        new_creases[face_id] = {"endpoints": sorted(x for x, _ in ends), "assignment": assignment,
                                "faces": [id_a, id_b]}
        st = {"outline": st["outline"], "faces": new_faces, "creases": new_creases}
        return {"ok": True, "sheet": _sheet_out(st)}
    except _Reject as r:
        return _error(r)


# ------------------------------------------------------------------ pose (contract 4, 6; floats)

def _is_angle(v):
    if isinstance(v, bool):
        return False
    if isinstance(v, int):
        return True
    return isinstance(v, float) and math.isfinite(v)


def _to_l(x):
    return float(Fraction(x) / QUANTA_PER_L)


def _matmul(a, b):
    return tuple(tuple(sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)) for i in range(3))


def _apply(m, v):
    return tuple(sum(m[i][k] * v[k] for k in range(3)) for i in range(3))


def _hinge(crease, parent_ring, theta_deg):
    """R(P, u, theta) as (matrix, translation) in rest coordinates: P the first endpoint, u from the
    exact difference Q - P, oriented so that the parent lies to the right of u (contract 4.2)."""
    pp, qq = crease["endpoints"]
    d = _sub(qq, pp)
    side = next(s for s in (_sign(_cross(d, _sub(v, pp))) for v in parent_ring) if s != 0)
    ux, uy = _to_l(d[0]), _to_l(d[1])
    ln = math.hypot(ux, uy)
    ux, uy = ux / ln, uy / ln
    if side > 0:
        ux, uy = -ux, -uy
    th = math.radians(theta_deg)
    c, s = math.cos(th), math.sin(th)
    k = 1.0 - c
    rot = ((c + ux * ux * k, ux * uy * k, uy * s),
           (ux * uy * k, c + uy * uy * k, -ux * s),
           (-uy * s, ux * s, c))
    base = (_to_l(pp[0]), _to_l(pp[1]), 0.0)
    moved = _apply(rot, base)
    return rot, tuple(b - m for b, m in zip(base, moved))


def pose(sheet, angles, root):
    """Rigid motion of every current face from one fold angle per crease and a root face (contract 4)."""
    try:
        st = _parse_sheet(sheet)
        if not isinstance(root, str):
            raise _Reject("malformed-input", "root must be a face id string")
        if not isinstance(angles, dict):
            raise _Reject("malformed-input", "angles must map crease ids to degrees")
        for key, value in angles.items():
            if not isinstance(key, str):
                raise _Reject("malformed-input", "angle key %r is not a string" % (key,))
            if not _is_angle(value):
                raise _Reject("malformed-input", "angle of %r is not a finite number" % key)
        faces, creases = st["faces"], st["creases"]
        if root not in faces:
            raise _Reject("unknown-face", "root %r never existed" % root)
        if faces[root]["children"] is not None:
            raise _Reject("not-a-leaf", "root %r was split" % root)
        for key in sorted(angles):
            if key not in creases:
                raise _Reject("unknown-crease", "%r is not a crease id" % key)
        ids = sorted(creases)
        for cid in ids:
            if cid not in angles:
                raise _Reject("missing-angle", "crease %r has no angle" % cid)
        for cid in ids:
            if abs(angles[cid]) >= ANGLE_LIMIT:
                raise _Reject("angle-out-of-range", "crease %r: |theta| >= %d" % (cid, ANGLE_LIMIT))
        for cid in ids:
            theta, assignment = angles[cid], creases[cid]["assignment"]
            if (assignment == "valley" and theta < 0) or (assignment == "mountain" and theta > 0):
                raise _Reject("assignment-mismatch", "crease %r is %s, theta %r" % (cid, assignment, theta))
        current = sorted(fid for fid, f in faces.items() if f["children"] is None)
        nbr = {fid: [] for fid in current}
        for cid in ids:
            a, b = creases[cid]["faces"]
            nbr[a].append((b, cid))
            nbr[b].append((a, cid))
        identity = ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0))
        motion = {root: (identity, (0.0, 0.0, 0.0))}
        frontier = [root]
        while frontier:
            parent = frontier.pop(0)
            rp, tp = motion[parent]
            for child, cid in sorted(nbr[parent]):
                if child in motion:
                    continue
                re, te = _hinge(creases[cid], faces[parent]["vertices"], angles[cid])
                motion[child] = (_matmul(rp, re), tuple(a + b for a, b in zip(_apply(rp, te), tp)))
                frontier.append(child)
        if len(motion) != len(current):
            raise _Reject("malformed-input", "the crease records do not connect every current face")
        out = []
        for fid in current:
            rot, t = motion[fid]
            verts = []
            for v in faces[fid]["vertices"]:
                x = _apply(rot, (_to_l(v[0]), _to_l(v[1]), 0.0))
                verts.append([x[0] + t[0], x[1] + t[1], x[2] + t[2]])
            out.append({"id": fid, "vertices": verts})
        return {"ok": True, "pose": {"root": root, "faces": out}}
    except _Reject as r:
        return _error(r)


# ------------------------------------------------------------------ canonical form and digests (contract 5)

def canonical_json(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _sha(obj):
    return hashlib.sha256(canonical_json(obj).encode("ascii")).hexdigest()


def digest(sheet):
    """SHA-256 of the canonical JSON of the sheet."""
    return _sha(sheet)


def geometry_digest(sheet):
    """SHA-256 of the outline, the sorted current face rings and the sorted [endpoints, assignment]
    pairs, with every id and all lineage removed. A malformed sheet digests its error code only."""
    try:
        st = _parse_sheet(sheet)
    except _Reject as r:
        return _sha({"error": r.code})
    rings = sorted(f["vertices"] for f in st["faces"].values() if f["children"] is None)
    pairs = sorted((tuple(sorted(c["endpoints"])), c["assignment"]) for c in st["creases"].values())
    return _sha({
        "outline": [[x, y] for x, y in st["outline"]],
        "faces": [[_pt_out(v) for v in ring] for ring in rings],
        "creases": [[[_pt_out(e) for e in ends], a] for ends, a in pairs],
    })
