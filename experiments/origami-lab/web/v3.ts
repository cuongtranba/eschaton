import type { Vec3 } from "@eschaton/foldon";
import {
  CROW,
  birdDesign,
  birdLandmarks,
  compileAssembly,
  compileDesign,
  designBird,
  generate,
  geo1Verdict,
  iou,
  poseCompiled,
  poseObject,
  provenance,
  reuseTable,
  silhouette,
  verifyCompiled,
  type Assembly,
  type Compiled,
  type Pose,
} from "../src/index.ts";
import { designVehicle, vehicleLandmarks } from "../src/v3/vehicle.ts";
import { createClayStage, type CameraSpec, type ClayView, type Line3, type Look, type Tri3 } from "./clay.ts";
import { flatNetSvg } from "./flatv2.ts";

declare const __BUILD__: string;

const query = new URLSearchParams(location.search);
const mode = query.get("mode") ?? "study";
const object = query.get("object") === "vehicle" ? "vehicle" : "bird";
type Token = number | "crow" | "min" | "max" | "hero";
const token = (t: string | null): Token => (t === null || t === "crow" || t === "hero" ? (object === "bird" ? "crow" : "hero") : t === "min" || t === "max" ? t : Math.trunc(Number(t)));
const variant = token(query.get("seed") ?? query.get("preset"));
const sheet = (query.get("seeds") ?? "1,2,3,4,5,6,7,8").split(",").map(token);
const lookOf = (v: string | null): Look => (v === "silhouette" ? "silhouette" : "clay");
const state = { t: Number(query.get("t") ?? 1), phase: query.has("phase") ? Number(query.get("phase")) : undefined, flap: query.get("flap") === "1", overlay: query.get("overlay") === "1", look: lookOf(query.get("look")), weld: query.get("weld") !== "0" };
const labelOf = (v: Token): string => (v === "crow" ? "crow baseline" : v === "hero" ? "hero sedan" : v === "min" ? "extreme: window minimum" : v === "max" ? "extreme: window maximum" : `seed ${v}`);

type Made = Readonly<{ assembly: Assembly; compiled: Compiled; summary: Readonly<Record<string, unknown>> }>;
const made = new Map<string, Made>();

function birdOf(v: Token): Made {
  const key = `bird:${String(v)}`;
  const hit = made.get(key);
  if (hit !== undefined) return hit;
  const d = designBird(v === "hero" ? "crow" : v);
  if (!d.ok) throw new Error(`${labelOf(v)}: ${d.error.code} ${d.error.message}`);
  const c = compileAssembly(d.value.assembly, "bird", { variant: String(v) }, birdLandmarks);
  if (!c.ok) throw new Error(`${labelOf(v)}: ${c.error.code} ${c.error.message}`);
  const m = d.value.measures;
  const out: Made = { assembly: d.value.assembly, compiled: c.value.compiled, summary: { targets: d.value.targets, assignment: d.value.assignment, measures: { spanRatio: m.spanRatio, tailRatio: m.tailRatio, beakRatio: m.beakRatio, headBreast: m.headBreast, length: m.length, span: m.span }, solver: { nodes: d.value.log.nodes, backtracks: d.value.log.backtracks, eliminations: d.value.log.eliminations } } };
  made.set(key, out);
  return out;
}

function vehicleOf(v: Token): Made {
  const key = `vehicle:${String(v)}`;
  const hit = made.get(key);
  if (hit !== undefined) return hit;
  const d = designVehicle(v === "crow" ? "hero" : v);
  if (!d.ok) throw new Error(`${labelOf(v)}: ${d.error.code} ${d.error.message}`);
  const c = compileAssembly(d.value.assembly, "vehicle", { variant: String(v) }, vehicleLandmarks);
  if (!c.ok) throw new Error(`${labelOf(v)}: ${c.error.code} ${c.error.message}`);
  const out: Made = { assembly: d.value.assembly, compiled: c.value.compiled, summary: { targets: d.value.targets, assignment: d.value.assignment, measures: d.value.measures, solver: { nodes: d.value.log.nodes, backtracks: d.value.log.backtracks, eliminations: d.value.log.eliminations } } };
  made.set(key, out);
  return out;
}

