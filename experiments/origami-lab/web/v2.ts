import type { Vec3 } from "@eschaton/foldon";
import {
  CROW,
  birdDesign,
  birdParams,
  compileDesign,
  generate,
  poseCompiled,
  poseObject,
  type BirdParams,
  type Compiled,
  type Pose,
} from "../src/index.ts";
import { createClayStage, type CameraSpec, type ClayView, type Line3, type Look, type Tri3 } from "./clay.ts";
import { flatNetSvg } from "./flatv2.ts";
import { inspectorHtml } from "./inspectv2.ts";

declare const __BUILD__: string;

const query = new URLSearchParams(location.search);
const num = (name: string, fallback: number): number => {
  const v = Number(query.get(name));
  return query.has(name) && Number.isFinite(v) ? v : fallback;
};
const mode = query.get("mode") ?? "study";
const initialLook: Look = query.get("look") === "silhouette" ? "silhouette" : "clay";
const state = {
  seed: query.get("preset") === "crow" || !query.has("seed") ? -1 : Math.trunc(num("seed", 1)),
  t: Math.min(1, Math.max(0, num("t", 1))),
  phase: query.has("phase") ? Math.min(1, Math.max(0, num("phase", 0.5))) : undefined,
  flap: query.get("flap") === "1",
  overlay: query.get("overlay") === "1",
  look: initialLook,
};
const sheetSeeds = (query.get("seeds") ?? "1,2,3,4,5,6,7,8").split(",").map(Number).filter(Number.isFinite);

const paramsFor = (seed: number): BirdParams => (seed < 0 ? CROW : birdParams(seed));
const labelFor = (seed: number): string => (seed < 0 ? "crow baseline" : `seed ${seed}`);

function compiledFor(seed: number): Compiled {
  const built = compileDesign(birdDesign(paramsFor(seed)));
  if (!built.ok) throw new Error(`${labelFor(seed)}: ${built.error.code} ${built.error.message}`);
  return built.value;
}

const ROLE_COLOR = { mountain: "#c8302b", valley: "#2753c9", join: "#b48d12", seam: "#16804a", joint: "#d86f00", boundary: "#26272b" } as const;

function snapshot(c: Compiled, pose: Pose, overlay: boolean): Readonly<{ polygons: readonly Tri3[]; lines: readonly Line3[] }> {
  const polygons = pose.faces.map((f) => f.vertices);
  if (!overlay) return { polygons, lines: [] };
  const where = (face: number, v: number): Vec3 | undefined => {
    const design = c.design.faces[face];
    const k = design?.v.indexOf(v) ?? -1;
    return k < 0 ? undefined : pose.faces[face]?.vertices[k];
  };
  const lines = c.edges.flatMap((e): Line3[] => {
    const f = e.faces[0];
    const [a, b] = f === undefined ? [undefined, undefined] : [where(f, e.a), where(f, e.b)];
    if (a === undefined || b === undefined) return [];
    const color = e.role === "crease" ? ((e.rest ?? 0) < 0 ? ROLE_COLOR.mountain : ROLE_COLOR.valley) : ROLE_COLOR[e.role];
    return [{ a, b, color, ...(e.role === "join" ? { dashed: true } : {}) }];
  });
  return { polygons, lines };
}

const BIRD_CENTRE: readonly [number, number, number] = [0.1, 0.1, 0];
const CAMERAS = {
  threeQuarter: { kind: "persp", azimuth: 38, elevation: 24, distance: 10.5, fov: 32, target: BIRD_CENTRE },
  front: { kind: "ortho", dir: [1, 0, 0], halfHeight: 1.9, target: BIRD_CENTRE },
  side: { kind: "ortho", dir: [0, 0, 1], halfHeight: 1.45, target: [-0.2, 0.1, 0] },
  top: { kind: "ortho", dir: [0, 1, 0], up: [1, 0, 0], halfHeight: 2.7, target: [-0.4, 0, 0] },
  below: { kind: "ortho", dir: [0, -1, 0], up: [1, 0, 0], halfHeight: 2.7, target: [-0.4, 0, 0] },
  head: { kind: "persp", azimuth: 50, elevation: 14, distance: 3.4, fov: 30, target: [1.35, 0.05, 0] },
  sheet: { kind: "persp", azimuth: 38, elevation: 24, distance: 12, fov: 32, target: BIRD_CENTRE },
} as const satisfies Readonly<Record<string, CameraSpec>>;

