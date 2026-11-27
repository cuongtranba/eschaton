"""Compose one form-study sheet (before and after the method). DESIGN ARTIFACT ONLY.

Usage: python3 study_sheet.py <veh|bld|tree> <before_dir> <after_dir> <observed_png> <out_png> <strips.json>

<strips.json> comes from export_strips.py (the section strips declared in each maquette spec).

<before_dir> and <after_dir> are render_form.py outputs with identical cameras and lights.
<observed_png> is the earlier lab capture on draft PR #11 @ 616b0cf, shown as cited context only.
"""
import json
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.normpath(os.path.join(HERE, "..", "..", "raven-concepts", "source"))]
from sheet import INK, MID, PAPER, SERIF, SERIF_I, font, silhouette  # noqa: E402
from sil_topology import holes  # noqa: E402

RED = (168, 67, 53)
BOX = (150, 140, 122)
BANNER = "CONCEPT DESIGN STUDY — not an ART-1 candidate · not approved · not implemented geometry"

TEXT = {
    "veh": {
        "title": "Form study: vehicle — a small sedan (derivation category)",
        "tag": "The method's procedure applied to a mechanical solid: section program, outline, junctions, envelopes, edges.",
        "observed": ("Observed V3 failure (PR #11 @ 616b0cf, captured at 74c686f)",
                     "plank tub of 12 equal bands, tower cabin, fang grille, wheels outside the body",
                     [(10, 75, 820, 505), (8, 512, 410, 760), (418, 512, 820, 760)]),
        "before": "BEFORE — the failure mechanism rebuilt: one section swept, a box cabin on a slab, wheels outside, equal fang slats, lines by crease angle",
        "after": "AFTER — method steps 1–6: sections change shape, outlines converge, junctions declared, arches as negative space, declared lines",
        "steps": [
            ("1 Landmarks", "axles 0.33 / −0.28 (wheelbase 0.61 L), cowl 0.14, windscreen head 0.02, roof rear −0.17, deck −0.34"),
            ("2 Sections (P1)", "nose low and rounded; at the axles the fender crowns are the peaks; cabin: body tumblehome + glasshouse leaning in"),
            ("3 Outlines (P2)", "bonnet falls to the nose, roof arcs, beltline rises to the tail; plan widest at the axles, glasshouse narrows rearward"),
            ("4 Junctions (P3)", "cowl fold with the raked windscreen as the transitional plane (B); fender crown flows into the beltline (C)"),
            ("5 Envelopes, series (P5, P6)", "four arches with stated clearance and a hem lip; two side windows that differ; three grille bars set by the opening"),
            ("6 Edges (P4)", "folds: shoulders, arch lips, windscreen and roof edges; seams: door cuts and window frames (where Collapse peels)"),
        ],
        "adversarial": "Four identical wheels (V-a): not a tract but one part doing one job at four stations; P5 does not fire, and reuse at the "
                       "level of one concrete definition is justified (method §7.1 c).",
    },
    "bld": {
        "title": "Form study: building — a three-tier tower (HOLDOUT category)",
        "tag": "Not used to derive the method. Designed with the method exactly as committed in 449406b; failures to transfer are findings.",
        "observed": ("Observed V1 house, for context (PR #11, lab capture at 6024a1b, commit 73b612b)",
                     "box walls and roof planes, no overhang, no openings; V1 had no per-object review",
                     [(10, 480, 580, 850)]),
        "before": "BEFORE — the failure mechanism: each tier one box scaled, flat slab roofs with no overhang, equal spacing, decal openings, lines by crease angle",
        "after": "AFTER — method steps 1–6: podium and walls prismatic by declaration; roofs carry the variation; deep eaves; recessed openings",
        "steps": [
            ("1 Landmarks", "podium top 0.10; eaves at 0.33, 0.56 and 0.76; finial tip 1.0; footprint 0.62 H"),
            ("2 Sections (P1)", "walls and podium declared prismatic (adversarial B-a); each roof changes from a steep upper slope to a flared eave"),
            ("3 Outlines (P2)", "stack converges 1.0 / 0.76 / 0.54; eave lines curve up at the corners; walls vertical by declaration"),
            ("4 Junctions (P3)", "wall to roof: a stated overhang (B) whose soffit shadow is designed; top roof runs into the finial (C)"),
            ("5 Envelopes, series (P5, P6)", "openings are recesses with jambs; the tiers are a series with a heavier ground tier and a different top element"),
            ("6 Edges (P4)", "hips, corrugation folds (a declared tessellation, B-b), eave hems, jambs; the finial bands"),
        ],
        "adversarial": "B-a rectangular walls: P1 and P2 do not fire once declared prismatic; the variation moved to the roofs. B-b corrugation: "
                       "P5's rake flags fire by design and are expected. B-c symmetry: the method has no asymmetry rule.",
    },
    "tree": {
        "title": "Form study: tree — a dead tree (HOLDOUT category)",
        "tag": "Not used to derive the method. Designed with the method exactly as committed in 449406b; failures to transfer are findings.",
        "observed": ("Observed V1 pine, for context (PR #11, lab capture at 6024a1b, commit 73b612b)",
                     "identical fan tiers from a fixed list; V1 had no per-object review",
                     [(590, 480, 1160, 850)]),
        "before": "BEFORE — the failure mechanism: a cylinder trunk of one profile, equal sticks at equal angles and heights, butt joints with gaps, lines by crease angle",
        "after": "AFTER — method steps 1–6: root flare to fluted oval to a flattened fork; branches by generation; collared forks; ridges along limbs",
        "steps": [
            ("1 Landmarks", "root flare 0–0.06; fork 0.43; second-generation forks at uneven stations; a broken leader"),
            ("2 Sections (P1)", "lobed buttress flare, fluted oval trunk, flattened in the fork plane below the fork; limbs thinner by generation"),
            ("3 Outlines (P2)", "trunk tapers from the flare to the fork; limbs taper to their tips; the leader ends broken"),
            ("4 Junctions (P3)", "fork: continuous (C), limbs rooted inside the trunk as a collar; no butt joint and no gap"),
            ("5 Envelopes, series (P5, P6)", "gen 1: 2 limbs; gen 2: 5 branches at stations 0.33/0.64/0.86 and 0.42/0.76; gen 3: 3 twigs; sky framed between limbs"),
            ("6 Edges (P4)", "bark ridges run along the limbs, never round them; the buttress valleys stay valleys up the trunk (fluting)"),
        ],
        "adversarial": "T-a irregularity is the subject: the series law holds per generation (length ratio, angle, spacing), not across the whole tree.",
    },
}


