"""Concept B-2 v4 flight study: Sumi Sculptural Raven, banked glide. DESIGN ARTIFACT ONLY.

Revision under owner decision ART-D3b, following the committed brief
`docs/art/raven-concepts/b2-v4-flight-brief.md`. Places sculpted planes for a concept
sheet; it does not fold paper, is not a geometry contract and is imported by nothing.

Units: L = bill tip to tail tip, about 1.0. x forward, y left (+y is the far, raised
wing in the hero), z up. The head and bill reuse Concept B's head profile
(`c2_sumi.py`) scaled by 1.12 into the flight axis.
"""
import math
from mathutils import Vector as V, Matrix
import kit

PENT = [(0, 1.0), (0.95, 0.32), (0.62, -0.85), (-0.62, -0.85), (-0.95, 0.32)]
DIAM = [(0, 1.0), (1.0, 0.0), (0, -1.0), (-1.0, 0.0)]
BANK = math.radians(20)
PITCH = math.radians(3)
HEAD_YAW = math.radians(9)
NECK_X = 0.25
DIH_ARM, DIH_HAND = math.radians(4), math.radians(8)
Z0 = 0.035
S_LE, W_LE = (0.06, 0.15), (0.38, 0.20)
BONE0, BONE1 = (0.38, 0.14), (0.56, 0.10)


def yaw_head(p):
    if p.x <= NECK_X:
        return p
    dx = p.x - NECK_X
    c, s = math.cos(HEAD_YAW), math.sin(HEAD_YAW)
    return V((NECK_X + dx * c + p.y * s, -dx * s + p.y * c, p.z))


def v_le(u):
    k = (u - S_LE[0]) / (W_LE[0] - S_LE[0])
    return S_LE[1] + (W_LE[1] - S_LE[1]) * k + 0.045 * k * (1 - k)


def v_te(u):
    pts = [(0.06, -0.20), (0.20, -0.226), (0.30, -0.217), (0.40, -0.19)]
    for (u0, a), (u1, b) in zip(pts, pts[1:]):
        if u <= u1:
            return a + (b - a) * (u - u0) / (u1 - u0)
    return pts[-1][1]


def camber(u, f):
    amp = 0.052 + (0.018 - 0.052) * (u - 0.06) / 0.34
    return amp * (f / 0.3 if f < 0.3 else 1 - (f - 0.3) / 0.7 * 1.25)