const makeOf = (v: Token): Made => (object === "bird" ? birdOf(v) : vehicleOf(v));

const ROLE = { mountain: "#c8302b", valley: "#2753c9", join: "#b48d12", seam: "#16804a", joint: "#d86f00", boundary: "#26272b" } as const;

/** One canonical position per design vertex (closed seams render watertight; gaps larger than 1e-6 are kept as they are). */
function welded(c: Compiled, pose: Pose): readonly Tri3[] {
  const canon = new Map<number, Vec3>();
  return pose.faces.map((f) => {
    const ids = c.design.faces[f.face]?.v ?? [];
    return f.vertices.map((p, k) => {
      const id = ids[k] ?? -1;
      const q = canon.get(id);
      if (q === undefined) {
        canon.set(id, p);
        return p;
      }
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) <= 1e-6 ? q : p;
    });
  });
}

function snapshot(c: Compiled, pose: Pose, overlay: boolean, weld = state.weld): Readonly<{ polygons: readonly Tri3[]; lines: readonly Line3[] }> {
  const polygons = weld ? welded(c, pose) : pose.faces.map((f) => f.vertices);
  if (!overlay) return { polygons, lines: [] };
  const where = (face: number, v: number): Vec3 | undefined => {
    const k = c.design.faces[face]?.v.indexOf(v) ?? -1;
    return k < 0 ? undefined : pose.faces[face]?.vertices[k];
  };
  const lines = c.edges.flatMap((e): Line3[] => {
    const f = e.faces[0];
    const [a, b] = f === undefined ? [undefined, undefined] : [where(f, e.a), where(f, e.b)];
    if (a === undefined || b === undefined) return [];
    const color = e.role === "crease" ? ((e.rest ?? 0) < 0 ? ROLE.mountain : ROLE.valley) : ROLE[e.role];
    return [{ a, b, color, ...(e.role === "join" ? { dashed: true } : {}) }];
  });
  return { polygons, lines };
}

const CENTRE: Readonly<Record<"bird" | "vehicle", readonly [number, number, number]>> = { bird: [0.1, 0.1, 0], vehicle: [0, 0.65, 0] };
const C = CENTRE[object];
const CAMERAS = {
  threeQuarter: { kind: "persp", azimuth: 38, elevation: 24, distance: object === "bird" ? 10.5 : 9.5, fov: 32, target: C },
  front: { kind: "ortho", dir: [1, 0, 0], halfHeight: object === "bird" ? 2.6 : 1.3, target: C },
  side: { kind: "ortho", dir: [0, 0, 1], halfHeight: object === "bird" ? 1.45 : 1.3, target: object === "bird" ? [-0.2, 0.1, 0] : C },
  top: { kind: "ortho", dir: [0, 1, 0], up: [1, 0, 0], halfHeight: object === "bird" ? 5.4 : 2.6, target: object === "bird" ? [-0.4, 0, 0] : [0, 0, 0] },
  below: { kind: "ortho", dir: [0, -1, 0], up: [1, 0, 0], halfHeight: object === "bird" ? 5.4 : 2.6, target: object === "bird" ? [-0.4, 0, 0] : [0, 0, 0] },
  rear: { kind: "ortho", dir: [-1, 0, 0], halfHeight: 1.3, target: C },
  sheet: { kind: "persp", azimuth: 38, elevation: 24, distance: object === "bird" ? 17 : 12, fov: 32, target: C },
} as const satisfies Readonly<Record<string, CameraSpec>>;