document.getElementById("build")?.replaceChildren(__BUILD__);
const canvas = document.getElementById("canvas");
const tilesRoot = document.getElementById("tiles");
const inspector = document.getElementById("inspector");
if (!(canvas instanceof HTMLCanvasElement) || tilesRoot === null || inspector === null) throw new Error("page skeleton missing");
const stage = createClayStage(canvas);

type Tile = Readonly<{ view: ClayView; draw: (seconds: number) => void }>;
const tiles: Tile[] = [];

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

const livePhase = (seconds: number): number | undefined => (state.flap ? 0.5 + 0.5 * Math.sin(seconds * 3) : state.phase);

function studyPage(seed: number): void {
  const c = compiledFor(seed);
  if (tilesRoot !== null) tilesRoot.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  const views: readonly (readonly [string, CameraSpec, number, number])[] = [
    [`three-quarter · ${labelFor(seed)}`, CAMERAS.threeQuarter, 430, 2],
    ["head close-up", CAMERAS.head, 430, 1],
    ["front (ortho)", CAMERAS.front, 250, 1],
    ["side (ortho)", CAMERAS.side, 250, 1],
    ["top (ortho)", CAMERAS.top, 250, 1],
  ];
  for (const [label, spec, h, span] of views) {
    const view = tile(label, spec, h, span);
    tiles.push({ view, draw: (s) => { const snap = snapshot(c, poseCompiled(c, state.t, livePhase(s), 1.2), state.overlay); view.set(snap.polygons, snap.lines, state.look); } });
  }
  const below = tile("from below (silhouette, as seen in the sky)", CAMERAS.below, 250, 3);
  tiles.push({ view: below, draw: (s) => {
    below.set(snapshot(c, poseCompiled(c, state.t, livePhase(s)), false).polygons, [], "silhouette");
  } });
  if (inspector !== null) inspector.innerHTML = inspectorHtml(c);
}

function sheetPage(): void {
  if (tilesRoot !== null) tilesRoot.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
  for (const seed of sheetSeeds) {
    const c = compiledFor(seed);
    const view = tile(labelFor(seed), CAMERAS.sheet, 260);
    tiles.push({ view, draw: (s) => { const snap = snapshot(c, poseCompiled(c, state.t, livePhase(s)), state.overlay); view.set(snap.polygons, snap.lines, state.look); } });
  }
  for (const seed of sheetSeeds) {
    const c = compiledFor(seed);
    const view = tile(`${labelFor(seed)} · top silhouette`, { ...CAMERAS.top, halfHeight: 3.2 }, 200);
    tiles.push({ view, draw: () => {
      view.set(snapshot(c, poseCompiled(c, 1), false).polygons, [], "silhouette");
    } });
  }
  if (inspector !== null) inspector.innerHTML = `<h3>Contact sheet</h3><pre>Same camera, light, material and world scale for every tile.\nSeeds: ${sheetSeeds.join(", ")}</pre>`;
}

