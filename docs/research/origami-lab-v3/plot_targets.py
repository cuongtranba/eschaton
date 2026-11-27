"""Plots the V3 multi-view targets from the numbers in bird-design-brief.md and vehicle-design-brief.md.

Independent of the lab code on purpose: the targets are design input, not output. Run: python3 plot_targets.py
Writes bird-target-views.svg and vehicle-target-views.svg next to this file. Coordinates: x forward, y up, z left.
"""

import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def rot_x(p, a):
    c, s = math.cos(a), math.sin(a)
    return (p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c)


def mirror(face):
    return [(x, y, -z) for (x, y, z) in face]


# ---------------------------------------------------------------- bird (L = 1, beak tip at x = 0.5)
KEEL = [(0.0, 0.80), (1.00, 0.22), (0.74, -0.72), (0.0, -1.24)]  # (z, y) in units of r: D, U, B, K
STATIONS = [(0.100, 0.028, 0.000), (0.140, 0.048, 0.012), (0.230, 0.046, 0.004), (0.330, 0.088, 0.000), (0.500, 0.074, 0.010), (0.600, 0.040, 0.016)]
BEAK = (0.0, -0.014)
RUMP = (0.640, 0.024)


def X(s):
    return 0.5 - s


def section(st):
    s, r, y = st
    return [(X(s), y + dy * r, dz * r) for (dz, dy) in KEEL]


def bird_faces():
    faces = []
    secs = [section(st) for st in STATIONS]
    for a, b in zip(secs, secs[1:]):
        for k in range(3):
            faces.append([a[k], a[k + 1], b[k + 1], b[k]])
    tip = (X(BEAK[0]), BEAK[1], 0.0)
    rump = (X(RUMP[0]), RUMP[1], 0.0)
    for k in range(3):
        faces.append([secs[0][k], secs[0][k + 1], tip])
        faces.append([secs[-1][k], secs[-1][k + 1], rump])
    # wing (left): arm plate from the shoulder ridge U4–U5, wrist at s = 0.29, span 0.30, chord 0.25, dihedral 8 deg
    u4, u5 = secs[3][1], secs[4][1]
    dih = math.radians(8)
    span_arm, chord_w = 0.30, 0.16

    def out(p, dz):
        return (p[0], p[1] + dz * math.tan(dih), p[2] + dz)

    wle = out((X(0.29), u4[1], u4[2]), span_arm)
    wte = (wle[0] - chord_w, wle[1], wle[2])
    c_root = (u4[0] + 0.35 * (u5[0] - u4[0]), u4[1], u4[2] + 0.35 * (u5[2] - u4[2]))
    c_wrist = (wle[0] - 0.35 * chord_w, wle[1], wle[2])
    faces.append([u4, c_root, c_wrist, wle])
    faces.append([c_root, u5, wte, c_wrist])
    # hand: 5 sockets of 0.05 on an arc (fan step 10 deg) from the wrist trailing corner (pointing back-out) to the tip (pointing out)
    step = math.radians(10)
    rho = 0.025 / math.sin(step / 2)
    dirs = [math.radians(-40) + step * i for i in range(6)]  # angle from +z (outward) toward -x (back) is negative
    first = (wte[0] - 0.02, wte[1], wte[2] + 0.03)
    centre = (first[0] - rho * math.sin(dirs[0]), first[1], first[2] - rho * math.cos(dirs[0]))
    arc = [(centre[0] + rho * math.sin(a), centre[1] + 0.01 * i / 5, centre[2] + rho * math.cos(a)) for i, a in enumerate(dirs)]
    alula = (wle[0] + 0.01, wle[1], wle[2] + 0.035)
    faces.append([wle, wte, *arc, alula])
    faces.append([wle, alula, (wle[0] + 0.03, wle[1] + 0.01, wle[2] + 0.13)])
    lengths = [0.36, 0.42, 0.48, 0.48, 0.42][::-1]  # inner -> outer along the arc
    for i, ln in enumerate(lengths):
        a, b = arc[i], arc[i + 1]
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
        d = (mid[0] - centre[0], 0.0, mid[2] - centre[2])
        n = math.hypot(d[0], d[2])
        e = (d[0] / n, d[2] / n)
        tipp = (mid[0] + e[0] * ln, mid[1] + 0.01, mid[2] + e[1] * ln)
        neck_a = (a[0] + e[0] * ln * 0.55, a[1], a[2] + e[1] * ln * 0.55)
        neck_b = (b[0] + e[0] * ln * 0.62 + (a[0] - b[0]) * 0.45, b[1], b[2] + e[1] * ln * 0.62 + (a[2] - b[2]) * 0.45)
        faces.append([a, b, neck_b, tipp, neck_a])
    # secondaries (6) and coverts (5) as tongues
    for i in range(6):
        p = [u5[k] + (wte[k] - u5[k]) * i / 6 for k in range(3)]
        q = [u5[k] + (wte[k] - u5[k]) * (i + 1) / 6 for k in range(3)]
        faces.append([tuple(p), tuple(q), (q[0] - 0.11, q[1] - 0.005, q[2] + 0.006), (p[0] - 0.11, p[1] - 0.005, p[2] - 0.006)])
    for i in range(5):
        p = [c_root[k] + (c_wrist[k] - c_root[k]) * i / 5 for k in range(3)]
        q = [c_root[k] + (c_wrist[k] - c_root[k]) * (i + 1) / 5 for k in range(3)]
        faces.append([tuple(p), tuple(q), (q[0] - 0.125, q[1] + 0.012, q[2]), (p[0] - 0.125, p[1] + 0.012, p[2])])
    # tail plate and 3 spatulate vanes per side (rounded: outer shorter), fan step 7 deg
    u6 = secs[-1][1]
    tm = (rump[0] - 0.05, rump[1], 0.0)
    faces.append([rump, u6, (u6[0] - 0.05, u6[1], u6[2] * 0.6), tm])
    for i, ln in enumerate([0.32, 0.30, 0.28]):
        a = math.radians(3 + 7 * i)
        root = (tm[0] + 0.004 * i, tm[1] + 0.004 * i, 0.004 + 0.045 * i * 0.5)
        e = (-math.cos(a), math.sin(a))
        side = (-e[1], e[0])
        w = 0.05
        faces.append([root, (root[0] - side[0] * w, root[1], root[2] + side[1] * w * -1 + w), (root[0] + e[0] * ln * 0.6 - side[0] * w * 0.7, root[1], root[2] + e[1] * ln * 0.6 + w * 1.2), (root[0] + e[0] * ln, root[1], root[2] + e[1] * ln + w * 0.5), (root[0] + e[0] * ln * 0.6, root[1], root[2] + e[1] * ln * 0.6)])
    return faces + [mirror(f) for f in faces if any(abs(p[2]) > 1e-12 for p in f)]


