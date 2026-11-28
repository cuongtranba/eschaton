"""Bounded experiment for O1 contract v2.1 (tilted section planes), against m1b-o1v2-contract.md.

RESEARCH ARTEFACT ONLY (D-7). Tests use the public functions of o1v2.py, the independent oracles of
oracles_o1v2.py and, for nets, v1.1's unchanged cut_open_net and oracles. No mocks, no sleeps,
seeded generators only. Run from the repository root:
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
import oracles_o1v2 as orc  # noqa: E402
import oracles as orc1  # noqa: E402
import o1  # noqa: E402
import o1v2  # noqa: E402

with open(os.path.join(HERE, "m1b-fixtures.json")) as _f:
    FX = json.load(_f)


def sec(vs):
    return {"vertices": [list(v) for v in vs]}


def run(a, b, **kw):
    return o1v2.section_transition_v2(sec(a), sec(b), **kw)


def ok(res):
    if not res.get("ok"):
        raise AssertionError("expected ok, got %r" % (res.get("error"),))
    return res["band"]


def code(res):
    if res.get("ok"):
        raise AssertionError("expected an error, got ok")
    return res["error"]["code"]


def face_sets(band):
    return {frozenset(tuple(v) for v in f["vertices"]) for f in band["faces"]}


def all_faces(band):
    """Lateral faces plus the two section faces, outward (A reversed), for oracle E."""
    ra = [tuple(v) for v in band["ring_a"]["vertices"]]
    rb = [tuple(v) for v in band["ring_b"]["vertices"]]
    return [f["vertices"] for f in band["faces"]] + [list(reversed(ra)), rb]


def kinds(band):
    out = {}
    for f in band["faces"]:
        out[f["kind"]] = out.get(f["kind"], 0) + 1
    return out


def check_band(test, a, b):
    """S1-S4 against the oracles: faces, canonical form, count, support, volume, topology."""
    band = ok(run(a, b))
    lat = orc.lateral_facets(a, b)
    test.assertEqual(face_sets(band), {pts for _, pts in lat.values()})
    test.assertEqual(orc.canonical_form_errors(band, a, b), [])
    two_edge = sum(1 for _, pts in lat.values() if len(pts) == 4)
    test.assertEqual(len(band["faces"]), len(a) + len(b) - two_edge)
    pts = [tuple(v) for v in a] + [tuple(v) for v in b]
    for f in band["faces"]:
        n = tuple(f["normal"])
        d = orc.dot(n, tuple(f["vertices"][0]))
        test.assertTrue(all(orc.dot(n, p) <= d for p in pts))
    test.assertEqual(Fraction(*band["volume"]), orc.volume(a, b))
    topo = orc.surface_topology(all_faces(band))
    test.assertEqual((topo["chi"], topo["orientable"], topo["boundary"]), (2, True, set()))
    lateral = orc.surface_topology([f["vertices"] for f in band["faces"]])
    test.assertEqual(lateral["chi"], 0)
    test.assertEqual(lateral["boundary"], orc.loop_edges(band["ring_a"]["vertices"]) | orc.loop_edges(band["ring_b"]["vertices"]))
    return band


def random_hull2(rng, span, max_vertices=10):
    while True:
        h = orc1.hull2([(rng.randint(-span, span), rng.randint(-span, span)) for _ in range(rng.randint(3, 30))])
        if 3 <= len(h) <= max_vertices:
            return [tuple(p) for p in h]


def embed(rng, poly):
    while True:
        e1 = tuple(rng.randint(-3, 3) for _ in range(3))
        e2 = tuple(rng.randint(-3, 3) for _ in range(3))
        if orc.cross(e1, e2) != (0, 0, 0):
            break
    o = tuple(rng.randint(-10 ** 6, 10 ** 6) for _ in range(3))
    return [tuple(o[i] + u * e1[i] + v * e2[i] for i in range(3)) for u, v in poly]


def admissible(a, b):
    na, nb = orc.plane_of(a)[0], orc.plane_of(b)[0]
    return orc.cross(na, nb) != (0, 0, 0) and orc.separated(a, b)


def s1_pairs(n):
    rng = random.Random(20261134)
    out, draws = [], 0
    while len(out) < n:
        draws += 1
        if draws > 100000:
            raise AssertionError("redraw cap reached")
        a, b = embed(rng, random_hull2(rng, 10 ** 5)), embed(rng, random_hull2(rng, 10 ** 5))
        if admissible(a, b):
            out.append((a, b))
    return out


def cut_frusta(n):
    """S1b (contract v2.2): cut frusta; odd cases force an A edge along x and a tilt along y only, so
    that edge's image in B stays parallel (a trapezoid)."""
    rng = random.Random(20261137)
    out = []
    while len(out) < n:
        forced = len(out) % 2 == 1
        for _ in range(10):
            if forced:
                pts = [(rng.randint(-10 ** 5, 10 ** 5), rng.randint(-10 ** 5, 10 ** 5)) for _ in range(rng.randint(3, 30))]
                y0 = min(y for _, y in pts) - 1
                x1, x2 = sorted(rng.sample(range(-10 ** 5, 10 ** 5), 2))
                a2 = [tuple(p) for p in orc1.hull2(pts + [(x1, y0), (x2, y0)])]
                if not 3 <= len(a2) <= 10:
                    continue
                a_, b_ = 0, rng.choice([-3, -2, -1, 1, 2, 3])
            else:
                a2 = random_hull2(rng, 10 ** 5)
                a_, b_ = 0, 0
                while (a_, b_) == (0, 0):
                    a_, b_ = rng.randint(-3, 3), rng.randint(-3, 3)
            p, r = rng.choice([(1, 2), (2, 3), (1, 1), (3, 2), (2, 1)])
            dd = rng.randint(4, 16)
            c = a2[0]
            b2 = [(Fraction(r * c[0] + p * (x - c[0]), r), Fraction(r * c[1] + p * (y - c[1]), r)) for x, y in a2]
            must = {i for i, v in enumerate(a2) if forced and v[1] == min(w[1] for w in a2)}
            extra = [i for i in range(len(b2)) if i not in must]
            k = rng.randint(max(0, 3 - len(must)), len(extra))
            keep = sorted(must | set(rng.sample(extra, k)))
            b2 = [b2[i] for i in keep]
            h = 1 + 2 * math.ceil(max(abs(a_ * x + b_ * y) for x, y in list(a2) + b2))
            s = dd * r
            a3 = [(s * x, s * y, 0) for x, y in a2]
            b3 = [(int(s * x), int(s * y), int(r * (dd * h + a_ * x + b_ * y))) for x, y in b2]
            if max(abs(c) for v in a3 + b3 for c in v) <= 10 ** 9 and admissible(a3, b3):
                out.append((a3, b3))
                break
        else:
            raise AssertionError("redraw cap reached")
    return out


