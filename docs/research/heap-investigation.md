# Studio JS heap growth across reset cycles (C-T2)

Status: **root cause found in our code and fixed.** The growth reported in the original Phase 0 benchmark report §4 (`benchmarks/phase-0-2026-11-24.md` at commit `4cecd5b`, since replaced; 12.1 → 24.9 MB over 20 reset cycles) is a real retention bug in `labRenderer.ts`, not a three.js cache or a measurement artefact. After the fix the heap plateaus. Confidence: high for the root cause (verified three ways, below); medium for the residual ~12 KB/cycle drift, which is not visible in heap snapshots.

## Summary

- **Symptom.** `renderer.info` geometries/textures and the instance count returned to baseline every cycle, but the JS heap kept rising ~0.64 MB per reset cycle in the benchmark (single `gc()` method; 0.12 MB/cycle with six CDP collections).
- **Cause.** `disposeContent()` disposed each `InstancedMesh` (`mesh.dispose()`, which dispatches the object's `dispose` event) but only disposed the *geometry* of the six `LineSegments` objects (edges, crease edges, crease axes, grid, footprint, sockets). three.js (r187) keeps one `RenderObject` per drawn object in `RenderObjects`' chain map, keyed by `[object, material, renderContext, lightsNode]`. The last key, the renderer's long-lived `LightsNode`, is a `WeakMap` key, so the entry (an ephemeron) lives as long as the renderer. A `RenderObject` is removed only when its object, material or lights node fires `dispose`. The line materials are shared by every content build and never disposed, and the lines never fired `dispose`, so every drawn `LineSegments` kept its `RenderObject` (`RenderObject.object` → `LineSegments` → `.parent` → the disposed `Group` → all of its meshes, geometries, typed arrays and Vector3/Matrix4/Quaternion members).
- **Why `renderer.info` did not show it.** `info.memory.geometries` counts GPU-side geometry records, and those were released by `geometry.dispose()`. The JS wrappers were still reachable.
- **Fix.** One line in `disposeContent()`: call `line.dispose()` on each `LineSegments` before its geometry. See "Fix" below.
- **Regression test.** `apps/studio/e2e/heap.spec.ts` fails without the fix (2.86 MB growth over 20 cycles against a 1.25 MB bound) and passes with it.

## Environment

| | |
|---|---|
| OS | Ubuntu 22.04.5 on WSL2, Linux 6.18.58.1-microsoft-standard-WSL2, 8 logical cores, 20 GB RAM |
| Browser | Playwright-managed headless Chromium 159.0.8154.6 (software WebGL2; no physical GPU) |
| three.js / Playwright / Vite / React | 0.187.0 / 1.65.1 / 8.3.8 / 19.3.1 (`StrictMode` on) |
| Builds measured | production minified (`vite build` + `vite preview`), production unminified (`vite build --minify false`, so constructor names survive in snapshots), and the dev server (`vite`) |
| Scenario | Studio at `/?continuous=1`, 1440×860. One *reset cycle* = select "Reference composition", then select "Pitched-roof house" (content is disposed and rebuilt twice), exactly as in `apps/studio/bench/studio.spec.ts` |

## Method

1. Build the bundle outside tracked paths (`pnpm exec vite build --outDir /tmp/eschaton-heap/dist`) and serve it with `vite preview --port 5185`; never touch `dist/` or benchmark outputs.
2. `measure.mjs` (below) drives the cycles through the real UI, forces GC via CDP (`HeapProfiler.collectGarbage` ×6), reads `Runtime.getHeapUsage`, and writes `.heapsnapshot` files with `HeapProfiler.takeHeapSnapshot` at chosen cycles. With `METHOD=bench WARM=1` it instead reproduces the original benchmark's measurement (a single `gc()` plus `performance.memory.usedJSHeapSize`, after visiting four scenes first).
3. `analyze.mjs` aggregates two snapshots by node type and constructor name and prints count and self-size deltas. `retain.mjs` finds the shortest strong retainer path (weak and shortcut edges excluded) from the GC roots to every node of a constructor and groups the paths. `renderobjects.mjs` counts what `RenderObject.object` points to.
4. The same flow was repeated on the fixed code.

Commands (run from a scratch directory outside the repo; `measure.mjs` resolves Playwright from `apps/studio`):

```sh
cd apps/studio
pnpm exec vite build --minify false --outDir /tmp/eschaton-heap/dist-nomin --emptyOutDir
pnpm exec vite preview --outDir /tmp/eschaton-heap/dist-nomin --port 5186 --strictPort &   # note the PID; stop only that PID
cd /tmp/eschaton-heap
node measure.mjs http://localhost:5186 30 "10,30" nomin          # per-cycle heap + snapshots at cycles 10 and 30
METHOD=bench WARM=1 node measure.mjs http://localhost:5186 20 "" bench   # original benchmark's method
node analyze.mjs nomin-c10.heapsnapshot nomin-c30.heapsnapshot 22
node retain.mjs nomin-c30.heapsnapshot InstancedMesh 3
node renderobjects.mjs nomin-c30.heapsnapshot
```

## Findings

### Reproduction

The original benchmark method (single `gc()`, `performance.memory`, four scenes visited first) reproduces the report on the unfixed code: **11.98 → 24.76 MB over 20 cycles, rising in 20 of 20 cycle pairs** (report: 12.1 → 24.9 MB, 19 of 19). The CDP method (six `HeapProfiler.collectGarbage` calls) shows the same defect with a ~5× smaller slope: 0.116 MB/cycle from cycle 10 to 40, linear with no plateau. Two extra 20-cycle runs on the unfixed build separate the factors: the benchmark's reading method without the scene warm-up still gives 0.73 MB/cycle (9.07 → 23.80 MB), while the CDP method with the warm-up gives 0.16 MB/cycle (9.49 → 12.82 MB). So the difference between the report's 0.64 and the CDP slope comes from the GC/reading method (one `gc()` versus six collections), not from the warm-up scenes. The mechanism was not isolated (likely garbage held through WeakMap/ephemeron and cross-heap references that one collection does not fully reclaim). Both methods plateau after the fix, so the conclusion does not depend on it.

### Per-cycle heap (MB, production build)

| Cycle | Before fix (CDP, 6×GC) | After fix (CDP, 6×GC) | Before fix (bench method) | After fix (bench method) |
|---:|---:|---:|---:|---:|
| 0 | 7.91 | 7.85 | 11.28 | 10.50 |
| 1 | 8.97 | 8.90 | 11.98 | 10.56 |
| 2 | 9.46 | 9.05 | 12.75 | 10.72 |
| 3 | 9.53 | 9.20 | 13.46 | 10.83 |
| 5 | 10.05 | 9.54 | 14.95 | 11.09 |
| 10 | 11.11 | 10.09 | 18.25 | 11.36 |
| 15 | 11.68 | 10.22 | 21.66 | 11.74 |
| 20 | 12.31 | 10.33 | 24.76 | 11.77 |
| 25 | 12.91 | 10.41 | – | – |
| 30 | 13.51 | 10.50 | – | – |
| 35 | 14.04 | 10.54 | – | – |
| 40 | 14.59 | 10.58 | – | – |

The CDP columns are from one 40-cycle run per build; the bench-method columns are from one 20-cycle run per build. Numbers are single runs on a shared machine, so differences below ~0.1 MB are noise. After the fix the first ~10 cycles still rise by ~2 MB; that is three.js lazily building pipelines, node builders and bind groups on first use and is not repeated (slope c20→c40: 0.012 MB/cycle, see "Residual").

Dev server with the fix (CDP method): 12.48 MB at cycle 1, 13.80 at cycle 10, 14.31 at cycle 40 (0.017 MB/cycle from cycle 10). The dev server baseline is ~3.5 MB higher (React development build, Vite client) but the shape is the same.

### Constructor deltas (unminified build, before the fix, cycle 10 → 30 = 20 cycles)

| Constructor | Δ count | Per cycle | Count at c30 |
|---|---:|---:|---:|
| `InstancedMesh` | +360 | 18 | 546 |
| `LineSegments` | +240 | 12 | 366 |
| `BufferGeometry` | +600 | 30 | 918 |
| `InstancedBufferAttribute` | +720 | 36 | 1,092 |
| `BufferAttribute` | +1,360 | 68 | 2,070 |
| `InterleavedBufferAttribute` | +1,440 | 72 | 2,184 |
| `Vector3` | +2,360 | 118 | 3,781 |
| `Matrix4` | +1,920 | 96 | 3,002 |
| `Euler` / `Quaternion` | +640 each | 32 | ~1,000 |
| `RenderObject` | +80 | 4 | 130 |
| `WeakMap` | +1,320 | 66 | 2,082 |

18 `InstancedMesh` per cycle is every mesh built by the two content builds in a cycle (six for the roof house plus twelve for the reference composition, counting batches), so *all* disposed content is retained, not a fraction of it. Of the 130 `RenderObject`s at cycle 30, `RenderObject.object` is a `LineSegments` for 123 (121 of them stale), an `InstancedMesh` for 6 (the live ones) and a `QuadMesh` for 1; no stale mesh render object remains. Fixed build at cycle 30: 2 `LineSegments` (the visible live lines), 6 `InstancedMesh`, 1 `QuadMesh`.

After the fix (same build, cycle 10 and cycle 30): `InstancedMesh` 6 and 6, `LineSegments` 6 and 6, `BufferGeometry` 18 and 18, `RenderObject` 9 and 9: exactly the live roof-house content, constant. Between cycle 20 and cycle 40 of the minified fixed build the total self-size delta of the whole object graph is under 300 bytes.

### Retainer path (before the fix, one of the 546 `InstancedMesh`)

```
(GC roots) → Global handles → document → ScriptedAnimationController → V8FrameCallback
  → renderFrame closure .context → Animation .renderer → WebGPURenderer
  .lighting → Lighting → (WeakMap entry) RenderList .lightsNode → LightsNode
  → (ephemeron: WeakMap key LightsNode → value RenderObject)
  RenderObject .object → LineSegments .parent → Group .children[0] → InstancedMesh
```

The renderer is legitimately alive. The `RenderObject` of a disposed `LineSegments` is held by the `LightsNode` key, and its `.object.parent` keeps the old `Group` and every child.

### Why the lines leaked and the meshes did not

`RenderObject` registers `dispose` listeners on its object, material and geometry. `InstancedMesh.dispose()` (and `Object3D.dispose()` in r187) dispatches `dispose` on the object, which removes the `RenderObject` from the chain map, pipelines, bindings and node caches. `geometry.dispose()` only drops cached node attributes; `Material.dispose()` would also clean up but the line materials are shared across content builds and must not be disposed. Only the meshes called `dispose()`; the lines did not.

## Fix

`apps/studio/src/renderer/labRenderer.ts`, `disposeContent()`:

```diff
-    for (const line of lines) line.geometry.dispose();
+    for (const line of lines) {
+      line.dispose();
+      line.geometry.dispose();
+    }
```

## Regression evidence

`apps/studio/e2e/heap.spec.ts` ("switching catalog items repeatedly does not retain disposed scene content in the JS heap") warms up 10 reset cycles, forces GC through CDP, runs 20 more cycles, forces GC again, and polls until the retained heap growth is below 1.25 MB. Run against the dev server on port 5185:

| Code | Growth over the 20 measured cycles | Result |
|---|---:|---|
| `labRenderer.ts` at HEAD (without the fix) | 2,856,992 bytes | **fails** (`Expected: < 1250000`) |
| with the fix | ~0.44 MB (cycles 10→30 of the dev-server CDP run; the test only asserts the bound) | passes, 3 of 3 runs |

An earlier draft with 5 warm-up cycles measured 0.82 MB of (warm-up tail) growth on the fixed code, too close to the bound, so the warm-up was raised to 10. The bound sits at roughly 2.8× the fixed-code growth and 0.44× the unfixed growth. The test measures a public outcome (retained heap after content switching) and does not name any three.js internals.

## Residual

After the fix the CDP heap still drifts ~0.012–0.017 MB per cycle (c20→c40), yet the object-graph snapshots at cycles 20 and 40 differ by under 300 bytes in total. The drift therefore is not reachable JS objects; it is V8 accounting (code/feedback metadata, internal tables) and is not pursued. The single-`gc()` benchmark method also shows ~0.04 MB/cycle noise in the tail (19 of 20 pairs rise by tiny amounts, plateauing at ~11.8 MB). The benchmark's "no persistent growth" claim can be re-evaluated from this plateau; per the Phase 0 closure plan the benchmark re-run happens separately on a clean SHA.

## Limitations

- Single runs per configuration on one WSL2 machine with software rendering; slopes are indicative, not statistics.
- The unfixed dev-server run is only evidenced through the failing regression test (3.0 MB), not through snapshots; snapshots were taken on production builds.
- Heap snapshots were taken at cycles 0/1/10/20/30/40 only. The `.heapsnapshot` files (20–28 MB each) are not committed.
- WebGPU on a physical GPU was not exercised (WebGL2 backend only); the retention is in backend-independent `RenderObjects` code, so the same fix applies, but that was not measured.

## Scripts

The scripts are throwaway tools kept here instead of in the repository.

`measure.mjs`:

```js
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("/home/cuong/Kanna/eschaton/.worktrees/phase-0/apps/studio/package.json");
const { chromium } = require("@playwright/test");

const [url, cyclesArg, snapArg, tag] = process.argv.slice(2);
const cycles = Number(cyclesArg);
const snapAt = new Set(snapArg.split(",").filter(Boolean).map(Number));
const out = `/tmp/eschaton-heap/${tag}`;

const browser = await chromium.launch({ args: ["--enable-precise-memory-info", "--js-flags=--expose-gc"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
const cdp = await page.context().newCDPSession(page);
await cdp.send("HeapProfiler.enable");
console.error("chromium", browser.version());

const frames = (n) => page.evaluate((t) => new Promise((d) => { let s = 0; const k = () => { if (++s >= t) d(); else requestAnimationFrame(k); }; requestAnimationFrame(k); }), n);
const choose = async (key) => {
  await page.locator(`[data-item="${key}"]`).click();
  await page.locator(`[data-item="${key}"][aria-current="true"]`).waitFor();
  await frames(4);
};
const stat = async (n) => Number(await page.getByTestId(`stat-${n}`).innerText());
const heap = async () => {
  if (process.env.METHOD === "bench") return page.evaluate(() => { globalThis.gc(); return performance.memory.usedJSHeapSize; });
  for (let i = 0; i < 6; i++) await cdp.send("HeapProfiler.collectGarbage");
  const u = await cdp.send("Runtime.getHeapUsage");
  return u.usedSize;
};
const snapshot = async (name) => {
  const chunks = [];
  const on = (e) => chunks.push(e.chunk);
  cdp.on("HeapProfiler.addHeapSnapshotChunk", on);
  await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false, captureNumericValue: false });
  cdp.off("HeapProfiler.addHeapSnapshotChunk", on);
  writeFileSync(`${out}-${name}.heapsnapshot`, chunks.join(""));
};

await page.goto(`${url}/?continuous=${process.env.CONTINUOUS ?? "1"}`);
await page.waitForFunction(() => Number(document.querySelector('[data-testid="stats"]')?.getAttribute("data-frames")) >= 1, null, { polling: "raf" });
if (process.env.WARM) for (const k of ["primitive:P08", "assembly:roof-house", "assembly:watchtower", "scene:reference-composition"]) await choose(k);
await choose("assembly:roof-house");
const rows = [];
const base = await heap();
rows.push({ cycle: 0, heap: base, instances: await stat("instances"), geometries: await stat("geometries"), textures: await stat("textures") });
if (snapAt.has(0)) await snapshot("c0");
for (let c = 1; c <= cycles; c++) {
  await choose("scene:reference-composition");
  await choose("assembly:roof-house");
  const h = await heap();
  const row = { cycle: c, heap: h, instances: await stat("instances"), geometries: await stat("geometries"), textures: await stat("textures") };
  rows.push(row);
  console.log(JSON.stringify(row));
  if (snapAt.has(c)) await snapshot(`c${c}`);
}
writeFileSync(`${out}-rows.json`, JSON.stringify(rows, null, 1));
await browser.close();
```

`analyze.mjs`:

```js
import { readFileSync } from "node:fs";
const [aPath, bPath, topArg] = process.argv.slice(2);
const top = Number(topArg ?? 30);
function agg(path) {
  const s = JSON.parse(readFileSync(path, "utf8"));
  const f = s.snapshot.meta.node_fields, nf = f.length;
  const ti = f.indexOf("type"), ni = f.indexOf("name"), si = f.indexOf("self_size");
  const types = s.snapshot.meta.node_types[0];
  const m = new Map();
  for (let i = 0; i < s.nodes.length; i += nf) {
    const t = types[s.nodes[i + ti]];
    if (t === "hidden" || t === "synthetic" || t === "code" || t === "native" ) continue;
    const name = t === "string" || t === "concatenated string" || t === "sliced string" ? `(${t})` : s.strings[s.nodes[i + ni]];
    const key = `${t}:${name}`;
    const e = m.get(key) ?? { n: 0, size: 0 };
    e.n++; e.size += s.nodes[i + si];
    m.set(key, e);
  }
  return m;
}
const a = agg(aPath), b = agg(bPath);
const rows = [];
for (const [k, e] of b) { const p = a.get(k) ?? { n: 0, size: 0 }; rows.push({ k, dn: e.n - p.n, dsize: e.size - p.size, n: e.n }); }
rows.sort((x, y) => y.dsize - x.dsize);
console.log("by self-size delta"); for (const r of rows.slice(0, top)) console.log(String(r.dsize).padStart(9), String(r.dn).padStart(7), String(r.n).padStart(8), r.k);
rows.sort((x, y) => y.dn - x.dn);
console.log("by count delta"); for (const r of rows.slice(0, top)) console.log(String(r.dsize).padStart(9), String(r.dn).padStart(7), String(r.n).padStart(8), r.k);
```

`retain.mjs`:

```js
import { readFileSync } from "node:fs";
const [path, targetName, countArg] = process.argv.slice(2);
const s = JSON.parse(readFileSync(path, "utf8"));
const nf = s.snapshot.meta.node_fields, ef = s.snapshot.meta.edge_fields;
const nTypes = s.snapshot.meta.node_types[0], eTypes = s.snapshot.meta.edge_types[0];
const ti = nf.indexOf("type"), ni = nf.indexOf("name"), ci = nf.indexOf("edge_count"), idi = nf.indexOf("id");
const ety = ef.indexOf("type"), enm = ef.indexOf("name_or_index"), eto = ef.indexOf("to_node");
const N = s.nodes.length / nf.length;
const first = new Uint32Array(N + 1);
for (let i = 0, e = 0; i < N; i++) { first[i] = e; e += s.nodes[i * nf.length + ci]; }
first[N] = s.edges.length / ef.length;
const name = (i) => s.strings[s.nodes[i * nf.length + ni]];
const type = (i) => nTypes[s.nodes[i * nf.length + ti]];
// BFS from root (node 0) skipping weak and shortcut edges; record parent edge
const parent = new Int32Array(N).fill(-1), pedge = new Int32Array(N).fill(-1), depth = new Int32Array(N).fill(-1);
depth[0] = 0; const q = [0];
for (let h = 0; h < q.length; h++) {
  const u = q[h];
  for (let e = first[u]; e < first[u + 1]; e++) {
    const et = eTypes[s.edges[e * ef.length + ety]];
    if (et === "weak" || et === "shortcut") continue;
    const v = s.edges[e * ef.length + eto] / nf.length;
    if (depth[v] >= 0) continue;
    depth[v] = depth[u] + 1; parent[v] = u; pedge[v] = e; q.push(v);
  }
}
const edgeLabel = (e) => { const et = eTypes[s.edges[e * ef.length + ety]]; const nm = s.edges[e * ef.length + enm]; return et === "element" || et === "hidden" ? `[${nm}]` : `.${s.strings[nm]}`; };
const targets = [];
for (let i = 0; i < N; i++) if (name(i) === targetName && type(i) === "object" && depth[i] >= 0) targets.push(i);
console.log(`${targets.length} reachable ${targetName}`);
// group by path signature (names of path nodes+edges), show most common
const sigs = new Map();
for (const t of targets) {
  const parts = []; let v = t;
  while (v > 0) { parts.push(`${name(v)}${v === t ? "" : ""}`); parts.push(edgeLabel(pedge[v])); v = parent[v]; }
  const sig = parts.reverse().join(" ");
  sigs.set(sig, (sigs.get(sig) ?? 0) + 1);
}
const out = [...sigs].sort((a, b) => b[1] - a[1]).slice(0, Number(countArg ?? 4));
for (const [sig, n] of out) console.log(`\n x${n}\n  ${sig}`);
```

`renderobjects.mjs`:

```js
import { readFileSync } from "node:fs";
const s = JSON.parse(readFileSync(process.argv[2], "utf8"));
const nf = s.snapshot.meta.node_fields, ef = s.snapshot.meta.edge_fields;
const ni = nf.indexOf("name"), ci = nf.indexOf("edge_count");
const N = s.nodes.length / nf.length; let e = 0; const counts = new Map();
for (let i = 0; i < N; i++) {
  const c = s.nodes[i * nf.length + ci];
  if (s.strings[s.nodes[i * nf.length + ni]] === "RenderObject") {
    for (let k = e; k < e + c; k++) {
      const nm = s.edges[k * ef.length + ef.indexOf("name_or_index")], ty = s.snapshot.meta.edge_types[0][s.edges[k * ef.length + ef.indexOf("type")]];
      if (ty === "property" && s.strings[nm] === "object") { const to = s.edges[k * ef.length + ef.indexOf("to_node")] / nf.length; const n = s.strings[s.nodes[to * nf.length + ni]]; counts.set(n, (counts.get(n) ?? 0) + 1); }
    }
  }
  e += c;
}
console.log(process.argv[2], Object.fromEntries(counts));
```

## Re-measured after the fix (clean commit `e9e50c5`)

The recorded benchmark ([`benchmarks/phase-0/2026-11-24-e9e50c527/report.md`](../../benchmarks/phase-0/2026-11-24-e9e50c527/report.md) §4, same single-`gc()` method as the original report) measured 11.2 → 11.9 MB over 20 reset cycles (≈0.04 MB per cycle), against 12.1 → 24.9 MB (≈0.64 MB per cycle) before the fix. `renderer.info` geometries/textures and instances returned to baseline every cycle. The regression gate is `apps/studio/e2e/heap.spec.ts`, which fails without the fix (2.69–2.86 MB growth measured on re-verification) and passes with it; since commit `e9e50c5` it runs with reduced motion so the decorative drift loop does not starve slow CI runners. It passes on GitHub Actions (run 45374198783).
