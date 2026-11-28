"""Controls for the form-method read-outs (design artefact, D-5). Float results are compared with
1e-12 for exact-zero cases (round-off only) and with the stated sampling bound otherwise. Run from the repository root:
    python3 -m unittest discover -s docs/art/form-method-diagnostics -p 'test_*.py'
"""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import diagnostics as dg  # noqa: E402

SQUARE = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
DIAMOND = [(0, 1), (-1, 0), (0, -1), (1, 0)]
CIRCLE = [(math.cos(2 * math.pi * k / 64), math.sin(2 * math.pi * k / 64)) for k in range(64)]
PENT = [(0, 1.0), (0.95, 0.32), (0.62, -0.85), (-0.62, -0.85), (-0.95, 0.32)]


class ProfileDistance(unittest.TestCase):
    def test_square_and_diamond_differ_by_half_the_diagonal(self):
        d, bound = dg.profile_distance(SQUARE, DIAMOND)
        self.assertLessEqual(abs(d - math.sqrt(2) / 2), bound + 1e-12)

    def test_an_aspect_only_family_has_distance_zero(self):
        a = [(0.068 * x, 0.076 * y) for x, y in PENT]
        b = [(0.056 * x, 0.054 * y + 0.3) for x, y in PENT]
        self.assertLess(dg.profile_distance(a, b)[0], 1e-12)

    def test_a_turned_profile_scaled_along_its_axis_has_distance_zero(self):
        self.assertLess(dg.profile_distance(CIRCLE, [(3 * x, 3 * y) for x, y in CIRCLE])[0], 1e-12)

    def test_a_rotated_profile_of_an_asymmetric_mass_has_distance_near_zero(self):
        rot = [(math.cos(0.35) * x - math.sin(0.35) * y, math.sin(0.35) * x + math.cos(0.35) * y) for x, y in PENT]
        d, bound = dg.profile_distance(PENT, rot, symmetric=False)
        self.assertLessEqual(d, bound)


class SingleSectionDistance(unittest.TestCase):
    def test_sections_nested_inside_the_widest_give_zero_whatever_their_profiles(self):
        res = dg.single_section_distance([CIRCLE, [(0.5, 0.5), (-0.5, 0.5), (-0.5, -0.5), (0.5, -0.5)],
                                          [(0, 0.7), (-0.7, 0), (0, -0.7), (0.7, 0)]])
        self.assertLess(res["e_v"], 1e-12)

    def test_one_section_translated_gives_its_offset_and_no_profile_change(self):
        res = dg.single_section_distance([SQUARE, [(x, y + 0.25) for x, y in SQUARE]])
        self.assertAlmostEqual(res["e_v"], 0.25, places=6)

    def test_a_cube_seen_along_its_body_diagonal_gives_root6_over_12(self):
        res = dg.single_section_distance(dg.cube_diagonal_slices(300), rays=7200)
        self.assertAlmostEqual(res["e_v"], math.sqrt(6) / 12, delta=5e-4)

    def test_non_convex_slices_are_reported_not_measured(self):
        dart = [(0, 0), (2, 0), (1, 0.5), (1, 2)]
        self.assertFalse(dg.single_section_distance([dart])["applicable"])


def chamfered_square(c, size=1.0):
    return [(size * x, size * y) for x, y in [(1 - c, 1), (-1, 1), (-1, -1), (1, -1), (1, 1 - c)]]


class P1Conformance(unittest.TestCase):
    def test_a_declared_change_far_above_the_floor_conforms_and_a_constant_target_does_not(self):
        self.assertEqual(dg.p1_conformance(SQUARE, DIAMOND, "change", 1e-6)["outcome"], "conforms")
        self.assertEqual(dg.p1_conformance(SQUARE, DIAMOND, "constant", 1e-6)["outcome"], "does-not-conform")

    def test_a_section_resliced_within_a_coarse_tolerance_conforms_to_constant_and_not_to_change(self):
        moved = [(x + 4e-4, y - 3e-4) for x, y in SQUARE[:2]] + SQUARE[2:]
        self.assertEqual(dg.p1_conformance(SQUARE, moved, "constant", 1e-3)["outcome"], "conforms")
        self.assertEqual(dg.p1_conformance(SQUARE, moved, "change", 1e-3)["outcome"], "does-not-conform")

    def test_R1_regression_the_floor_is_in_half_extents_so_one_shape_change_is_lost_on_a_small_section(self):
        big = dg.p1_conformance(SQUARE, chamfered_square(0.007), "change", 1e-6)
        small = dg.p1_conformance([(1e-3 * x, 1e-3 * y) for x, y in SQUARE], chamfered_square(0.007, 1e-3), "change", 1e-6)
        self.assertEqual((big["outcome"], small["outcome"]), ("conforms", "does-not-conform"))

    def test_a_distance_whose_sampling_interval_straddles_the_floor_is_not_verified(self):
        self.assertEqual(dg.classify_p1(0.010, 0.001, 0.0105, "change"), "NOT VERIFIED")
        self.assertEqual(dg.classify_p1(0.010, 0.001, 0.0105, "constant"), "NOT VERIFIED")

    def test_a_degenerate_section_is_not_applicable(self):
        self.assertEqual(dg.p1_conformance(SQUARE, [(0, 0), (1, 0)], "change", 1e-6)["outcome"], "not-applicable")


if __name__ == "__main__":
    unittest.main()