def near_parallel(n):
    rng = random.Random(20261135)
    out = []
    while len(out) < n:
        a = [(1000 * x, 1000 * y, 0) for x, y in random_hull2(rng, 10 ** 3)]
        h = rng.randint(10 ** 5, 10 ** 6)
        b = [(1000 * x, 1000 * y, h + x) for x, y in random_hull2(rng, 10 ** 3)]
        out.append((a, b))
    return out


class Fixtures(unittest.TestCase):
    def test_t1_an_oblique_cut_prism_has_two_trapezoids_and_two_quadrilaterals(self):
        f = FX["T1"]
        band = check_band(self, [tuple(v) for v in f["a"]], [tuple(v) for v in f["b"]])
        self.assertEqual(kinds(band), f["kinds"])
        self.assertEqual([x["owner"] for x in band["faces"]], f["owners"])
        self.assertEqual(band["volume"], f["volume_q3"])
        self.assertEqual((band["ring_a"]["plane"][:3], band["ring_b"]["plane"][:3], band["axis_direction"]), (f["n_a"], f["n_b"], f["axis"]))

    def test_t2_a_tilted_diamond_keeps_the_eight_triangles_and_volume_of_f1(self):
        f = FX["T2"]
        band = check_band(self, [tuple(v) for v in f["a"]], [tuple(v) for v in f["b"]])
        self.assertEqual((kinds(band), band["volume"]), (f["kinds"], f["volume_q3"]))
        owners = [x["owner"] for x in band["faces"]]
        self.assertEqual(set(owners), {"A", "B"})
        self.assertTrue(all(owners[i] != owners[(i + 1) % 8] for i in range(8)))

    def test_t3_a_book_has_volume_four_minus_eps_squared_and_canonical_a_second(self):
        f = FX["T3"]
        band = check_band(self, [tuple(v) for v in f["a"]], [tuple(v) for v in f["b"]])
        self.assertEqual((kinds(band), band["volume"]), (f["kinds"], f["volume_q3"]))
        self.assertEqual((band["ring_a"]["plane"][:3], band["ring_b"]["plane"][:3], band["axis_direction"]), (f["n_a"], f["n_b"], f["axis"]))
        self.assertAlmostEqual(band["min_altitude"], f["min_altitude_q"], delta=1e-3)

    def test_t3t_a_one_quantum_book_is_exact_and_thin_only_with_a_threshold(self):
        f = FX["T3t"]
        a, b = [tuple(v) for v in f["a"]], [tuple(v) for v in f["b"]]
        self.assertEqual(ok(run(a, b))["volume"], f["volume_q3"])
        self.assertEqual(code(run(a, b, min_altitude=f["min_altitude"])), "thin-panel")

    def test_t4_a_near_parallel_pair_is_accepted_with_f1_combinatorics(self):
        f = FX["T4"]
        band = check_band(self, [tuple(v) for v in f["a"]], [tuple(v) for v in f["b"]])
        self.assertEqual((kinds(band), band["volume"]), (f["kinds"], f["volume_q3"]))

    def test_t5_nets_of_t1_and_t2_are_congruent_within_tau(self):
        for k in ("T1", "T2"):
            band = ok(run(FX[k]["a"], FX[k]["b"]))
            net = o1.cut_open_net(band)
            self.assertLessEqual(net["congruence_residual"], net["tau"])
            self.assertTrue(all(r <= net["tau"] for r in net["seam_residuals"]))


