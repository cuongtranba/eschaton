"""Concept-maquette toolkit for Eschaton Raven concept sheets.

DESIGN ARTIFACT ONLY. Builds hand-authored sculpt meshes in Blender so that the
hero view and the orthographic turnaround of each concept are drawn from one
consistent form. It is not a geometry contract, not a fold simulation, and is
not imported by any Eschaton package.
"""
import bpy, bmesh, math, json, os
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

V = Vector


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "Standard"
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    try:
        sc.eevee.use_gtao = False
    except AttributeError:
        pass
    return sc


def material(name, rgb, rough=0.92):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def hexrgb(h):
    h = h.lstrip("#")
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


class Builder:
    """Accumulates faces per named part; part -> one object with one material."""

    def __init__(self):
        self.parts = {}

    def face(self, part, pts):
        self.parts.setdefault(part, []).append([V(p) for p in pts])

    def faces(self, part, polys):
        for p in polys:
            self.face(part, p)

    def mirror(self, src, dst):
        for poly in list(self.parts.get(src, [])):
            self.face(dst, [V((p.x, -p.y, p.z)) for p in reversed(poly)])

    def build(self, mats, transform=Matrix.Identity(4), name="raven"):
        root = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(root)
        for part, polys in self.parts.items():
            me = bpy.data.meshes.new(part)
            bm = bmesh.new()
            for poly in polys:
                vs = [bm.verts.new(transform @ p) for p in poly]
                if len(vs) >= 3:
                    try:
                        bm.faces.new(vs)
                    except ValueError:
                        pass
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
            bm.to_mesh(me)
            bm.free()
            ob = bpy.data.objects.new(part, me)
            ob.parent = root
            key = part.split(".")[0]
            ob.data.materials.append(mats.get(key, mats["default"]))
            bpy.context.scene.collection.objects.link(ob)
        return root


def ring(center, frame, profile, w, h):
    t, s, u = frame
    return [center + s * (py * w) + u * (pz * h) for (py, pz) in profile]


def loft(builder, part, sections, profile, cap_start=True, cap_end=True):
    """sections: list of (center Vector, w, h, up Vector). Frames from tangents."""
    rings = []
    n = len(sections)
    for i, (c, w, h, up) in enumerate(sections):
        a = sections[max(i - 1, 0)][0]
        b = sections[min(i + 1, n - 1)][0]
        t = (b - a).normalized()
        s = up.cross(t).normalized()
        u = t.cross(s).normalized()
        if w < 1e-6 and h < 1e-6:
            rings.append([c] * len(profile))
        else:
            rings.append(ring(c, (t, s, u), profile, w, h))
    m = len(profile)
    for i in range(n - 1):
        r0, r1 = rings[i], rings[i + 1]
        for j in range(m):
            k = (j + 1) % m
            quad = [r0[j], r0[k], r1[k], r1[j]]
            uniq = []
            for q in quad:
                if all((q - e).length > 1e-7 for e in uniq):
                    uniq.append(q)
            if len(uniq) >= 3:
                builder.face(part, uniq)
    if cap_start and (rings[0][0] - rings[0][1]).length > 1e-7:
        builder.face(part, list(reversed(rings[0])))
    if cap_end and (rings[-1][0] - rings[-1][1]).length > 1e-7:
        builder.face(part, rings[-1])
    return rings


def profile_poly(n, top_peak=1.0, belly=1.0, rot=0.0):
    pts = []
    for i in range(n):
        a = rot + 2 * math.pi * i / n
        y, z = math.sin(a), math.cos(a)
        z = z * (top_peak if z > 0 else belly)
        pts.append((y, z))
    return pts


def feather(builder, part, root, d, n, L, wd, spine=0.18, camber=0.0, tipup=0.0,
            tip="point", asym=0.55, rootw=0.45, twist=0.0):
    """A folded vane: two facets meeting at a raised spine (mountain crease).

    root: Vector, d: unit direction in the wing plane, n: plane normal.
    Returns tip point.
    """
    d = d.normalized()
    s = n.cross(d).normalized()
    nn = d.cross(s).normalized()

    def P(t, off):
        z = -camber * math.sin(math.pi * t) + tipup * t * t
        tw = twist * t
        side = s * math.cos(tw) + nn * math.sin(tw)
        return root + d * (L * t) + side * off + nn * (z * L)

    wo, wi = wd * asym, wd * (1 - asym)
    if tip == "point":
        prof = [(0.0, rootw), (0.22, 1.0), (0.72, 0.92), (1.0, 0.0)]
    elif tip == "blunt":
        prof = [(0.0, rootw), (0.2, 1.0), (0.9, 1.0), (1.0, 0.55)]
    elif tip == "round":
        prof = [(0.0, rootw), (0.2, 1.0), (0.78, 0.95), (0.93, 0.6), (1.0, 0.15)]
    else:  # emarginated finger: narrows after mid-length
        prof = [(0.0, rootw), (0.18, 1.0), (0.45, 1.0), (0.6, 0.55), (0.93, 0.5), (1.0, 0.0)]
    spine_h = spine * wd
    shaft = [P(t, 0) + nn * (spine_h * (1 - t) * L / max(L, 1e-6)) for t, _ in prof]
    outer = [P(t, wo * k) for t, k in prof]
    inner = [P(t, -wi * k) for t, k in prof]
    for i in range(len(prof) - 1):
        a = [shaft[i], outer[i], outer[i + 1], shaft[i + 1]]
        b = [shaft[i], shaft[i + 1], inner[i + 1], inner[i]]
        for poly in (a, b):
            uniq = []
            for q in poly:
                if all((q - e).length > 1e-7 for e in uniq):
                    uniq.append(q)
            if len(uniq) >= 3:
                builder.face(part, uniq)
    return P(1.0, 0)


