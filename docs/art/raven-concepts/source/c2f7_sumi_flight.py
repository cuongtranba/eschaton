"""Concept B-2 v7 flight study: Sumi Sculptural Raven, banked glide. DESIGN ARTIFACT ONLY.

Revision of B-2 v6 after its independent round-1 review (decision packet §9.2), following the
v7 target in `docs/art/raven-concepts/b2-v6-flight-brief.md` §12 (committed before this file).
B-2 v6 (`c2f6_sumi_flight.py`) is unchanged. Under the owner's second ART-D3b ruling (B-2 v5
not approved; fix by a generic method). Follows `docs/art/raven-concepts/b2-v6-flight-brief.md`, which applies the proposed
`docs/art/form-construction-method.md`. Built with `docs/art/form-studies/source/formkit.py`:
a section program instead of one scaled profile, declared panels and lines, a converging
arm outline, attachment overlaps, and a structured primary series. Places sculpted planes for
a concept sheet; it does not fold paper, is not a geometry contract and is imported by nothing.

Units: L = bill tip to tail tip, about 1.0. x forward, y left (+y is the far, raised wing in
the hero), z up. Pose, bank, pitch, head yaw and cameras are B-2 v5's.
"""
import math
import os
import sys

from mathutils import Matrix
from mathutils import Vector as V

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                                                 "form-studies", "source")))
import formkit as fk  # noqa: E402

BANK = math.radians(20)
PITCH = math.radians(3)
HEAD_YAW = math.radians(9)
NECK_X = 0.21
DIH_ARM, DIH_HAND = math.radians(5), math.radians(11)
ARCH = 0.040
Z0 = 0.035
ROOT_U, WRIST_U = 0.03, 0.40
BONE0, BONE1 = (0.40, 0.150), (0.66, 0.100)
PLEAT_U = [0.03, 0.13, 0.23, 0.31, 0.40]
PLEAT_Z = [0.0, 0.015, -0.010, 0.012, 0.0]

H = fk.mirror_half
BROW = H([(0, 1.0), (0.48, 1.0), (0.96, 0.10), (0.60, -1.0), (0, -1.0)])
CROWN = H([(0, 1.0), (0.52, 1.0), (1.0, 0.18), (0.64, -1.0), (0, -1.0)])
NAPE_FLAT = H([(0, 1.0), (0.56, 1.0), (1.0, 0.05), (0.60, -1.0), (0, -1.0)])
NAPE = H([(0, 1.0), (0.56, 0.86), (1.0, 0.05), (0.60, -1.0), (0, -1.0)])
NECK = H([(0, 1.0), (0.70, 0.74), (1.0, 0.0), (0.62, -1.0), (0, -1.0)])
BREAST = H([(0, 1.0), (0.74, 0.72), (1.0, -0.05), (0.64, -1.0), (0, -1.0)])
BACK = H([(0, 1.0), (0.80, 0.88), (1.0, 0.18), (0.70, -0.92), (0, -0.92)])
VENT = H([(0, 1.0), (0.84, 0.80), (1.0, 0.10), (0.76, -0.82), (0, -0.82)])
PLATE = H([(0, 1.0), (0.88, 0.62), (1.0, 0.0), (0.88, -1.0), (0, -1.0)])

KEYS = [
    (0.404, -0.016, 0.036, 0.044, BROW, "fore"),
    (0.384, -0.010, 0.044, 0.056, BROW, "fore"),
    (0.366, -0.002, 0.054, 0.066, BROW, "head"),
    (0.322, 0.004, 0.068, 0.074, CROWN, "head"),
    (0.272, -0.029, 0.064, 0.058, NAPE_FLAT, "nape"),
    (0.240, -0.034, 0.070, 0.068, NAPE, "body"),
    (0.205, -0.041, 0.086, 0.090, NECK, "body"),
    (0.130, -0.048, 0.108, 0.110, BREAST, "body"),
    (0.030, -0.044, 0.118, 0.092, BACK, "body"),
    (-0.070, -0.040, 0.098, 0.070, BACK, "body"),
    (-0.130, -0.032, 0.070, 0.042, VENT, "body"),
    (-0.205, -0.022, 0.050, 0.014, PLATE, "body"),
]
HEAD_PANELS = {7: "crown", 0: "crown", 1: "temple.L", 6: "temple.R", 2: "cheek.L", 5: "cheek.R",
               3: "throat", 4: "throat"}
