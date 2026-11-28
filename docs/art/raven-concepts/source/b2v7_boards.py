"""Compose the B-2 v7 comparison and method boards. DESIGN ARTIFACT ONLY.

Usage: python3 b2v7_boards.py <v5_dir> <v7_dir> <v7_legacy_dir> <v7_flat_dir> <export.json> <v7_sheet_dir> <out_compare.png> <out_method.png>

All comparison renders use the v7 hero distance (HERO_DIST=4.7), including v5, so the pair stays
matched; the v5 sheet itself was drawn at 4.1. <v7_flat_dir> is v7 in render_form.py "flat" mode.

<v5_dir>, <v7_dir> and <v7_legacy_dir> are render_form.py outputs at scale 2 with identical
cameras, lights and paper (v5 drawn as it always was; v7 with declared lines; v7 with v5's
drawing). Crops use identical pixel boxes in every pair. <v7_sheet_dir> is the scale-1 v7 render
with the crease-declaration passes.
"""
import json
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet import INK, MID, PAPER, SERIF, SERIF_I, font, silhouette  # noqa: E402
from PIL import ImageFont  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..", "..", "form-studies", "source")))
from sil_topology import holes  # noqa: E402

v5d, v6d, v6L, v6F, exp_path, shd, out_cmp, out_met = sys.argv[1:9]
EXP = json.load(open(exp_path))
BANNER = "PROPOSED CONCEPT ARTWORK — pending owner ART-1 review · NOT approved · NOT implemented geometry"
BOX = (150, 140, 122)
RED = (168, 67, 53)


def rgba(path):
    return Image.open(path).convert("RGBA")


def on_paper(im, tone=PAPER):
    bg = Image.new("RGBA", im.size, tone + (255,))
    bg.alpha_composite(im)
    return bg


def fit(im, w, h):
    s = min(w / im.width, h / im.height)
    return im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)


