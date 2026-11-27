"""Reproduce the M3 P1/P7 read-outs and compute the M3.1 controls; write evidence/m31-readouts.json.

DESIGN AND RESEARCH ARTEFACT ONLY (D-5). Run from the repository root:
    python3 docs/art/form-method-diagnostics/run_readouts.py
"""
import hashlib
import json
import math
import os
import platform
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import diagnostics as dg  # noqa: E402

HERO_LOWER_BOUND_PX = 400.0
P1_STEP = 0.002
RAYS = 3600
PER_INTERVAL = 60


def r(x, n=4):
    return None if x is None else round(x, n)


def v5_stations(inp, masses):
    v5 = inp["v5"]
    rows = []
    if "head" in masses:
        rows += v5["head"]
    if "body" in masses:
        rows += v5["body"]
    return [(w, h, z + v5["zh"], v5["profile"]) for _, z, w, h in rows]


def v7_keys(inp):
    v7 = inp["v7"]
    prof = {k: dg_mirror(v) for k, v in v7["profiles_half"].items()}
    return [(x, z + v7["zh"], w, h, prof[p], tag) for x, z, w, h, p, tag in v7["keys"]], prof


def dg_mirror(half):
    right = [tuple(p) for p in half]
    left = [(-y, z) for y, z in reversed(half[1:-1])]
    return right + left


def ev_px(slices, span_L, rays=RAYS):
    res = dg.single_section_distance(slices, rays=rays)
    if not res["applicable"]:
        return res
    l_px = HERO_LOWER_BOUND_PX / span_L
    res["L_px"] = r(l_px, 2)
    res["e_v_L"] = r(res["e_v"], 5)
    res["e_v_px"] = r(res["e_v"] * l_px, 2)
    del res["e_v"]
    return res