# ---------------------------------------------------------------- vehicle (cells; L = 4.4, nose at x = 2.2)
TUB = [(0.0, 0.0), (0.14, -0.006), (0.28, -0.016), (0.42, -0.03), (0.56, -0.06), (0.56, -0.36), (0.0, -0.38)]  # (z, y below deck): D, G1, G2, M, U, B, K; floor 0.42
CAR_STATIONS = [(0.00, 0.62, 0.70), (0.35, 0.78, 0.86), (1.55, 0.80, 1.00), (3.45, 0.80, 1.00), (4.40, 0.70, 0.84)]  # x from nose, deck y, width scale


def car_faces():
    faces = []

    def sec(st):
        x, deck, w = st
        return [(2.2 - x, deck + dy, dz * w) for (dz, dy) in TUB]

    secs = [sec(st) for st in CAR_STATIONS]
    for a, b in zip(secs, secs[1:]):
        for k in range(len(TUB) - 1):
            faces.append([a[k], a[k + 1], b[k + 1], b[k]])
    nose = (2.2 - 0.08, 0.60, 0.0)
    tail = (2.2 - 4.40 - 0.06, 0.62, 0.0)
    for k in range(len(TUB) - 1):
        faces.append([secs[0][k], secs[0][k + 1], nose])
        faces.append([secs[-1][k], secs[-1][k + 1], tail])
    # cabin: windshield at x 1.55 -> roof 1.85..3.05 -> rear window to 3.45; roof y 1.48, half-width 0.46 at belt 0.42 at roof
    belt = 0.80
    cab = [(1.55, belt, 0.42, 0.0), (1.85, 1.48, 0.36, 0.40), (3.05, 1.48, 0.36, 0.40), (3.45, belt, 0.42, 0.0)]
    for (x0, y0, w0, _r0), (x1, y1, w1, _r1) in zip(cab, cab[1:]):
        faces.append([(2.2 - x0, y0, 0.0), (2.2 - x0, y0, w0), (2.2 - x1, y1, w1), (2.2 - x1, y1, 0.0)])
    # wheels: centres x = 0.78 and 3.38 from nose, y = 0.33, z = 0.71, r = 0.33, width 0.20; octagon
    for xc in (0.78, 3.38):
        for zc in (0.61, 0.81):
            ring = [(2.2 - xc + 0.33 * math.cos(math.pi / 8 + i * math.pi / 4), 0.33 + 0.33 * math.sin(math.pi / 8 + i * math.pi / 4), zc) for i in range(8)]
            faces.append(ring)
        # fender arch: 5 quads around radius 0.39, z 0.56..0.86
        arc = [(2.2 - xc + 0.39 * math.cos(math.radians(a)), 0.33 + 0.39 * math.sin(math.radians(a))) for a in (0, 36, 72, 108, 144, 180)]
        for (a0, a1) in zip(arc, arc[1:]):
            faces.append([(a0[0], a0[1], 0.56), (a1[0], a1[1], 0.56), (a1[0], a1[1], 0.86), (a0[0], a0[1], 0.86)])
    faces.append([(2.2 - 0.78 - 0.39, 0.40, 0.56), (2.2 - 3.38 + 0.39, 0.40, 0.56), (2.2 - 3.38 + 0.39, 0.40, 0.86), (2.2 - 0.78 - 0.39, 0.40, 0.86)])
    for i in range(3):
        z0, z1 = 0.14 * i, 0.14 * (i + 1)
        faces.append([(2.2 - 0.36, 0.78, z0), (2.2 - 0.36, 0.78, z1), (2.2 - 0.34, 0.30, z1 - 0.01), (2.2 - 0.34, 0.30, z0 + 0.01)])
    return faces + [mirror(f) for f in faces if any(abs(p[2]) > 1e-12 for p in f)]


