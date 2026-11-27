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


if __name__ == "__main__":
    unittest.main()
