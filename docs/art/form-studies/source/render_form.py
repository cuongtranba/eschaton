"""Render a maquette for a form-method sheet. DESIGN ARTIFACT ONLY.

Usage: Blender -b --factory-startup --python render_form.py -- <module> <out_dir> [declared|legacy] [scale]

- A module whose build() returns a formkit.Model is drawn with declared lines (panel
  boundaries, free boundaries, silhouettes) and smooth shading inside panels.
- "legacy" draws the same Model the way the raven sheets up to B-2 v5 were drawn: flat faces
  and Freestyle lines on every edge sharper than the crease angle. It is the render-parity
  control: the same form under the old drawing.
- A module whose build() returns a kit.Builder (for example c2f5_sumi_flight, B-2 v5) is
  always drawn the legacy way, exactly as raven-concepts/source/render.py draws it.
Light, paper tone and cameras are the ones raven-concepts/source/render.py uses.
"""
import importlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAVEN = os.path.normpath(os.path.join(HERE, "..", "..", "raven-concepts", "source"))
sys.path[:0] = [HERE, RAVEN]
import bpy  # noqa: E402
from mathutils import Vector as V  # noqa: E402

import formkit  # noqa: E402
import kit  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
mod = importlib.import_module(args[0])
out = args[1]
mode = args[2] if len(args) > 2 else "declared"
scale = float(args[3]) if len(args) > 3 else 1.0
os.makedirs(out, exist_ok=True)

kit.reset()
model, landmarks, spec = mod.build()
legacy_builder = isinstance(model, kit.Builder)
if legacy_builder:
    mode = "legacy"

paper = {
    "default": kit.material("paper", kit.hexrgb("#e0d3b8")),
    "body": kit.material("paper", kit.hexrgb("#e0d3b8")),
    "under": kit.material("paper_under", kit.hexrgb("#bfae8e")),
    "accent": kit.material("paper_eye", kit.hexrgb("#3a3530")),
    "glass": kit.material("paper_glass", kit.hexrgb("#8f8576")),
}
if legacy_builder:
    root = model.build({**paper, **{k: paper[v] for k, v in spec["tones"].items()}})
    edge_kinds = {}
else:
    root, edge_kinds = formkit.to_blender(model, paper, spec["tones"], declared=(mode == "declared"))
kit.setup_world((1.0, 0.97, 0.92), 0.42)
for L in (kit.add_sun((0.45, -0.7, 1.0), 2.4, "key"), kit.add_sun((-0.6, 0.8, -0.3), 0.6, "fill", 1.0)):
    L.data.use_shadow = False


def lines_paper():
    if mode == "declared":
        formkit.freestyle_declared(1.25, (0.14, 0.13, 0.12))
    else:
        kit.freestyle(1.25, (0.14, 0.13, 0.12), spec.get("crease", 155))


lines_paper()
cam = kit.camera()
lo, hi = kit.bounds(root)
centre = (lo + hi) / 2
proj = {"bounds": [list(lo), list(hi)], "stats": kit.stats(root), "mode": mode, "views": {}}


def shoot(prefix, names):
    for name in names:
        v = spec["views"][name]
        tgt = V(v.get("target", centre))
        kit.aim(cam, tgt, v["dir"], v.get("dist", 6), v.get("ortho"), v.get("lens", 60), V(v.get("up", (0, 0, 1))))
        rx, ry = v["res"]
        kit.render(os.path.join(out, f"{prefix}-{name}.png"), int(rx * scale), int(ry * scale))
        if prefix == "neutral":
            proj["views"][name] = kit.project(landmarks)


shoot("neutral", spec.get("render_views", list(spec["views"])))
ctx = [o for o in root.children if o.name.split(".")[0] in spec.get("context", [])]
for o in ctx:
    o.hide_render = True
shoot("sil", spec.get("sil_views", []))
for o in ctx:
    o.hide_render = False
with open(os.path.join(out, "projection.json"), "w") as f:
    json.dump(proj, f, indent=1)

if not legacy_builder and mode == "declared":
    diag = formkit.diagnostics(model, hidden=spec.get("hidden_panels", ()))
    diag["series"] = list(model.series.values())
    diag["sections"] = spec.get("sections", {})
    with open(os.path.join(out, "diagnostics.json"), "w") as f:
        json.dump(diag, f, indent=1)
    print("DIAG", json.dumps({k: v for k, v in diag.items() if k not in ("sections", "series")}))


def flat(name, hx):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs[0].default_value = (*kit.hexrgb(hx), 1)
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


if spec.get("ink_views"):
    ink = {"default": kit.material("ink", kit.hexrgb("#2a2825"), 0.7),
           "under": kit.material("ink_under", kit.hexrgb("#1c1b19"), 0.7),
           "accent": kit.material("ink_eye", kit.hexrgb("#0d0c0b"), 0.4),
           "glass": kit.material("ink_glass", kit.hexrgb("#111110"), 0.4)}
    kit.set_materials(root, lambda n: ink.get(spec["tones"].get(n.split(".")[0], "default"), ink["default"]))
    if mode == "declared":
        formkit.freestyle_declared(1.1, (0.80, 0.74, 0.62))
    else:
        kit.freestyle(1.1, (0.80, 0.74, 0.62), spec.get("crease", 155))
    shoot("ink", spec["ink_views"])

if spec.get("hier_views"):
    cls = {1: flat("h1", "#2b2825"), 2: flat("h2", "#9a8f7c"), 3: flat("h3", "#b5462e")}
    hier = spec["hier"]
    kit.set_materials(root, lambda n: cls[hier.get(n.split(".")[0], 1)])
    bpy.context.scene.render.use_freestyle = False
    for o in ctx:
        o.hide_render = True
    shoot("hier", spec["hier_views"])
    for o in ctx:
        o.hide_render = False

if not legacy_builder and mode == "declared" and spec.get("crease_views"):
    white = flat("cm_white", "#f6f1e6")
    kit.set_materials(root, lambda n: white)
    passes = [("tess", None, (0.78, 0.75, 0.70), 0.6, False),
              ("fold", formkit.FOLD, (0.70, 0.16, 0.12), 1.6, False),
              ("hinge", formkit.HINGE, (0.85, 0.45, 0.05), 2.2, False),
              ("seam", formkit.SEAM, (0.12, 0.45, 0.22), 2.0, False),
              ("bound", "none", (0.10, 0.10, 0.10), 1.6, True)]
    tess_marks = {}
    for ob in root.children:
        n = len(ob.data.edges)
        k = edge_kinds.get(ob.name, [None] * n)
        tess_marks[ob.name] = ["tess" if x is None else x for x in k]
    for tag, kind, rgb, th, sil in passes:
        if tag == "tess":
            formkit.set_marks(root, tess_marks, lambda k: k == "tess")
        else:
            formkit.set_marks(root, edge_kinds, lambda k, kind=kind: k == kind)
        ls = formkit.freestyle_declared(th, rgb, silhouette=sil)
        ls.select_edge_mark = tag != "bound"
        shoot(f"crease_{tag}", spec["crease_views"])
print("DONE", proj["stats"], mode)