document.getElementById("build")?.replaceChildren(__BUILD__);
const canvas = document.getElementById("canvas");
const tilesRoot = document.getElementById("tiles");
const inspectorEl = document.getElementById("inspector");
if (!(canvas instanceof HTMLCanvasElement) || tilesRoot === null || inspectorEl === null) throw new Error("page skeleton missing");
const inspector: HTMLElement = inspectorEl;
const stage = createClayStage(canvas);
const tiles: { draw: (s: number) => void }[] = [];

function tile(label: string, spec: CameraSpec, height: number, span = 1): ClayView {
  const box = document.createElement("div");
  box.className = "tile";
  box.style.height = `${height}px`;
  box.style.gridColumn = `span ${span}`;
  const tag = document.createElement("div");
  tag.className = "label";
  tag.textContent = label;
  box.append(tag);
  tilesRoot?.append(box);
  return stage.addView(box, spec);
}
const columns = (n: number): void => {
  tilesRoot.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
};
const livePhase = (s: number): number | undefined => (state.flap ? 0.5 + 0.5 * Math.sin(s * 3) : state.phase);
const show = (view: ClayView, c: Compiled, t: number, phase: number | undefined, look: Look, explode = 0, overlay = state.overlay): void => {
  const snap = snapshot(c, poseCompiled(c, t, phase, explode), overlay && look === "clay");
  view.set(snap.polygons, snap.lines, look);
};
const lm = (c: Compiled, k: string, fallback: Vec3): Vec3 => c.design.landmarks[k] ?? fallback;
const mix = (a: Vec3, b: Vec3, u: number): readonly [number, number, number] => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

function studyPage(v: Token): void {
  const { compiled: c } = makeOf(v);
  columns(3);
  const views: (readonly [string, CameraSpec, number, number, Look])[] = [
    [`three-quarter · ${object} ${labelOf(v)}`, CAMERAS.threeQuarter, 430, 2, "clay"],
    ...(object === "bird"
      ? ([["head close-up", { kind: "persp", azimuth: 58, elevation: 14, distance: 2.4, fov: 30, target: mix(lm(c, "beakTip", [2, 0, 0]), [1.2, 0.1, 0], 0.55) }, 430, 1, "clay"]] as const)
      : ([["front-wheel close-up", { kind: "persp", azimuth: 55, elevation: 12, distance: 2.6, fov: 30, target: lm(c, "wheelFL", [1.4, 0.33, 0.8]) }, 430, 1, "clay"]] as const)),
    ["front (ortho)", CAMERAS.front, 250, 1, "clay"],
    ["side (ortho)", CAMERAS.side, 250, 1, "clay"],
    ["top (ortho)", CAMERAS.top, 250, 1, "clay"],
    [object === "bird" ? "silhouette: from below (as seen in the sky)" : "silhouette: below", CAMERAS.below, 230, 1, "silhouette"],
    ["silhouette: side", CAMERAS.side, 230, 1, "silhouette"],
    ["silhouette: front", CAMERAS.front, 230, 1, "silhouette"],
    ["silhouette: three-quarter", { ...CAMERAS.threeQuarter, distance: object === "bird" ? 13 : 11 }, 230, 1, "silhouette"],
    ...(object === "bird"
      ? ([
          ["close-up: wing tip and primaries (from above)", { kind: "persp", azimuth: 20, elevation: 62, distance: 4.4, fov: 30, target: mix(lm(c, "wingTipL", [0, 0, 3.5]), [0, 0.2, 1.4], 0.45) }, 230, 1, "clay"],
          ["close-up: shoulder, coverts and secondaries", { kind: "persp", azimuth: 150, elevation: 38, distance: 3.2, fov: 30, target: [-0.1, 0.2, 1.0] }, 230, 1, "clay"],
          ["close-up: tail fan (from above and behind)", { kind: "persp", azimuth: 140, elevation: 42, distance: 3.0, fov: 30, target: mix(lm(c, "tailTip", [-2, 0, 0]), [-1.0, 0.1, 0], 0.5) }, 230, 1, "clay"],
        ] as const)
      : ([
          ["close-up: grille and nose", { kind: "persp", azimuth: 70, elevation: 10, distance: 2.4, fov: 30, target: lm(c, "nose", [2.2, 0.6, 0]) }, 230, 1, "clay"],
          ["rear (ortho)", CAMERAS.rear, 230, 1, "clay"],
          ["close-up: cabin and window openings", { kind: "persp", azimuth: 20, elevation: 18, distance: 3.2, fov: 30, target: [-0.3, 1.1, 0.4] }, 230, 1, "clay"],
        ] as const)),
  ];
  for (const [label, spec, h, span, look] of views) {
    const view = tile(label, spec, h, span);
    tiles.push({ draw: (s) => { show(view, c, state.t, livePhase(s), look === "silhouette" ? "silhouette" : state.look, label.startsWith("three-quarter ·") ? 1.2 : 0); } });
  }
  inspector.innerHTML = inspectorHtml(v);
}

