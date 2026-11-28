"""Panel-aware maquette toolkit for the form-method studies. DESIGN ARTIFACT ONLY.

It applies the proposed form construction method (docs/art/form-construction-method.md):
faces belong to a part (material) and to a declared panel (one sheet region, flat or
gently bent). Ink is drawn only on panel boundaries (declared folds, hinges, seams), free
boundaries and silhouettes; edges inside a panel are tessellation and carry no line.
Section lofts take a different profile per keyframe (a section program), not one profile
scaled. The read-outs (dihedrals, bend, angle defect, series statistics) are drawing aids,
not GEO-1 evidence. Imported by nothing outside docs/art.
"""
import math
import bmesh
import bpy
from mathutils import Vector as V

import kit

FOLD, HINGE, SEAM = "fold", "hinge", "seam"


class Model:
    """Faces with a part and a panel. Edge kinds between panels default to fold."""

    def __init__(self):
        self.faces = []
        self.kinds = {}
        self.series = {}

    def face(self, part, panel, pts):
        pts = [V(p) for p in pts]
        uniq = []
        for q in pts:
            if all((q - e).length > 1e-7 for e in uniq):
                uniq.append(q)
        if len(uniq) >= 3:
            self.faces.append((part, panel, uniq))

    def kind(self, a, b, k):
        self.kinds[frozenset((a, b))] = k

    def apply(self, M, parts=None):
        self.faces = [(p, n, [M @ q for q in pts]) if parts is None or p.split(".")[0] in parts else (p, n, pts)
                      for p, n, pts in self.faces]


def smooth(x0, x1, k):
    k = 0.5 - 0.5 * math.cos(math.pi * k)
    return x0 + (x1 - x0) * k


def lerp_profile(p0, p1, k):
    return [(smooth(a[0], b[0], k), smooth(a[1], b[1], k)) for a, b in zip(p0, p1)]


def mirror_half(half):
    """half: (top, ..., bottom) for the +y side; returns a closed ring top -> +y side -> bottom -> -y side."""
    right = list(half)
    left = [(-y, z) for y, z in reversed(half[1:-1])]
    return right + left


def _cr(p0, p1, p2, p3, t):
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)


def _flat(k):
    return [k[0], k[1], k[2], k[3]] + [c for pt in k[4] for c in pt]


def program(keys, sub=3):
    """keys: (x, zc, w, h, profile, tag). A segment is a run of keyframe intervals with one tag;
    a tag change is a declared transverse fold. Inside a segment the section program is a
    Catmull-Rom spline, so it bends smoothly and never flattens at its keyframes; across a
    segment boundary the slope may break. Returns stations (x, zc, w, h, ring, tag)."""
    out = []
    i = 0
    n = len(keys)
    while i < n - 1:
        j = i
        while j + 1 < n - 1 and keys[j + 1][5] == keys[i][5]:
            j += 1
        seg = [_flat(k) for k in keys[i:j + 2]]
        tag = keys[i][5]
        ext = [[2 * a - b for a, b in zip(seg[0], seg[1])]] + seg + [[2 * a - b for a, b in zip(seg[-1], seg[-2])]]
        for q in range(len(seg) - 1):
            for s_ in range(sub):
                t = s_ / sub
                vals = [_cr(ext[q][c], ext[q + 1][c], ext[q + 2][c], ext[q + 3][c], t) for c in range(len(seg[0]))]
                ring = [(vals[4 + 2 * r], vals[5 + 2 * r]) for r in range(len(keys[0][4]))]
                out.append((vals[0], vals[1], vals[2], vals[3], ring, tag))
        i = j + 1
    last = keys[-1]
    out.append(last)
    return out, None


def section_loft(m, part, stations, panel_of, up=V((0, 0, 1)), cap_start=None, cap_end=None, xform=None,
                 slice_axis=None):
    """stations: (x, zc, w, h, ring, tag). panel_of(tag, strip) -> panel name. slice_axis, if given,
    fixes every section plane perpendicular to it, so rings cannot cross where the spine bends."""
    rings = []
    pts = [V((x, 0, z)) for x, z, *_ in stations]
    n = len(stations)
    for i, (x, z, w, h, ring, tag) in enumerate(stations):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, n - 1)]
        t = V(slice_axis) if slice_axis else (b - a).normalized()
        s = up.cross(t).normalized()
        u = t.cross(s).normalized()
        r = [pts[i] + s * (py * w) + u * (pz * h) for py, pz in ring]
        rings.append([xform(p) if xform else p for p in r])
    k = len(stations[0][4])
    for i in range(n - 1):
        tag = stations[i][5]
        for j in range(k):
            jj = (j + 1) % k
            q = [rings[i][j], rings[i][jj], rings[i + 1][jj], rings[i + 1][j]]
            pn = panel_of(tag, j)
            m.face(part, pn, [q[0], q[1], q[2]])
            m.face(part, pn, [q[0], q[2], q[3]])
    if cap_start:
        m.face(part, cap_start, list(reversed(rings[0])))
    if cap_end:
        m.face(part, cap_end, rings[-1])
    return rings


