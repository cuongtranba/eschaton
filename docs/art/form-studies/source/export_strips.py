"""Export the section strips declared in each study maquette's spec. DESIGN ARTIFACT ONLY.

Usage: Blender -b --factory-startup --python export_strips.py -- <out.json>
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "raven-concepts", "source")))
import bld  # noqa: E402
import tree  # noqa: E402
import veh  # noqa: E402

out = {}
for key, mod in (("veh", veh), ("bld", bld), ("tree", tree)):
    out[key] = {"before": mod.build_before()[2]["section_strip"], "after": mod.build_after()[2]["section_strip"]}
json.dump(out, open(sys.argv[sys.argv.index("--") + 1], "w"), indent=1)
print("STRIPS", list(out))