function sheetPage(): void {
  columns(4);
  for (const v of sheet) {
    const { compiled: c } = makeOf(v);
    const view = tile(labelOf(v), CAMERAS.sheet, 260);
    tiles.push({ draw: (s) => { show(view, c, state.t, livePhase(s), state.look); } });
  }
  for (const v of sheet) {
    const { compiled: c } = makeOf(v);
    const view = tile(`${labelOf(v)} · ${object === "bird" ? "below" : "side"} silhouette`, object === "bird" ? { ...CAMERAS.below, halfHeight: 5.6 } : { ...CAMERAS.side, halfHeight: 1.75 }, 200);
    tiles.push({ draw: () => { show(view, c, 1, undefined, "silhouette", 0, false); } });
  }
  inspector.innerHTML = `<h3>Contact sheet</h3><pre>Same camera, light, clay material and world scale for every tile.\nVariants: ${sheet.map(labelOf).join(", ")}</pre>`;
}

function v2Compiled(): Compiled {
  const c = compileDesign(birdDesign(CROW));
  if (!c.ok) throw new Error(c.error.message);
  return c.value;
}

function comparePage(): void {
  columns(2);
  const now = makeOf(object === "bird" ? "crow" : "hero").compiled;
  const v1 = object === "vehicle" ? generate("vehicle", 1) : undefined;
  const v1Polys = (): readonly Tri3[] => {
    if (!v1?.ok) return [];
    const polys = poseObject(v1.value, 1).panels.map((p) => p.vertices);
    const all = polys.flat();
    const lo = [0, 1, 2].map((k) => Math.min(...all.map((v) => v[k] ?? 0)));
    const hi = [0, 1, 2].map((k) => Math.max(...all.map((v) => v[k] ?? 0)));
    const mid = [((lo[0] ?? 0) + (hi[0] ?? 0)) / 2, lo[1] ?? 0, ((lo[2] ?? 0) + (hi[2] ?? 0)) / 2];
    return polys.map((poly) => poly.map((v): readonly [number, number, number] => [v[0] - (mid[0] ?? 0), v[1] - (mid[1] ?? 0), v[2] - (mid[2] ?? 0)]));
  };
  const before = object === "bird" ? v2Compiled() : undefined;
  const specs = object === "bird"
    ? ([["three-quarter", CAMERAS.threeQuarter], ["side", CAMERAS.side], ["front", CAMERAS.front], ["below (silhouette)", CAMERAS.below]] as const)
    : ([["three-quarter", CAMERAS.threeQuarter], ["side", { ...CAMERAS.side, halfHeight: 1.75 }], ["front", CAMERAS.front], ["top", CAMERAS.top]] as const);
  for (const [label, spec] of specs) {
    const look: Look = label.includes("silhouette") ? "silhouette" : "clay";
    const a = tile(object === "bird" ? `V2 crow (e8082a8 geometry, raw render) · ${label}` : `V1 vehicle seed 1 (73b612b code, ground-aligned and centred) · ${label}`, spec, 300);
    tiles.push({ draw: () => { a.set(before !== undefined ? snapshot(before, poseCompiled(before, 1), false, false).polygons : v1Polys(), [], look); } });
    const b = tile(`V3 ${object} ${labelOf(object === "bird" ? "crow" : "hero")} · ${label}`, spec, 300);
    tiles.push({ draw: () => { b.set(snapshot(now, poseCompiled(now, 1), false).polygons, [], look); } });
  }
  inspector.innerHTML = `<h3>Before / after</h3><pre>Identical cameras, lights, clay material and world scale (1 cell = 1 unit); nothing is scaled. ${object === "bird" ? "V2 is rendered from the V2 code still in this package, unwelded as it was reviewed; both birds are in their own design coordinates." : "V1 is translated so its footprint centre sits at the origin and its lowest point on the ground; V3 is in its own coordinates (ground y = 0)."}</pre>`;
}

