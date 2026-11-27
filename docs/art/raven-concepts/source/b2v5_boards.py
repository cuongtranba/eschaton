"""B-2 v5 details board: v3 beside v5 at matched views, v5 close-ups, clay beside ink, silhouettes.

DESIGN ARTIFACT ONLY. Usage: python3 b2v5_boards.py <v3_render_dir> <v5_render_dir> <out_png>
The v3 renders come from the unchanged `c2f_sumi_flight.py`; the v5 renders from `c2f5_sumi_flight.py`.
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
import sheet as S

v3, v5, outp = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 2800, 2200
RED = (140, 52, 36)
FIELD = (222, 210, 186)
DARK = (30, 28, 26)
LIGHT = (232, 220, 196)
cv = S.paper(W, H).convert("RGBA")
d = ImageDraw.Draw(cv)


def r(rd, v):
    return S.load(os.path.join(rd, v + ".png"))


def panel(box, title, im, sub=None, crop=True):
    S.frame(d, box, title, sub)
    x, y, w, h = box
    top = 58 if sub else 40
    S.place(cv, im, (x + 10, y + top, w - 20, h - top - 10), crop=crop)


d.text((40, 26), "Raven Concept B-2 v5 — details, and v3 beside v5", font=ImageFont.truetype(S.SERIF, 46), fill=S.INK)
d.text((42, 84), "Same maquette as Sheet B-2 v5. Left of each pair: B-2 v3 (not approved, ART-D3b). Right: B-2 v5 "
       "(pending owner ART-1). B-2 v4 was reviewed as NEEDS REVISION (packet §7.1).",
       font=ImageFont.truetype(S.SERIF_I, 22), fill=S.MID)
st = "PROPOSED CONCEPT ARTWORK — pending owner ART-1 review · NOT approved · NOT implemented geometry"
d.text((W - 40 - d.textlength(st, font=S.font(18, True)), 30), st, font=S.font(18, True), fill=RED)
prov = "B-2 v5 details · 2026-11-27 · Blender 5.2.1 maquettes c2f_sumi_flight.py (v3) and c2f5_sumi_flight.py (v5) + Pillow (b2v5_boards.py)"
d.text((W - 40 - d.textlength(prov, font=S.font(15)), 58), prov, font=S.font(15), fill=S.MID)
d.line((40, 122, W - 40, 122), fill=S.INK, width=2)

y = 140
d.text((40, y), "BEFORE AND AFTER (v3, then v5). Top, underside and side share orthographic view directions (each scaled "
       "to fit); each hero is its version's own three-quarter camera", font=S.font(20, True), fill=S.INK)
y += 34
pairs = [("neutral-hero", "Hero"), ("neutral-top", "Top"), ("neutral-under", "Underside"), ("neutral-side", "Side")]
pw = (W - 80) // 4
for i, (v, cap) in enumerate(pairs):
    x = 40 + i * pw
    hw = (pw - 16) // 2
    panel((x, y, hw, 470), f"{cap} · v3", r(v3, v))
    panel((x + hw + 6, y, hw, 470), f"{cap} · v5", r(v5, v))
y += 490

d.text((40, y), "B-2 v5 CLOSE-UPS (neutral paper, one key light, renderer lines)", font=S.font(20, True), fill=S.INK)
y += 34
close = [("neutral-hand_near", "Near hand", "inner blades graduate into 4 slotted fingers"),
         ("neutral-hand_far", "Far hand", "fingers fan and curl; each its own width"),
         ("neutral-wrist", "Wrist", "primary-covert leaf bridges arm and hand"),
         ("neutral-section", "Arm, front elevation", "bevelled hem, camber, elbow arch"),
         ("neutral-head", "Head", "B's head profile in the flight axis")]
cw = (W - 80) // 5
for i, (v, cap, sub) in enumerate(close):
    panel((40 + i * cw, y, cw - 8, 460), cap, r(v5, v), sub)
y += 480

d.text((40, y), "CLAY BESIDE INK · SILHOUETTES · WHAT CHANGED", font=S.font(20, True), fill=S.INK)
y += 34
panel((40, y, 520, 640), "v5 neutral clay", r(v5, "neutral-hero"))
ink = r(v5, "ink-hero")
bg = Image.new("RGBA", ink.size, (236, 224, 198, 255))
bg.alpha_composite(ink)
bg.putalpha(ink.getchannel("A").point(lambda a: 255 if a > 8 else 0))
panel((570, y, 520, 640), "v5 ink treatment (form judged in clay)", bg)

sx = 1100
S.frame(d, (sx, y, 760, 640), "Silhouettes at 96 / 48 / 24 px", "hero and underside: v3 light field; v5 light and dark fields")
rows = [(v3, "v3", S.INK, FIELD), (v5, "v5", S.INK, FIELD), (v5, "v5", LIGHT, DARK)]
for row, (rd, lab, fg, fld) in enumerate(rows):
    yc0 = y + 64 + row * 190
    d.rectangle((sx + 10, yc0, sx + 750, yc0 + 180), fill=fld)
    d.text((sx + 18, yc0 + 8), lab, font=S.font(18, True), fill=fg)
    xx = sx + 64
    yc = yc0 + 92
    for v in ("sil-hero", "sil-under"):
        s0, _ = S.silhouette(r(rd, v), fg, fld, (2000, 2000))
        for hpx, wmax in ((96, 150), (48, 75), (24, 38)):
            sc = min(hpx / s0.height, wmax / s0.width)
            t = s0.resize((max(1, int(s0.width * sc)), max(1, int(s0.height * sc))), Image.LANCZOS)
            cv.alpha_composite(t, (xx, yc - t.height // 2))
            xx += t.width + 18
        xx += 20

nx = 1870
S.frame(d, (nx, y, W - 40 - nx, 640), "What changed (author self-assessment, not a verdict)", None)
lines = [
    "Against v3 (D1–D6 of the brief):",
    "D1 rake hand: fingers graduate (P6/P7 longest), fan with",
    "   widening gaps; each has its own width and notch.",
    "D2 hand plate: no plate; inner blades continue the trailing",
    "   edge; under-wing coverts hide the wrist hub from below.",
    "D3 plank arm: broad root tapering to the wrist, S-curved",
    "   trailing edge, cambered covert leaf, bevelled hem, elbow arch.",
    "D4 stray fragment: gone.",
    "D5 cylinder head: B's head profile with fewer rings.",
    "D6 ruff debris: one hackle strip set inside the throat.",
    "Against the v4 review: side view no longer clipped; alula",
    "   removed (it read as a sliver); spines no longer pierce the",
    "   wrist leaf; jaw gap and neck hoop removed; wider tail fan.",
    "Kept from B: pentagonal body and ridge, compact neck,",
    "   heavy bill, keeled three-blade wedge tail.",
    "Not claimed: foldability, collision, thickness, bonds.",
]
yy = y + 46
for ln in lines:
    d.text((nx + 16, yy), ln, font=S.font(16), fill=S.INK)
    yy += 26
cv.crop((0, 0, W, y + 670)).convert("RGB").save(outp, optimize=True)