class NegativeControls(unittest.TestCase):
    def test_w1_to_w4_plane_and_separation_codes(self):
        self.assertEqual(code(run(FX["W1"]["a"], FX["W1"]["b"])), "non-planar-section")
        self.assertEqual(code(run(FX["W2"]["a"], FX["W2"]["b"])), "parallel-planes")
        self.assertEqual(code(run(FX["W3"]["a"], FX["W3"]["b"])), "coincident-planes")
        for case in FX["W4"]:
            self.assertEqual(code(run(case["a"], case["b"])), "sections-not-separated")

    def test_w5_degenerate_sections(self):
        self.assertEqual(code(run([[0, 0, 5]], FX["square"])), "degenerate-section")
        self.assertEqual(code(run([[0, 0, 5], [1, 0, 5]], FX["square"])), "degenerate-section")

    def test_w6_invalid_sections_return_their_codes(self):
        w, b = FX["W6"], FX["T2"]["b"]
        for key, expected in (("dart", "non-convex-section"), ("pentagram", "non-convex-section"),
                              ("planar_bowtie", "non-convex-section"), ("midpoint", "collinear-vertex"),
                              ("repeated", "duplicate-vertex"), ("non_planar", "non-planar-section")):
            self.assertEqual(code(run(w[key], b)), expected, key)

    def test_w7_w8_malformed_and_out_of_bounds(self):
        sq = FX["square"]
        for bad in ([[0.5, 0, 0]] + sq[1:], [[True, 0, 0]] + sq[1:], [["0", 0, 0]] + sq[1:], [[0, 0]] + sq[1:]):
            self.assertEqual(code(run(bad, FX["T2"]["b"])), "malformed-input")
        self.assertEqual(code(o1v2.section_transition_v2({"vertices": sq, "z": 0}, sec(FX["T2"]["b"]))), "malformed-input")
        self.assertEqual(code(o1v2.section_transition_v2({}, sec(FX["T2"]["b"]))), "malformed-input")
        self.assertEqual(code(run([[10 ** 9 + 1, 0, 0]] + sq[1:], FX["T2"]["b"])), "out-of-bounds")
        many = [[int(1e8 * math.cos(2 * math.pi * k / 1025)), int(1e8 * math.sin(2 * math.pi * k / 1025)), 0] for k in range(1025)]
        self.assertEqual(code(run(many, FX["T2"]["b"])), "out-of-bounds")
        self.assertEqual(code(run([], FX["T2"]["b"])), "out-of-bounds")

    def test_w9_w10_thin_panel_and_precedence(self):
        self.assertEqual(code(run(FX["T3t"]["a"], FX["T3t"]["b"], min_altitude=1000)), "thin-panel")
        self.assertEqual(code(run(FX["W1"]["a"], FX["W2"]["b"])), "non-planar-section")
        self.assertEqual(code(run(FX["W3_overlapping"]["a"], FX["W3_overlapping"]["b"])), "coincident-planes")
        collinear = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 5, 0]]
        duplicate = [[0, 0, 0], [0, 0, 7], [0, 0, 7], [0, 5, 7]]
        self.assertEqual(code(run(collinear, duplicate)), "duplicate-vertex")
        self.assertEqual(code(run(duplicate, collinear)), "duplicate-vertex")