class Wing:
    def __init__(self, b, sgn, flex):
        self.b, self.sgn, self.flex = b, sgn, flex

    def map(self, u, v, h, hand=False):
        if hand and self.flex:
            du, dv = u - W_LE[0], v - W_LE[1]
            c, s = math.cos(self.flex), math.sin(self.flex)
            u, v = W_LE[0] + du * c - dv * s, W_LE[1] + du * s + dv * c
        uw = W_LE[0]
        dz = u * math.tan(DIH_ARM) if u <= uw else uw * math.tan(DIH_ARM) + (u - uw) * math.tan(DIH_HAND)
        if u <= uw:
            dz += 0.028 * math.sin(math.pi * max(u, 0.0) / uw)
        return V((v, self.sgn * u, Z0 + dz + h))

    def face(self, part, pts):
        side = "R" if self.sgn > 0 else "L"
        self.b.face(f"{part}.{side}", pts if self.sgn > 0 else list(reversed(pts)))

    def chord(self, u, f, lift):
        le, te = v_le(u), v_te(u)
        return (u, le - f * (le - te), camber(u, f) + lift)

    def arm(self):
        st = [0.05, 0.14, 0.23, 0.32, 0.40]
        hf = [0.15, 0.13, 0.11, 0.09, 0.07]
        hd = [-0.016, -0.012, -0.008, -0.005, -0.002]
        hem = [[self.chord(u, f, 0.016) for f in (0.0, hf[i])] for i, u in enumerate(st)]
        for i in range(len(st) - 1):
            a, b_ = hem[i], hem[i + 1]
            self.face("wing", [self.map(*a[1]), self.map(*b_[1]), self.map(*b_[0]), self.map(*a[0])])
            lo0 = self.chord(st[i], hf[i] * 0.6, hd[i])
            lo1 = self.chord(st[i + 1], hf[i + 1] * 0.6, hd[i + 1])
            self.face("hem", [self.map(*a[0]), self.map(*b_[0]), self.map(*lo1), self.map(*lo0)])
        cov_front = [self.chord(u, f, 0.009) for u, f in zip(st, (0.12, 0.10, 0.08, 0.065, 0.05))]
        cov_crease = [self.chord(u, 0.30, 0.009) for u in st]
        for i in range(len(st) - 1):
            self.face("cov", [self.map(*cov_front[i + 1]), self.map(*cov_front[i]),
                              self.map(*cov_crease[i]), self.map(*cov_crease[i + 1])][::-1])
        notch = [(0.05, 0.50), (0.14, 0.57), (0.19, 0.51), (0.29, 0.585), (0.33, 0.52), (0.40, 0.44)]
        rear = [self.chord(u, f, 0.009) for u, f in notch]
        for i in range(len(rear) - 1):
            c0 = self.chord(notch[i][0], 0.30, 0.009)
            c1 = self.chord(notch[i + 1][0], 0.30, 0.009)
            self.face("cov", [self.map(*c0), self.map(*c1), self.map(*rear[i + 1]), self.map(*rear[i])])
        te = [(0.05, -0.200), (0.14, -0.227), (0.19, -0.212), (0.27, -0.229), (0.31, -0.214), (0.40, -0.194)]
        for i in range(len(te) - 1):
            (u0, t0), (u1, t1) = te[i], te[i + 1]
            f0 = self.chord(u0, 0.42, 0.0)
            f1 = self.chord(u1, 0.42, 0.0)
            h0, h1 = camber(u0, 0.97) - 0.004, camber(u1, 0.97) - 0.004
            self.face("wing", [self.map(*f0), self.map(*f1), self.map(u1, t1, h1), self.map(u0, t0, h0)][::-1])

    def blade(self, part, t_bone, ang, L, wl, wt, prof, lift, curl=0.0, twist=0.0, ridge=0.16):
        rx = BONE0[0] + (BONE1[0] - BONE0[0]) * t_bone
        ry = BONE0[1] + (BONE1[1] - BONE0[1]) * t_bone
        a = math.radians(ang)
        d = (math.cos(a), math.sin(a))
        nl = (-d[1], d[0])
        spine, lead, trail = [], [], []
        for t, k in prof:
            cx, cy = rx + d[0] * L * t, ry + d[1] * L * t
            hz = lift + curl * t * t
            spine.append(self.map(cx, cy, hz + ridge * (wl + wt) * (1 - t) * 0.5, True))
            lead.append(self.map(cx + nl[0] * wl * k, cy + nl[1] * wl * k, hz - twist * t * wl * k, True))
            trail.append(self.map(cx - nl[0] * wt * k, cy - nl[1] * wt * k, hz + twist * t * wt * k, True))
        for i in range(len(prof) - 1):
            self.face(part, [spine[i], spine[i + 1], lead[i + 1], lead[i]][::-1])
            self.face(part, [spine[i], trail[i], trail[i + 1], spine[i + 1]][::-1])
        return trail[-1] if False else spine[-1]

    def hand(self):
        broad = [(0.0, 0.45), (0.16, 1.0), (0.8, 1.0), (0.94, 0.72), (1.0, 0.3)]
        finger = [(0.0, 0.45), (0.15, 1.0), (0.5, 1.0), (0.62, 0.48), (0.9, 0.44), (1.0, 0.0)]
        inner = [(0.05, -80, 0.34, 0.040, 0.075), (0.24, -70, 0.375, 0.040, 0.070),
                 (0.40, -60, 0.42, 0.038, 0.066), (0.55, -50, 0.47, 0.034, 0.060)]
        for j, (t, ang, L, wl, wt) in enumerate(inner):
            self.blade("prim", t, ang, L, wl, wt, broad, 0.030 - 0.003 * j, curl=0.006, ridge=0.12)
        tips = []
        fingers = [(0.68, -42, 0.55, 0.034, 0.050, 0.020, 0.10), (0.79, -31, 0.56, 0.032, 0.047, 0.032, 0.16),
                   (0.89, -20, 0.52, 0.029, 0.043, 0.046, 0.22), (0.96, -8, 0.45, 0.025, 0.037, 0.058, 0.28)]
        for j, (t, ang, L, wl, wt, curl, tw) in enumerate(fingers):
            tips.append(self.blade("prim", t, ang, L, wl, wt, finger, 0.016 - 0.003 * j, curl=curl, twist=tw))
        tips.append(self.blade("prim", 1.0, -1, 0.27, 0.014, 0.020, finger, 0.004, curl=0.03, twist=0.2))
        pc = [(0.372, 0.19), (0.47, 0.16), (0.575, 0.112), (0.585, 0.075), (0.545, 0.035), (0.51, 0.048),
              (0.47, 0.008), (0.43, 0.02), (0.39, -0.02), (0.362, -0.012), (0.356, 0.09)]
        centre = (0.46, 0.08)
        lift = 0.024
        ring = [self.map(u, v, lift + (0.006 if i in (0, 1) else 0.0), True) for i, (u, v) in enumerate(pc)]
        c = self.map(centre[0], centre[1], lift + 0.008, True)
        for i in range(len(ring) - 1):
            self.face("cov", [c, ring[i + 1], ring[i]])
        self.face("cov", [c, ring[0], ring[-1]])
        al = [(0.37, 0.205, 0.046), (0.50, 0.178, 0.054), (0.47, 0.166, 0.05), (0.38, 0.188, 0.046)]
        self.face("alula", [self.map(u, v, h, True) for u, v, h in al][::-1])
        return tips


