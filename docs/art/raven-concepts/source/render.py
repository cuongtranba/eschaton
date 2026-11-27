"""Render one concept maquette: neutral paper views, ink views, landmark projections.

Usage: Blender -b --factory-startup --python render.py -- <concept_module> <out_dir>
DESIGN ARTIFACT ONLY (see kit.py).
"""
import sys, os, json, importlib, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit
from mathutils import Vector as V

args = sys.argv[sys.argv.index("--") + 1:]
mod = importlib.import_module(args[0])
out = args[1]
os.makedirs(out, exist_ok=True)

kit.reset()
b, landmarks, spec = mod.build()

paper = {
    "default": kit.material("paper", kit.hexrgb("#e0d3b8")),
    "body": kit.material("paper", kit.hexrgb("#e0d3b8")),
    "under": kit.material("paper_under", kit.hexrgb("#bfae8e")),
    "accent": kit.material("paper_eye", kit.hexrgb("#3a3530")),
}
root = b.build({**paper, **{k: paper[v] for k, v in spec["tones"].items()}})
kit.setup_world((1.0, 0.97, 0.92), 0.42)
for L in (kit.add_sun((0.45, -0.7, 1.0), 2.4, "key"), kit.add_sun((-0.6, 0.8, -0.3), 0.6, "fill", 1.0)):
    L.data.use_shadow = False
kit.freestyle(1.25, (0.14, 0.13, 0.12), spec.get("crease", 155))
cam = kit.camera()

lo, hi = kit.bounds(root)
centre = (lo + hi) / 2
proj = {"bounds": [list(lo), list(hi)], "stats": kit.stats(root), "views": {}}

for name, v in spec["views"].items():
    tgt = V(v.get("target", centre))
    kit.aim(cam, tgt, v["dir"], v.get("dist", 6), v.get("ortho"), v.get("lens", 60),
            V(v.get("up", (0, 0, 1))))
    rx, ry = v["res"]
    kit.render(os.path.join(out, f"neutral-{name}.png"), rx, ry)
    proj["views"][name] = kit.project(landmarks)

ctx = [o for o in root.children if o.name.split(".")[0] in spec.get("context", [])]
for o in ctx:
    o.hide_render = True
for name in spec.get("sil_views", []):
    v = spec["views"][name]
    tgt = V(v.get("target", centre))
    kit.aim(cam, tgt, v["dir"], v.get("dist", 6), v.get("ortho"), v.get("lens", 60),
            V(v.get("up", (0, 0, 1))))
    rx, ry = v["res"]
    kit.render(os.path.join(out, f"sil-{name}.png"), rx, ry)
for o in ctx:
    o.hide_render = False

ink = {
    "default": kit.material("ink", kit.hexrgb("#2a2825"), 0.7),
    "under": kit.material("ink_under", kit.hexrgb("#1c1b19"), 0.7),
    "accent": kit.material("ink_eye", kit.hexrgb("#0d0c0b"), 0.4),
}
tone_map = {**{k: ink.get(v, ink["default"]) for k, v in spec["tones"].items()}}
kit.set_materials(root, lambda n: tone_map.get(n.split(".")[0], ink["default"]))
kit.freestyle(1.1, (0.80, 0.74, 0.62), spec.get("crease", 155))
for name in spec.get("ink_views", []):
    v = spec["views"][name]
    tgt = V(v.get("target", centre))
    kit.aim(cam, tgt, v["dir"], v.get("dist", 6), v.get("ortho"), v.get("lens", 60),
            V(v.get("up", (0, 0, 1))))
    rx, ry = v["res"]
    kit.render(os.path.join(out, f"ink-{name}.png"), rx, ry)

with open(os.path.join(out, "projection.json"), "w") as f:
    json.dump(proj, f, indent=1)
print("DONE", proj["stats"])

# form-hierarchy diagnostic pass: flat emission tones per class, no lines
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

import bpy
cls = {1: flat("h1", "#2b2825"), 2: flat("h2", "#9a8f7c"), 3: flat("h3", "#b5462e")}
hier = spec["hier"]
kit.set_materials(root, lambda n: cls[hier.get(n.split(".")[0], 1)] if n.split(".")[0] != "under"
                  else cls[hier.get(n.split(".")[1], 2)])
bpy.context.scene.render.use_freestyle = False
for o in ctx:
    o.hide_render = True
for name in spec.get("hier_views", ["hero"]):
    v = spec["views"][name]
    tgt = V(v.get("target", centre))
    kit.aim(cam, tgt, v["dir"], v.get("dist", 6), v.get("ortho"), v.get("lens", 60),
            V(v.get("up", (0, 0, 1))))
    rx, ry = v["res"]
    kit.render(os.path.join(out, f"hier-{name}.png"), rx, ry)
with open(os.path.join(out, "spec.json"), "w") as f:
    json.dump({k: spec[k] for k in spec if k in ("module_counts", "hier")}, f, indent=1)
print("HIER DONE")