class Properties(unittest.TestCase):
    def test_s1_to_s4_random_tilted_pairs_match_the_brute_force_hull(self):
        for a, b in s1_pairs(300):
            check_band(self, a, b)

    def test_s1b_cut_frusta_give_two_edge_faces_whose_section_edges_meet_on_the_axis(self):
        trapezoids = quads = 0
        for a, b in cut_frusta(200):
            band = check_band(self, a, b)
            ra = {tuple(v) for v in band["ring_a"]["vertices"]}
            pa, pb = band["ring_a"]["plane"], band["ring_b"]["plane"]
            for f in band["faces"]:
                if f["kind"] == "quadrilateral":
                    quads += 1
                    ea = [tuple(v) for v in f["vertices"] if tuple(v) in ra]
                    eb = [tuple(v) for v in f["vertices"] if tuple(v) not in ra]
                    da, db = orc.sub(ea[1], ea[0]), orc.sub(eb[1], eb[0])
                    w = orc.sub(eb[0], ea[0])
                    den = orc.dot(orc.cross(da, db), orc.cross(da, db))
                    t = Fraction(orc.dot(orc.cross(w, db), orc.cross(da, db)), den)
                    x = tuple(ea[0][i] + t * da[i] for i in range(3))
                    self.assertEqual(orc.dot(pa[:3], x), pa[3])
                    self.assertEqual(orc.dot(pb[:3], x), pb[3])
                elif f["kind"] == "trapezoid":
                    trapezoids += 1
        self.assertGreater(quads, 0)
        self.assertGreater(trapezoids, 0)

    def test_s2_near_parallel_pairs_keep_the_count_and_support(self):
        for a, b in near_parallel(50):
            check_band(self, a, b)

    def test_s5_cube_rotations_mirror_translation_and_scaling_transform_the_band(self):
        rots = []
        for perm in ((0, 1, 2), (0, 2, 1), (1, 0, 2), (1, 2, 0), (2, 0, 1), (2, 1, 0)):
            for signs in ((1, 1, 1), (1, 1, -1), (1, -1, 1), (1, -1, -1), (-1, 1, 1), (-1, 1, -1), (-1, -1, 1), (-1, -1, -1)):
                m = [[0] * 3 for _ in range(3)]
                for i in range(3):
                    m[i][perm[i]] = signs[i]
                det = (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
                       + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]))
                if det == 1:
                    rots.append(m)
        self.assertEqual(len(rots), 24)
        rng = random.Random(20261138)
        pairs = s1_pairs(50)
        for idx, (a, b) in enumerate(pairs):
            base = ok(run(a, b))
            ref = face_sets(base)
            m = rots[idx % 24]

            def apply(v, m=m):
                return tuple(sum(m[i][j] * v[j] for j in range(3)) for i in range(3))

            for f in (apply, lambda v: (-v[0], v[1], v[2]), lambda v: (v[0] + 7, v[1] - 11, v[2] + 13)):
                moved = ok(run([f(v) for v in a], [f(v) for v in b]))
                self.assertEqual(face_sets(moved), {frozenset(f(v) for v in s) for s in ref})
                self.assertEqual(moved["volume"], base["volume"])
            span = max(abs(c) for v in a + b for c in v)
            k = rng.randint(2, max(2, min(500, 10 ** 9 // span)))
            scaled = ok(run([tuple(k * c for c in v) for v in a], [tuple(k * c for c in v) for v in b]))
            self.assertEqual(Fraction(*scaled["volume"]), Fraction(*base["volume"]) * k ** 3)

    def test_s6_allowed_permutations_give_identical_canonical_json(self):
        rng = random.Random(20261139)
        for a, b in s1_pairs(150):
            ref = o1v2.canonical_json(ok(run(a, b)))
            i, j = rng.randrange(len(a)), rng.randrange(len(b))
            ra, rb = a[i:] + a[:i], b[j:] + b[:j]
            for x, y in ((ra, rb), (list(reversed(ra)), rb), (rb, ra), (list(reversed(rb)), list(reversed(ra)))):
                self.assertEqual(o1v2.canonical_json(ok(run(x, y))), ref)

    def test_s7_the_digest_does_not_depend_on_the_hash_seed(self):
        script = ("import json,sys; sys.path.insert(0, %r); import o1v2;"
                  "fx=json.load(open(%r));"
                  "print([o1v2.digest(o1v2.section_transition_v2({'vertices':fx[k]['a']},{'vertices':fx[k]['b']})['band'])"
                  " for k in ('T1','T2','T3','T4')])") % (HERE, os.path.join(HERE, "m1b-fixtures.json"))
        outs = {subprocess.run([sys.executable, "-c", script], env=dict(os.environ, PYTHONHASHSEED=seed),
                               capture_output=True, text=True, check=True).stdout for seed in ("0", "12345")}
        self.assertEqual(len(outs), 1)

    def test_s8_random_nets_are_congruent_and_their_seams_match_within_tau(self):
        for a, b in s1_pairs(300):
            band = ok(run(a, b))
            net = o1.cut_open_net(band)
            self.assertLessEqual(net["congruence_residual"], net["tau"])
            self.assertTrue(all(r <= net["tau"] for r in net["seam_residuals"]))


class Independence(unittest.TestCase):
    def test_the_v2_oracles_import_neither_implementation(self):
        with open(os.path.join(HERE, "oracles_o1v2.py")) as f:
            src = f.read()
        for name in ("import o1v2", "from o1v2", "import o1\n", "from o1 "):
            self.assertNotIn(name, src)


if __name__ == "__main__":
    unittest.main()