def descriptors(ring, w, h):
    """Section shape descriptors (method P1, round 2), in the section's rest frame. ring is in
    profile units and is scaled by (w, h). Aspect is recorded but is not a shape descriptor."""
    pts = [(y * w, z * h) for y, z in ring]
    ys = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    W, Hh = max(ys) - min(ys), max(zs) - min(zs)
    area = 0.0
    for i in range(len(pts)):
        y0, z0 = pts[i]
        y1, z1 = pts[(i + 1) % len(pts)]
        area += y0 * z1 - y1 * z0
    area = abs(area) / 2
    top = max(range(len(pts)), key=lambda i: zs[i])
    widest = max(range(len(pts)), key=lambda i: ys[i])
    lean = math.degrees(math.atan2(ys[widest] - ys[top], zs[top] - zs[widest])) if zs[top] > zs[widest] else 90.0
    return {"aspect_recorded": round(Hh / W, 3), "fill": round(area / (W * Hh), 3),
            "side_lean_deg": round(lean, 1), "shoulder_height": round((zs[widest] - min(zs)) / Hh, 3)}


def series_stats(name, widths, spacings, angles, ends):
    """Coefficients of variation and straight-line fit of ends (method P5)."""
    def cv(xs):
        mu = sum(xs) / len(xs)
        return round((sum((x - mu) ** 2 for x in xs) / len(xs)) ** 0.5 / abs(mu), 3) if mu else 0.0
    steps = [b - a for a, b in zip(angles, angles[1:])]
    xs = [p[0] for p in ends]
    ys = [p[1] for p in ends]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    r2 = round((sxy * sxy) / (sxx * syy), 4) if sxx > 1e-12 and syy > 1e-12 else 1.0
    return {"name": name, "cv_width": cv(widths), "cv_spacing": cv(spacings) if spacings else None,
            "cv_angle_step": cv(steps) if len(steps) > 1 else None, "ends_r2": r2}


def to_blender(m, mats, tones, name="model", declared=True, smooth=None):
    """Build one object per part. declared=True: smooth inside panels, sharp and inked on panel
    boundaries. declared=False: flat faces, no edge marks (the legacy crease-angle drawing)."""
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    parts = {}
    for part, panel, pts in m.faces:
        parts.setdefault(part, []).append((panel, pts))
    edge_kinds = {}
    for part, faces in parts.items():
        bm = bmesh.new()
        lay = bm.faces.layers.int.new("panel")
        ids = {}
        for panel, pts in faces:
            vs = [bm.verts.new(p) for p in pts]
            try:
                f = bm.faces.new(vs)
            except ValueError:
                continue
            f[lay] = ids.setdefault(panel, len(ids))
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        names = {v: k for k, v in ids.items()}
        marks = []
        for e in bm.edges:
            lf = e.link_faces
            k = None
            if len(lf) == 2 and lf[0][lay] != lf[1][lay]:
                pa, pb = names[lf[0][lay]], names[lf[1][lay]]
                k = m.kinds.get(frozenset((pa, pb)), FOLD)
            marks.append(k)
        for f in bm.faces:
            f.smooth = declared if smooth is None else smooth
        me = bpy.data.meshes.new(part)
        bm.to_mesh(me)
        bm.free()
        if declared:
            fe = me.attributes.new("freestyle_edge", "BOOLEAN", "EDGE")
            sh = me.attributes.new("sharp_edge", "BOOLEAN", "EDGE")
            for i, k in enumerate(marks):
                fe.data[i].value = k is not None
                sh.data[i].value = k is not None
        ob = bpy.data.objects.new(part, me)
        ob.parent = root
        key = part.split(".")[0]
        ob.data.materials.append(mats.get(tones.get(key, "body"), mats["default"]))
        bpy.context.scene.collection.objects.link(ob)
        edge_kinds[part] = marks
    return root, edge_kinds


