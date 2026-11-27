"""B-2 v4 details board: v3 beside v4 at matched views, v4 close-ups, clay beside ink. DESIGN ARTIFACT ONLY.

Usage: python3 b2v4_boards.py <v3_render_dir> <v4_render_dir> <out_png>
The v3 renders come from the unchanged `c2f_sumi_flight.py`; the v4 renders from `c2f4_sumi_flight.py`.
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
import sheet as S

v3, v4, outp = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 2800, 2050
RED = (140, 52, 36)
cv = S.paper(W, H).convert("RGBA")
d = ImageDraw.Draw(cv)


def r(rd, v):
    return S.load(os.path.join(rd, v + ".png"))


def panel(box, title, im, sub=None, crop=True):
    S.frame(d, box, title, sub)
    x, y, w, h = box
    top = 58 if sub else 40
    S.place(cv, im, (x + 10, y + top, w - 20, h - top - 10), crop=crop)


d.text((40, 26), "Raven Concept B-2 v4 — details, and v3 beside v4", font=ImageFont.truetype(S.SERIF, 46), fill=S.INK)
d.text((42, 84), "Same maquette as Sheet B-2 v4. Left of each pair: B-2 v3 (not approved, ART-D3b). Right: B-2 v4 (revision, pending owner ART-1).",
       font=ImageFont.truetype(S.SERIF_I, 22), fill=S.MID)
st = "PROPOSED CONCEPT ARTWORK — pending owner ART-1 review · NOT approved · NOT implemented geometry"
d.text((W - 40 - d.textlength(st, font=S.font(18, True)), 30), st, font=S.font(18, True), fill=RED)
prov = "B-2 v4 details · 2026-11-27 · Blender 5.2.1 maquettes c2f_sumi_flight.py (v3) and c2f4_sumi_flight.py (v4) + Pillow (b2v4_boards.py)"
d.text((W - 40 - d.textlength(prov, font=S.font(15)), 58), prov, font=S.font(15), fill=S.MID)
d.line((40, 122, W - 40, 122), fill=S.INK, width=2)

y = 140
d.text((40, y), "BEFORE AND AFTER AT MATCHED VIEWS (v3, then v4)", font=S.font(20, True), fill=S.INK)
y += 34
pairs = [("neutral-hero", "Hero"), ("neutral-top", "Top"), ("neutral-under", "Underside"), ("neutral-wing", "Arm and hand close-up")]
pw = (W - 80) // 4
for i, (v, cap) in enumerate(pairs):
    x = 40 + i * pw
    hw = (pw - 16) // 2
    panel((x, y, hw, 470), f"{cap} · v3", r(v3, v))
    panel((x + hw + 6, y, hw, 470), f"{cap} · v4", r(v4, v))
y += 490

d.text((40, y), "B-2 v4 CLOSE-UPS (neutral paper, one key light, renderer lines)", font=S.font(20, True), fill=S.INK)
y += 34
close = [("neutral-hand_near", "Near hand", "4 inner blades graduate into 4 slotted fingers; P6/P7 longest"),
         ("neutral-hand_far", "Far hand", "fanned, curled fingers; overlap inner over outer"),
         ("neutral-wrist", "Wrist", "alula + primary-covert leaf bridge arm and hand"),
         ("neutral-section", "Arm, front elevation", "hem at the leading edge; camber; elbow arch"),
         ("neutral-head", "Head", "B's head profile scaled into the flight axis")]
cw = (W - 80) // 5
for i, (v, cap, sub) in enumerate(close):
    panel((40 + i * cw, y, cw - 8, 460), cap, r(v4, v), sub)
y += 480

d.text((40, y), "CLAY BESIDE INK · SILHOUETTES · WHAT CHANGED", font=S.font(20, True), fill=S.INK)
y += 34
panel((40, y, 560, 560), "v4 neutral clay", r(v4, "neutral-hero"))
ink = r(v4, "ink-hero")
bg = Image.new("RGBA", ink.size, (236, 224, 198, 255))
bg.alpha_composite(ink)
bg.putalpha(ink.getchannel("A").point(lambda a: 255 if a > 8 else 0))
panel((610, y, 560, 560), "v4 ink treatment (form judged in clay)", bg)

sx = 1180
S.frame(d, (sx, y, 640, 560), "Silhouettes at 96 / 48 / 24 px", "hero and underside; v3 top row, v4 bottom row")
d.rectangle((sx + 10, y + 60, sx + 630, y + 550), fill=(222, 210, 186))
for row, (rd, lab) in enumerate([(v3, "v3"), (v4, "v4")]):
    xx = sx + 60
    yc = y + 170 + row * 220
    d.text((sx + 18, yc - 10), lab, font=S.font(18, True), fill=S.INK)
    for v in ("sil-hero", "sil-under"):
        s0, _ = S.silhouette(r(rd, v), S.INK, (222, 210, 186), (2000, 2000))
        for hpx, wmax in ((96, 140), (48, 70), (24, 35)):
            sc = min(hpx / s0.height, wmax / s0.width)
            t = s0.resize((max(1, int(s0.width * sc)), max(1, int(s0.height * sc))), Image.LANCZOS)
            cv.alpha_composite(t, (xx, yc - t.height // 2))
            xx += t.width + 16
        xx += 14

nx = 1830
S.frame(d, (nx, y, W - 40 - nx, 560), "What changed (author self-assessment vs brief D1–D6)", None)
lines = [
    "D1 rake hand. Now: fingers graduate (P6/P7 longest), fan with",
    "   unequal gaps, narrow after mid-length, curl and twist.",
    "D2 separate hand plate. Now: no plate; 4 overlapping inner",
    "   blades continue the trailing edge into the fingers.",
    "D3 flat trapezoid arm. Now: hem fold, cambered covert leaf,",
    "   scalloped secondaries; chord taper; elbow arch.",
    "D4 stray fragment. Now: gone with the v3 arm.",
    "D5 cylinder head. Now: B's head profile (dome, nape, brow).",
    "D6 ruff debris. Now: one sleeked hackle strip per side.",
    "Pose: bank 14° to 20°, inner wing flexed, head and tail",
    "   turned into the turn. Faces: about 210 to about 350.",
    "Kept from B: pentagonal body and ridge, compact neck,",
    "   heavy bill, keeled three-blade wedge tail.",
    "Not claimed: foldability, collision, thickness, bonds.",
]
yy = y + 46
for ln in lines:
    d.text((nx + 16, yy), ln, font=S.font(16), fill=S.INK)
    yy += 26
cv.crop((0, 0, W, y + 590)).convert("RGB").save(outp, optimize=True)