def rgba(p):
    return Image.open(p).convert("RGBA")


def on(im, tone=PAPER):
    bg = Image.new("RGBA", im.size, tone + (255,))
    bg.alpha_composite(im)
    return bg


def fit(im, w, h):
    s = min(w / im.width, h / im.height)
    return im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)


def render(path, tone=PAPER, pad=14):
    im = rgba(path)
    bb = im.getchannel("A").getbbox()
    im = im.crop((max(bb[0] - pad, 0), max(bb[1] - pad, 0), min(bb[2] + pad, im.width), min(bb[3] + pad, im.height)))
    return on(im, tone)


def put(cv, im, box, crop=True):
    if crop and im.mode == "RGBA" and im.getchannel("A").getbbox():
        bb = im.getchannel("A").getbbox()
        im = im.crop((max(bb[0] - 10, 0), max(bb[1] - 10, 0), min(bb[2] + 10, im.width), min(bb[3] + 10, im.height)))
    x, y, w, h = box
    t = fit(im, w, h)
    cv.alpha_composite(t if t.mode == "RGBA" else t.convert("RGBA"), (x + (w - t.width) // 2, y + (h - t.height) // 2))


def frame(d, box, title=None, sub=None, col=INK):
    x, y, w, h = box
    d.rectangle((x, y, x + w, y + h), outline=BOX, width=1)
    if title:
        d.text((x + 12, y + 8), title.upper(), font=font(16, True), fill=col)
    if sub:
        d.text((x + 12, y + 30), sub, font=font(13), fill=MID)


def ring_of(h):
    if abs(h[0][0]) < 1e-9 and abs(h[-1][0]) < 1e-9:
        return list(h) + [(-y, z) for y, z in reversed(h[1:-1])]
    return list(h)


def draw_ring(d, cx, cy, ring, size, col, ext=None):
    ys = [p[0] for p in ring]
    zs = [p[1] for p in ring]
    s = size / (ext or max(max(ys) - min(ys), max(zs) - min(zs)))
    my, mz = (max(ys) + min(ys)) / 2, (max(zs) + min(zs)) / 2
    pts = [(cx + (y - my) * s, cy - (z - mz) * s) for y, z in ring]
    d.line(pts + [pts[0]], fill=col, width=2)


def darker(a, b):
    return ImageChops.darker(a.convert("RGB"), b.convert("RGB")).convert("RGBA")


def main():
    key, bd, ad, obs, out, strips = sys.argv[1:7]
    T = TEXT[key]
    W, H = 3000, 2080
    cv = Image.new("RGBA", (W, H), PAPER + (255,))
    d = ImageDraw.Draw(cv)
    d.text((40, 22), T["title"], font=ImageFont.truetype(SERIF, 44), fill=INK)
    d.text((42, 80), T["tag"], font=ImageFont.truetype(SERIF_I, 21), fill=MID)
    d.text((W - 40, 28), BANNER, font=font(18, True), fill=RED, anchor="ra")
    d.text((W - 40, 56), f"form study {key} · 2026-11-27 · Blender 5.2.1 maquettes ({key}.py, formkit, render_form.py) + Pillow (study_sheet.py) · "
           "same cameras and lights before and after", font=font(13, True), fill=MID, anchor="ra")
    d.line((40, 114, W - 40, 114), fill=INK, width=2)
    views = [("three", "Three-quarter"), ("side", "Side"), ("front", "Front"), ("top", "Top")]
    y = 130
    for r, (dirn, label, col) in enumerate(((bd, T["before"], RED), (ad, T["after"], INK))):
        d.text((40, y), label, font=font(16, True), fill=col)
        for i, (v, t) in enumerate(views):
            x = 40 + i * 735
            frame(d, (x, y + 28, 715, 460), t)
            put(cv, render(os.path.join(dirn, f"neutral-{v}.png")), (x + 8, y + 60, 699, 420), crop=False)
        y += 510
    title, sub, boxes = T["observed"]
    frame(d, (40, y, 720, 520), title, sub)
    ob = rgba(obs)
    n = len(boxes)
    for i, b in enumerate(boxes):
        if n == 3:
            box = (50, y + 56, 700, 270) if i == 0 else (50 + (i - 1) * 350, y + 334, 340, 176)
        else:
            box = (50, y + 56, 700, 450)
        put(cv, ob.crop(b), box, crop=False)
    frame(d, (780, y, 720, 520), "Step 2 · section strip (P1)", "before in red (one section, scaled), after in ink (shapes change)")
    bspec = json.load(open(strips))[key]
    allr = [ring_of(h) for _, h in bspec["before"] + bspec["after"]]
    ext = max(max(max(p[0] for p in r) - min(p[0] for p in r), max(p[1] for p in r) - min(p[1] for p in r)) for r in allr)
    for i, (lab, h) in enumerate(bspec["before"][:4]):
        draw_ring(d, 860 + i * 160, y + 150, ring_of(h), 90, RED, ext)
        d.text((860 + i * 160, y + 205), lab, font=font(12), fill=MID, anchor="ma")
    n_after = len(bspec["after"][:7])
    for i, (lab, h) in enumerate(bspec["after"][:7]):
        cx = 830 + i * (660 // max(n_after, 1)) + 20
        draw_ring(d, cx, y + 330, ring_of(h), 90, INK, ext)
        for k, line in enumerate(lab.split(", ")[:2]):
            d.text((cx, y + 400 + k * 18), line, font=font(12), fill=MID, anchor="ma")
    d.text((800, y + 480), "all sections at one common scale", font=font(12), fill=MID)
    frame(d, (1520, y, 700, 520), "Step 6 · crease declaration map (P4), after",
          "red folds · green seams · black boundary and silhouette · pale tessellation, never inked")
    base = None
    bb = rgba(os.path.join(ad, "crease_bound-three.png")).getchannel("A").getbbox()
    bb = (bb[0] - 14, bb[1] - 14, bb[2] + 14, bb[3] + 14)
    for tag in ("tess", "fold", "hinge", "seam", "bound"):
        im = on(rgba(os.path.join(ad, f"crease_{tag}-three.png")), (255, 255, 255)).crop(bb)
        base = im if base is None else darker(base, im)
    put(cv, base, (1530, y + 56, 680, 456), crop=False)
    frame(d, (2240, y, W - 2280, 520), "Silhouettes (P6) and district scale (P9)", "side and three-quarter; before above, after below; 48 and 24 px")
    for r, dirn in enumerate((bd, ad)):
        xs = 2256
        for v in ("side", "three"):
            s, _ = silhouette(rgba(os.path.join(dirn, f"sil-{v}.png")), INK, PAPER, (210, 200))
            cv.paste(s, (xs, y + 60 + r * 225))
            xs += s.width + 16
        for size in (48, 24):
            s, _ = silhouette(rgba(os.path.join(dirn, "sil-three.png")), INK, (222, 210, 186), (size, size))
            cv.paste(s, (xs, y + 120 + r * 225))
            xs += s.width + 14
    y += 540
    frame(d, (40, y, 1700, H - y - 30), "The same procedure, steps 1–6, applied")
    for i, (a, b) in enumerate(T["steps"]):
        d.text((60, y + 46 + i * 34), a, font=font(16, True), fill=INK)
        d.text((330, y + 46 + i * 34), b, font=font(15), fill=INK)
    d.text((60, y + 46 + 6 * 34 + 14), "Adversarial case", font=font(16, True), fill=RED)
    words, line, yy = T["adversarial"].split(), "", y + 46 + 7 * 34 + 10
    for w_ in words:
        if len(line) + len(w_) > 150:
            d.text((60, yy), line, font=font(15), fill=INK)
            yy += 22
            line = ""
        line += w_ + " "
    d.text((60, yy), line, font=font(15), fill=INK)
    frame(d, (1760, y, W - 1800, H - y - 30), "Read-outs (aids, not verdicts)")
    dg = json.load(open(os.path.join(ad, "diagnostics.json")))
    rows = [f"after: {dg['panels']} declared panels, {dg['declared_edges']} declared edges",
            f"declared folds under 8° (lines with almost no form change): {len(dg['declared_folds_below_8_deg'])}",
            f"visible tessellation edges bending over 20° inside a panel: {dg['panel_edges_bending_over_20_deg']} (max {dg['max_panel_bend_deg']}°)",
            f"hidden surfaces ({', '.join(dg['hidden_panels']) or 'none'}): {dg['hidden_panel_edges_bending_over_20_deg']} such edges",
            f"interior vertices with angle defect over 2°: {dg['interior_vertices_defect_over_2_deg']} (max {dg['max_defect_deg']}°)"]
    for lab, dirn in (("before", bd), ("after", ad)):
        res = {v: holes(os.path.join(dirn, f"sil-{v}.png"))["holes"] for v in ("side", "three")}
        rows.append(f"silhouette holes at 400 px, {lab}: " + "; ".join(
            f"{v} {', '.join(str(h['area_px']) for h in hs) or 'none'}" for v, hs in res.items()))
    rows += ["before has no declared panels: it is drawn by crease angle, so these read-outs do not exist for it (F4).",
             "Not claimed: foldability, planarity, collision, closure, thickness, structural support."]
    for i, t in enumerate(rows):
        d.text((1780, y + 46 + i * 30), t, font=font(15), fill=INK)
    cv.convert("RGB").save(out, optimize=True)
    print("SHEET", out)


main()
