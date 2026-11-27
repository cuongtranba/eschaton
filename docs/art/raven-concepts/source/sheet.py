"""Compose a Raven concept sheet from maquette renders. DESIGN ARTIFACT ONLY.

Usage: python3 sheet.py <concept_key> <render_dir> <out_png>
"""
import sys, json, math, os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

PAPER = (239, 229, 207)
INK = (33, 31, 29)
MID = (120, 111, 98)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
SERIF_I = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"


def font(size, bold=False):
    return ImageFont.truetype(FONT, size, index=2 if bold else 0)


def paper(w, h, seed=7, tone=PAPER, grain=False):
    im = Image.new("RGB", (w, h), tone)
    if not grain:
        return im
    noise = Image.effect_noise((w // 2, h // 2), 18).resize((w, h)).filter(ImageFilter.GaussianBlur(0.8))
    grain = Image.merge("RGB", [noise] * 3)
    im = ImageChops.add(im, grain, scale=1.0, offset=-128)
    im = Image.blend(Image.new("RGB", (w, h), tone), im, 0.35)
    return im


def load(path):
    return Image.open(path).convert("RGBA")


def crop_alpha(im, pad=12):
    bb = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    x0, y0, x1, y1 = bb
    x0, y0 = max(x0 - pad, 0), max(y0 - pad, 0)
    x1, y1 = min(x1 + pad, im.width), min(y1 + pad, im.height)
    return im.crop((x0, y0, x1, y1)), (x0, y0)


def place(canvas, im, box, align="center", crop=True, lm=None):
    """Fit im into box; returns mapping fn for render-space points."""
    x, y, w, h = box
    off = (0, 0)
    if crop:
        im, off = crop_alpha(im)
    s = min(w / im.width, h / im.height)
    t = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    ox = x + (w - t.width) // 2
    oy = y + (h - t.height) // 2
    canvas.alpha_composite(t, (ox, oy))

    def m(p):
        return (ox + (p[0] - off[0]) * s, oy + (p[1] - off[1]) * s)
    return m


def frame(d, box, title=None, sub=None):
    x, y, w, h = box
    d.rectangle((x, y, x + w, y + h), outline=(150, 140, 122), width=1)
    if title:
        d.text((x + 12, y + 8), title.upper(), font=font(17, True), fill=INK)
    if sub:
        d.text((x + 12, y + 30), sub, font=font(15), fill=MID)


def silhouette(im, fg, bg, size):
    im, _ = crop_alpha(im, 20)
    a = im.getchannel("A").point(lambda v: 255 if v > 40 else 0)
    out = Image.new("RGBA", im.size, bg + (255,))
    out.paste(Image.new("RGBA", im.size, fg + (255,)), (0, 0), a)
    s = min(size[0] / im.width, size[1] / im.height)
    return out.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS), a


def label_points(d, mapping, lms, names, box, centre):
    x0, y0, w, h = box
    placed = []
    for key, text in names.items():
        if key not in lms:
            continue
        px, py = mapping(lms[key])
        if not (x0 < px < x0 + w and y0 < py < y0 + h):
            continue
        dx, dy = px - centre[0], py - centre[1]
        n = math.hypot(dx, dy) or 1
        lx, ly = px + dx / n * 110, py + dy / n * 80
        tw = d.textlength(text, font=font(16))
        lx = min(max(lx, x0 + 10), x0 + w - tw - 14)
        ly = min(max(ly, y0 + 56), y0 + h - 26)
        for (qx, qy) in placed:
            if abs(qy - ly) < 24 and abs(qx - lx) < 220:
                ly = qy + 26 if ly >= qy else qy - 26
        placed.append((lx, ly))
        ax = lx if lx > px else lx + tw
        d.line((px, py, ax, ly + 10), fill=(60, 56, 50), width=1)
        d.ellipse((px - 3.5, py - 3.5, px + 3.5, py + 3.5), outline=(60, 56, 50), fill=PAPER, width=2)
        d.rounded_rectangle((lx - 5, ly - 1, lx + tw + 5, ly + 22), 4, fill=(244, 236, 218))
        d.text((lx, ly), text, font=font(16), fill=INK)


def hatch(d, box, spacing, angle=0, width=1, fill=INK, rnd=None, jitter=0.0):
    x, y, w, h = box
    rnd = rnd or random.Random(3)
    if angle == 0:
        yy = y
        while yy < y + h:
            xs = x + rnd.random() * jitter * w
            d.line((xs, yy, x + w - rnd.random() * jitter * w, yy), fill=fill, width=width)
            yy += spacing
    else:
        k = math.tan(math.radians(angle))
        for i in range(int(-h * abs(k)) - 10, int(w) + 10, spacing):
            d.line((x + i, y + h, x + i + h * k, y), fill=fill, width=width)


def ink_context(raven, size, mode, seed=11, flock=None, scale=0.62, left=0.36):
    W, H = size
    rnd = random.Random(seed)
    im = paper(W, H, seed, (236, 224, 198)).convert("RGBA")
    d = ImageDraw.Draw(im)
    # woodcut sky: horizontal gouge lines, denser toward the top
    for yy in range(0, int(H * 0.62), 5):
        dens = 1 - yy / (H * 0.62)
        if rnd.random() < 0.25 + 0.7 * dens:
            x0 = rnd.randint(-40, int(W * 0.5))
            x1 = x0 + rnd.randint(int(W * 0.2), int(W * 0.9))
            d.line((x0, yy, x1, yy), fill=(40, 37, 34, int(90 + 140 * dens)), width=1 + (dens > 0.6))
    # sun disc with rays (cream, carved out of the sky)
    cx, cy, r = int(W * (0.36 if mode == "perch" else 0.3)), int(H * 0.3), int(H * 0.15)
    for k in range(72):
        a = 2 * math.pi * k / 72 + rnd.random() * 0.03
        L = r * (1.5 + 0.6 * rnd.random())
        d.line((cx + math.cos(a) * r * 1.05, cy + math.sin(a) * r * 1.05,
                cx + math.cos(a) * L, cy + math.sin(a) * L), fill=(45, 42, 38, 170), width=1)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(240, 230, 206, 255), outline=INK + (255,), width=2)
    # distant mountains: hatched cones
    base = int(H * 0.64)
    for mx, mh, mw in [(0.55, 0.16, 0.16), (0.7, 0.22, 0.2), (0.86, 0.14, 0.14), (0.12, 0.1, 0.12)]:
        px, ph, pw = W * mx, H * mh, W * mw
        poly = [(px - pw, base), (px, base - ph), (px + pw, base)]
        d.polygon(poly, fill=(160, 150, 134, 255))
        for i in range(0, int(pw), 6):
            d.line((px + i * 0.2, base - ph + i * ph / pw, px + i, base), fill=(60, 56, 50, 200), width=1)
        d.line(poly[:2], fill=INK, width=2)
    # ruined towers and a broken roofline (charcoal)
    for tx, tw, th, br in [(0.03, 0.06, 0.42, 0.05), (0.1, 0.04, 0.3, 0.03), (0.15, 0.05, 0.5, 0.06),
                           (0.88, 0.05, 0.28, 0.03), (0.94, 0.04, 0.36, 0.05)]:
        x0, x1 = W * tx, W * (tx + tw)
        top = base - H * th
        d.polygon([(x0, base + 30), (x0, top + H * br), (x0 + (x1 - x0) * 0.4, top), (x1, top + H * br * 0.5),
                   (x1, base + 30)], fill=(38, 35, 32, 255))
        for yy in range(int(top + 20), base, 14):
            d.line((x0 + 4, yy, x1 - 4, yy), fill=(90, 84, 75, 255), width=1)
    # ground: inked plane with carved flow lines
    d.rectangle((0, base, W, H), fill=(52, 48, 44, 255))
    for k in range(26):
        yy = base + 8 + k * (H - base) / 26
        x0 = rnd.randint(-80, W // 2)
        d.line((x0, yy, x0 + rnd.randint(W // 5, W), yy + rnd.randint(-6, 6)), fill=(170, 158, 138, 255), width=1)
    if mode == "perch":
        sil = raven
        s = H * 0.98 / sil.height
        t = sil.resize((int(sil.width * s), int(sil.height * s)), Image.LANCZOS)
        im.alpha_composite(t, (int(W * 0.98 - t.width), int(H - t.height + H * 0.06)))
    else:
        s = W * scale / raven.width
        t = raven.resize((int(raven.width * s), int(raven.height * s)), Image.LANCZOS)
        im.alpha_composite(t, (int(W * left), int(H * 0.06)))
    if flock is not None:
        for (fx, fy, fh) in [(0.62, 0.52, 22), (0.7, 0.47, 16), (0.12, 0.2, 18)] if mode == "perch" else \
                [(0.12, 0.62, 20), (0.2, 0.56, 14), (0.06, 0.5, 11)]:
            s = fh / flock.height
            t = flock.resize((max(1, int(flock.width * s)), fh), Image.LANCZOS)
            im.alpha_composite(t, (int(W * fx), int(H * fy)))
    d.rectangle((0, 0, W - 1, H - 1), outline=INK, width=3)
    return im


def main():
    key, rd, outp = sys.argv[1], sys.argv[2], sys.argv[3]
    meta = json.load(open(os.path.join(os.path.dirname(__file__), "concepts.json")))[key]
    proj = json.load(open(os.path.join(rd, "projection.json")))
    W, H = 2800, 2050
    cv = paper(W, H).convert("RGBA")
    d = ImageDraw.Draw(cv)
    # header
    d.text((40, 26), meta["title"], font=ImageFont.truetype(SERIF, 46), fill=INK)
    d.text((42, 84), meta["tagline"], font=ImageFont.truetype(SERIF_I, 22), fill=MID)
    status = "PROPOSED CONCEPT ARTWORK — pending owner ART-1 review · NOT approved · NOT implemented geometry"
    d.text((W - 40 - d.textlength(status, font=font(18, True)), 30), status, font=font(18, True), fill=(140, 52, 36))
    prov = meta["provenance"]
    d.text((W - 40 - d.textlength(prov, font=font(15)), 58), prov, font=font(15), fill=MID)
    d.line((40, 122, W - 40, 122), fill=INK, width=2)

    # hero
    hb = (40, 140, 1460, 1000)
    frame(d, hb, "Hero · three-quarter", meta["hero_sub"])
    hero = load(os.path.join(rd, "neutral-hero.png"))
    m = place(cv, hero, (hb[0] + 20, hb[1] + 60, hb[2] - 40, hb[3] - 80))
    label_points(d, m, proj["views"]["hero"], meta["labels"], hb, (hb[0] + hb[2] / 2, hb[1] + hb[3] / 2))

    # turnaround
    tx, ty, tw, th = 1520, 140, 1240, 1000
    names = meta["turn"]
    cw, ch = tw // 2, th // 2
    for i, (v, cap) in enumerate(names):
        bx, by = tx + (i % 2) * cw, ty + (i // 2) * ch
        frame(d, (bx, by, cw - 10, ch - 10), cap, None)
        place(cv, load(os.path.join(rd, f"neutral-{v}.png")), (bx + 20, by + 44, cw - 50, ch - 66))
    d.text((tx, ty + th + 4), "Orthographic turnaround from the same maquette as the hero (consistent by construction); "
           "front / side / top / " + meta["fourth"] + ".", font=font(14), fill=MID)

    # close-ups
    cy0 = 1170
    for i, (v, cap) in enumerate(meta["close"]):
        bx = 40 + i * 470
        frame(d, (bx, cy0, 460, 400), cap, None)
        place(cv, load(os.path.join(rd, f"neutral-{v}.png")), (bx + 6, cy0 + 40, 448, 354), crop=False)

    # hierarchy diagnostic
    hx = 40 + 3 * 470
    frame(d, (hx, cy0, 460, 400), "Form hierarchy (diagnostic)", None)
    place(cv, load(os.path.join(rd, f"hier-{meta['hier_view']}.png")), (hx + 16, cy0 + 44, 428, 270))
    for j, (sw, txt) in enumerate([((43, 40, 37), "1 core mass"), ((154, 143, 124), "2 limb tracts"),
                                   ((181, 70, 46), "3 accents")]):
        yy = cy0 + 322 + j * 24
        d.rectangle((hx + 16, yy + 3, hx + 32, yy + 17), fill=sw)
        d.text((hx + 40, yy), txt + " — " + meta["hier_text"][j], font=font(15), fill=INK)

    # ink contextual study
    ix, iw = 1940, 820
    frame(d, (ix, cy0, iw, 400), "Ink / woodcut context study", None)
    ink_main = load(os.path.join(rd, f"ink-{meta['ink_view']}.png"))
    ink_main, _ = crop_alpha(ink_main, 4)
    flock_src, _ = silhouette(load(os.path.join(rd, f"neutral-{meta['flock_view']}.png")), INK, (0, 0, 0), (400, 400))
    fl = flock_src.convert("RGBA")
    fl.putalpha(flock_src.convert("L").point(lambda v: 255 if v > 0 else 0))
    ctx = ink_context(ink_main, (iw - 20, 340), meta["ink_mode"], flock=fl,
                      scale=meta.get("ink_scale", 0.62), left=meta.get("ink_left", 0.36))
    cv.alpha_composite(ctx, (ix + 10, cy0 + 48))

    # silhouettes: light and dark fields, plus district scale
    sy = 1600
    frame(d, (40, sy, 1180, 410), "Silhouette — light and dark fields", "fill only; no interior lines; context props hidden")
    for i, (v, fg, bg) in enumerate([(meta["sil"][0], INK, PAPER), (meta["sil"][1], INK, PAPER),
                                     (meta["sil"][0], (232, 220, 196), (30, 28, 26)),
                                     (meta["sil"][1], (232, 220, 196), (30, 28, 26))]):
        s, _ = silhouette(load(os.path.join(rd, f"sil-{v}.png")), fg, bg, (270, 300))
        bx = 52 + i * 290
        d.rectangle((bx, sy + 60, bx + 280, sy + 395), fill=bg)
        cv.alpha_composite(s, (bx + (280 - s.width) // 2, sy + 60 + (335 - s.height) // 2))

    frame(d, (1240, sy, 680, 410), "District-scale readability",
          "both silhouettes at 96 / 48 / 24 / 12 px height (wide ones capped by width); context hidden")
    d.rectangle((1252, sy + 60, 1908, sy + 395), fill=(222, 210, 186))
    for row, v in enumerate(meta["sil"][:2]):
        s0, _ = silhouette(load(os.path.join(rd, f"sil-{v}.png")), INK, (222, 210, 186), (2000, 2000))
        xx = 1270
        yc = sy + 135 + row * 160
        for hpx, wmax in ((96, 230), (48, 115), (24, 58), (12, 29)):
            sc = hpx / s0.height
            t = s0.resize((max(1, int(s0.width * sc)), hpx), Image.LANCZOS)
            if t.width > wmax:
                sc = wmax / s0.width
                t = s0.resize((wmax, max(1, int(s0.height * sc))), Image.LANCZOS)
            cv.alpha_composite(t, (xx, yc - t.height // 2))
            d.text((xx, yc + 52), f"{t.height}px", font=font(13), fill=MID)
            xx += t.width + 30

    # notes
    nx = 1940
    frame(d, (nx, sy, 820, 410), "Design intent", None)
    yy = sy + 44
    for line in meta["notes"]:
        d.text((nx + 16, yy), line, font=font(16), fill=INK)
        yy += 25
    cv.convert("RGB").save(outp, optimize=True)


if __name__ == "__main__":
    main()