function diagnosisPage(): void {
  columns(2);
  const c = v2Compiled();
  const shoulder = c.design.joints.find((j) => j.module === "wingL")?.edge ?? [0, 0];
  const p = c.design.vertices[shoulder[0]] ?? [0, 0, 0];
  for (const [label, zoom] of [["far", 3.2], ["near", 1.1]] as const) {
    for (const weld of [false, true]) {
      const view = tile(`V2 shoulder (${label}) · ${weld ? "welded positions (one per design vertex)" : "raw per-sheet Float32 positions (as V2 rendered)"}`, { kind: "persp", azimuth: 25, elevation: 32, distance: zoom, fov: 30, target: [p[0] - 0.3, p[1], p[2]] }, 360);
      tiles.push({ draw: () => { view.set(snapshot(c, poseCompiled(c, 1), false, weld).polygons, [], "clay"); } });
    }
  }
  inspector.innerHTML = `<h3>Shoulder diagnosis (V2)</h3><pre>Geometry: seam gap ≤ 5.3e-10 cells, no T-junctions, no duplicate vertices; the shoulder edge is shared by two body facets and the wing root (by design). Opening angles there are 52–168° over the flap, so no near-coplanar z-fighting.\nRender: each sheet is transformed separately and uploaded unindexed as Float32; 1-ulp differences at shared vertices rasterise as sub-pixel cracks (dark dots where the unlit inside shows, a bright pinhole where background shows). Left: raw; right: welded.</pre>`;
}

function foldPage(v: Token): void {
  const { compiled: c } = makeOf(v);
  columns(5);
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const view = tile(`t = ${t}${t < 1 ? " (sheets exploded)" : " (assembled)"}`, { ...CAMERAS.sheet, distance: object === "bird" ? 22 : 15 }, 230);
    tiles.push({ draw: () => { show(view, c, t, undefined, "clay", 0.45, true); } });
  }
  if (object === "bird") {
    for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
      const view = tile(`flap phase ${phase} (shoulder + wrist joints)`, CAMERAS.front, 200);
      tiles.push({ draw: () => { show(view, c, 1, phase, "clay", 0, true); } });
    }
  }
  const flat = document.createElement("div");
  flat.className = "flat";
  flat.style.gridColumn = "span 5";
  flat.innerHTML = flatNetSvg(c).replace("modular papercraft, not one sheet", "one sheet per module instance");
  tilesRoot?.append(flat);
  inspector.innerHTML = inspectorHtml(v);
}