def build():
    b = kit.Builder()
    up = V((0, 0, 1))
    zh = 0.035
    head = [(0.404, -0.015, 0.036, 0.044), (0.39, -0.010, 0.044, 0.052), (0.365, -0.002, 0.056, 0.064),
            (0.335, 0.002, 0.066, 0.074), (0.30, -0.004, 0.068, 0.074), (0.268, -0.024, 0.056, 0.054)]
    body = [(0.225, -0.040, 0.086, 0.086), (0.16, -0.045, 0.110, 0.104), (0.07, -0.047, 0.118, 0.108),
            (-0.04, -0.045, 0.104, 0.094), (-0.13, -0.035, 0.070, 0.060), (-0.19, -0.025, 0.035, 0.026)]
    secs = [(x, z + zh, w, h) for x, z, w, h in head] + [(x, z + zh, w, h) for x, z, w, h in body]
    kit.loft(b, "body", [(yaw_head(V((x, 0, z))), w, h, up) for x, z, w, h in secs], PENT)
    upper = [(0.40, 0.0, 0.038, 0.034), (0.436, -0.004, 0.030, 0.029), (0.469, -0.016, 0.020, 0.020),
             (0.501, -0.032, 0.010, 0.011), (0.525, -0.054, 0, 0)]
    lower = [(0.372, -0.030, 0.040, 0.024), (0.40, -0.026, 0.031, 0.018), (0.436, -0.031, 0.022, 0.013),
             (0.467, -0.039, 0.011, 0.008), (0.50, -0.052, 0, 0)]
    zb = zh - 0.015
    kit.loft(b, "bill", [(yaw_head(V((x, 0, z + zb))), w, h, up) for x, z, w, h in upper], DIAM)
    kit.loft(b, "bill", [(yaw_head(V((x, 0, z + zb))), w, h, up) for x, z, w, h in lower], DIAM)
    for sgn in (1, -1):
        c = V((0.345, 0.0605 * sgn, 0.044))
        b.face("eye", [yaw_head(p) for p in [c + V((0.009, 0, 0.001)), c + V((0, 0.001 * sgn, 0.006)),
                                            c + V((-0.009, 0, 0)), c + V((0, 0.001 * sgn, -0.004))][::sgn]])
        up_e = [(0.392, 0.026, -0.010), (0.35, 0.048, -0.022), (0.315, 0.060, -0.030), (0.28, 0.064, -0.036),
                (0.245, 0.068, -0.040)]
        lo_e = [(0.37, 0.026, -0.046), (0.33, 0.046, -0.072), (0.30, 0.054, -0.058), (0.266, 0.060, -0.080),
                (0.232, 0.066, -0.062)]
        for i in range(len(up_e) - 1):
            q = [yaw_head(V((x, y * sgn, z))) for x, y, z in (up_e[i], up_e[i + 1], lo_e[i + 1], lo_e[i])]
            b.face("hackle", q if sgn > 0 else list(reversed(q)))
    tips = {}
    for sgn, flex in ((1, 0.0), (-1, math.radians(-9))):
        w = Wing(b, sgn, flex)
        w.arm()
        tips[sgn] = w.hand()
    twist = Matrix.Rotation(math.radians(-7), 4, "X")
    for k, (L, a, wdt) in enumerate([(0.34, 0.0, 0.12), (0.275, 0.16, 0.11), (0.275, -0.16, 0.11)]):
        d = V((-math.cos(a), math.sin(a), -0.02))
        kit.feather(b, "tail", V((-0.165, 0, 0.01 + 0.006 * (k == 0))), d, V((0, 0, 1)), L, wdt,
                    spine=0.45 if k == 0 else 0.3, tip="point", asym=0.5)
    b.parts["tail"] = [[twist @ p for p in poly] for poly in b.parts["tail"]]
    T = Matrix.Rotation(BANK, 4, "X") @ Matrix.Rotation(PITCH, 4, "Y")
    for part, polys in b.parts.items():
        b.parts[part] = [[T @ p for p in poly] for poly in polys]

    def t(p):
        return tuple(T @ V(p))
    tail_tip = twist @ V((-0.165 - 0.34, 0, 0.016 - 0.34 * 0.02))
    lm = {"bill_tip": t(yaw_head(V((0.525, 0, -0.054 + zb)))), "finger_R": tuple(tips[1][2]),
          "tail_wedge_tip": t(tail_tip), "throat_hackles": t(yaw_head(V((0.30, -0.05, -0.05)))),
          "wrist_L": t((W_LE[1], -W_LE[0], Z0 + W_LE[0] * math.tan(DIH_ARM))),
          "p10_L": tuple(tips[-1][4]), "finger_L": tuple(tips[-1][1])}
    wrist_l = V(lm["wrist_L"])
    wrist_r = T @ V((W_LE[1], W_LE[0], Z0 + W_LE[0] * math.tan(DIH_ARM)))
    near_hand = (wrist_l + V(tips[-1][1])) / 2
    far_hand = (wrist_r + V(tips[1][1])) / 2
    spec = {
        "tones": {"under": "under", "eye": "accent", "body": "body", "wing": "body", "cov": "body",
                  "prim": "body", "alula": "body", "tail": "body", "bill": "under", "hackle": "body", "hem": "body"},
        "crease": 165,
        "hier": {"body": 1, "bill": 1, "tail": 1, "wing": 2, "cov": 2, "prim": 2, "hem": 2,
                 "alula": 3, "hackle": 3, "eye": 3},
        "hier_views": ["top"],
        "views": {
            "hero": {"dir": (0.62, -1.0, 0.62), "dist": 3.7, "lens": 58, "res": (1500, 1000), "target": (0.0, 0.05, 0.1)},
            "front": {"dir": (1, 0, 0.0001), "ortho": 2.4, "dist": 4, "res": (900, 420), "target": (0, 0, 0.0)},
            "side": {"dir": (0, -1, 0.0001), "ortho": 1.25, "dist": 4, "res": (900, 420), "target": (0.0, 0, 0.0)},
            "top": {"dir": (0, 0, 1), "ortho": 2.4, "dist": 4, "res": (900, 560), "target": (-0.02, 0, 0), "up": (1, 0, 0)},
            "under": {"dir": (0, 0, -1), "ortho": 2.4, "dist": 4, "res": (900, 560), "target": (-0.02, 0, 0), "up": (1, 0, 0)},
            "head": {"dir": (0.75, -1, 0.3), "dist": 0.7, "lens": 55, "res": (700, 520), "target": (0.36, -0.02, 0.03)},
            "wing": {"dir": (0.15, -0.25, 1), "dist": 1.75, "lens": 55, "res": (700, 520),
                     "target": tuple((wrist_l + near_hand) / 2), "up": (1, 0, 0)},
            "tail": {"dir": (-0.75, -0.3, 0.8), "dist": 1.0, "lens": 55, "res": (700, 520), "target": (-0.3, 0, -0.02)},
            "hand_near": {"dir": (0.62, -1.0, 0.62), "dist": 1.45, "lens": 55, "res": (900, 640),
                          "target": tuple(near_hand)},
            "hand_far": {"dir": (0.62, -1.0, 0.62), "dist": 1.45, "lens": 55, "res": (900, 640),
                         "target": tuple(far_hand)},
            "wrist": {"dir": (0.62, -1.0, 0.75), "dist": 0.85, "lens": 55, "res": (900, 640), "target": tuple(wrist_l)},
            "section": {"dir": (1, -0.12, 0.22), "dist": 1.25, "lens": 55, "res": (900, 640),
                        "target": tuple(T @ V((0.05, -0.30, 0.05)))},
        },
        "ink_views": ["hero", "under"],
        "sil_views": ["hero", "under", "side", "top"],
    }
    return b, lm, spec