function comparePage(seed: number): void {
  if (tilesRoot !== null) tilesRoot.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  const v1 = generate("bird", seed < 0 ? 1 : seed);
  const c = compiledFor(seed);
  const v1Polys = (): readonly Tri3[] => (v1.ok ? poseObject(v1.value, 1).panels.map((p) => p.vertices) : []);
  for (const [label, spec] of [["three-quarter", CAMERAS.sheet], ["top", { ...CAMERAS.top, halfHeight: 3.2 }], ["side", { ...CAMERAS.side, halfHeight: 1.6 }]] as const) {
    const old = tile(`V1 (PR #11 @ 73b612b) bird seed ${seed < 0 ? 1 : seed} · ${label}`, spec, 300);
    tiles.push({ view: old, draw: () => {
      old.set(v1Polys(), [], state.look);
    } });
    const now = tile(`V2 bird ${labelFor(seed)} · ${label}`, spec, 300);
    tiles.push({ view: now, draw: () => {
      now.set(snapshot(c, poseCompiled(c, 1), false).polygons, [], state.look);
    } });
  }
  if (inspector !== null) inspector.innerHTML = `<h3>Old / new</h3><pre>Identical cameras, lights, clay material and world scale. V1 is rendered from the PR #11 code that is still in this package.</pre>`;
}

function foldPage(seed: number): void {
  const c = compiledFor(seed);
  if (tilesRoot !== null) tilesRoot.style.gridTemplateColumns = "repeat(5, minmax(0, 1fr))";
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const view = tile(`t = ${t}${t < 1 ? " (pieces exploded)" : " (assembled)"}`, { ...CAMERAS.sheet, distance: 21 }, 230);
    tiles.push({ view, draw: () => { const snap = snapshot(c, poseCompiled(c, t, undefined, 1.2), true); view.set(snap.polygons, snap.lines, "clay"); } });
  }
  for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
    const view = tile(`flap phase ${phase} (shoulder + wrist)`, CAMERAS.front, 200);
    tiles.push({ view, draw: () => { const snap = snapshot(c, poseCompiled(c, 1, phase), true); view.set(snap.polygons, snap.lines, "clay"); } });
  }
  const flat = document.createElement("div");
  flat.className = "flat";
  flat.style.gridColumn = "span 5";
  flat.innerHTML = flatNetSvg(c);
  tilesRoot?.append(flat);
  if (inspector !== null) inspector.innerHTML = inspectorHtml(c);
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
    <a href="${link({ mode: "study" })}">study</a> · <a href="${link({ mode: "sheet" })}">contact sheet</a> · <a href="${link({ mode: "fold" })}">fold + flat net</a> · <a href="${link({ mode: "compare" })}">old / new</a>
    <label>seed <input id="seed" type="number" value="${state.seed < 0 ? "" : state.seed}" placeholder="crow" /></label>
    <label>fold t <input id="t" type="range" min="0" max="1" step="0.01" value="${state.t}" /></label>
    <label><input id="flap" type="checkbox" ${state.flap ? "checked" : ""}/> flap</label>
    <label><input id="overlay" type="checkbox" ${state.overlay ? "checked" : ""}/> crease overlay (M red, V blue, join yellow, seam green, joint orange)</label>
    <label><input id="sil" type="checkbox" ${state.look === "silhouette" ? "checked" : ""}/> silhouette</label>`;
  const input = (id: string): HTMLInputElement | null => {
    const el = document.getElementById(id);
    return el instanceof HTMLInputElement ? el : null;
  };
  input("seed")?.addEventListener("change", () => {
    const v = input("seed")?.value ?? "";
    location.search = link(v === "" ? { preset: "crow", seed: "" } : { seed: v, preset: "" });
  });
  input("t")?.addEventListener("input", () => { state.t = Number(input("t")?.value ?? 1); });
  input("flap")?.addEventListener("change", () => { state.flap = input("flap")?.checked ?? false; });
  input("overlay")?.addEventListener("change", () => { state.overlay = input("overlay")?.checked ?? false; });
  input("sil")?.addEventListener("change", () => { state.look = input("sil")?.checked === true ? "silhouette" : "clay"; });
}

controls();
if (mode === "sheet") sheetPage();
else if (mode === "compare") comparePage(state.seed);
else if (mode === "fold") foldPage(state.seed);
else studyPage(state.seed);
document.body.dataset.ready = "1";

const start = performance.now();
function frame(now: number): void {
  const seconds = (now - start) / 1000;
  for (const t of tiles) t.draw(seconds);
  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