def set_marks(root, edge_kinds, keep):
    """Re-mark freestyle edges: keep(kind) -> bool. Used for the crease-declaration map passes."""
    for ob in root.children:
        marks = edge_kinds.get(ob.name)
        if marks is None:
            continue
        fe = ob.data.attributes.get("freestyle_edge") or ob.data.attributes.new("freestyle_edge", "BOOLEAN", "EDGE")
        for i, k in enumerate(marks):
            fe.data[i].value = bool(keep(k))


def freestyle_declared(thickness=1.25, rgb=(0.14, 0.13, 0.12), silhouette=True):
    sc = bpy.context.scene
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = "ABSOLUTE"
    fs = sc.view_layers[0].freestyle_settings
    for ls in list(fs.linesets):
        fs.linesets.remove(ls)
    ls = fs.linesets.new("ink")
    ls.select_by_visibility = True
    ls.visibility = "VISIBLE"
    ls.select_by_edge_types = True
    ls.select_silhouette = silhouette
    ls.select_border = silhouette
    ls.select_external_contour = silhouette
    ls.select_crease = False
    ls.select_edge_mark = True
    st = ls.linestyle
    st.color = rgb
    st.thickness = thickness
    st.caps = "ROUND"
    return ls


def diagnostics(m, ink_min=8.0, bend_max=20.0, defect_max=2.0, hidden=()):
    """Per-panel read-outs on the maquette (method P4): declared folds (not seams) below ink_min degrees,
    tessellation edges inside a panel bending more than bend_max, interior angle defects."""
    bm = bmesh.new()
    lay = bm.faces.layers.int.new("panel")
    ids = {}
    for part, panel, pts in m.faces:
        vs = [bm.verts.new(p) for p in pts]
        try:
            f = bm.faces.new(vs)
        except ValueError:
            continue
        f[lay] = ids.setdefault(part + "|" + panel, len(ids))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.normal_update()
    names = {v: k for k, v in ids.items()}
    folds, weak, bends, worst_bend, hidden_bends = 0, [], 0, 0.0, 0

    def is_hidden(i):
        return names[i].split("|", 1)[1].startswith(tuple(hidden)) if hidden else False
    for e in bm.edges:
        lf = e.link_faces
        if len(lf) != 2:
            continue
        a = math.degrees(lf[0].normal.angle(lf[1].normal, 0.0))
        a = min(a, 180 - a) if a > 90 else a
        if lf[0][lay] != lf[1][lay]:
            folds += 1
            pa, pb = names[lf[0][lay]].split("|", 1)[1], names[lf[1][lay]].split("|", 1)[1]
            if a < ink_min and m.kinds.get(frozenset((pa, pb)), FOLD) == FOLD:
                weak.append((names[lf[0][lay]], names[lf[1][lay]], round(a, 1)))
        elif is_hidden(lf[0][lay]):
            hidden_bends += a > bend_max
        else:
            worst_bend = max(worst_bend, a)
            if a > bend_max:
                bends += 1
    defects = []
    for v in bm.verts:
        lf = v.link_faces
        if len(lf) < 3 or v.is_boundary or len({f[lay] for f in lf}) != 1 or is_hidden(lf[0][lay]):
            continue
        s = sum(f.calc_center_median() and _corner_angle(f, v) for f in lf)
        d = abs(360 - math.degrees(s))
        if d > defect_max:
            defects.append(round(d, 1))
    bm.free()
    return {"panels": len(ids), "declared_edges": folds, "declared_folds_below_%g_deg" % ink_min: weak,
            "panel_edges_bending_over_%g_deg" % bend_max: bends, "max_panel_bend_deg": round(worst_bend, 1),
            "hidden_panels": list(hidden), "hidden_panel_edges_bending_over_%g_deg" % bend_max: int(hidden_bends),
            "interior_vertices_defect_over_%g_deg" % defect_max: len(defects),
            "max_defect_deg": max(defects) if defects else 0.0}


def _corner_angle(f, v):
    for loop in f.loops:
        if loop.vert == v:
            a = loop.link_loop_prev.vert.co - v.co
            b = loop.link_loop_next.vert.co - v.co
            return a.angle(b, 0.0)
    return 0.0
