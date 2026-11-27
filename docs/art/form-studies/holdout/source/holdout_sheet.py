"""Holdout design sheet: biwa-type lute. DESIGN ARTIFACT ONLY (original design drawing).

Draws orthographic and three-quarter sketches, a section strip, the pegbox flat pattern, silhouettes
at 96/48/24 px and a read-out panel, all from the numbers in ../brief.md. No reference image is
imported or traced. This is not geometry, not an operator implementation and not imported by anything.
The read-out values printed on the sheet are literal numbers copied from ../composition.md.

Usage: python3 holdout_sheet.py <out.png>
"""
import math
import sys
from PIL import Image, ImageDraw, ImageFont

PAPER, INK, MID, LIGHT, ACC = (241, 230, 208), (34, 32, 30), (120, 112, 100), (214, 200, 176), (150, 60, 45)


def font(sz):
    for p in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(p, sz)
        except OSError:
            pass
    return ImageFont.load_default()


def mirror_half(half):
    return list(half) + [(-y, z) for y, z in reversed(half[1:-1])]


BODY = mirror_half([(0, 1.0), (0.65, 0.985), (1.0, 0.92), (0.97, 0.30), (0.85, -0.55), (0.62, -1.0), (0, -1.0)])
SHOULDER = mirror_half([(0, 1.0), (0.75, 0.99), (1.0, 0.85), (0.96, 0.15), (0.78, -0.62), (0.45, -0.98), (0, -1.0)])
NECK = mirror_half([(0, 1.0), (0.9, 1.0), (1.0, 0.75), (0.92, 0.0), (0.65, -0.70), (0.30, -0.97), (0, -1.0)])
KEYS = [(0.03, 0.100, 0.024, BODY, "K0 BODY"), (0.20, 0.180, 0.026, BODY, "K1 BODY"), (0.42, 0.150, 0.026, BODY, "K2 BODY"),
        (0.58, 0.075, 0.024, SHOULDER, "K3 SHOULDER"), (0.64, 0.036, 0.022, NECK, "K4 NECK"), (0.89, 0.030, 0.020, NECK, "K5 NECK (nut)")]
BETA, PEG_LEN = math.radians(65), 0.25
FRETS = [0.70, 0.765, 0.82, 0.865]  # design assumption (brief §5)
PEGS = [0.05, 0.10, 0.15, 0.20]       # along the pegbox, alternating sides

W, H = 3000, 2100
im = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(im)
F = {k: font(v) for k, v in (("t", 46), ("h", 26), ("b", 21), ("s", 17))}


def panel(x, y, w, h, title, sub=""):
    d.rectangle([x, y, x + w, y + h], outline=MID, width=2)
    d.text((x + 14, y + 10), title, fill=INK, font=F["h"])
    if sub:
        d.text((x + 14, y + 42), sub, fill=MID, font=F["s"])