BODY_PANELS = {0: "back.L", 7: "back.R", 1: "shoulder.L", 6: "shoulder.R", 2: "flank.L", 5: "flank.R",
               3: "belly", 4: "belly"}


def yaw_head(p):
    """Turn the head into the bank. The yaw ramps along the neck (x 0.21 to 0.29) so that no two
    neighbouring sections cross; ahead of the ramp it is a rigid rotation about the neck."""
    if p.x <= NECK_X:
        return p
    k = min((p.x - NECK_X) / 0.08, 1.0)
    ang = HEAD_YAW * (3 * k * k - 2 * k ** 3)
    dx = p.x - NECK_X
    c, s = math.cos(ang), math.sin(ang)
    return V((NECK_X + dx * c + p.y * s, -dx * s + p.y * c, p.z))


def panel_of(tag, j):
    """The cheek plane continues into the flank (no line at the nape on the side of the neck);
    the nape fold is declared only where the crown plate meets the back, with the dorsal ridge
    starting behind it (v7, after the read-outs found both lines nearly flat)."""
    if j in (2, 5):
        return "body." + BODY_PANELS[j]
    if tag == "fore":
        return ("fore." if HEAD_PANELS[j] == "crown" else "head.") + HEAD_PANELS[j]
    if tag in ("head", "nape"):
        return "head." + HEAD_PANELS[j]
    return "body." + BODY_PANELS[j]


def section_at(stations, x):
    for a, b in zip(stations, stations[1:]):
        if b[0] <= x <= a[0]:
            k = (a[0] - x) / (a[0] - b[0])
            return a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k
    raise ValueError(x)


def v_le(u):
    k = (u - ROOT_U) / (WRIST_U - ROOT_U)
    return 0.118 + 0.102 * k + 0.045 * math.sin(math.pi * k) * (1 - 0.35 * k)


def v_te(u):
    pts = [(0.03, -0.276), (0.06, -0.272), (0.12, -0.262), (0.19, -0.226), (0.26, -0.172), (0.33, -0.118), (0.40, -0.074)]
    for (u0, a), (u1, b) in zip(pts, pts[1:]):
        if u <= u1:
            return a + (b - a) * (u - u0) / (u1 - u0)
    return pts[-1][1]


def root_ramp(u):
    """0 at the root, 1 from u = 0.12: the arm's camber and layers fade so the root passes under the back."""
    k = max(0.0, min(1.0, (u - ROOT_U) / 0.09))
    return k * k * (3 - 2 * k)


def camber(u, f):
    amp = 0.055 + (0.034 - 0.055) * (u - ROOT_U) / (WRIST_U - ROOT_U)
    return amp * (f / 0.3 if f < 0.3 else 1 - (f - 0.3) / 0.7 * 1.2) * root_ramp(u)


