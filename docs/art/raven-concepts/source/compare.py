"""Comparison board (3 concepts) and V3 failure-anatomy board. DESIGN ARTIFACT ONLY.

Usage: python3 compare.py <v3_screenshot_dir> <out_dir>
"""
import sys, os, textwrap
from PIL import Image, ImageDraw, ImageFont
import sheet as S

v3, out = sys.argv[1], sys.argv[2]
D = os.path.dirname(os.path.abspath(__file__))


def r(c, v):
    return S.load(os.path.join(D, "out", c, v + ".png"))


def head(d, W, title, sub):
    d.text((40, 24), title, font=ImageFont.truetype(S.SERIF, 42), fill=S.INK)
    d.text((42, 78), sub, font=ImageFont.truetype(S.SERIF_I, 21), fill=S.MID)
    st = "PROPOSED — pending owner ART-1 review · NOT approved"
    d.text((W - 40 - d.textlength(st, font=S.font(18, True)), 30), st, font=S.font(18, True), fill=(140, 52, 36))
    d.line((40, 116, W - 40, 116), fill=S.INK, width=2)


# ---------------- comparison board ----------------
W, H = 2800, 1560
cv = S.paper(W, H, 5).convert("RGBA")
d = ImageDraw.Draw(cv)
head(d, W, "Raven concepts A · B (+ B-2 flight) · C — side by side",
     "Same paper, light and line treatment; each row compares one property at identical scale per row.")
cols = [("c1", "A — Anatomical Folded", "glide"), ("c2", "B — Sumi Sculptural", "perched, calling"),
        ("c2f", "B-2 — Sumi, flight study", "banked glide"), ("c3", "C — Modular Tessellated", "upstroke")]
cw = (W - 80 - 200) // 4
rows = [("Hero", 480), ("Ink context", 280), ("Silhouette", 230), ("District 48 / 24 px", 130), ("Hierarchy", 230)]
y = 140
for c_i, (key, name, pose) in enumerate(cols):
    d.text((240 + c_i * cw + 12, y), name.upper(), font=S.font(22, True), fill=S.INK)
    d.text((240 + c_i * cw + 12, y + 30), pose, font=S.font(17), fill=S.MID)