def halfwidth(x):
    """Plan half-width along the spine, piecewise linear through the keyframes, with the tail cap."""
    pts = [(0.0, 0.05)] + [(k[0], k[1]) for k in KEYS]
    for (x0, w0), (x1, w1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            return w0 + (w1 - w0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def halfdepth(x):
    pts = [(0.0, 0.024)] + [(k[0], k[2]) for k in KEYS]
    for (x0, h0), (x1, h1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            return h0 + (h1 - h0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


# ---- Front (soundboard) view: spine vertical, tail at the bottom ----
px, py, pw, ph = 30, 120, 760, 1240
panel(px, py, pw, ph, "FRONT (soundboard) - orthographic", "spine vertical; pegbox foreshortened (bent back 65 deg)")
S = 1050
ox, oy = px + pw // 2, py + ph - 70
xs = [i / 200 * 0.89 for i in range(201)]
outline = [(ox + halfwidth(x) * S, oy - x * S) for x in xs] + [(ox - halfwidth(x) * S, oy - x * S) for x in reversed(xs)]
d.polygon(outline, fill=LIGHT, outline=INK)
# pegbox foreshortened: projection on the soundboard plane has length PEG_LEN*cos(beta)
pe = 0.89 + PEG_LEN * math.cos(BETA)
pb = [(ox - 0.025 * S, oy - 0.89 * S), (ox + 0.025 * S, oy - 0.89 * S), (ox + 0.020 * S, oy - pe * S), (ox - 0.020 * S, oy - pe * S)]
d.polygon(pb, fill=PAPER, outline=INK)
d.line([(ox - 0.016 * S, oy - 0.895 * S), (ox - 0.013 * S, oy - (pe - 0.005) * S)], fill=MID, width=1)
d.line([(ox + 0.016 * S, oy - 0.895 * S), (ox + 0.013 * S, oy - (pe - 0.005) * S)], fill=MID, width=1)
for i, t in enumerate(PEGS):
    xx = 0.89 + t * math.cos(BETA)
    sgn = -1 if i % 2 == 0 else 1
    d.rectangle([ox + sgn * 0.022 * S - (45 if sgn < 0 else 0), oy - xx * S - 6, ox + sgn * 0.022 * S + (45 if sgn > 0 else 0), oy - xx * S + 6], fill=PAPER, outline=INK)
# rim seam (soundboard edge) as an inset line
rim = [(ox + 0.985 * halfwidth(x) * S, oy - x * S) for x in xs if x <= 0.58]
d.line(rim, fill=INK, width=1)
d.line([(ox - p[0] + ox, p[1]) for p in rim], fill=INK, width=1)
# crescent sound holes (declared negative envelopes), upper bout
for sgn in (-1, 1):
    cx, cy, r = ox + sgn * 0.085 * S, oy - 0.43 * S, 0.032 * S
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK)
    c2 = cx - sgn * 0.55 * r
    d.ellipse([c2 - r, cy - r * 1.05, c2 + r, cy + r * 1.05], fill=LIGHT)
# bachimen band
d.polygon([(ox - 0.14 * S, oy - 0.30 * S), (ox + 0.14 * S, oy - 0.30 * S), (ox + 0.13 * S, oy - 0.36 * S), (ox - 0.13 * S, oy - 0.36 * S)], fill=(200, 186, 160), outline=INK)
# tailpiece
d.rectangle([ox - 0.07 * S, oy - 0.14 * S, ox + 0.07 * S, oy - 0.115 * S], fill=PAPER, outline=INK)
# frets
for f in FRETS:
    hw = halfwidth(f)
    d.rectangle([ox - hw * S * 0.95, oy - f * S - 4, ox + hw * S * 0.95, oy - f * S + 4], fill=PAPER, outline=INK)
# strings
for i in range(4):
    a = -0.045 + i * 0.03
    b = -0.012 + i * 0.008
    d.line([(ox + a * S, oy - 0.128 * S), (ox + b * S, oy - 0.89 * S)], fill=INK, width=1)
for k in KEYS:
    d.line([(px + 16, oy - k[0] * S), (px + 60, oy - k[0] * S)], fill=ACC, width=2)
    d.text((px + 64, oy - k[0] * S - 10), k[4].split()[0], fill=ACC, font=F["s"])
d.text((ox + 0.20 * S, oy - 0.43 * S - 12), "crescent holes (declared negative space)", fill=MID, font=F["s"])
d.text((ox + 0.16 * S, oy - 0.33 * S - 10), "bachimen (O3 layer)", fill=MID, font=F["s"])
d.text((ox + 0.09 * S, oy - 0.13 * S - 10), "tailpiece (O3)", fill=MID, font=F["s"])
d.text((ox + 0.05 * S, oy - 0.79 * S - 10), "4 frets (graded tract)", fill=MID, font=F["s"])
d.text((ox + 0.07 * S, oy - 0.96 * S - 10), "pegbox M2 + 4 pegs", fill=MID, font=F["s"])

# ---- Side view: spine horizontal, tail at left; soundboard at top ----
sx, sy, sw, sh = 810, 120, 1380, 520
panel(sx, sy, sw, sh, "SIDE - orthographic", "soundboard line u = 0 at top; flat back; pegbox bent back 65 deg behind the back plane")
S2 = 1220
o2x, o2y = sx + 70, sy + 190
top = [(o2x + x * S2, o2y) for x in xs]
back = [(o2x + x * S2, o2y + 2 * halfdepth(x) * S2) for x in reversed(xs)]
d.polygon(top + back, fill=LIGHT, outline=INK)
n0 = (o2x + 0.89 * S2, o2y)
ex, eu = 0.89 + PEG_LEN * math.cos(BETA), -PEG_LEN * math.sin(BETA)
pbx = [n0, (o2x + ex * S2, o2y - eu * S2), (o2x + (ex - 0.03) * S2, o2y - eu * S2 + 0.012 * S2), (o2x + 0.875 * S2, o2y + 0.04 * S2)]
d.polygon(pbx, fill=PAPER, outline=INK)
for t in PEGS:
    cx, cy = o2x + (0.89 + t * math.cos(BETA) - 0.012) * S2, o2y + (t * math.sin(BETA) + 0.006) * S2
    d.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=PAPER, outline=INK)
for f in FRETS:
    d.rectangle([o2x + f * S2 - 3, o2y - 10, o2x + f * S2 + 3, o2y], fill=PAPER, outline=INK)
d.rectangle([o2x + 0.115 * S2, o2y - 9, o2x + 0.14 * S2, o2y], fill=PAPER, outline=INK)
for k in KEYS:
    d.line([(o2x + k[0] * S2, o2y - 40), (o2x + k[0] * S2, o2y + 70)], fill=ACC, width=1)
    d.text((o2x + k[0] * S2 + 3, o2y - 62), k[4].split()[0], fill=ACC, font=F["s"])
d.text((o2x + 0.92 * S2, o2y + 0.12 * S2), "B junction: nut, reflex mate 65 deg (O3)", fill=MID, font=F["s"])
d.text((o2x + 0.20 * S2, o2y + 0.075 * S2), "body depth 0.052 L (design assumption, not sourced)", fill=MID, font=F["s"])

# ---- End view along the spine (from the pegbox end) ----
ex0, ey0, ew, eh = 2210, 120, 760, 520
panel(ex0, ey0, ew, eh, "END VIEW along the spine", "every keyframe outline at true size, tops aligned (u = 0)")
S3 = 1900
c3x, c3y = ex0 + ew // 2, ey0 + 250
for k in KEYS:
    x, w, hh, prof, name = k
    pts = [(c3x + y * w * S3, c3y + (hh - z * hh) * S3) for y, z in prof]
    d.polygon(pts, outline=INK if "BODY" in name else ACC)
d.text((ex0 + 16, ey0 + 420), "M1 silhouette = K1 section within 0.15 px at 400 px:", fill=INK, font=F["s"])
d.text((ex0 + 16, ey0 + 444), "a single-section view (frozen M3 P7: FAIL, see composition.md)", fill=ACC, font=F["s"])

# ---- Three-quarter sketch ----
tx, ty, tw, th = 810, 660, 1380, 700
panel(tx, ty, tw, th, "THREE-QUARTER sketch (hero direction)", "keyframe rings and profile lines only; a design sketch, not the O1 surface")
az, el = math.radians(35), math.radians(20)


def proj(x, s, u):
    # object: x along spine (up when standing), s across, u toward the viewer
    s2 = s * math.cos(az) + u * math.sin(az)
    u2 = -s * math.sin(az) + u * math.cos(az)
    y = x * math.cos(el) - u2 * math.sin(el)
    return (tx + 690 + s2 * 600, ty + 650 - y * 600)


rings = []
for k in KEYS:
    x, w, hh, prof, _ = k
    rings.append([(x, yv * w, -hh + z * hh) for yv, z in prof])
tail = [(0.0, yv * 0.05, -0.024) for yv in (1, -1)]
hullpts = []
for a, b in zip([tail] + rings, rings):
    pts = [proj(*p) for p in a + b]
    hullpts.append(pts)


def hull2(ps):
    ps = sorted(set(ps))

    def cr(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in ps:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(ps):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


for pts in hullpts:
    d.polygon(hull2(pts), fill=LIGHT)
for pts in hullpts:
    d.polygon(hull2(pts), outline=INK)
for r in rings:
    d.line([proj(*p) for p in r + r[:1]], fill=MID, width=1)
for j in range(len(BODY)):
    d.line([proj(*r[j]) for r in rings], fill=(170, 158, 140), width=1)
nut = (0.89, 0, 0)
dv = (math.cos(BETA), 0, -math.sin(BETA))
for sgn in (1, -1):
    a0 = (0.89, sgn * 0.025, 0)
    a1 = (0.89 + PEG_LEN * dv[0], sgn * 0.020, PEG_LEN * dv[2])
    d.line([proj(*a0), proj(*a1)], fill=INK, width=2)
d.line([proj(0.89 + PEG_LEN * dv[0], -0.02, PEG_LEN * dv[2]), proj(0.89 + PEG_LEN * dv[0], 0.02, PEG_LEN * dv[2])], fill=INK, width=2)
d.text((tx + 20, ty + 650), "hero e_v = 0.25 L (100 px at 400 px): not a single-section view", fill=MID, font=F["s"])

# ---- Section strip ----
qx, qy, qw, qh = 2210, 660, 760, 700
panel(qx, qy, qw, qh, "SECTION STRIP (step 2)", "true size (top) and normalised to [-1,1]^2 (bottom); d = profile distance")
for i, k in enumerate(KEYS):
    x, w, hh, prof, name = k
    cx = qx + 70 + i * 120
    pts = [(cx + yv * w * 300, qy + 140 + (-z) * hh * 300) for yv, z in prof]
    d.polygon(pts, outline=INK)
    d.text((cx - 40, qy + 175), name.split()[0], fill=ACC, font=F["s"])
for i, (prof, name) in enumerate(((BODY, "BODY"), (SHOULDER, "SHOULDER"), (NECK, "NECK"))):
    cx, cy = qx + 130 + i * 240, qy + 360
    d.polygon([(cx + yv * 90, cy - z * 90) for yv, z in prof], outline=INK, fill=LIGHT)
    d.text((cx - 45, cy + 105), name, fill=INK, font=F["s"])
d.text((qx + 20, qy + 500), "d(BODY, SHOULDER) = 0.139 -> 1.33 px at 400 px", fill=INK, font=F["s"])
d.text((qx + 20, qy + 525), "d(SHOULDER, NECK) = 0.100 -> 0.88 px at 400 px", fill=INK, font=F["s"])
d.text((qx + 20, qy + 550), "frozen M3 P1: both below 2 px -> FAIL (composition.md)", fill=ACC, font=F["s"])
d.text((qx + 20, qy + 590), "K0-K2: one function (resonator), same profile,", fill=MID, font=F["s"])
d.text((qx + 20, qy + 612), "aspect-only change: not graded by P1", fill=MID, font=F["s"])

# ---- Pegbox flat pattern (O2) ----
fx, fy, fw, fh = 30, 1380, 760, 690
panel(fx, fy, fw, fh, "PEGBOX M2 flat pattern (O2)", "floor trapezoid + two walls; two creases, valley +90 deg; holes declared")
S4 = 2300
cx, cy = fx + 110, fy + 360
fl = [(cx, cy - 0.025 * S4), (cx + PEG_LEN * S4, cy - 0.020 * S4), (cx + PEG_LEN * S4, cy + 0.020 * S4), (cx, cy + 0.025 * S4)]
d.polygon(fl, fill=LIGHT, outline=INK)
for sgn in (-1, 1):
    a, b = (cx, cy + sgn * 0.025 * S4), (cx + PEG_LEN * S4, cy + sgn * 0.020 * S4)
    wall = [a, b, (b[0], b[1] + sgn * 0.035 * S4), (a[0], a[1] + sgn * 0.035 * S4)]
    d.polygon(wall, fill=PAPER, outline=INK)
    for t in range(0, 40):
        x0 = a[0] + (b[0] - a[0]) * t / 40
        y0 = a[1] + (b[1] - a[1]) * t / 40
        if t % 2 == 0:
            d.line([(x0, y0), (a[0] + (b[0] - a[0]) * (t + 1) / 40, a[1] + (b[1] - a[1]) * (t + 1) / 40)], fill=ACC, width=3)
    for t in PEGS:
        hx = cx + t * S4
        hy = (a[1] + (b[1] - a[1]) * t / PEG_LEN) + sgn * 0.017 * S4
        d.ellipse([hx - 9, hy - 9, hx + 9, hy + 9], fill=INK)
d.text((fx + 20, fy + 560), "red dashes: valley folds +90 deg (declared). Black dots: peg holes,", fill=MID, font=F["s"])
d.text((fx + 20, fy + 582), "which make each wall non-convex: coplanar convex pieces + tessellation", fill=MID, font=F["s"])
d.text((fx + 20, fy + 604), "edges, a 0-degree joint Foldon cannot type today (Q2).", fill=MID, font=F["s"])
d.text((fx + 20, fy + 640), "floor 0.05 -> 0.04 L wide, 0.25 L long; walls 0.035 L (design assumptions)", fill=MID, font=F["s"])

# ---- Silhouettes ----
gx, gy, gw, gh = 810, 1380, 1000, 690
panel(gx, gy, gw, gh, "SILHOUETTES (front view) at 96 / 48 / 24 px", "light and dark fields; signature: pear body, short neck, bent pegbox")
sil = Image.new("L", (400, 1300), 0)
sd = ImageDraw.Draw(sil)
o_x, o_y = 200, 1250
sd.polygon([(o_x + halfwidth(x) * S, o_y - x * S) for x in xs] + [(o_x - halfwidth(x) * S, o_y - x * S) for x in reversed(xs)], fill=255)
sd.polygon([(o_x - 0.025 * S, o_y - 0.89 * S), (o_x + 0.025 * S, o_y - 0.89 * S), (o_x + 0.020 * S, o_y - pe * S), (o_x - 0.020 * S, o_y - pe * S)], fill=255)
for i, t in enumerate(PEGS):
    xx = 0.89 + t * math.cos(BETA)
    sgn = -1 if i % 2 == 0 else 1
    sd.rectangle([o_x + sgn * 0.022 * S - (45 if sgn < 0 else 0), o_y - xx * S - 6, o_x + sgn * 0.022 * S + (45 if sgn > 0 else 0), o_y - xx * S + 6], fill=255)
bbox = sil.getbbox()
sil = sil.crop(bbox)
xpos = gx + 40
for size in (96, 48, 24):
    sc = size / sil.size[1]
    small = sil.resize((max(1, int(sil.size[0] * sc)), size), Image.LANCZOS)
    for j, (bg, fg) in enumerate(((PAPER, INK), (INK, PAPER))):
        tile = Image.new("RGB", (small.size[0] + 30, size + 30), bg)
        tile.paste(Image.new("RGB", small.size, fg), (15, 15), small)
        im.paste(tile, (xpos, gy + 90 + j * 150))
    d.text((xpos, gy + 400), "%d px" % size, fill=MID, font=F["s"])
    xpos += small.size[0] + 90
big = sil.resize((int(sil.size[0] * 420 / sil.size[1]), 420), Image.LANCZOS)
im.paste(Image.new("RGB", big.size, INK), (gx + 640, gy + 90), big)

# ---- Read-out panel ----
rx, ry, rw, rh = 1830, 1380, 1140, 690
panel(rx, ry, rw, rh, "FROZEN M3 + O1-O3 APPLIED (values from composition.md)", "transfer: what applied as written, and where it failed")
lines = [
    ("applied as written", INK), ("  masses, kinds, function program, junctions, envelopes, crease map", MID),
    ("  O1 bands: 21-23 planar faces each (aspect-only bands: 1 trapezoid, 20 triangles)", MID),
    ("  O2 pegbox: 3 convex panels, 2 valley folds; O3 reflex mate puts the end at (0.996, -0.227) L", MID),
    ("failed or not covered", ACC),
    ("  P1 shoulder: 1.33 / 0.88 px < 2 px (shallow mass: section ~10 px at 400 px)", MID),
    ("  P7 end view of M1: 0.15 px, FAIL; same body split at the shoulder: allowed (partition-sensitive)", MID),
    ("  O1 aspect-only bands: 13 of 21 folds below 8 deg -> P4 'lines without form'", MID),
    ("  soundboard camber: centre fold 0.38 deg, next 1.35 deg -> P4 flags; bent panel has no", MID),
    ("     production representation", MID),
    ("  P5: 4 equal pegs flag as a rake; M3 has no clause for equal functional elements", MID),
    ("  O3: a string has two hosts (tailpiece, peg) -> not-a-tree; wedge joint is not an overlap", MID),
    ("  sound holes and peg holes: non-convex panels -> coplanar pieces need a 0-deg joint (Q2)", MID),
    ("not verified", INK), ("  aesthetics, foldability, collision, closure (Q4), pegbox angle and body depth (unsourced)", MID),
]
for i, (t, c) in enumerate(lines):
    d.text((rx + 20, ry + 80 + i * 36), t, fill=c, font=F["b"] if c != MID else F["s"])

d.text((30, 22), "Holdout transfer check - biwa-type lute (short-necked plucked lute)", fill=INK, font=F["t"])
d.text((30, 78), "ORIGINAL DESIGN DRAWING from brief.md numbers - concept only, NOT approved, NOT implemented geometry - no reference image imported or traced - method M3 frozen at 8c2bd53", fill=ACC, font=F["s"])
im.save(sys.argv[1])