def kite(builder, part, center, d, n, L, wd, rise=0.12, back=0.35):
    """C3 module: a kite plate folded on its long diagonal (valley/mountain spine)."""
    d = d.normalized()
    s = n.cross(d).normalized()
    nn = d.cross(s).normalized()
    a = center - d * (L * back)
    b = center + d * (L * (1 - back))
    m = center
    left = m + s * (wd / 2)
    right = m - s * (wd / 2)
    ridge_a = a + nn * (rise * wd * 0.3)
    ridge_b = b + nn * (rise * wd * 0.3)
    mid = m + nn * (rise * wd)
    builder.face(part, [ridge_a, left, mid])
    builder.face(part, [mid, left, ridge_b])
    builder.face(part, [ridge_a, mid, right])
    builder.face(part, [mid, ridge_b, right])
    return b


# ---------------- scene, cameras, lines ----------------

def setup_world(rgb=(1, 1, 1), strength=0.55):
    w = bpy.data.worlds.new("w")
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (*rgb, 1)
    bg.inputs[1].default_value = strength


def add_sun(direction, energy=3.0, name="sun", angle=0.3):
    l = bpy.data.lights.new(name, "SUN")
    l.energy = energy
    l.angle = angle
    o = bpy.data.objects.new(name, l)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = V(direction).normalized().to_track_quat("Z", "Y").to_euler()
    return o


def camera(name="cam"):
    c = bpy.data.objects.get(name)
    if c:
        return c
    c = bpy.data.objects.new(name, bpy.data.cameras.new(name))
    bpy.context.scene.collection.objects.link(c)
    bpy.context.scene.camera = c
    return c


def aim(cam, target, direction, dist, ortho=None, lens=60, roll_up=V((0, 0, 1))):
    direction = V(direction).normalized()
    cam.location = V(target) + direction * dist
    up = roll_up if abs(direction.dot(roll_up)) < 0.98 else V((1, 0, 0))
    fwd = -direction
    right = fwd.cross(up).normalized()
    upv = right.cross(fwd).normalized()
    m = Matrix((right, upv, -fwd)).transposed()
    cam.rotation_euler = m.to_euler()
    if ortho:
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = ortho
    else:
        cam.data.type = "PERSP"
        cam.data.lens = lens
    cam.data.clip_start = 0.01
    cam.data.clip_end = 100


def freestyle(thickness=1.4, rgb=(0.12, 0.11, 0.1), crease=150.0, taper=False):
    sc = bpy.context.scene
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = "ABSOLUTE"
    sc.render.line_thickness = thickness
    vl = sc.view_layers[0]
    fs = vl.freestyle_settings
    fs.crease_angle = math.radians(crease)
    for ls in list(fs.linesets):
        fs.linesets.remove(ls)
    ls = fs.linesets.new("ink")
    ls.select_by_visibility = True
    ls.visibility = "VISIBLE"
    ls.select_by_edge_types = True
    ls.select_silhouette = True
    ls.select_border = True
    ls.select_crease = True
    ls.select_external_contour = True
    st = ls.linestyle
    st.color = rgb
    st.thickness = thickness
    st.caps = "ROUND"
    if taper and not st.thickness_modifiers:
        mod = st.thickness_modifiers.new("taper", "ALONG_STROKE")
        mod.mapping = "CURVE"
        mod.influence = 0.6
    return ls


def render(path, rx, ry):
    sc = bpy.context.scene
    sc.render.resolution_x = rx
    sc.render.resolution_y = ry
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def project(points):
    sc = bpy.context.scene
    cam = sc.camera
    rx, ry = sc.render.resolution_x, sc.render.resolution_y
    out = {}
    for k, p in points.items():
        co = world_to_camera_view(sc, cam, V(p))
        out[k] = [round(co.x * rx, 1), round((1 - co.y) * ry, 1)]
    return out


def bounds(root):
    pts = []
    for ch in root.children:
        pts += [ch.matrix_world @ v.co for v in ch.data.vertices]
    lo = V((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = V((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def set_materials(root, mat_for_part):
    for ch in root.children:
        ch.data.materials.clear()
        ch.data.materials.append(mat_for_part(ch.name))


def stats(root):
    f = sum(len(ch.data.polygons) for ch in root.children)
    return {"faces": f, "parts": len(root.children)}


def shingle(builder, part, root, d, n, L, wd, rise=0.12):
    """C3 module: a shingle folded on its long axis with a blunt chevron trailing edge."""
    d = d.normalized()
    s = n.cross(d).normalized()
    nn = d.cross(s).normalized()
    h = wd * rise

    def P(t, k):
        return root + d * (L * t) + s * (wd * k)

    spine = [P(0, 0) + nn * h * 0.5, P(0.45, 0) + nn * h, P(0.85, 0) + nn * h * 0.8, P(1.0, 0) + nn * h * 0.4]
    right = [P(0, 0.28), P(0.45, 0.5), P(0.85, 0.5), P(1.0, 0)]
    left = [P(0, -0.28), P(0.45, -0.5), P(0.85, -0.5), P(1.0, 0)]
    for i in range(3):
        builder.face(part, [spine[i], right[i], right[i + 1], spine[i + 1]])
        builder.face(part, [spine[i], spine[i + 1], left[i + 1], left[i]])
    return P(1.0, 0)
