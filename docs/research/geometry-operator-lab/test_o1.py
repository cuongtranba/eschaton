"""Laboratory M1 tests for O1 section transition, against the frozen contract v1.1 (m0-o1-contract.md).

RESEARCH ARTEFACT ONLY (D-3, D-5). Tests import the public functions of o1.py and the independent
oracles of oracles.py; no mocks, no sleeps, seeded generators only. Run from the repository root:
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
import oracles as orc  # noqa: E402
import o1  # noqa: E402

with open(os.path.join(HERE, "fixtures.json")) as _f:
    FX = json.load(_f)
Q = 10 ** 6


def random_convex(rng, max_vertices, span):
    """A strictly convex polygon: the exact hull of random integer points (collinear points dropped)."""
    while True:
        pts = [(rng.randint(-span, span), rng.randint(-span, span)) for _ in range(rng.randint(3, 3 * max_vertices))]
        hull = orc.hull2(pts)
        if 3 <= len(hull) <= max_vertices:
            return [list(p) for p in hull]


def random_cases(seed, pairs, degenerate):
    """Seeded (a, b) section pairs: polygon pairs, or caps and wedges with the degenerate section lower or upper."""
    rng = random.Random(seed)
    out = []
    for i in range(pairs):
        poly = random_convex(rng, 12, Q)
        other = random_convex(rng, 12, Q)
        if degenerate:
            p = [rng.randint(-Q, Q), rng.randint(-Q, Q)]
            q = p if i % 4 < 2 else [p[0] + rng.randint(1, Q), p[1] + rng.randint(-Q, Q)]
            other = [p] if q is p else [p, q]
        h = rng.randint(1, 2 * Q)
        z0 = rng.randint(-Q, Q)
        lower_degenerate = degenerate and i % 2 == 0
        a, b = (other, poly) if lower_degenerate else (poly, other)
        out.append(({"z": z0, "vertices": a}, {"z": z0 + h, "vertices": b}))
    return out


R1 = random_cases(20261128, 300, False)
R1_DEGENERATE = random_cases(20261129, 200, True)


def points3(a, b):
    return [tuple(v) + (a["z"],) for v in a["vertices"]] + [tuple(v) + (b["z"],) for v in b["vertices"]]


def face_sets(band):
    return {frozenset(tuple(v) for v in f["vertices"]) for f in band["faces"]}


class Architecture(unittest.TestCase):
    def test_the_oracles_do_not_import_the_implementation(self):
        src = open(os.path.join(HERE, "oracles.py")).read()
        self.assertNotIn("import o1", src)
        self.assertNotIn("from o1", src)


class Fixtures(unittest.TestCase):
    def test_fixture_bands_have_the_frozen_topology_counts_owners_areas_and_volumes(self):
        for name, fx in FX["bands"].items():
            exp = fx["expect"]
            if "error" in exp:
                continue
            with self.subTest(name):
                res = o1.section_transition(fx["a"], fx["b"], min_altitude=fx.get("min_altitude"))
                self.assertTrue(res["ok"], res)
                band = res["band"]
                self.assertEqual(band["topology"], exp["topology"])
                self.assertEqual(len(band["faces"]), exp["faces"])
                kinds = [f["kind"] for f in band["faces"]]
                self.assertEqual((kinds.count("triangle"), kinds.count("trapezoid")), (exp["triangle"], exp["trapezoid"]))
                if "owners" in exp:
                    self.assertEqual([f["owner"] for f in band["faces"]], exp["owners"])
                for key in ("area_a", "area_b", "area_mid", "volume"):
                    num, den = band[key]
                    self.assertTrue(den > 0 and math.gcd(num, den) == 1, (key, band[key]))
                if "area_mid" in exp:
                    self.assertEqual(Fraction(*band["area_mid"]), Fraction(*exp["area_mid"]))
                if "volume" in exp:
                    self.assertEqual(Fraction(*band["volume"]), Fraction(*exp["volume"]))
                self.assertEqual(orc.surface_topology([f["vertices"] for f in band["faces"]])["chi"], exp["chi"])

    def test_f1_faces_lie_in_the_frozen_planes(self):
        band = o1.section_transition(FX["bands"]["F1"]["a"], FX["bands"]["F1"]["b"])["band"]
        self.assertEqual([f["normal"] for f in band["faces"]], FX["bands"]["F1"]["expect"]["normals"])

    def test_f1_face_angles_total_150_at_square_and_210_at_diamond_vertices(self):
        fx = FX["bands"]["F1"]
        band = o1.section_transition(fx["a"], fx["b"])["band"]
        faces = [f["vertices"] for f in band["faces"]]
        tol = fx["expect"]["angle_sum_deg"]["tol"]
        for v in fx["a"]["vertices"]:
            self.assertAlmostEqual(orc.angle_sum_deg(faces, tuple(v) + (0,)), 150.0, delta=tol)
        for v in fx["b"]["vertices"]:
            self.assertAlmostEqual(orc.angle_sum_deg(faces, tuple(v) + (Q,)), 210.0, delta=tol)

    def test_f1_net_matches_the_frozen_points_without_overlap(self):
        fx = FX["bands"]["F1"]
        exp = fx["expect"]
        net = o1.cut_open_net(o1.section_transition(fx["a"], fx["b"])["band"], first_face=exp["net_first_face"])
        self.assertEqual(len(net["points"]), len(exp["net_points_L"]))
        for got, want in zip(net["points"], exp["net_points_L"]):
            self.assertLessEqual(max(abs(got[0] - want[0]), abs(got[1] - want[1])), exp["net_tol_L"])
        self.assertEqual((net["classes"]["overlap"], net["classes"]["inconclusive"]), (0, 0))
        self.assertEqual(orc.net_pairs_overlapping(net["faces"], net["tau"]), [])

    def test_f6_v5_pent_pair_has_one_trapezoid_on_the_shared_bottom_direction(self):
        fx = FX["bands"]["F6"]
        band = o1.section_transition(fx["a"], fx["b"])["band"]
        traps = [f for f in band["faces"] if f["kind"] == "trapezoid"]
        self.assertEqual([(f["direction"], f["owner"]) for f in traps],
                         [(fx["expect"]["trapezoid_direction"], fx["expect"]["trapezoid_owner"])])

    def test_f15_short_chamfer_is_a_thin_panel_and_reports_a_sub_2q_altitude(self):
        fx = FX["bands"]["F15"]
        res = o1.section_transition(fx["a"], fx["b"], min_altitude=fx["min_altitude"])
        self.assertEqual(res["error"]["code"], "thin-panel")
        free = o1.section_transition(fx["a"], fx["b"])
        self.assertLess(free["band"]["min_altitude"], fx["expect"]["min_altitude_below_q"])

    def test_f16_near_parallel_directions_give_full_size_faces_at_a_small_dihedral(self):
        fx = FX["bands"]["F16"]
        res = o1.section_transition(fx["a"], fx["b"], min_altitude=fx["min_altitude"])
        self.assertTrue(res["ok"], res)
        lo, hi = fx["expect"]["min_dihedral_deg_range"]
        self.assertTrue(lo <= res["band"]["min_dihedral_deg"] <= hi, res["band"]["min_dihedral_deg"])

    def test_f18_cap_with_the_point_below_has_a_282_degree_apex(self):
        fx = FX["bands"]["F18"]
        band = o1.section_transition(fx["a"], fx["b"])["band"]
        apex = (0, 0, 0)
        self.assertAlmostEqual(orc.angle_sum_deg([f["vertices"] for f in band["faces"]], apex),
                               fx["expect"]["apex_angle_deg"], delta=fx["expect"]["apex_tol"])


class Chains(unittest.TestCase):
    def test_rings_have_the_frozen_kind_edge_classes_and_vertex_angles(self):
        for name, fx in FX["chains"].items():
            exp = fx["expect"]
            with self.subTest(name):
                res = o1.chain(fx["stations"])
                self.assertTrue(res["ok"], res)
                (ring,) = res["chain"]["rings"]
                self.assertEqual(ring["kind"], exp["kind"])
                self.assertEqual(ring["on_path"], exp["on_path"])
                classes = [c for _, c in ring["edges"]]
                self.assertEqual((classes.count("dissolvable"), classes.count("seam-dihedral")),
                                 (exp["dissolvable"], exp["seam"]))
                for a in ring["vertex_angle_deg"]:
                    self.assertAlmostEqual(a, exp["vertex_angle_deg"], delta=exp["tol"])

    def test_on_path_ring_merges_into_the_single_band(self):
        fx = FX["chains"]["F10"]
        res = o1.chain(fx["stations"])["chain"]
        single = o1.section_transition(fx["expect"]["merged_equals_band"]["a"], fx["expect"]["merged_equals_band"]["b"])["band"]
        merged = {}
        for band in res["bands"]:
            for f in band["faces"]:
                merged.setdefault(tuple(f["normal"]), set()).update(tuple(v) for v in f["vertices"])
        self.assertEqual(set(merged), {tuple(f["normal"]) for f in single["faces"]})
        for f in single["faces"]:
            n = tuple(f["normal"])
            drop = max(range(3), key=lambda i: abs(n[i]))
            proj = {tuple(c for i, c in enumerate(p) if i != drop): p for p in merged[n]}
            self.assertEqual({proj[v] for v in orc.hull2(list(proj))}, {tuple(v) for v in f["vertices"]})

    def test_on_path_rings_have_every_edge_dissolvable_and_every_vertex_flat(self):
        """Contract 5 consistency check; added after the first green run (disclosed in the README)."""
        for i, (a, b) in enumerate(R1[:40]):
            with self.subTest(i):
                lo, hi = (a, b) if a["z"] < b["z"] else (b, a)
                va = [(2 * x, 2 * y) for x, y in lo["vertices"]]
                vb = [(2 * x, 2 * y) for x, y in hi["vertices"]]
                mid = [[int(x), int(y)] for x, y in orc.minkowski_hull(va, vb, Fraction(1, 2))]
                h = hi["z"] - lo["z"]
                res = o1.chain([{"z": 0, "vertices": [list(v) for v in va]}, {"z": h, "vertices": mid},
                                {"z": 2 * h, "vertices": [list(v) for v in vb]}])
                ring = res["chain"]["rings"][0]
                self.assertEqual(ring["kind"], "tessellation-ring")
                self.assertTrue(all(c == "dissolvable" for _, c in ring["edges"]))
                self.assertTrue(all(ring["vertex_flat"]), ring["vertex_angle_deg"])

    def test_mixed_ring_dissolves_only_the_flat_y_edges(self):
        fx = FX["chains"]["F12"]
        res = o1.chain(fx["stations"])["chain"]
        ring, kv = res["rings"][0], res["bands"][0]["ring_b"]["vertices"]
        dirs = [list(orc.prim((kv[j][1] - kv[i][1], kv[i][0] - kv[j][0])))
                for (i, j), c in ring["edges"] if c == "dissolvable"]
        self.assertEqual(sorted(dirs), sorted(fx["expect"]["dissolvable_directions"]))


class NegativeControls(unittest.TestCase):
    def test_each_negative_band_fails_with_exactly_its_code_in_either_argument_order(self):
        for name, fx in FX["negative_bands"].items():
            with self.subTest(name):
                for a, b in ((fx["a"], fx["b"]), (fx["b"], fx["a"])):
                    res = o1.section_transition(a, b, min_altitude=fx.get("min_altitude"))
                    self.assertFalse(res["ok"], res)
                    self.assertEqual(res["error"]["code"], fx["code"])

    def test_each_negative_chain_fails_with_exactly_its_code(self):
        for name, fx in FX["negative_chains"].items():
            with self.subTest(name):
                res = o1.chain(fx["stations"])
                self.assertFalse(res["ok"], res)
                self.assertEqual(res["error"]["code"], fx["code"])

    def test_non_list_inputs_are_malformed_not_exceptions(self):
        for bad in (None, 3, "x", {"z": 0, "vertices": "abc"}, {"z": 0, "vertices": [[1, 2, 3]]}, {"z": 0.0, "vertices": [[0, 0]]}):
            with self.subTest(repr(bad)):
                self.assertEqual(o1.section_transition(bad, {"z": 1, "vertices": [[0, 0], [1, 0], [0, 1]]})["error"]["code"],
                                 "malformed-input")


class Randomized(unittest.TestCase):
    def test_r1_faces_equal_the_brute_force_hull_and_are_canonical(self):
        for i, (a, b) in enumerate(R1 + R1_DEGENERATE):
            with self.subTest(i):
                res = o1.section_transition(a, b)
                self.assertTrue(res["ok"], res)
                band = res["band"]
                self.assertEqual(face_sets(band), orc.lateral_facets(points3(a, b)))
                lo, hi = (a, b) if a["z"] < b["z"] else (b, a)
                self.assertEqual(orc.canonical_form_errors(band, [tuple(v) for v in lo["vertices"]],
                                                           [tuple(v) for v in hi["vertices"]], lo["z"], hi["z"]), [])

    def test_r2_face_count_equals_distinct_edge_directions_and_faces_have_3_or_4_vertices(self):
        for i, (a, b) in enumerate(R1 + R1_DEGENERATE):
            with self.subTest(i):
                band = o1.section_transition(a, b)["band"]
                dirs = set()
                for poly in (a["vertices"], b["vertices"]):
                    if len(poly) >= 2:
                        cyc = poly if len(poly) >= 3 else [poly[0], poly[1]]
                        for k in range(len(cyc)):
                            p, q = cyc[k], cyc[(k + 1) % len(cyc)]
                            n = orc.prim((q[1] - p[1], p[0] - q[0]))
                            dirs.add(n)
                            if len(poly) == 2:
                                dirs.add(tuple(-c for c in n))
                self.assertEqual(len(band["faces"]), len(dirs))
                self.assertTrue(all(len(f["vertices"]) in (3, 4) for f in band["faces"]))

    def test_r2_large_polygons_give_supporting_face_planes(self):
        rng = random.Random(20261130)
        for i in range(20):
            secs = []
            for _ in range(2):
                angles = sorted(rng.random() * 6.283185307179586 for _ in range(rng.randint(600, 1400)))
                pts = {(int(round(5e8 * math.cos(t))), int(round(5e8 * math.sin(t)))) for t in angles}
                secs.append([list(p) for p in orc.hull2(list(pts))][:1024])
            secs = [[list(p) for p in orc.hull2([tuple(v) for v in s])] for s in secs]
            a, b = {"z": 0, "vertices": secs[0]}, {"z": rng.randint(1, 10 ** 9), "vertices": secs[1]}
            with self.subTest(i):
                band = o1.section_transition(a, b)["band"]
                for f in band["faces"]:
                    n = f["normal"]
                    d = orc.dot(n, f["vertices"][0])
                    self.assertTrue(all(orc.dot(n, v) == d for v in f["vertices"]))
                    ma = max(n[0] * x + n[1] * y for x, y in a["vertices"]) + n[2] * a["z"]
                    mb = max(n[0] * x + n[1] * y for x, y in b["vertices"]) + n[2] * b["z"]
                    self.assertEqual(max(ma, mb), d)

    def test_r3_slices_equal_the_minkowski_combination(self):
        for i, (a, b) in enumerate(R1 + R1_DEGENERATE):
            lo, hi = (a, b) if a["z"] < b["z"] else (b, a)
            band = o1.section_transition(a, b)["band"]
            faces = [f["vertices"] for f in band["faces"]]
            for t in (Fraction(1, 7), Fraction(1, 2), Fraction(5, 6)):
                with self.subTest((i, t)):
                    z = lo["z"] + t * (hi["z"] - lo["z"])
                    want = orc.minkowski_hull([tuple(v) for v in lo["vertices"]], [tuple(v) for v in hi["vertices"]], t)
                    self.assertEqual(set(orc.slice_band(faces, z)), set(want))

    def test_r4_prismoidal_volume_equals_tetrahedral_volume_and_topology_is_right(self):
        cases = R1 + R1_DEGENERATE + [(fx["a"], fx["b"]) for fx in FX["bands"].values() if "error" not in fx["expect"]]
        for i, (a, b) in enumerate(cases):
            with self.subTest(i):
                band = o1.section_transition(a, b)["band"]
                vol = Fraction(*band["volume"])
                self.assertEqual(vol, orc.tet_volume([f["vertices"] for f in band["faces"]], band["ring_a"], band["ring_b"]))
                topo = orc.surface_topology([f["vertices"] for f in band["faces"]])
                self.assertTrue(topo["oriented"] and topo["manifold"])
                want_chi = 0 if band["topology"] == "closed-band" else 1
                self.assertEqual(topo["chi"], want_chi)
                self.assertEqual(topo["boundary"], orc.loop_edges(band["ring_a"]) | orc.loop_edges(band["ring_b"]))

    def test_r5_translation_quarter_turn_mirror_and_scaling_transform_the_result(self):
        rng = random.Random(5)
        maps = {
            "translate": lambda v: (v[0] + 123457, v[1] - 98765, v[2] + 4321),
            "quarter-turn": lambda v: (-v[1], v[0], v[2]),
            "mirror": lambda v: (-v[0], v[1], v[2]),
            "scale": lambda v: (7 * v[0], 7 * v[1], 7 * v[2]),
        }
        for name, m in maps.items():
            for i, (a, b) in enumerate(rng.sample(R1, 50)):
                with self.subTest((name, i)):
                    def tr(s):
                        out = [m((x, y, s["z"])) for x, y in s["vertices"]]
                        return {"z": out[0][2], "vertices": [[p[0], p[1]] for p in out]}
                    base = o1.section_transition(a, b)["band"]
                    moved = o1.section_transition(tr(a), tr(b))["band"]
                    self.assertEqual(face_sets(moved), {frozenset(m(tuple(v)) for v in f) for f in face_sets(base)})
                    k = 343 if name == "scale" else 1
                    self.assertEqual(Fraction(*moved["volume"]), k * Fraction(*base["volume"]))

    def test_r6_every_allowed_permutation_gives_an_identical_digest(self):
        for i, (a, b) in enumerate(R1[:100] + R1_DEGENERATE[:50]):
            with self.subTest(i):
                ref = o1.digest(o1.section_transition(a, b))
                va = a["vertices"]
                for rot in range(len(va)):
                    for rev in (False, True):
                        vv = va[rot:] + va[:rot]
                        vv = vv[::-1] if rev else vv
                        aa = {"z": a["z"], "vertices": vv}
                        self.assertEqual(o1.digest(o1.section_transition(aa, b)), ref)
                        self.assertEqual(o1.digest(o1.section_transition(b, aa)), ref)

    def test_r7_digests_do_not_depend_on_the_hash_seed(self):
        code = ("import json,sys;sys.path.insert(0,%r);import o1;fx=json.load(open(%r));"
                "print(json.dumps({k:o1.digest(o1.section_transition(v['a'],v['b'])) for k,v in fx['bands'].items()},sort_keys=True))"
                % (HERE, os.path.join(HERE, "fixtures.json")))
        outs = set()
        for seed in ("0", "12345"):
            env = dict(os.environ, PYTHONHASHSEED=seed)
            outs.add(subprocess.run([sys.executable, "-c", code], env=env, capture_output=True, text=True, check=True).stdout)
        self.assertEqual(len(outs), 1)

    def test_r8_nets_are_congruent_within_tau(self):
        for i, (a, b) in enumerate(R1 + R1_DEGENERATE):
            with self.subTest(i):
                net = o1.cut_open_net(o1.section_transition(a, b)["band"])
                self.assertLessEqual(net["congruence_residual"], net["tau"])
                self.assertLessEqual(max(net["seam_residuals"]), net["tau"])


if __name__ == "__main__":
    unittest.main()