def ev_with_convergence(slices_fine, slices_coarse, span_L):
    fine = ev_px(slices_fine, span_L, RAYS)
    half = ev_px(slices_fine, span_L, RAYS // 2)
    coarse = ev_px(slices_coarse, span_L, RAYS)
    if fine.get("applicable"):
        fine["convergence_L"] = {
            "rays_3600_vs_1800": r(abs(fine["e_v_L"] - half["e_v_L"]), 5),
            "per_interval_60_vs_30": r(abs(fine["e_v_L"] - coarse["e_v_L"]), 5),
        }
    return fine


def main():
    with open(os.path.join(HERE, "inputs.json")) as f:
        inp = json.load(f)
    out = {"artefact": "form-method diagnostics (D-5); informative read-outs, not a gate",
           "python": platform.python_version(),
           "script_sha256": {n: hashlib.sha256(open(os.path.join(HERE, n), "rb").read()).hexdigest()
                             for n in ("diagnostics.py", "run_readouts.py", "inputs.json")},
           "parameters": {"hero_lower_bound_px": HERO_LOWER_BOUND_PX, "p1_sample_step_half_extents": P1_STEP,
                          "rays": RAYS, "slices_per_interval": PER_INTERVAL}}

    v5 = inp["v5"]
    pent = v5["profile"]
    secs = v5["head"] + v5["body"]
    d_max = 0.0
    for i in range(len(secs)):
        for j in range(i + 1, len(secs)):
            a = dg.section_polygon(secs[i][2], secs[i][3], 0.0, pent)
            b = dg.section_polygon(secs[j][2], secs[j][3], 0.0, pent)
            d, bound = dg.profile_distance(a, b, symmetric=True, step=P1_STEP)
            d_max = max(d_max, d)
    out["p1_v5_all_pairs"] = {"pairs": len(secs) * (len(secs) - 1) // 2, "max_d": r(d_max, 6),
                              "sample_bound": P1_STEP / 2}

    keys, _ = v7_keys(inp)
    l7 = HERO_LOWER_BOUND_PX / inp["v7"]["span_L"]
    by_x = {k[0]: k for k in keys}
    pairs = [(0.366, 0.322), (0.322, 0.272), (0.272, 0.240), (0.240, 0.205), (0.205, 0.130), (0.130, 0.030),
             (-0.070, -0.130), (-0.130, -0.205)]
    rows = []
    for xa, xb in pairs:
        ka, kb = by_x[xa], by_x[xb]
        a = dg.section_polygon(ka[2], ka[3], 0.0, ka[4])
        b = dg.section_polygon(kb[2], kb[3], 0.0, kb[4])
        d, bound = dg.profile_distance(a, b, symmetric=True, step=P1_STEP)
        s_px = min(ka[2], ka[3], kb[2], kb[3]) * l7
        rows.append({"from": [xa, inp["v7"]["keys"][keys.index(ka)][4]], "to": [xb, inp["v7"]["keys"][keys.index(kb)][4]],
                     "d": r(d, 3), "bound": bound, "s_px": r(s_px, 1), "delta_px": r(d * s_px, 2)})
    out["p1_v7_station_pairs"] = rows

    sq = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
    di = [(0, 1), (-1, 0), (0, -1), (1, 0)]
    circle = [(math.cos(2 * math.pi * k / 64), math.sin(2 * math.pi * k / 64)) for k in range(64)]
    controls = {}
    controls["square_vs_diamond"] = r(dg.profile_distance(sq, di, step=P1_STEP)[0], 4)
    controls["turned_vessel_circle_r1_vs_r3"] = r(dg.profile_distance(circle, [(3 * x, 3 * y) for x, y in circle],
                                                                      step=P1_STEP)[0], 6)
    controls["prism_identical_sections"] = r(dg.profile_distance(sq, sq, step=P1_STEP)[0], 6)
    padded = list(pent[:1]) + [(0.475, 0.66)] + list(pent[1:])
    controls["pent_collinear_vertex_padding"] = r(dg.profile_distance(pent, padded, step=P1_STEP)[0], 6)
    rect_a = [(2, 0.5), (-2, 0.5), (-2, -0.5), (2, -0.5)]
    rect_b = [(1, 1.5), (-1, 1.5), (-1, -1.5), (1, -1.5)]
    controls["rectangle_aspect_change_only"] = r(dg.profile_distance(rect_a, rect_b, step=P1_STEP)[0], 6)
    out["p1_controls"] = controls

    def v5_slices(masses, per, raise_first_body=0.0):
        st = v5_stations(inp, masses)
        if raise_first_body and "head" not in masses:
            w, h, z, p = st[0]
            st[0] = (w, h, z + raise_first_body, p)
        return dg.linear_slices(st, per)

    p7 = {}
    p7["v5_body_mass"] = ev_with_convergence(v5_slices(["body"], PER_INTERVAL), v5_slices(["body"], PER_INTERVAL // 2),
                                             v5["span_L"])
    p7["v5_one_mass_head_and_body"] = ev_with_convergence(v5_slices(["head", "body"], PER_INTERVAL),
                                                          v5_slices(["head", "body"], PER_INTERVAL // 2), v5["span_L"])
    p7["v5_body_first_station_raised_0.03L"] = ev_with_convergence(
        v5_slices(["body"], PER_INTERVAL, 0.03), v5_slices(["body"], PER_INTERVAL // 2, 0.03), v5["span_L"])

    stations7 = dg.program_stations(keys, inp["v7"]["sub"])
    body7 = [s for s in stations7 if s[0] <= 0.240 + 1e-12]
    st7 = [(s[2], s[3], s[1], s[4]) for s in body7]
    p7["v7_body_mass"] = ev_with_convergence(dg.linear_slices(st7, 10),
                                             dg.linear_slices(st7, 5), inp["v7"]["span_L"])
    folded = dict(p7["v7_body_mass"])
    if folded.get("applicable"):
        folded["L_px"] = HERO_LOWER_BOUND_PX / 1.0
        folded["e_v_px"] = r(folded["e_v_L"] * folded["L_px"], 2)
        folded["note"] = "same body; object drawn with folded wings, so its largest extent is L, not the span"
    p7["v7_body_mass_folded_wings_scale"] = folded

    radii = [0.3, 0.6, 0.9, 1.0, 0.8, 0.4]
    torpedo = [[(rad * x, rad * y) for x, y in circle] for rad in radii]
    nested = [[(1.0 * x, 1.0 * y) for x, y in circle],
              [(0.5, 0.5), (-0.5, 0.5), (-0.5, -0.5), (0.5, -0.5)],
              [(0, 0.7), (-0.7, 0), (0, -0.7), (0.7, 0)]]
    p7["nested_torpedo_circles"] = dg.single_section_distance(torpedo)
    p7["nested_changing_profiles_inside_widest"] = dg.single_section_distance(nested)
    cube = dg.single_section_distance(dg.cube_diagonal_slices(300))
    cube["analytic"] = r(math.sqrt(6) / 12, 5)
    p7["cube_body_diagonal_view"] = cube
    for k in ("nested_torpedo_circles", "nested_changing_profiles_inside_widest", "cube_body_diagonal_view"):
        p7[k]["e_v"] = r(p7[k]["e_v"], 5)
    out["p7"] = p7

    with open(os.path.join(os.path.dirname(HERE), "raven-concepts", "renders", "b2v7", "v5-v7-readouts.json")) as f:
        ro = json.load(f)
    out["p5"] = {"four_equal_pegs_cv_width": dg.coefficient_of_variation([1.0, 1.0, 1.0, 1.0]),
                 "v5_fingers_cv_width_recorded": ro["v5"]["fingers"]["cv_width"]}

    os.makedirs(os.path.join(HERE, "evidence"), exist_ok=True)
    text = json.dumps(out, indent=1, sort_keys=True)
    with open(os.path.join(HERE, "evidence", "m31-readouts.json"), "w") as f:
        f.write(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
