"""Laboratory M2 tests for O2 crease insertion, against the frozen contract (m2-o2-contract.md).

RESEARCH ARTEFACT ONLY (D-6). Tests use the public functions of o2.py and the independent oracles of
oracles_o2.py; no mocks, no sleeps, seeded generators only. Run from the repository root:
    python3 -m unittest discover -s docs/research/geometry-operator-lab -p 'test_*.py'
"""
import json
import math
import os
import random
import subprocess
import sys
import unittest
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import oracles_o2 as orc  # noqa: E402
import o2  # noqa: E402

with open(os.path.join(HERE, "m2-fixtures.json")) as _f:
    FX = json.load(_f)
M = 10 ** 6
H = M // 2
SQ = FX["square"]
ANGLE_BAND = 1e-7


def ok(res):
    if not res.get("ok"):
        raise AssertionError("expected ok, got %r" % (res.get("error"),))
    return res


def code(res):
    if res.get("ok"):
        raise AssertionError("expected an error, got ok")
    return res["error"]["code"]


def sheet(outline=SQ):
    return ok(o2.make_sheet(outline))["sheet"]


def insert(sh, face, line, assignment="valley", **kw):
    return o2.insert_crease(sh, face, line[0], line[1], assignment, **kw)


def current(sh):
    return {f["id"]: [orc.point(v) for v in f["vertices"]] for f in sh["faces"] if f["children"] is None}


def ring_of(points):
    return [(Fraction(x), Fraction(y)) for x, y in points]


def crease_map(sh):
    return {c["id"]: (c["faces"][0], c["faces"][1], orc.point(c["endpoints"][0]), orc.point(c["endpoints"][1]))
            for c in sh["creases"]}


def posed(sh, angles, root):
    return {f["id"]: [tuple(v) for v in f["vertices"]] for f in ok(o2.pose(sh, angles, root))["pose"]["faces"]}


def tau(sh):
    pts = [orc.point(v) for v in sh["outline"]]
    diam = max(math.hypot(float(a[0] - b[0]), float(a[1] - b[1])) for a in pts for b in pts) * 1e-6
    return 1e-9 * max(1.0, diam)


def random_convex(rng, max_vertices, span):
    """Q1/Q2 outline: the exact hull of randint(3, 36) random points in +-span, kept if 3..max_vertices."""
    while True:
        pts = [(rng.randint(-span, span), rng.randint(-span, span)) for _ in range(rng.randint(3, 36))]
        h = orc.hull([(Fraction(x), Fraction(y)) for x, y in pts])
        if 3 <= len(h) <= max_vertices:
            return [[int(x), int(y)] for x, y in h]


def _box_point(rng, ring):
    xs, ys = [v[0] for v in ring], [v[1] for v in ring]
    cx, cy = (max(xs) + min(xs)) // 2, (max(ys) + min(ys)) // 2
    rx, ry = max(1, int(max(xs) - min(xs))), max(1, int(max(ys) - min(ys)))
    return [int(cx) + rng.randint(-rx, rx), int(cy) + rng.randint(-ry, ry)]


def _distinct(rng, a, pick):
    while True:
        b = pick()
        if b != a:
            return [a, b]


def random_line(rng, outline):
    """Q1 random mode: two distinct random points in the outline's bounding box enlarged twice."""
    return _distinct(rng, _box_point(rng, outline), lambda: _box_point(rng, outline))