function inspectorHtml(v: Token): string {
  const { assembly, compiled: c, summary } = makeOf(v);
  const prov = provenance(assembly);
  const families = new Map<string, number>();
  for (const i of assembly.instances) families.set(i.def.family, (families.get(i.def.family) ?? 0) + 1);
  const decisions = assembly.decisions.map((d) => `${d.variable} = ${d.value}${d.eliminated.length > 0 ? `  (eliminated ${d.eliminated.length}: ${d.eliminated.slice(0, 2).map((e) => `${e.value} by ${e.by}`).join("; ")})` : ""}`);
  return `
    <h3>Summary</h3><pre>${JSON.stringify(summary, null, 1)}</pre>
    <h3>Modules</h3><pre>${assembly.instances.length} instances = ${c.pieces.length} sheets · ${c.design.faces.length} panels\n${[...families].map(([k, n]) => `${k}: ${n}`).join(" · ")}\ndistinct definitions: ${new Set(assembly.instances.map((i) => i.def.id)).size}</pre>
    <h3>Solver decisions (eliminations by constraint)</h3><pre>${decisions.join("\n")}</pre>
    <h3>Provenance (instance ← parent via ports @ angle · definition · decided by)</h3><pre>${prov.map((n) => `${n.instance} ← ${n.parent ?? "(root)"} ${n.via ?? ""} · ${n.family}:${n.definition}${n.decidedBy.length > 0 ? ` · ${n.decidedBy.join(",")}` : ""}`).join("\n")}</pre>`;
}

function modulesPage(): void {
  columns(1);
  const bird = birdOf("crow");
  const objects: Assembly[] = [bird.assembly];
  try {
    objects.push(vehicleOf("hero").assembly);
  } catch {
    /* vehicle not available */
  }
  const rows = reuseTable(objects);
  const shared = rows.filter((r) => Object.keys(r.uses).length > 1);
  const pre = document.createElement("pre");
  pre.className = "panel";
  pre.textContent = `Concrete definitions used by more than one object (GEO-7.5 level c):\n${shared.map((r) => `${r.family} ${r.id} ${r.params} uses ${JSON.stringify(r.uses)}`).join("\n") || "(none)"}\n\nAll definitions (${rows.length}):\n${rows.map((r) => `${r.family.padEnd(7)} ${r.id} ${JSON.stringify(r.uses)}${r.mirrorOf === undefined ? "" : ` mirror of ${r.mirrorOf}`}  ${r.params.slice(0, 120)}`).join("\n")}`;
  tilesRoot?.append(pre);
  inspector.innerHTML = `<h3>Reuse levels</h3><pre>(a) shared helper — not claimed\n(b) same family, different params\n(c) same definition id across objects (listed first)</pre>`;
}

function evidencePage(): void {
  const variants: Token[] = object === "bird" ? ["crow", 1, 2, 3, 4, 5, 6, 7, 8, 101, 202, 303, "min", "max"] : ["hero", 1, 2, 3, 4, 5, 6, 7, 8, "min", "max"];
  const rows = variants.map((v) => {
    const t0 = performance.now();
    const m = makeOf(v);
    const buildMs = Math.round(performance.now() - t0);
    const t1 = performance.now();
    const report = verifyCompiled(m.compiled);
    const verifyMs = Math.round(performance.now() - t1);
    const all = [...report.sweeps, report.rest];
    const sum = (k: "analytic" | "static" | "certified" | "sampled" | "collision"): number => all.reduce((s, w) => s + w.counts[k], 0);
    return {
      variant: labelOf(v),
      instances: m.assembly.instances.length,
      sheets: m.compiled.pieces.length,
      panels: m.compiled.design.faces.length,
      definitions: new Set(m.assembly.instances.map((i) => i.def.id)).size,
      buildMs,
      verifyMs,
      geo1: geo1Verdict(report),
      counts: { analytic: sum("analytic"), static: sum("static"), certified: sum("certified"), sampled: sum("sampled"), collision: sum("collision") },
      witnesses: all.flatMap((w) => w.witnesses.map((x) => ({ sweep: w.name, ...x }))),
      panelIssues: report.panels.issues,
      thinAnnotated: report.panels.thinAnnotated.length,
      minAngleDeg: report.panels.minAngleDeg,
      minAltitude: report.panels.minAltitude,
      flat: { maxOffPlane: report.flat.maxOffPlane, overlaps: report.flat.overlaps.length },
      rigidity: report.rigidity,
      seamGap: report.seamGap,
      definitionsInvalid: report.definitions.invalid,
      ...m.summary,
    };
  });
  const sil = (v: Token): ReturnType<typeof silhouette> => silhouette(poseCompiled(makeOf(v).compiled, 1), object === "bird" ? "top" : "side", 96, object === "bird" ? 5.5 : 2.8);
  const seeds: Token[] = [1, 2, 3, 4, 5, 6, 7, 8];
  const s = seeds.map(sil);
  const matrix = s.map((a) => s.map((b) => Math.round(iou(a, b) * 1000) / 1000));
  const reuse = reuseTable([birdOf("crow").assembly, ...(object === "vehicle" ? [vehicleOf("hero").assembly] : [])]);
  const out = { build: __BUILD__, generated: `v3.html?object=${object}&mode=evidence`, object, variants: rows, silhouetteIoU: { view: object === "bird" ? "top" : "side", seeds, matrix }, reuse: reuse.filter((r) => Object.keys(r.uses).length > 1), provenance: provenance(makeOf(object === "bird" ? "crow" : "hero").assembly) };
  const pre = document.createElement("pre");
  pre.id = "evidence";
  pre.textContent = JSON.stringify(out, null, 1);
  pre.className = "panel";
  tilesRoot?.append(pre);
}