y += 70
for rname, rh in rows:
    d.text((40, y + rh // 2 - 12), rname.upper(), font=S.font(18, True), fill=S.INK)
    for c_i, (key, name, pose) in enumerate(cols):
        bx = 240 + c_i * cw
        box = (bx + 6, y + 6, cw - 12, rh - 12)
        S.frame(d, (bx, y, cw - 4, rh - 4))
        meta = __import__("json").load(open(os.path.join(D, "concepts.json")))[key]
        if rname == "Hero":
            S.place(cv, r(key, "neutral-hero"), box)
        elif rname == "Ink context":
            ink, _ = S.crop_alpha(r(key, "ink-" + meta["ink_view"]), 4)
            sil, _ = S.silhouette(r(key, "neutral-" + meta["flock_view"]), S.INK, (0, 0, 0), (400, 400))
            fl = sil.convert("RGBA")
            fl.putalpha(sil.convert("L").point(lambda v: 255 if v > 0 else 0))
            ctx = S.ink_context(ink, (cw - 24, rh - 24), meta["ink_mode"], flock=fl)
            cv.alpha_composite(ctx, (bx + 8, y + 8))
        elif rname == "Silhouette":
            for k, v in enumerate(meta["sil"]):
                s, _ = S.silhouette(r(key, "sil-" + v), S.INK, S.PAPER, ((cw - 40) // 2, rh - 40))
                cv.alpha_composite(s, (bx + 12 + k * (cw // 2), y + (rh - s.height) // 2))
        elif rname.startswith("District"):
            d.rectangle((bx + 6, y + 6, bx + cw - 10, y + rh - 10), fill=(222, 210, 186))
            s0, _ = S.silhouette(r(key, "sil-" + meta["sil"][0]), S.INK, (222, 210, 186), (2000, 2000))
            xx = bx + 30
            for hpx in (48, 24):
                sc = hpx / s0.height
                t = s0.resize((max(1, int(s0.width * sc)), hpx), Image.LANCZOS)
                cv.alpha_composite(t, (xx, y + rh // 2 - hpx // 2))
                xx += t.width + 50
        else:
            S.place(cv, r(key, "hier-" + meta["hier_view"]), box)
    y += rh
cv.convert("RGB").save(os.path.join(out, "raven-concepts-comparison.png"), optimize=True)

# ---------------- failure anatomy board: V3 pixels vs concepts A and B ----------------
W, H = 2800, 1640
cv = S.paper(W, H, 9).convert("RGBA")
d = ImageDraw.Draw(cv)
head(d, W, "Why V3 failed GEO-2, and what the bible asks for instead",
     "Left: actual V3 lab pixels (PR #11 @ 616b0cf, captured at 74c686f). Middle: Concept A v4. Right: Concept B v4 / B-2 v3. Same question per row.")
study = Image.open(os.path.join(v3, "exp-origami-v3-bird-study.png")).convert("RGBA")
rows3 = [
    ("Head", (830, 76, 1234, 504), ("c1", "neutral-head", True), ("c2", "neutral-head", True),
     "Conical head: the bill runs straight into the crown; no forehead step, no nape.",
     "Steep forehead, nape step, deep arched bill, hanging hackle strip; B keeps the head close on a short neck."),
    ("Wing", (418, 1004, 822, 1232), ("c1", "neutral-wing", True), ("c2f", "neutral-wing", True),
     "Planar rake: equal parallel blades in one plane, no tiers, no camber.",
     "A: three tiers, 4 slotted fingers + short P10 (near hand still rake-like: open). B-2: covert band over a tapered arm; hand plate still reads separate (open)."),
    ("Below", (8, 768, 410, 996), ("c1", "sil-hero", False), ("c2f", "sil-hero", False),
     "Heraldic silhouette: symmetric comb hands, bell tail with teeth.",
     "Silhouette tested in the three-quarter / banked signature view: wedge tail, slotted hand, heavy bill; not a frontal emblem."),
    ("Side", (418, 512, 822, 760), ("c1", "neutral-side", True), ("c2", "neutral-side", True),
     "Plank body and a dashed ridge with no anatomical meaning.",
     "A: neck waist, rounded breast; wing root on the upper flank so nothing rises above the back. B: plump mass, nape fold, keeled wedge tail."),
]
rh = (H - 200) // 4
for i, (name, box, ca, cb, bad, good) in enumerate(rows3):
    y = 136 + i * rh
    d.text((40, y + 14), name.upper(), font=S.font(22, True), fill=S.INK)
    for k, (bx, bw) in enumerate([(180, 520), (720, 640), (1380, 640)]):
        S.frame(d, (bx, y, bw, rh - 12))
        if k == 0:
            cimg = study.crop(box)
            s = min((bw - 20) / cimg.width, (rh - 34) / cimg.height)
            cimg = cimg.resize((int(cimg.width * s), int(cimg.height * s)), Image.LANCZOS)
            cv.alpha_composite(cimg, (bx + (bw - cimg.width) // 2, y + 10))
        else:
            key, view, _ = ca if k == 1 else cb
            src = r(key, view)
            if view.startswith("sil-"):
                src, _ = S.silhouette(src, S.INK, S.PAPER, (bw - 30, rh - 40))
                cv.alpha_composite(src, (bx + (bw - src.width) // 2, y + (rh - 12 - src.height) // 2))
            else:
                S.place(cv, src, (bx + 8, y + 8, bw - 16, rh - 28))
    d.text((2040, y + 10), "V3: FAIL (independent GEO-2 review)", font=S.font(16, True), fill=(140, 52, 36))
    yy = y + 36
    for line in textwrap.wrap(bad, 52):
        d.text((2040, yy), line, font=S.font(16), fill=S.INK); yy += 22
    d.text((2040, yy + 8), "A / B (proposed; not approved)", font=S.font(16, True), fill=S.INK)
    yy += 34
    for line in textwrap.wrap(good, 52):
        d.text((2040, yy), line, font=S.font(16), fill=S.INK); yy += 22
for x, t in [(180, "V3 (actual pixels)"), (720, "Concept A v2"), (1380, "Concept B v2 / B-2")]:
    d.text((x, 118 - 0), "", font=S.font(14), fill=S.MID)
d.text((40, H - 46), "Columns: V3 (actual pixels) · Concept A v4 · Concept B v4 / B-2 v3. Defects as named by the independent GEO-2 reviewer "
       "(V3 gate evidence). Material, light and framing differ between columns: compare form, not rendering.", font=S.font(15), fill=S.MID)
cv.convert("RGB").save(os.path.join(out, "v3-failure-anatomy.png"), optimize=True)
print("ok")