def q1_line(rng, outline, i):
    """Q1 line by case index i mod 10 (contract v1.1 section 8)."""
    m = i % 10
    n = len(outline)
    if m <= 4:
        return random_line(rng, outline)
    if m == 5:
        return _distinct(rng, list(outline[rng.randrange(n)]), lambda: _box_point(rng, outline))
    if m == 6:
        k = rng.sample(range(n), 2)
        return [list(outline[k[0]]), list(outline[k[1]])]
    if m == 7:
        k = rng.randrange(n)
        return [list(outline[k]), list(outline[(k + 1) % n])]
    v = outline[rng.randrange(n)]
    if m == 8:
        p = [v[0] + 1, v[1]]
        return _distinct(rng, p, lambda: [p[0] + rng.randint(-M, M), p[1] + rng.randint(-M, M)])
    xs, ys = [u[0] for u in outline], [u[1] for u in outline]
    c = [(max(xs) + min(xs)) // 2, (max(ys) + min(ys)) // 2]
    return [list(v), c] if list(v) != c else random_line(rng, outline)


def q2_line(rng, ring, j):
    """Q2 line by attempt index j mod 4 on a current face ring (contract v1.1 section 8)."""
    m = j % 4
    ints = [[int(v[0]), int(v[1])] for v in ring if v[0].denominator == 1 and v[1].denominator == 1]
    if m <= 1 or not ints:
        return _distinct(rng, _box_point(rng, ring), lambda: _box_point(rng, ring))
    if m == 2 or len(ints) < 2:
        return _distinct(rng, ints[rng.randrange(len(ints))], lambda: _box_point(rng, ring))
    k = rng.sample(range(len(ints)), 2)
    return [ints[k[0]], ints[k[1]]]


def expected_code(sh, face_id, line):
    """Oracle classification of an insertion: None when it must succeed (no min_altitude)."""
    faces = current(sh)
    ring = faces[face_id]
    p, q = ring_of(line)
    if p == q:
        return "degenerate-line"
    kind = orc.classify_line(ring, p, q)
    if kind != "splits":
        return {"misses": "line-misses-panel", "touches": "line-touches-boundary"}[kind]
    ends = [v for v in orc.clip(ring, p, q, 1) if orc.side(p, q, v) == 0]
    crease_edges = [e for k, (full, e) in orc.adjacency(faces).items() if face_id in k and e]
    for x in ends:
        for a, b in crease_edges:
            if orc.on_segment(x, a, b) and x not in (a, b):
                return "splits-crease"
    return None


def random_sheet(rng, attempts, test=None):
    """A Q2 sequence: attempted insertions on random current faces; returns every accepted sheet."""
    outline = random_convex(rng, 10, M)
    sh = sheet(outline)
    out = [sh]
    for j in range(attempts):
        faces = current(sh)
        ids = sorted(faces)
        face = ids[rng.randrange(len(ids))]
        line = q2_line(rng, faces[face], j)
        res = insert(sh, face, line, rng.choice(["valley", "mountain"]))
        if test is not None:
            exp = expected_code(sh, face, line)
            test.assertEqual(res["ok"], exp is None, (exp, res.get("error")))
            if exp is not None:
                test.assertEqual(res["error"]["code"], exp)
        if res["ok"]:
            sh = res["sheet"]
            out.append(sh)
    return out


def random_angles(rng, sh):
    return {c["id"]: (1 if c["assignment"] == "valley" else -1) * rng.uniform(0, 179) for c in sh["creases"]}


def check_pose(test, sh, angles, root):
    """P1, P2, the angle roundtrip and agreement with the oracle pose, within the contract bands."""
    t = tau(sh)
    got = posed(sh, angles, root)
    faces = current(sh)
    ref = orc.pose(faces, crease_map(sh), angles, root)
    test.assertEqual(sorted(got), sorted(faces))
    for fid, ring in faces.items():
        test.assertEqual((len(got[fid]), len(ref[fid])), (len(ring), len(ring)), fid)
        for a, b in zip(got[fid], ref[fid]):
            test.assertLessEqual(orc.dist3(a, b), t, fid)
        rest = [orc._fl(v) for v in ring]
        for i in range(len(ring)):
            for j in range(i + 1, len(ring)):
                test.assertLessEqual(abs(orc.dist3(got[fid][i], got[fid][j]) - orc.dist3(rest[i], rest[j])), t)
    for cid, (f1, f2, p, q) in crease_map(sh).items():
        for e in (p, q):
            a, b = got[f1][faces[f1].index(e)], got[f2][faces[f2].index(e)]
            test.assertLessEqual(orc.dist3(a, b), t)
        big = max(abs(float(c)) for v in sh["outline"] for c in v) * 1e-6
        if all(not orc.altitude2_below(faces[f], 1000 * max(1.0, big)) for f in (f1, f2)):
            for par, ch in ((f1, f2), (f2, f1)):
                pa, pb = got[par][faces[par].index(p)], got[par][faces[par].index(q)]
                m = orc.measured_angle_deg(got[par], got[ch], pa, pb)
                test.assertLessEqual(abs(((m - angles[cid] + 180.0) % 360.0) - 180.0), ANGLE_BAND, (cid, par))
    return got


class Fixtures(unittest.TestCase):
    def test_g1_splits_the_square_into_two_named_halves_joined_by_one_crease(self):
        sh = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        faces = current(sh)
        self.assertEqual(faces, {"F.a": ring_of(FX["G1"]["F.a"]), "F.b": ring_of(FX["G1"]["F.b"])})
        areas = {f["id"]: f["area"] for f in sh["faces"] if f["children"] is None}
        self.assertEqual(areas, {"F.a": FX["G1"]["area_each_q2"], "F.b": FX["G1"]["area_each_q2"]})
        self.assertEqual([(c["id"], c["faces"], c["assignment"]) for c in sh["creases"]], [("F", ["F.a", "F.b"], "valley")])
        self.assertEqual([orc.point(e) for e in sh["creases"][0]["endpoints"]], ring_of(FX["G1"]["crease_endpoints"]))

    def test_g1_valley_at_90_lifts_the_child_toward_the_front_from_either_root(self):
        sh = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        for root, other, key in (("F.a", "F.b", "pose_root_Fa_90_Fb_L"), ("F.b", "F.a", "pose_root_Fb_90_Fa_L")):
            got = check_pose(self, sh, {"F": 90.0}, root)
            for a, b in zip(got[other], FX["G1"][key]):
                self.assertLessEqual(orc.dist3(a, b), tau(sh))

    def test_g1m_mountain_at_minus_90_lowers_the_child(self):
        sh = ok(insert(sheet(), "F", FX["G1"]["line"], "mountain"))["sheet"]
        got = check_pose(self, sh, {"F": -90.0}, "F.a")
        for a, b in zip(got["F.b"], FX["G1"]["pose_root_Fa_m90_mountain_Fb_L"]):
            self.assertLessEqual(orc.dist3(a, b), tau(sh))

    def test_g2_line_orientation_and_naming_points_do_not_change_the_canonical_sheet(self):
        base = o2.canonical_json(ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"])
        for line in FX["G2"]["lines"]:
            self.assertEqual(o2.canonical_json(ok(insert(sheet(), "F", line))["sheet"]), base)

    def test_g3_a_diagonal_through_two_vertices_adds_no_vertex(self):
        faces = current(ok(insert(sheet(), "F", FX["G3"]["line"]))["sheet"])
        self.assertEqual(faces, {"F.a": ring_of(FX["G3"]["F.a"]), "F.b": ring_of(FX["G3"]["F.b"])})

    def test_g4_a_line_through_a_vertex_and_an_edge_interior_adds_one_vertex(self):
        sh = ok(insert(sheet(), "F", FX["G4"]["line"]))["sheet"]
        self.assertEqual(current(sh), {"F.a": ring_of(FX["G4"]["F.a"]), "F.b": ring_of(FX["G4"]["F.b"])})
        self.assertEqual({f["id"]: f["area"] for f in sh["faces"] if f["children"] is None}, FX["G4"]["areas_q2"])

    def test_g5_a_fan_at_a_crease_endpoint_is_legal_and_keeps_a_tree(self):
        sh = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        sh = ok(insert(sh, "F.a", FX["G5"]["second_line"]))["sheet"]
        faces = current(sh)
        self.assertEqual(faces["F.a.a"], ring_of(FX["G5"]["F.a.a"]))
        self.assertEqual(faces["F.a.b"], ring_of(FX["G5"]["F.a.b"]))
        self.assertEqual({c["id"]: c["faces"] for c in sh["creases"]}, FX["G5"]["creases"])
        adj = orc.adjacency(faces)
        self.assertTrue(orc.is_tree(faces, list(adj)))

    def test_g6_parallel_creases_fold_into_a_u_and_commute_in_the_flat_state(self):
        a, b = FX["G6"]["lines"]
        sh = ok(insert(ok(insert(sheet(), "F", a))["sheet"], "F.b", b))["sheet"]
        self.assertEqual(current(sh), {k: ring_of(v) for k, v in FX["G6"]["faces"].items()})
        self.assertEqual({c["id"]: c["faces"] for c in sh["creases"]}, FX["G6"]["creases"])
        other = ok(insert(ok(insert(sheet(), "F", b))["sheet"], "F.a", a))["sheet"]
        self.assertEqual(o2.geometry_digest(other), o2.geometry_digest(sh))
        got = check_pose(self, sh, {"F": 90.0, "F.b": 90.0}, "F.b.a")
        exp = FX["G6"]["pose_root_Fba_90_90"]
        self.assertLessEqual(orc.dist3(got["F.a"][0], exp["origin_to"]), tau(sh))
        self.assertLessEqual(orc.dist3(got["F.b.b"][1], exp["x1_to"]), tau(sh))

    def test_g7_camber_matches_the_arc_deviation_table(self):
        g = FX["G7"]
        for case in g["cases"]:
            n, w = case["n"], case["strip_width_q"]
            sh = sheet([[0, 0], [n * w, 0], [n * w, g["height_q"]], [0, g["height_q"]]])
            for i in range(1, n):
                leaf = [f for f, ring in current(sh).items() if max(v[0] for v in ring) == n * w][0]
                sh = ok(insert(sh, leaf, [[i * w, 0], [i * w, g["height_q"]]]))["sheet"]
            root = [f for f, ring in current(sh).items() if min(v[0] for v in ring) == 0][0]
            angles = {c["id"]: case["fold_deg"] for c in sh["creases"]}
            got = check_pose(self, sh, angles, root)
            pts = sorted({(round(v[0], 12), round(v[1], 12), round(v[2], 12)) for f in got.values() for v in f if abs(v[1]) < 1e-12})
            chain = [(0.0, 0.0, 0.0)]
            while len(chain) < n + 1:
                nxt = min((p for p in pts if p not in chain), key=lambda p: orc.dist3(p, chain[-1]))
                chain.append(nxt)
            chord = orc.dist3(chain[0], chain[-1])
            self.assertLessEqual(abs(chord - g["chord_L"]), g["band_L"], case["k"])
            mid = tuple((a + b) / 2 for a, b in zip(chain[0], chain[-1]))
            d_hat = orc._unit(orc._sub3(chain[-1], chain[0]))

            def perp(p):
                v = orc._sub3(p, mid)
                t = sum(a * b for a, b in zip(v, d_hat))
                return tuple(a - t * b for a, b in zip(v, d_hat))

            away = orc._unit(max((perp(p) for p in chain), key=lambda v: math.sqrt(sum(c * c for c in v))))
            centre = tuple(m - (g["R_L"] - g["sagitta_L"]) * u for m, u in zip(mid, away))
            for p in chain:
                self.assertLessEqual(abs(orc.dist3(p, centre) - g["R_L"]), g["band_L"], case["k"])
            dev = g["R_L"] - min(orc.dist3(tuple((a + b) / 2 for a, b in zip(chain[i], chain[i + 1])), centre) for i in range(n))
            self.assertLessEqual(abs(dev - case["deviation_L"]), g["band_L"], case["k"])

    def test_g8_angles_near_the_limits_roundtrip_and_keep_lengths(self):
        for theta, assignment in ((FX["G8"]["angles"][0], "valley"), (FX["G8"]["angles"][1], "mountain")):
            sh = ok(insert(sheet(), "F", FX["G1"]["line"], assignment))["sheet"]
            check_pose(self, sh, {"F": theta}, "F.a")

    def test_g9_zero_angles_give_the_rest_sheet(self):
        sh = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        got = posed(sh, {"F": 0}, "F.a")
        for fid, ring in current(sh).items():
            for a, v in zip(got[fid], ring):
                self.assertLessEqual(orc.dist3(a, orc._fl(v)), tau(sh))

    def test_g10_rerooting_keeps_every_pairwise_distance(self):
        sh = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        sh = ok(insert(sh, "F.b", FX["G10"]["second_line"], "mountain"))["sheet"]
        angles = FX["G10"]["angles"]
        r1, r2 = (check_pose(self, sh, angles, r) for r in FX["G10"]["roots"])
        v1 = [v for f in sorted(r1) for v in r1[f]]
        v2 = [v for f in sorted(r2) for v in r2[f]]
        for i in range(len(v1)):
            for j in range(i + 1, len(v1)):
                self.assertLessEqual(abs(orc.dist3(v1[i], v1[j]) - orc.dist3(v2[i], v2[j])), tau(sh))


    def test_g11_a_sheet_far_from_the_origin_poses_within_the_bands(self):
        off = 998 * M
        t = lambda v: [v[0] + off, v[1] + off]
        sh = ok(insert(sheet([t(v) for v in SQ]), "F", [t(v) for v in FX["G1"]["line"]]))["sheet"]
        sh = ok(insert(sh, "F.b", [t(v) for v in FX["G10"]["second_line"]], "mountain"))["sheet"]
        for root in FX["G10"]["roots"]:
            check_pose(self, sh, FX["G10"]["angles"], root)

    def test_g12_a_64_strip_chain_at_the_bound_and_g1_just_below_180(self):
        w, x0 = 15625, 998 * M
        sh = sheet([[x0, 0], [x0 + 64 * w, 0], [x0 + 64 * w, M], [x0, M]])
        for i in range(1, 64):
            leaf = [f for f, ring in current(sh).items() if max(v[0] for v in ring) == x0 + 64 * w][0]
            sh = ok(insert(sh, leaf, [[x0 + i * w, 0], [x0 + i * w, M]]))["sheet"]
        root = [f for f, ring in current(sh).items() if min(v[0] for v in ring) == x0][0]
        check_pose(self, sh, {c["id"]: 2.8125 for c in sh["creases"]}, root)
        g1 = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        check_pose(self, g1, {"F": math.nextafter(180.0, 0.0)}, "F.a")

    def test_g13_signed_zero_angles_pass_both_assignments(self):
        for assignment, theta in (("valley", -0.0), ("mountain", 0.0)):
            sh = ok(insert(sheet(), "F", FX["G1"]["line"], assignment))["sheet"]
            got = posed(sh, {"F": theta}, "F.a")
            for fid, ring in current(sh).items():
                for a, v in zip(got[fid], ring):
                    self.assertLessEqual(orc.dist3(a, orc._fl(v)), tau(sh))

    def test_g14_a_strip_exactly_at_the_threshold_is_not_thin(self):
        line = [[1000, 0], [1000, M]]
        self.assertTrue(insert(sheet(), "F", line, min_altitude=1000)["ok"])
        self.assertEqual(code(insert(sheet(), "F", line, min_altitude=1001)), "thin-panel")

    def test_g15_insertion_leaves_the_input_sheet_unchanged(self):
        sh = sheet()
        before = o2.canonical_json(sh)
        ok(insert(sh, "F", FX["G1"]["line"]))
        self.assertEqual(o2.canonical_json(sh), before)


class NegativeControls(unittest.TestCase):
    def test_x1_to_x3_invalid_outlines_return_their_codes(self):
        pent = [[int(1e6 * math.cos(2 * math.pi * k / 5)), int(1e6 * math.sin(2 * math.pi * k / 5))] for k in range(5)]
        cases = [([[0, 0], [2 * M, 0], [M, M // 2], [M, 2 * M]], "non-convex-panel"),
                 ([pent[i] for i in (0, 2, 4, 1, 3)], "non-convex-panel"),
                 ([[0, 0], [M, M], [M, 0], [0, M]], "non-convex-panel"),
                 ([[0, 0], [M // 2, 0], [M, 0], [M, M], [0, M]], "collinear-vertex"),
                 ([[0, 0], [M, 0], [2 * M, 0]], "collinear-vertex"),
                 ([[0, 0], [M, 0], [M, 0], [M, M], [0, M]], "duplicate-vertex"),
                 ([[0, 0], [M, 0], [M, M], [0, M], [M, 0]], "duplicate-vertex")]
        for outline, expected in cases:
            self.assertEqual(code(o2.make_sheet(outline)), expected, outline)

    def test_x4_malformed_inputs_are_malformed(self):
        for outline in ([[0.5, 0], [M, 0], [0, M]], [[True, 0], [M, 0], [0, M]], [["0", 0], [M, 0], [0, M]], [[0], [M, 0], [0, M]]):
            self.assertEqual(code(o2.make_sheet(outline)), "malformed-input")
        self.assertEqual(code(insert(sheet(), "F", FX["G1"]["line"], "flat")), "malformed-input")

    def test_x5_bounds_are_out_of_bounds(self):
        self.assertEqual(code(o2.make_sheet([[0, 0], [10 ** 9 + 1, 0], [0, M]])), "out-of-bounds")
        many = [[int(1e8 * math.cos(2 * math.pi * k / 1025)), int(1e8 * math.sin(2 * math.pi * k / 1025))] for k in range(1025)]
        self.assertEqual(code(o2.make_sheet(many)), "out-of-bounds")
        self.assertEqual(code(o2.make_sheet([[0, 0], [M, 0]])), "out-of-bounds")
        self.assertEqual(code(insert(sheet(), "F", FX["G1"]["line"], min_altitude=4 * 10 ** 9 + 1)), "out-of-bounds")
        sh = sheet([[0, 0], [66 * M, 0], [66 * M, M], [0, M]])
        for i in range(1, 65):
            leaf = [f for f, ring in current(sh).items() if max(v[0] for v in ring) == 66 * M][0]
            sh = ok(insert(sh, leaf, [[i * M, 0], [i * M, M]]))["sheet"]
        leaf = [f for f, ring in current(sh).items() if max(v[0] for v in ring) == 66 * M][0]
        self.assertEqual(code(insert(sh, leaf, [[65 * M, 0], [65 * M, M]])), "out-of-bounds")

    def test_x6_x7_unknown_and_split_faces(self):
        self.assertEqual(code(insert(sheet(), "Z", FX["G1"]["line"])), "unknown-face")
        sh = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        self.assertEqual(code(insert(sh, "F", FX["G3"]["line"])), "not-a-leaf")

    def test_x8_to_x10_degenerate_missing_and_touching_lines(self):
        self.assertEqual(code(insert(sheet(), "F", [[H, H], [H, H]])), "degenerate-line")
        self.assertEqual(code(insert(sheet(), "F", [[2 * M, 0], [2 * M, M]])), "line-misses-panel")
        self.assertEqual(code(insert(sheet(), "F", [[M, 0], [M, M]])), "line-touches-boundary")
        self.assertEqual(code(insert(sheet(), "F", [[M, M], [2 * M, 0]])), "line-touches-boundary")

    def test_x11_a_t_junction_and_the_crossing_pair_split_a_crease(self):
        sh = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        self.assertEqual(code(insert(sh, "F.a", [[0, H], [M, H]])), "splits-crease")
        self.assertEqual(code(insert(sh, "F.b", [[0, H], [M, H]])), "splits-crease")

    def test_x12_a_one_quantum_corner_is_thin_only_with_a_threshold(self):
        line = [[0, 1], [1, 0]]
        self.assertEqual(code(insert(sheet(), "F", line, min_altitude=1000)), "thin-panel")
        self.assertTrue(insert(sheet(), "F", line)["ok"])

    def test_x13_to_x17_pose_rejections(self):
        sh = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        for theta in (180, -180, 200):
            self.assertEqual(code(o2.pose(sh, {"F": theta}, "F.a")), "angle-out-of-range")
        self.assertEqual(code(o2.pose(sh, {"F": -10}, "F.a")), "assignment-mismatch")
        self.assertEqual(code(o2.pose(sh, {"F": 10, "Q": 0}, "F.a")), "unknown-crease")
        self.assertEqual(code(o2.pose(sh, {}, "F.a")), "missing-angle")
        for theta in (float("nan"), True, "90"):
            self.assertEqual(code(o2.pose(sh, {"F": theta}, "F.a")), "malformed-input")
        self.assertEqual(code(o2.pose(sh, {"F": 10}, "F")), "not-a-leaf")
        self.assertEqual(code(o2.pose(sh, {"F": 10}, "Z")), "unknown-face")

    def test_x18_error_precedence(self):
        self.assertEqual(code(insert(sheet(), "Z", [[10 ** 9 + 1, 0], [0, 0]])), "out-of-bounds")
        sh = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        self.assertEqual(code(insert(sh, "F", [[H, H], [H, H]])), "not-a-leaf")
        sh2 = ok(insert(sh, "F.b", FX["G10"]["second_line"], "mountain"))["sheet"]
        self.assertEqual(code(o2.pose(sh2, {"F.b": -200}, "F.a")), "missing-angle")


class Properties(unittest.TestCase):
    def test_q1_splits_equal_the_clip_oracle_and_conserve_area(self):
        rng = random.Random(20261130)
        accepted = 0
        modes = set()
        for i in range(300):
            outline = random_convex(rng, 12, M)
            line = q1_line(rng, outline, i)
            res = insert(sheet(outline), "F", line)
            face = ring_of(outline)
            p, q = ring_of(line)
            kind = orc.classify_line(face, p, q)
            modes.add(kind)
            if kind != "splits":
                self.assertEqual(code(res), {"misses": "line-misses-panel", "touches": "line-touches-boundary"}[kind])
                continue
            faces = current(ok(res)["sheet"])
            accepted += 1
            pieces = {tuple(orc.clip(face, p, q, 1)), tuple(orc.clip(face, p, q, -1))}
            self.assertEqual({tuple(v) for v in faces.values()}, pieces)
            for ring in faces.values():
                self.assertTrue(orc.strictly_convex(ring))
            self.assertEqual(sum(orc.shoelace(r) for r in faces.values()), orc.shoelace(face))
        self.assertGreater(accepted, 100)
        self.assertEqual(modes, {"splits", "misses", "touches"})

    def test_q2_random_sequences_keep_the_boundary_invariant_a_tree_and_a_cover(self):
        rng = random.Random(20261131)
        for _ in range(100):
            for sh in random_sheet(rng, 16, self):
                outline = [orc.point(v) for v in sh["outline"]]
                faces = current(sh)
                self.assertTrue(all(orc.on_boundary(v, outline) for r in faces.values() for v in r))
                adj = orc.adjacency(faces)
                self.assertTrue(all(full for full, _ in adj.values()))
                self.assertTrue(orc.is_tree(faces, list(adj)))
                creases = {tuple(c["faces"]): tuple(sorted(orc.point(e) for e in c["endpoints"])) for c in sh["creases"]}
                self.assertEqual(creases, {k: v[1] for k, v in adj.items()})
                self.assertEqual(sum(orc.shoelace(r) for r in faces.values()), orc.shoelace(outline))
                ids = sorted(faces)
                for i, a in enumerate(ids):
                    for b in ids[i + 1:]:
                        self.assertTrue(orc.interiors_disjoint(faces[a], faces[b]))
                byid = {f["id"]: {orc.point(v) for v in f["vertices"]} for f in sh["faces"]}
                for f in sh["faces"]:
                    if f["children"]:
                        ca, cb = (byid[c] for c in f["children"])
                        off = [v for v in (orc.point(w) for w in f["vertices"]) if not (v in ca and v in cb)]
                        self.assertIn(min(off), ca, f["id"])

    def test_q3_poses_are_rigid_share_their_axes_roundtrip_and_match_the_oracle(self):
        rng = random.Random(20261131)
        sheets = [s for _ in range(100) for s in random_sheet(rng, 16)[-1:]]
        prng = random.Random(20261136)
        for sh in sheets:
            for _ in range(3):
                faces = sorted(current(sh))
                check_pose(self, sh, random_angles(prng, sh), faces[prng.randrange(len(faces))])

    def test_q4_allowed_permutations_give_identical_canonical_json(self):
        rng = random.Random(20261132)
        done = 0
        while done < 150:
            outline = random_convex(rng, 12, M)
            line = random_line(rng, outline)
            base = insert(sheet(outline), "F", line)
            if not base["ok"]:
                continue
            done += 1
            ref = o2.canonical_json(base["sheet"])
            k = rng.randrange(len(outline))
            rot = outline[k:] + outline[:k]
            p, q = line
            far = [p[0] + 3 * (q[0] - p[0]), p[1] + 3 * (q[1] - p[1])]
            lines = [[p, q], [q, p]] + ([[far, p]] if max(abs(c) for c in far) <= 10 ** 9 else [])
            for o in (rot, list(reversed(rot))):
                for ln in lines:
                    self.assertEqual(o2.canonical_json(ok(insert(sheet(o), "F", ln))["sheet"]), ref)

    def test_q5_non_crossing_chords_and_fans_commute_and_crossing_chords_are_rejected_both_ways(self):
        rng = random.Random(20261133)
        noncross = cross = fans = 0
        draw = 0
        while noncross < 100 or cross < 100 or fans < 30:
            draw += 1
            ts = sorted(rng.sample(range(1, 4 * M), 4))
            fan = draw % 3 == 0
            if fan:
                ts[2] = ts[1]
            pts = [self._on_square(t) for t in ts]
            pairs = [("noncross", (pts[0], pts[1]), (pts[2], pts[3]))]
            if not fan:
                pairs.append(("cross", (pts[0], pts[2]), (pts[1], pts[3])))
            for kind, c1, c2 in pairs:
                r1, r2 = insert(sheet(), "F", list(c1)), insert(sheet(), "F", list(c2))
                if not (r1["ok"] and r2["ok"]):
                    continue
                a_, b_ = self._second(r1["sheet"], c2), self._second(r2["sheet"], c1)
                if kind == "noncross":
                    noncross += 1
                    fans += fan
                    self.assertEqual(o2.geometry_digest(ok(a_)["sheet"]), o2.geometry_digest(ok(b_)["sheet"]))
                else:
                    cross += 1
                    self.assertEqual((code(a_), code(b_)), ("splits-crease", "splits-crease"))

    @staticmethod
    def _on_square(t):
        side, s = divmod(t, M)
        return [[s, 0], [M, s], [M - s, M], [0, M - s]][side]

    @staticmethod
    def _second(sh, chord):
        mid = (Fraction(chord[0][0] + chord[1][0], 2), Fraction(chord[0][1] + chord[1][1], 2))
        for fid, ring in current(sh).items():
            if not orc.interiors_disjoint(ring, [mid, (mid[0] + Fraction(1, 10 ** 9), mid[1]), (mid[0], mid[1] + Fraction(1, 10 ** 9))]):
                return insert(sh, fid, list(chord))
        raise AssertionError("no face holds the chord midpoint")

    def test_q6_translation_quarter_turn_and_mirror_transform_the_geometry(self):
        rng = random.Random(20261130)
        maps = {"translate": lambda p: [p[0] + 12345, p[1] - 6789], "quarter": lambda p: [-p[1], p[0]], "mirror": lambda p: [-p[0], p[1]]}
        done = 0
        while done < 50:
            outline = random_convex(rng, 12, M)
            line = random_line(rng, outline)
            base = insert(sheet(outline), "F", line)
            if not base["ok"]:
                continue
            done += 1
            for name, f in maps.items():
                moved = ok(insert(sheet([f(p) for p in outline]), "F", [f(p) for p in line]))["sheet"]
                expect = {tuple(sorted((f([v[0], v[1]])[0], f([v[0], v[1]])[1]) for v in r)) for r in current(base["sheet"]).values()}
                self.assertEqual({tuple(sorted(r)) for r in current(moved).values()}, expect, name)
                self.assertEqual([c["assignment"] for c in moved["creases"]], ["valley"])

    def test_q7_the_digest_does_not_depend_on_the_hash_seed(self):
        script = ("import json,sys; sys.path.insert(0, %r); import o2;"
                  "fx=json.load(open(%r)); b=o2.make_sheet(fx['square'])['sheet'];"
                  "i=lambda s,f,l,a='valley': o2.insert_crease(s,f,l[0],l[1],a)['sheet'];"
                  "g1=i(b,'F',fx['G1']['line']); l6=fx['G6']['lines'];"
                  "sheets=[g1,i(b,'F',fx['G1']['line'],'mountain'),i(b,'F',fx['G3']['line']),i(b,'F',fx['G4']['line']),"
                  "i(g1,'F.a',fx['G5']['second_line']),i(i(b,'F',l6[0]),'F.b',l6[1]),i(g1,'F.b',fx['G10']['second_line'],'mountain')];"
                  "print([(o2.digest(s), o2.geometry_digest(s)) for s in sheets])") % (HERE, os.path.join(HERE, "m2-fixtures.json"))
        outs = {subprocess.run([sys.executable, "-c", script], env=dict(os.environ, PYTHONHASHSEED=seed),
                               capture_output=True, text=True, check=True).stdout for seed in ("0", "12345")}
        self.assertEqual(len(outs), 1)


class ReviewRegressions(unittest.TestCase):
    """Added in the bounded revision after the independent M2 review (contract section 14 and README);
    o2.py was not changed. Each names the review finding it closes."""

    def test_f1_digests_are_pinned_to_values_an_independent_engine_reproduced(self):
        g1 = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        g5 = ok(insert(g1, "F.a", FX["G5"]["second_line"]))["sheet"]
        self.assertEqual((o2.digest(g1), o2.geometry_digest(g1)),
                         ("bc7d69e9569102808cee643a636446b4bd9987529927709de058f72be3ccd158",
                          "9f256f959bbf389c5873ae3d56e032724aef0b114c7c743324c2b0d35ec54b29"))
        self.assertEqual((o2.digest(g5), o2.geometry_digest(g5)),
                         ("faf0d4b3bccffdef449aefe705f68b8e721d4c0a0a6a9ab8e0aa0e312fc6d305",
                          "d6e33b5449971b9b7eba8416b4d31f62d174a936a625e782584562f8672d1e03"))

    def test_f1_the_canonical_sheet_value_has_the_contract_fields(self):
        g5 = ok(insert(ok(insert(sheet(SQ[2:] + SQ[:2]), "F", FX["G1"]["line"]))["sheet"], "F.a", FX["G5"]["second_line"]))["sheet"]
        self.assertEqual(o2.canonical_json(g5), json.dumps(g5, sort_keys=True, separators=(",", ":"), ensure_ascii=True))
        self.assertEqual(g5["outline"], SQ)
        self.assertEqual([f["id"] for f in g5["faces"]], ["F", "F.a", "F.a.a", "F.a.b", "F.b"])
        lineage = {f["id"]: (f["parent"], f["children"], f["crease"]) for f in g5["faces"]}
        self.assertEqual(lineage, {"F": (None, ["F.a", "F.b"], "F"), "F.a": ("F", ["F.a.a", "F.a.b"], "F.a"),
                                   "F.a.a": ("F.a", None, None), "F.a.b": ("F.a", None, None), "F.b": ("F", None, None)})
        areas = {f["id"]: f["area"] for f in g5["faces"] if f["children"] is None}
        self.assertEqual(areas, {"F.a.a": [25 * 10 ** 10, 1], "F.a.b": [25 * 10 ** 10, 1], "F.b": [5 * 10 ** 11, 1]})
        mountain = ok(insert(sheet(), "F", FX["G1"]["line"], "mountain"))["sheet"]
        valley = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        self.assertNotEqual(o2.geometry_digest(mountain), o2.geometry_digest(valley))

    def test_f2_a_short_crease_far_from_the_origin_follows_the_exact_axis_rule(self):
        outline = [[998000000, 998000000], [999000000, 998157296], [999000000, 999000000], [998287708, 999000000]]
        sh = ok(insert(sheet(outline), "F", [[998000005, 997999997], [997999997, 998000002]]))["sheet"]
        faces = current(sh)
        root = min(faces, key=lambda f: orc.shoelace(faces[f]))
        check_pose(self, sh, {"F": 90.0}, root)

    def test_f3_a_thin_b_piece_is_thin_panel(self):
        self.assertEqual(code(insert(sheet(), "F", [[999999, 0], [M, 1]], min_altitude=1000)), "thin-panel")

    def test_f4_precedence_of_unknown_crease_and_root_checks(self):
        g1 = ok(insert(sheet(), "F", FX["G1"]["line"]))["sheet"]
        self.assertEqual(code(o2.pose(g1, {"Q": 1}, "F.a")), "unknown-crease")
        self.assertEqual(code(o2.pose(g1, {"F": 200}, "Z")), "unknown-face")
        self.assertEqual(code(insert(g1, "F.b", [[0, H], [M, H]], min_altitude=M)), "splits-crease")

    def test_f5_the_bounds_are_inclusive(self):
        self.assertTrue(o2.make_sheet([[-10 ** 9, -10 ** 9], [10 ** 9, -10 ** 9], [10 ** 9, 10 ** 9]])["ok"])
        self.assertEqual(code(insert(sheet(), "F", FX["G1"]["line"], min_altitude=4 * 10 ** 9)), "thin-panel")

    def test_f6_a_sheet_with_a_wrong_version_is_malformed(self):
        sh = dict(sheet(), version="o2-contract-v0")
        self.assertEqual(code(insert(sh, "F", FX["G1"]["line"])), "malformed-input")


class Independence(unittest.TestCase):
    def test_the_oracles_do_not_import_the_implementation(self):
        with open(os.path.join(HERE, "oracles_o2.py")) as f:
            src = f.read()
        self.assertNotIn("import o2", src)
        self.assertNotIn("from o2", src)


if __name__ == "__main__":
    unittest.main()