function controls(): void {
  const root = document.getElementById("controls");
  if (root === null) return;
  const link = (extra: Record<string, string>): string => {
    const next = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(extra)) next.set(k, v);
    return `?${next.toString()}`;
  };
  root.innerHTML = `
    <b>${object}</b> <a href="${link({ object: "bird", seed: "crow" })}">bird</a> · <a href="${link({ object: "vehicle", seed: "hero" })}">vehicle</a> |
    <a href="${link({ mode: "study" })}">study</a> · <a href="${link({ mode: "sheet" })}">contact sheet</a> · <a href="${link({ mode: "fold" })}">fold + flat nets</a> · <a href="${link({ mode: "compare" })}">before / after</a> · <a href="${link({ mode: "modules" })}">modules + reuse</a> · <a href="${link({ mode: "diagnosis" })}">V2 shoulder diagnosis</a> · <a href="${link({ mode: "evidence" })}">evidence</a>
    <label>fold t <input id="t" type="range" min="0" max="1" step="0.01" value="${state.t}" /></label>
    <label><input id="flap" type="checkbox" ${state.flap ? "checked" : ""}/> flap</label>
    <label><input id="overlay" type="checkbox" ${state.overlay ? "checked" : ""}/> creases (M red, V blue, seam green, joint orange)</label>`;
  const input = (id: string): HTMLInputElement | null => {
    const el = document.getElementById(id);
    return el instanceof HTMLInputElement ? el : null;
  };
  input("t")?.addEventListener("input", () => { state.t = Number(input("t")?.value ?? 1); });
  input("flap")?.addEventListener("change", () => { state.flap = input("flap")?.checked ?? false; });
  input("overlay")?.addEventListener("change", () => { state.overlay = input("overlay")?.checked ?? false; });
}

controls();
try {
  if (mode === "evidence") evidencePage();
  else if (mode === "sheet") sheetPage();
  else if (mode === "compare") comparePage();
  else if (mode === "fold") foldPage(variant);
  else if (mode === "modules") modulesPage();
  else if (mode === "diagnosis") diagnosisPage();
  else studyPage(variant);
} catch (e) {
  const pre = document.createElement("pre");
  pre.className = "panel";
  pre.textContent = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  tilesRoot.append(pre);
}
document.body.dataset.ready = "1";
const start = performance.now();
function frame(now: number): void {
  const seconds = (now - start) / 1000;
  for (const t of tiles) t.draw(seconds);
  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