class Wing:
    def __init__(self, m, sgn, flex):
        self.m, self.sgn, self.flex = m, sgn, flex
        self.side = "R" if sgn > 0 else "L"

    def map(self, u, v, h, hand=False):
        if hand and self.flex:
            du, dv = u - WRIST_U, v - v_le(WRIST_U)
            c, s = math.cos(self.flex), math.sin(self.flex)
            u, v = WRIST_U + du * c - dv * s, v_le(WRIST_U) + du * s + dv * c
        if u <= WRIST_U:
            dz = u * math.tan(DIH_ARM) + ARCH * math.sin(math.pi * max(u, 0.0) / WRIST_U) ** 0.8
        else:
            dz = WRIST_U * math.tan(DIH_ARM) + (u - WRIST_U) * math.tan(DIH_HAND)
        return V((v, self.sgn * u, Z0 + dz + h))

    def face(self, part, panel, pts):
        name = f"{part}.{self.side}"
        self.m.face(name, f"{panel}.{self.side}", pts if self.sgn > 0 else list(reversed(pts)))

    def chord(self, u, f, lift):
        le, te = v_le(u), v_te(u)
        return (u, le - f * (le - te), camber(u, f) + lift * root_ramp(u))

    def pleated(self, u, f, te_off=0.0):
        """A point of the secondary tier: alternating, unevenly spaced pleats (a series law, not a ramp)."""
        for (u0, z0), (u1, z1) in zip(zip(PLEAT_U, PLEAT_Z), zip(PLEAT_U[1:], PLEAT_Z[1:])):
            if u0 <= u <= u1 + 1e-9:
                z = z0 + (z1 - z0) * (u - u0) / (u1 - u0)
                break
        le, te = v_le(u), v_te(u) + te_off
        return (u, le - f * (le - te), camber(u, f) + z * (f - 0.3) / 0.7 * root_ramp(u))

    def strip(self, part, panel, us, f0, f1, lift0, lift1, under=False):
        for u0, u1 in zip(us, us[1:]):
            q = [self.chord(u0, f0(u0), lift0), self.chord(u1, f0(u1), lift0), self.chord(u1, f1(u1), lift1),
                 self.chord(u0, f1(u0), lift1)]
            pts = [self.map(*p) for p in q]
            self.face(part, panel, pts[::-1] if not under else pts)

    def arm(self):
        us = [ROOT_U + (WRIST_U - ROOT_U) * i / 10 for i in range(11)]
        us_h = [0.07 + (WRIST_U - 0.07) * i / 10 for i in range(11)]
        self.strip("wing", "hem", us_h, lambda u: 0.0, lambda u: 0.15 - 0.07 * (u - ROOT_U) / 0.34, 0.006, 0.016)
        for k, (p0, p1) in enumerate(zip(PLEAT_U, PLEAT_U[1:])):
            uu = [p0 + (p1 - p0) * i / 3 for i in range(4)]
            for u0, u1 in zip(uu, uu[1:]):
                q = [self.chord(u0, 0.30, 0.0), self.chord(u1, 0.30, 0.0), self.pleated(u1, 0.97),
                     self.pleated(u0, 0.97)]
                self.face("wing", f"sec{k}", [self.map(*p) for p in q][::-1])
        self.strip("wing", "secf", us, lambda u: 0.15 - 0.07 * (u - ROOT_U) / 0.34, lambda u: 0.30, 0.016, 0.0)
        for k in range(len(PLEAT_U) - 1):
            self.m.kind(f"secf.{self.side}", f"sec{k}.{self.side}", fk.FOLD)
        notch = [(0.07, 0.55), (0.105, 0.58), (0.15, 0.53), (0.215, 0.60), (0.255, 0.545), (0.31, 0.585),
                 (0.35, 0.52), (0.40, 0.45)]
        front = [(u, 0.12 - 0.07 * (u - ROOT_U) / 0.34) for u, _ in notch]
        for (u0, f0), (u1, f1), (_, g0), (_, g1) in zip(notch, notch[1:], front, front[1:]):
            a = [self.chord(u0, g0, 0.026), self.chord(u1, g1, 0.026), self.chord(u1, 0.30, 0.012),
                 self.chord(u0, 0.30, 0.012)]
            self.face("cov", "cov.front", [self.map(*p) for p in a][::-1])
            b = [self.chord(u0, 0.30, 0.012), self.chord(u1, 0.30, 0.012), self.chord(u1, f1, 0.010),
                 self.chord(u0, f0, 0.010)]
            self.face("cov", "cov.rear", [self.map(*p) for p in b][::-1])
        scallop = [(0.03, 0.0), (0.11, -0.012), (0.145, 0.002), (0.205, -0.015), (0.24, 0.001), (0.30, -0.011),
                   (0.335, 0.0), (0.40, -0.006)]
        cuts = sorted(set([u for u, _ in scallop] + PLEAT_U))
        off = dict(scallop)
        for u0, u1 in zip(cuts, cuts[1:]):
            k = max(i for i, p in enumerate(PLEAT_U[:-1]) if p <= u0 + 1e-9)
            o0 = off.get(u0, 0.0)
            o1 = off.get(u1, 0.0)
            q = [self.pleated(u0, 0.97), self.pleated(u1, 0.97), self.pleated(u1, 1.0, o1), self.pleated(u0, 1.0, o0)]
            self.face("wing", f"sec{k}", [self.map(*p) for p in q][::-1])
        tert = [(0.0, -0.100), (0.075, -0.150), (0.080, -0.272), (0.050, -0.300), (0.0, -0.250)]
        self.face("under", "tert", [self.map(u, v, -0.058 * (1 - min(u / 0.08, 1.0)) - 0.004) for u, v in tert])
        rows = [("ucov1", [(0.10, 0.05, 0.22), (0.15, 0.04, 0.37), (0.21, 0.04, 0.31), (0.27, 0.05, 0.36),
                           (0.33, 0.07, 0.29), (0.38, 0.10, 0.22), (0.41, 0.15, 0.16)], -0.010),
                ("ucov2", [(0.09, 0.31, 0.40), (0.14, 0.33, 0.58), (0.20, 0.30, 0.50), (0.26, 0.32, 0.56),
                           (0.32, 0.28, 0.47), (0.37, 0.27, 0.38), (0.40, 0.30, 0.31)], -0.016)]
        for name, edge, lift in rows:
            for (u0, a0, f0), (u1, a1, f1) in zip(edge, edge[1:]):
                q = [self.chord(u0, a0, lift), self.chord(u1, a1, lift), self.chord(u1, f1, lift),
                     self.chord(u0, f0, lift)]
                self.face("under", name, [self.map(*p) for p in q])

    def blade(self, name, t_bone, ang, L, wl, wt, prof, lift, curl=0.0, twist=0.0, ridge=0.30):
        rx = BONE0[0] + (BONE1[0] - BONE0[0]) * t_bone
        ry = BONE0[1] + (BONE1[1] - BONE0[1]) * t_bone
        a = math.radians(ang)
        d = (math.cos(a), math.sin(a))
        nl = (-d[1], d[0])
        spine, lead, trail = [], [], []
        for t, k in prof:
            cx, cy = rx + d[0] * L * t, ry + d[1] * L * t
            hz = lift + curl * t * t
            spine.append(self.map(cx, cy, hz + ridge * (wl + wt) * k * 0.5, True))
            lead.append(self.map(cx + nl[0] * wl * k, cy + nl[1] * wl * k, hz - twist * t * wl * k, True))
            trail.append(self.map(cx - nl[0] * wt * k, cy - nl[1] * wt * k, hz + twist * t * wt * k, True))
        for i in range(len(prof) - 1):
            self.face("prim", f"{name}.lead", [spine[i], spine[i + 1], lead[i + 1], lead[i]][::-1])
            self.face("prim", f"{name}.trail", [spine[i], trail[i], trail[i + 1], spine[i + 1]][::-1])
        return (rx, ry), spine[-1]

    def hand(self):
        broad = [(0.0, 0.55), (0.14, 1.0), (0.78, 1.0), (0.93, 0.74), (1.0, 0.28)]

        def finger(e, k):
            return [(0.0, 0.55), (0.14, 1.0), (e, 1.0), (e + 0.10, k), (0.88, k * 0.92), (1.0, 0.0)]
        inner = [("P1", 0.00, -97, 0.225, 0.034, 0.062), ("P2", 0.13, -88, 0.265, 0.036, 0.066),
                 ("P3", 0.28, -78, 0.315, 0.037, 0.068), ("P4", 0.43, -67, 0.37, 0.036, 0.066),
                 ("P5", 0.53, -54, 0.47, 0.034, 0.060)]
        roots, tips, widths, angles, inner_tips = [], [], [], [], []
        for j, (n, t, ang, L, wl, wt) in enumerate(inner):
            r, tip = self.blade(n, t, ang, L, wl, wt, broad, 0.022 - 0.003 * j, curl=0.008, ridge=0.32)
            roots.append(r)
            inner_tips.append((tip.x, tip.y))
            widths.append(wl + wt)
            angles.append(ang)
        fingers = [("P6", 0.62, -43, 0.55, 0.034, 0.054, 0.024, 0.10, 0.50, 0.50),
                   ("P7", 0.74, -30, 0.57, 0.037, 0.060, 0.036, 0.15, 0.58, 0.46),
                   ("P8", 0.86, -20, 0.52, 0.027, 0.044, 0.050, 0.22, 0.45, 0.47),
                   ("P9", 0.96, -6, 0.44, 0.022, 0.035, 0.064, 0.28, 0.54, 0.42)]
        notches, fwidths, fangles = [], [], []
        for j, (n, t, ang, L, wl, wt, curl, tw, e, k) in enumerate(fingers):
            r, tip = self.blade(n, t, ang, L, wl, wt, finger(e, k), 0.012 - 0.002 * j, curl=curl, twist=tw,
                                ridge=0.36)
            tips.append(tip)
            a = math.radians(ang)
            notches.append((r[0] + math.cos(a) * L * (e + 0.10), r[1] + math.sin(a) * L * (e + 0.10)))
            fwidths.append(wl + wt)
            fangles.append(ang)
            roots.append(r)
        self.blade("P10", 1.0, 3, 0.27, 0.013, 0.019, finger(0.36, 0.6), 0.004, curl=0.03, twist=0.2, ridge=0.4)
        pc = [(0.31, 0.150), (0.38, 0.212), (0.47, 0.178), (0.58, 0.125), (0.60, 0.082), (0.56, 0.045),
              (0.52, 0.058), (0.48, 0.018), (0.44, 0.030), (0.40, -0.020), (0.35, 0.020)]
        self.face("cov", "pcov", [self.map(u, v, 0.032, True) for u, v in pc])
        cu = sum(u for u, _ in pc) / len(pc)
        cv = sum(v for _, v in pc) / len(pc)
        upc = [(cu + (u - cu) * 0.88, cv + (v - cv) * 0.88) for u, v in pc]
        self.face("under", "upcov", [self.map(u, v, -0.010, True) for u, v in upc])
        sp = [math.dist(a, b) for a, b in zip(roots, roots[1:])]
        if self.sgn > 0:
            self.m.series["primaries.inner"] = fk.series_stats("inner primaries P1-P5 (ends = tips)", widths, sp[:4], angles,
                                                                inner_tips)
            self.m.series["fingers"] = fk.series_stats("fingers P6-P9 (ends = notch points)", fwidths, sp[5:8],
                                                       fangles, notches)
        return tips