# ---------------------------------------------------------------- drawing
def project(view, p):
    x, y, z = p
    if view == "top":
        return (x, -z)
    if view == "below":
        return (x, z)
    if view == "side":
        return (x, y)
    if view == "front":
        return (-z, y)
    a, e = math.radians(35), math.radians(22)
    xr = x * math.cos(a) + z * math.sin(a)
    zr = -x * math.sin(a) + z * math.cos(a)
    return (xr, y * math.cos(e) - zr * math.sin(e))


def depth(view, f):
    if view != "oblique":
        return 0.0
    a, e = math.radians(35), math.radians(22)
    return sum(-(-p[0] * math.sin(a) + p[2] * math.cos(a)) * math.cos(e) - p[1] * math.sin(e) for p in f) / len(f)


def panel(faces, view, box, title, fill, stroke):
    pts = [project(view, p) for f in faces for p in f]
    minx, maxx = min(p[0] for p in pts), max(p[0] for p in pts)
    miny, maxy = min(p[1] for p in pts), max(p[1] for p in pts)
    bx, by, bw, bh = box
    sc = 0.86 * min(bw / (maxx - minx), (bh - 24) / (maxy - miny))
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    out = [f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" fill="#f4f1ea" stroke="#999"/>', f'<text x="{bx + 8}" y="{by + 16}" font-size="13" font-family="sans-serif">{title}</text>']
    for f in sorted(faces, key=lambda f: -depth(view, f)):
        d = " ".join(f"{bx + bw / 2 + (q[0] - cx) * sc:.1f},{by + 12 + bh / 2 - (q[1] - cy) * sc:.1f}" for q in (project(view, p) for p in f))
        out.append(f'<polygon points="{d}" fill="{fill}" stroke="{stroke}" stroke-width="0.7" stroke-linejoin="round"/>')
    return out


def sheet(faces, title, note, path):
    w, h = 1500, 980
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">', f'<rect width="{w}" height="{h}" fill="#fff"/>', f'<text x="16" y="26" font-size="17" font-family="sans-serif" font-weight="bold">{title}</text>', f'<text x="16" y="46" font-size="12" font-family="sans-serif">{note}</text>']
    parts += panel(faces, "top", (16, 60, 720, 440), "top (x forward → right)", "#d9d4c8", "#333")
    parts += panel(faces, "side", (752, 60, 720, 440), "side (left side, x → right)", "#d9d4c8", "#333")
    parts += panel(faces, "front", (16, 516, 470, 440), "front", "#d9d4c8", "#333")
    parts += panel(faces, "below", (502, 516, 470, 440), "silhouette from below", "#111", "#111")
    parts += panel(faces, "oblique", (988, 516, 484, 440), "three-quarter (az 35°, el 22°)", "#d9d4c8", "#333")
    parts.append("</svg>")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(parts) + "\n")


if __name__ == "__main__":
    sheet(bird_faces(), "Bird V3 target — crow baseline (bird-design-brief.md §4)", "Plotted from the brief tables; L = 1. Design input, not lab output. Feathers shown schematically (tongues, vanes).", os.path.join(HERE, "bird-target-views.svg"))
    sheet(car_faces(), "Vehicle V3 target — hero sedan (vehicle-design-brief.md §4)", "Plotted from the brief tables; cells (≈ m). Wheel octagons schematic; cabin side windows open between pillars.", os.path.join(HERE, "vehicle-target-views.svg"))
    print("wrote bird-target-views.svg and vehicle-target-views.svg")