def put(cv, im, box):
    x, y, w, h = box
    t = fit(im, w, h)
    cv.alpha_composite(t, (x + (w - t.width) // 2, y + (h - t.height) // 2))


def frame(d, box, title=None, sub=None):
    x, y, w, h = box
    d.rectangle((x, y, x + w, y + h), outline=BOX, width=1)
    if title:
        d.text((x + 12, y + 8), title.upper(), font=font(17, True), fill=INK)
    if sub:
        d.text((x + 12, y + 30), sub, font=font(14), fill=MID)


def header(d, W, title, tag, prov):
    d.text((40, 22), title, font=ImageFont.truetype(SERIF, 46), fill=INK)
    d.text((42, 82), tag, font=ImageFont.truetype(SERIF_I, 22), fill=MID)
    d.text((W - 40, 28), BANNER, font=font(18, True), fill=RED, anchor="ra")
    d.text((W - 40, 56), prov, font=font(14, True), fill=MID, anchor="ra")
    d.line((40, 118, W - 40, 118), fill=INK, width=2)


def lm(d, view, key):
    p = json.load(open(os.path.join(d, "projection.json")))["views"][view][key]
    return p


def crop(dirn, view, cx, cy, w, h):
    im = rgba(os.path.join(dirn, f"neutral-{view}.png"))
    return on_paper(im.crop((int(cx - w / 2), int(cy - h / 2), int(cx + w / 2), int(cy + h / 2))))


def compare_board():
    W, H = 3000, 3560
    cv = Image.new("RGBA", (W, H), PAPER + (255,))
    d = ImageDraw.Draw(cv)
    header(d, W, "Raven Concept B-2 v7 — v5 beside v7 at the same camera, scale and light",
           "Left of each pair: B-2 v5 (NOT approved, ART-D3b second ruling). Right: B-2 v7 (pending owner ART-1). "
           "Identical cameras, lights, paper tone and render size; crops are identical pixel boxes.",
           "B-2 v7 compare · 2026-11-27 · render_form.py (v5 drawn as before; v7 declared lines) + Pillow (b2v7_boards.py)")
    y = 140
    pw = (W - 80 - 20) // 2
    frame(d, (40, y, pw, 860), "Hero · v5", "banked 20° glide; neutral paper; one key light, one fill")
    frame(d, (60 + pw, y, pw, 860), "Hero · v7", "same camera; lines only on declared folds, seams, boundaries, silhouette")
    put(cv, on_paper(rgba(os.path.join(v5d, "neutral-hero.png"))), (50, y + 52, pw - 20, 800))
    put(cv, on_paper(rgba(os.path.join(v6d, "neutral-hero.png"))), (70 + pw, y + 52, pw - 20, 800))
    y += 880
    qw = (W - 80 - 60) // 4
    for i, (v, t) in enumerate((("top", "Top"), ("under", "Underside"), ("front", "Front (banked)"), ("side", "Side"))):
        row = y if i < 2 else y + 470
        col = (i % 2) * 2
        for j, (dirn, lab) in enumerate(((v5d, "v5"), (v6d, "v7"))):
            x = 40 + (col + j) * (qw + 20)
            frame(d, (x, row, qw, 450), f"{t} · {lab}")
            put(cv, on_paper(rgba(os.path.join(dirn, f"neutral-{v}.png"))), (x + 8, row + 40, qw - 16, 400))
    y += 960
    d.text((40, y), "MATCHED CROPS (IDENTICAL PIXEL BOXES IN BOTH VERSIONS)", font=font(19, True), fill=INK)
    y += 34
    bt = lm(v6d, "top", "bill_tip")
    bu = lm(v6d, "under", "bill_tip")
    tu = lm(v6d, "under", "tail_wedge_tip")
    wr = lm(v6d, "hero", "wrist_L")
    fl = lm(v6d, "hero", "finger_L")
    crops = [("Head from above", "top", bt[0], bt[1] + 120, 300, 300, "compare: transverse bands on the head"),
             ("Head from below", "under", bu[0], bu[1] + 120, 300, 300, "compare: the throat and the bill base"),
             ("Inner arm from above", "top", 1150, 560, 520, 340, "compare: the arm outline from root to wrist"),
             ("Wing root and tail root, below", "under", tu[0], tu[1] - 200, 520, 340, "compare: the junction of wing, body and tail"),
             ("Wrist, hero", "hero", wr[0], wr[1], 560, 420, "compare: slivers and tabs at the wrist"),
             ("Near hand, hero", "hero", (wr[0] + fl[0]) / 2, (wr[1] + fl[1]) / 2, 760, 560, "compare: finger widths, notches and roots")]
    cw = (W - 80 - 5 * 20) // 6
    for i, (t, view, cx, cy, w, h, note) in enumerate(crops):
        x = 40 + i * (cw + 20)
        frame(d, (x, y, cw, 760), t, note)
        for j, dirn in enumerate((v5d, v6d)):
            put(cv, crop(dirn, view, cx, cy, w, h), (x + 8, y + 60 + j * 350, cw - 16, 330))
            d.text((x + 14, y + 64 + j * 350), "v5" if j == 0 else "v7", font=font(16, True), fill=RED if j == 0 else INK)
    y += 780
    frame(d, (40, y, 1420, 560), "Silhouettes · light and dark fields", "hero and underside, v5 above, v7 below; 96 / 48 / 24 px strip at right")
    for j, dirn in enumerate((v5d, v6d)):
        for k, v in enumerate(("hero", "under")):
            for f_, (fg, bg) in enumerate(((INK, PAPER), (PAPER, INK))):
                s, _ = silhouette(rgba(os.path.join(dirn, f"sil-{v}.png")), fg, bg, (200, 200))
                x = 90 + (k * 2 + f_) * 210
                cv.paste(s, (x, y + 60 + j * 245))
        d.text((52, y + 52 + j * 245), "v5" if j == 0 else "v7", font=font(18, True), fill=RED if j == 0 else INK)
        xs = 960 + 10
        for size in (96, 48, 24):
            s, _ = silhouette(rgba(os.path.join(dirn, "sil-under.png")), INK, (222, 210, 186), (size * 2, size))
            cv.paste(s, (xs, y + 100 + j * 245))
            xs += s.width + 30
    frame(d, (1480, y, W - 1520, 560), "Drawing controls for v7",
          "top row: flat faces, a line on every edge sharper than 15° (the v5 way); bottom row: flat faces, declared lines only")
    for k, v in enumerate(("hero", "top", "under", "side")):
        put(cv, on_paper(rgba(os.path.join(v6L, f"neutral-{v}.png"))), (1490 + k * 372, y + 56, 360, 240))
        put(cv, on_paper(rgba(os.path.join(v6F, f"neutral-{v}.png"))), (1490 + k * 372, y + 304, 360, 240))
    y += 580
    notes = ["Honest differences. Cameras, lights, paper tone, render size and crop boxes are identical between v5 and v7 on this board. Stated changes:",
             "the hero camera is 4.7 units from the bird for both versions here (v6 and the v5 sheet used 4.1; v6 cropped its fingertips). v7 draws lines only on declared edges",
             "and shades continuously only inside developable panels (flat across, bent along); v5 drew every edge sharper than 15 degrees on flat faces. The controls show v7 both ways.",
             "The side-view gap between the raised far wing and the near wing is a declared negative space in both versions. Foldability, planarity, collision and the perched-to-flight re-fold are NOT VERIFIED."]
    for i, t in enumerate(notes):
        d.text((40, y + i * 26), t, font=font(17, i == 0), fill=INK if i == 0 else MID)
    cv.convert("RGB").save(out_cmp, optimize=True)


def draw_ring(d, cx, cy, ring, w, h, scale, col, width=2):
    pts = [(cx + py * w * scale, cy - pz * h * scale) for py, pz in ring]
    d.line(pts + [pts[0]], fill=col, width=width)


def method_board():
    W, H = 3000, 1830
    cv = Image.new("RGBA", (W, H), PAPER + (255,))
    d = ImageDraw.Draw(cv)
    header(d, W, "Raven Concept B-2 v7 — the generic method's artefacts, v5 against v7",
           "The same procedure as the vehicle, building and tree studies: section program, outline, junctions, crease map, series, envelopes.",
           "B-2 v7 method board · 2026-11-27 · b2v7_export.py (v5 numbers read from c2f5 source) + formkit read-outs + Pillow")
    y = 140
    frame(d, (40, y, 1440, 520), "Step 2 · section program (P1)", "keyframe sections at landmarks, front to tail, each at its own scale; aspect h/w under each")
    s5, s6 = EXP["v5"]["sections"], EXP["v6"]["sections"]
    d.text((60, y + 70), "v5: one pentagon, scaled", font=font(16, True), fill=RED)
    for i, s in enumerate(s5):
        cx = 120 + i * 135
        draw_ring(d, cx, y + 190, s["ring"], s["w"], s["h"], 520, RED)
        d.text((cx, y + 270), f"{s['aspect_recorded']:.2f}", font=font(14), fill=MID, anchor="ma")
    d.text((60, y + 300), "v7: shapes change at landmarks", font=font(16, True), fill=INK)
    labels = ["bill base", "brow", "brow fold", "crown", "nape fold", "nape", "neck", "breast", "back", "rump", "vent", "tail plate"]
    for i, s in enumerate(s6):
        cx = 110 + i * 118
        draw_ring(d, cx, y + 410, s["ring"], s["w"], s["h"], 520, INK)
        d.text((cx, y + 470), labels[i] if i < len(labels) else "", font=font(13), fill=MID, anchor="ma")
        d.text((cx, y + 490), f"{s['aspect_recorded']:.2f}", font=font(14), fill=MID, anchor="ma")
    frame(d, (1500, y, W - 1540, 520), "Step 3 · outline (P2): top-view silhouettes overlaid",
          "v5 outline in red over v7 filled; same orthographic camera")
    t5 = rgba(os.path.join(v5d, "sil-top.png")).getchannel("A").point(lambda v: 255 if v > 40 else 0)
    t6 = rgba(os.path.join(v6d, "sil-top.png")).getchannel("A").point(lambda v: 255 if v > 40 else 0)
    ov = Image.new("RGBA", t6.size, PAPER + (255,))
    ov.paste(Image.new("RGBA", t6.size, (205, 196, 176, 255)), (0, 0), t6)
    edge = t5.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
    ov.paste(Image.new("RGBA", t6.size, RED + (255,)), (0, 0), edge)
    bb = t6.getbbox()
    put(cv, ov.crop(bb), (1510, y + 56, W - 1560, 380))
    c5, c6 = EXP["v5"]["arm_chord"], EXP["v6"]["arm_chord"]
    d.text((1520, y + 450), f"Arm chord, wrist / root: v5 {c5['wrist']:.3f} / {c5['root']:.3f} = {c5['ratio']:.2f}"
           f"     v7 {c6['wrist']:.3f} / {c6['root']:.3f} = {c6['ratio']:.2f}", font=font(17, True), fill=INK)
    d.text((1520, y + 478), "P2 proposed flag: a ratio between 0.85 and 1.15 over a long run (v5 flagged, v7 not).", font=font(15), fill=MID)
    y += 540
    frame(d, (40, y, 1440, 760), "Step 6 · crease declaration map (P4), v7",
          "red: declared folds · green: seams · black: boundary and silhouette · pale: tessellation (never inked)")
    for k, v in enumerate(("hero", "top")):
        base = None
        for tag in ("tess", "fold", "hinge", "seam", "bound"):
            p = os.path.join(shd, f"crease_{tag}-{v}.png")
            im = on_paper(rgba(p), (255, 255, 255))
            base = im if base is None else _min(base, im)
        put(cv, base, (50 + k * 715, y + 56, 700, 690))
    frame(d, (1500, y, W - 1540, 760), "Step 4 · junctions (P3) and step 5 · envelopes and series (P5, P6)")
    rows = [("Bill to head", "B: bill base sits inside the head shell; gape is a seam, no gap"),
            ("Head to neck", "B: one valley fold at the nape; crown plane meets it"),
            ("Neck to body", "C: section program flows; no ring line"),
            ("Body to wing", "C on top (covert leaf over the back); arm rooted inside the body"),
            ("Arm to hand", "C on the trailing edge; B on the leading edge, bridged by the covert leaf"),
            ("Inner blades to fingers", "C: the trailing line continues into P6"),
            ("Rump to tail", "C: rump is a flat plate; tail roots inside; under-tail covert; tertial fairing")]
    for i, (a, b) in enumerate(rows):
        d.text((1520, y + 52 + i * 34), a, font=font(16, True), fill=INK)
        d.text((1800, y + 52 + i * 34), b, font=font(16), fill=INK)
    f5, f6 = EXP["v5"]["fingers"], EXP["v6"]["fingers"]
    yy = y + 52 + len(rows) * 34 + 20
    d.text((1520, yy), "Series (P5), fingers P6–P9", font=font(16, True), fill=INK)
    lines = [f"width CV: v5 {f5['cv_width']:.2f}, v7 {f6['cv_width']:.2f}  ·  spacing CV: v5 {f5['cv_spacing']:.2f}, v7 {f6['cv_spacing']:.2f}",
             f"notch points, straight-line R² in the wing plane: v5 {f5['ends_r2']:.2f}, v7 {f6['ends_r2']:.2f}. Neither is flagged, yet the v5 reviewer",
             "  saw the v5 notches on one diagonal in the hero view. No working end-alignment read-out exists (method P5, §12);",
             "  the judged-view replacement was withdrawn after review. The reviewer's eye is the check.",
             "Widths: v5 shrink monotonically P6toP9; v7 peak at P7 (P7 widest and longest)."]
    for i, t in enumerate(lines):
        d.text((1520, yy + 28 + i * 24), t, font=font(15), fill=INK)
    yy += 28 + len(lines) * 24 + 18
    d.text((1520, yy), "Envelopes (P6): silhouette holes at 400 px height, area in px", font=font(16, True), fill=INK)
    for i, (lab, dirn) in enumerate((("v5", v5d), ("v7", v6d))):
        res = {v: holes(os.path.join(dirn, f"sil-{v}.png"))["holes"] for v in ("hero", "under", "top", "side")}
        txt = "  ".join(f"{v}: {', '.join(str(h['area_px']) for h in hs) or 'none'}" for v, hs in res.items())
        d.text((1520, yy + 28 + i * 24), f"{lab}  {txt}", font=font(15), fill=INK)
    d.text((1520, yy + 80), "side: the declared gap between the raised far wing and the near wing (both versions)", font=font(14), fill=MID)
    y += 780
    frame(d, (40, y, W - 80, 320), "Read-outs (aids, not verdicts)")
    dg = json.load(open(os.path.join(shd, "diagnostics.json")))
    r = EXP["v6"]["ratios"]
    lines = [f"v7 declared panels {dg['panels']}; declared edges {dg['declared_edges']}; declared folds under 8°: {len(dg['declared_folds_below_8_deg'])} "
             f"(an under-8° fold is a line marking almost no form change; earlier iterations had seven, all fixed or removed)",
             f"Bends inside a panel: max {dg['max_panel_bend_deg']}° across one tessellation edge; {dg['panel_edges_bending_over_20_deg']} edges over 20°. "
             f"Interior vertices with angle defect over 2°: {dg['interior_vertices_defect_over_2_deg']} (max {dg['max_defect_deg']}°):",
             "  the merged crown, throat and belly panels are mildly doubly curved in the maquette; in paper they would need a fold or a curved-crease design. Open, not hidden.",
             f"Measured on the v7 maquette (reported, not fitted): span/L {r['span_L']}, tail/L {r['tail_L']}, bill/L {r['bill_L']}, head:body depth {r['head_body_depth']}.",
             "v5 has no declared panels: it was drawn by crease angle, so these read-outs do not exist for it. That absence is the F4 failure pattern.",
             "Not claimed: foldability, planarity or convexity of any maquette face, collision, closure, thickness, structural support, the perched-to-flight re-fold."]
    for i, t in enumerate(lines):
        d.text((60, y + 50 + i * 40), t, font=font(17), fill=INK)
    cv.convert("RGB").save(out_met, optimize=True)


def _min(a, b):
    return ImageChops.darker(a.convert("RGB"), b.convert("RGB")).convert("RGBA")


compare_board()
method_board()
print("BOARDS", out_cmp, out_met)