def build():
    m = fk.Model()
    zh = 0.035
    keys = [(x, z + zh, w, h, prof, tag) for x, z, w, h, prof, tag in KEYS]
    stations, _ = fk.program(keys, sub=6)
    fk.section_loft(m, "body", stations, panel_of, cap_start="fore.cap", cap_end="body.tailcap", xform=yaw_head,
                    slice_axis=(-1, 0, 0))
    m.kind("body.belly", "body.tailcap", fk.SEAM)
    upper = [(0.398, 0.0, 0.040, 0.036), (0.436, -0.004, 0.031, 0.030), (0.469, -0.016, 0.021, 0.021),
             (0.501, -0.032, 0.010, 0.011), (0.525, -0.054, 0.0, 0.0)]
    lower = [(0.360, -0.031, 0.034, 0.020), (0.40, -0.027, 0.030, 0.017), (0.436, -0.031, 0.022, 0.013),
             (0.467, -0.039, 0.011, 0.008), (0.50, -0.052, 0.0, 0.0)]
    diam = [(0, 1.0), (1.0, 0.0), (0, -1.0), (-1.0, 0.0)]
    zb = zh - 0.015
    names = {0: "culmen.R", 1: "side.R", 2: "side.L", 3: "culmen.L"}
    for nm, sec in (("bill.upper", upper), ("bill.lower", lower)):
        st = [(x, z + zb, w, h, diam, nm) for x, z, w, h in sec]
        fk.section_loft(m, "bill", st, lambda tag, j: f"{tag}.{names[j]}", cap_start=f"{nm}.base", xform=yaw_head)
    for sgn in (1, -1):
        ez, ew, eh = section_at(stations, 0.345)
        c = V((0.345, (0.957 * ew + 0.003) * sgn, ez + 0.04 * eh))
        m.face("eye", "eye", [yaw_head(p) for p in [c + V((0.010, 0, 0.001)), c + V((0, 0.001 * sgn, 0.007)),
                                                     c + V((-0.010, 0, 0)), c + V((0, 0.001 * sgn, -0.005))][::sgn]])
        up_e, lo_e = [], []
        for x, dz, dx in zip((0.37, 0.335, 0.30, 0.265, 0.232), (0.026, 0.044, 0.030, 0.048, 0.034),
                             (0.012, 0.020, 0.014, 0.022, 0.016)):
            zc, w, h = section_at(stations, x)
            up_e.append((x, 0.50 * w, zc - 0.86 * h))
            lo_e.append((x - dx, 0.46 * w, zc - 0.86 * h - dz))
        for i in range(len(up_e) - 1):
            q = [yaw_head(V((x, y * sgn, z))) for x, y, z in (up_e[i], up_e[i + 1], lo_e[i + 1], lo_e[i])]
            m.face("hackle", f"hackle.{sgn}", q if sgn > 0 else list(reversed(q)))
    tips = {}
    for sgn, flex in ((1, 0.0), (-1, math.radians(-9))):
        w = Wing(m, sgn, flex)
        w.arm()
        tips[sgn] = w.hand()
    tail = fk.Model()
    for k, (L, a, wdt, keel) in enumerate([(0.355, 0.0, 0.12, 0.40), (0.295, 0.25, 0.108, 0.30),
                                           (0.29, -0.25, 0.108, 0.30)]):
        d = V((-math.cos(a), math.sin(a), -0.02)).normalized()
        s = V((0, 0, 1)).cross(d).normalized()
        root = V((-0.150, 0.0, 0.006 + 0.004 * (k == 0)))
        prof = [(0.0, 0.42), (0.22, 1.0), (0.74, 0.92), (1.0, 0.0)]
        sp = [root + d * (L * t) + V((0, 0, keel * wdt * 0.5 * kk)) for t, kk in prof]
        le = [root + d * (L * t) + s * (wdt * 0.5 * kk) for t, kk in prof]
        tr = [root + d * (L * t) - s * (wdt * 0.5 * kk) for t, kk in prof]
        for i in range(len(prof) - 1):
            tail.face("tail", f"r{k}.a", [sp[i], le[i], le[i + 1], sp[i + 1]])
            tail.face("tail", f"r{k}.b", [sp[i], sp[i + 1], tr[i + 1], tr[i]])
    utc = [V((-0.11, 0.0, -0.041)), V((-0.16, 0.032, -0.022)), V((-0.25, 0.0, -0.014)), V((-0.16, -0.032, -0.022))]
    tail.face("under", "utc", utc)
    tail.apply(Matrix.Rotation(math.radians(-7), 4, "X"))
    m.faces += tail.faces
    T = Matrix.Rotation(BANK, 4, "X") @ Matrix.Rotation(PITCH, 4, "Y")
    m.apply(T)

    def t(p):
        return tuple(T @ V(p))
    wing_l = Wing(m, -1, math.radians(-9))
    wing_r = Wing(m, 1, 0.0)
    wrist_l = T @ wing_l.map(WRIST_U, v_le(WRIST_U), 0.0)
    wrist_r = T @ wing_r.map(WRIST_U, v_le(WRIST_U), 0.0)
    tail_tip = Matrix.Rotation(math.radians(-7), 4, "X") @ V((-0.150 - 0.355, 0, 0.010 - 0.355 * 0.02))
    lm = {"bill_tip": t(yaw_head(V((0.525, 0, -0.054 + zb)))), "finger_R": tuple(T @ tips[1][1]),
          "tail_wedge_tip": t(tail_tip), "throat_hackles": t(yaw_head(V((0.30, -0.05, -0.05)))),
          "wrist_L": tuple(wrist_l), "p10_L": tuple(T @ tips[-1][3]), "finger_L": tuple(T @ tips[-1][1])}
    near_hand = (wrist_l + T @ tips[-1][1]) / 2
    far_hand = (wrist_r + T @ tips[1][1]) / 2
    sections = {}
    for x, z, w, h, prof, tag in keys:
        sections[f"{x:+.3f}"] = fk.descriptors(prof, w, h)
    spec = {
        "tones": {"under": "under", "eye": "accent", "body": "body", "wing": "body", "cov": "body",
                  "prim": "body", "tail": "body", "bill": "under", "hackle": "body"},
        "crease": 165,
        "hier": {"body": 1, "bill": 1, "tail": 1, "wing": 2, "cov": 2, "prim": 2, "under": 2,
                 "hackle": 3, "eye": 3},
        "hier_views": ["top"],
        "sections": sections,
        "views": {
            "hero": {"dir": (0.55, -1.0, 0.8), "dist": 4.7, "lens": 58, "res": (1500, 1000), "target": (0.0, 0.0, 0.03)},
            "front": {"dir": (1, 0, 0.0001), "ortho": 2.4, "dist": 4, "res": (900, 500), "target": (0, 0, 0.12)},
            "side": {"dir": (0, -1, 0.0001), "ortho": 1.7, "dist": 4, "res": (900, 600), "target": (0.0, 0, 0.12)},
            "top": {"dir": (0, 0, 1), "ortho": 2.4, "dist": 4, "res": (900, 560), "target": (-0.02, 0, 0), "up": (1, 0, 0)},
            "under": {"dir": (0, 0, -1), "ortho": 2.4, "dist": 4, "res": (900, 560), "target": (-0.02, 0, 0), "up": (1, 0, 0)},
            "head": {"dir": (0.75, -1, 0.3), "dist": 0.7, "lens": 55, "res": (700, 520), "target": (0.36, -0.02, 0.03)},
            "wing": {"dir": (0.15, -0.25, 1), "dist": 1.75, "lens": 55, "res": (700, 520),
                     "target": tuple((wrist_l + near_hand) / 2), "up": (1, 0, 0)},
            "tail": {"dir": (-0.75, -0.3, 0.8), "dist": 1.0, "lens": 55, "res": (700, 520), "target": (-0.3, 0, -0.02)},
            "hand_near": {"dir": (0.62, -1.0, 0.62), "dist": 1.45, "lens": 55, "res": (900, 640),
                          "target": tuple(near_hand)},
            "hand_far": {"dir": (0.45, -0.7, 1.0), "dist": 2.0, "lens": 55, "res": (900, 640),
                         "target": tuple(far_hand)},
            "wrist": {"dir": (0.35, -0.3, 1), "dist": 1.0, "lens": 55, "res": (900, 640),
                      "target": tuple(wrist_l + (T @ tips[-1][0] - wrist_l) * 0.25)},
            "section": {"dir": (1, -0.12, 0.22), "dist": 1.25, "lens": 55, "res": (900, 640),
                        "target": tuple(T @ V((0.05, -0.30, 0.05)))},
        },
        "ink_views": ["hero", "under"],
        "sil_views": ["hero", "under", "side", "top"],
        "crease_views": ["hero", "top"],
    }
    return m, lm, spec
