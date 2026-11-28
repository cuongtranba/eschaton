"""Silhouette topology read-out (method P6). DESIGN ARTIFACT ONLY.

Usage: python3 sil_topology.py <render_dir> <view> [<view> ...]

For each sil-<view>.png: crop to the object, scale so the object is 400 px tall (the hero tier),
threshold the alpha, and count the background regions that are enclosed by the object (holes),
with their areas in px at that scale. A hole of 4 px or more (2 x 2 px at 400 px height) is
listed. It is a candidate for a reviewer, not a verdict: a declared negative space (finger slots
that close in a view, a window) is expected.
"""
import json
import sys
from collections import deque

from PIL import Image


def holes(path, height=400, min_area=4):
    im = Image.open(path).convert("RGBA")
    a = im.getchannel("A").point(lambda v: 255 if v > 40 else 0)
    bb = a.getbbox()
    a = a.crop(bb)
    s = height / a.height
    a = a.resize((max(1, int(a.width * s)), height), Image.NEAREST)
    w, h = a.size
    px = a.load()
    seen = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if px[x, y] == 0 and not seen[y][x]:
                seen[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if px[x, y] == 0 and not seen[y][x]:
                seen[y][x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny] == 0:
                seen[ny][nx] = True
                q.append((nx, ny))
    found = []
    for y in range(h):
        for x in range(w):
            if px[x, y] == 0 and not seen[y][x]:
                seen[y][x] = True
                q.append((x, y))
                area, cx, cy = 0, 0, 0
                while q:
                    u, v = q.popleft()
                    area += 1
                    cx += u
                    cy += v
                    for nx, ny in ((u + 1, v), (u - 1, v), (u, v + 1), (u, v - 1)):
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny] == 0:
                            seen[ny][nx] = True
                            q.append((nx, ny))
                if area >= min_area:
                    found.append({"area_px": area, "at": [round(cx / area), round(cy / area)]})
    return {"size": [w, h], "holes": found}


if __name__ == "__main__":
    rd = sys.argv[1]
    print(json.dumps({v: holes(f"{rd}/sil-{v}.png") for v in sys.argv[2:]}, indent=1))
