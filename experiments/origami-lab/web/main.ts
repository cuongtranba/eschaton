import { foldProgress, poseGeometry, primitiveCatalog } from "@eschaton/foldon";
import { EDGE_COLORS, generate, objectInspection, objectNames, poseObject, type EdgeKind, type LabObject, type ObjectName } from "../src/index.ts";
import { flatSvg } from "./flat.ts";
import { createStage, type PaperView, type Snapshot } from "./render.ts";

declare const __BUILD__: string;

const KINDS: readonly EdgeKind[] = ["M", "V", "F", "J", "B", "S"];
const query = new URLSearchParams(location.search);
const flag = (name: string): boolean => query.get(name) === "1";
const param = (name: string, fallback: number): number => {
  const value = Number(query.get(name));
  return query.has(name) && Number.isFinite(value) ? value : fallback;
};
const isObjectName = (value: string | null): value is ObjectName => objectNames.some((name) => name === value);
const isKind = (value: string | undefined): value is EdgeKind => KINDS.some((kind) => kind === value);

const kinds: Record<EdgeKind, boolean> = { M: true, V: true, F: true, J: true, B: true, S: true };
const requested = query.get("object");
const state = {
  seed: Math.max(0, Math.trunc(param("seed", 1))),
  t: Math.min(1, Math.max(0, param("t", 1))),
  playing: flag("play"),
  flap: flag("flap"),
  overlay: flag("overlay"),
  flat: flag("flat"),
  selected: isObjectName(requested) ? requested : objectNames[0],
  single: query.get("layout") === "single",
  kinds,
};

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`missing #${id}`);
  return found;
}

function input(id: string): HTMLInputElement {
  const found = element(id);
  if (!(found instanceof HTMLInputElement)) throw new Error(`#${id} is not an input`);
  return found;
}

function canvas(id: string): HTMLCanvasElement {
  const found = element(id);
  if (!(found instanceof HTMLCanvasElement)) throw new Error(`#${id} is not a canvas`);
  return found;
}

element("build").textContent = __BUILD__;
const stage = createStage(canvas("canvas"));
const viewsRoot = element("views");
viewsRoot.classList.toggle("single", state.single);

type Shown = { name: ObjectName; object: LabObject; view: PaperView; box: HTMLElement };
let shown: Shown[] = [];

const snapshotOf = (object: LabObject, t: number, phase: number | undefined): Snapshot => {
  const posed = poseObject(object, t, phase);
  return { panels: posed.panels, edges: posed.edges };
};

function select(name: ObjectName): void {
  state.selected = name;
  for (const item of shown) item.box.classList.toggle("selected", item.name === name);
  const inspector = element("inspector");
  const chosen = shown.find((item) => item.name === name);
  if (chosen === undefined) {
    inspector.textContent = "";
    return;
  }
  const info = objectInspection(chosen.object);
  const classes = info.counts.triangleClasses;
  inspector.innerHTML = `
    <h3>Inspector — ${info.name} seed ${info.seed}</h3>
    <pre>fingerprint ${info.fingerprint}
panels ${info.panels.length} · creases ${info.creases.length} · joins ${info.joins.length}
triangles acute ${classes.acute} / right ${classes.right} / obtuse ${classes.obtuse} · quads ${info.counts.quads}
distinct variant ids ${info.counts.distinctVariantIds}</pre>
    <h3>Foldon definitions</h3>
    <table><tr><th>id</th><th>fingerprint</th><th>footprint</th><th>valid</th></tr>${info.foldons.map((f) => `<tr><td>${f.id}</td><td>${f.fingerprint.slice(0, 8)}</td><td>${f.footprint.join("×")}</td><td>${f.valid ? "yes" : "NO"}</td></tr>`).join("")}</table>
    <h3>Parts</h3>
    <table>${info.parts.map((p) => `<tr><td>${p.name}</td><td>${p.module}</td><td>${p.panels.length}</td></tr>`).join("")}</table>
    <h3>Panels</h3>
    <table>${info.panels.map((p) => `<tr><td>${p.id}</td><td>${p.variant}</td><td>${p.triangleClass}</td><td>${p.squaredSides.join("/")}</td></tr>`).join("")}</table>
    <h3>Creases</h3>
    <table>${info.creases.map((c) => `<tr><td>${c.id}</td><td>${c.kind}</td><td>${c.targetDeg}°</td><td>${c.articulation === null ? "" : `[${c.articulation.lo}, ${c.articulation.hi}]`}</td></tr>`).join("")}</table>
    <h3>Connections</h3>
    <pre>${info.connections.map((c) => JSON.stringify(c)).join("\n")}</pre>`;
}

function renderFlat(): void {
  const section = element("flatSection");
  section.hidden = !state.flat;
  if (!state.flat) {
    section.replaceChildren();
    return;
  }
  section.innerHTML = shown
    .map(
      (item) =>
        `<h3>${item.name} — flat crease pattern per part</h3><div class="flats">${Object.entries(item.object.partSheets)
          .map(([part, sheet]) => `<figure><figcaption>${part}</figcaption>${flatSvg(sheet)}</figure>`)
          .join("")}</div>`,
    )
    .join("");
}

function rebuildObjects(): void {
  for (const item of shown) stage.removeView(item.view);
  viewsRoot.replaceChildren();
  shown = [];
  for (const name of objectNames) {
    if (state.single && name !== state.selected) continue;
    const built = generate(name, state.seed);
    const box = document.createElement("div");
    box.className = "view";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = built.ok ? `${name} · seed ${state.seed} · ${built.value.fingerprint.slice(0, 8)}` : `${name}: ${built.error.message}`;
    box.append(label);
    viewsRoot.append(box);
    if (!built.ok) continue;
    const view = stage.addView(box);
    view.fit(snapshotOf(built.value, 1, undefined), param("az", 40), param("el", 30));
    box.addEventListener("pointerdown", () => {
      select(name);
    });
    shown.push({ name, object: built.value, view, box });
  }
  select(state.selected);
  renderFlat();
}

function buildControls(): void {
  const controls = element("controls");
  controls.innerHTML = `
    <label>seed <button id="prev">◀</button><input id="seed" type="number" min="0" step="1" value="${state.seed}" /><button id="next">▶</button></label>
    <label>fold t <input id="t" type="range" min="0" max="1" step="0.01" value="${state.t}" /><output id="tOut">${state.t.toFixed(2)}</output></label>
    <button id="play">${state.playing ? "pause fold" : "play fold"}</button>
    <label><input id="flap" type="checkbox" ${state.flap ? "checked" : ""} /> wing flap</label>
    <label><input id="overlay" type="checkbox" ${state.overlay ? "checked" : ""} /> edge overlays</label>
    ${KINDS.map((k) => `<label><span class="swatch" style="background:${EDGE_COLORS[k]}"></span>${k}<input data-kind="${k}" type="checkbox" checked /></label>`).join("")}
    <label><input id="flat" type="checkbox" ${state.flat ? "checked" : ""} /> flat crease pattern</label>
    <label><input id="single" type="checkbox" ${state.single ? "checked" : ""} /> single view</label>`;
  const setSeed = (value: number): void => {
    state.seed = Math.max(0, Math.trunc(value));
    input("seed").value = String(state.seed);
    rebuildObjects();
  };
  element("prev").addEventListener("click", () => {
    setSeed(state.seed - 1);
  });
  element("next").addEventListener("click", () => {
    setSeed(state.seed + 1);
  });
  input("seed").addEventListener("change", () => {
    setSeed(Number(input("seed").value));
  });
  input("t").addEventListener("input", () => {
    state.t = Number(input("t").value);
    state.playing = false;
    element("play").textContent = "play fold";
  });
  element("play").addEventListener("click", () => {
    state.playing = !state.playing;
    element("play").textContent = state.playing ? "pause fold" : "play fold";
  });
  input("flap").addEventListener("change", () => {
    state.flap = input("flap").checked;
  });
  input("overlay").addEventListener("change", () => {
    state.overlay = input("overlay").checked;
  });
  input("flat").addEventListener("change", () => {
    state.flat = input("flat").checked;
    renderFlat();
  });
  input("single").addEventListener("change", () => {
    state.single = input("single").checked;
    viewsRoot.classList.toggle("single", state.single);
    rebuildObjects();
  });
  for (const box of controls.querySelectorAll<HTMLInputElement>("input[data-kind]")) {
    box.addEventListener("change", () => {
      const kind = box.dataset.kind;
      if (isKind(kind)) state.kinds[kind] = box.checked;
    });
  }
}

function buildBefore(): readonly Readonly<{ view: PaperView; snapshot: Snapshot }>[] {
  const strip = element("strip");
  return primitiveCatalog.map((definition) => {
    const box = document.createElement("div");
    box.className = "view";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = definition.id;
    box.append(label);
    strip.append(box);
    const posed = poseGeometry(definition.geometry, foldProgress(definition.geometry, 1));
    if (!posed.ok) throw new Error(posed.error.message);
    const snapshot: Snapshot = {
      panels: posed.value.panels,
      edges: [
        ...posed.value.panels.flatMap((p) => p.vertices.map((v, i) => ({ a: v, b: p.vertices[(i + 1) % p.vertices.length] ?? v, kind: "B" as const }))),
        ...posed.value.creases.map((c) => ({ a: c.start, b: c.end, kind: c.angle < 0 ? ("M" as const) : ("V" as const) })),
      ],
    };
    const view = stage.addView(box);
    view.fit(snapshot);
    return { view, snapshot };
  });
}

buildControls();
element("flatSection").hidden = !state.flat;
rebuildObjects();
const before = buildBefore();

const start = performance.now();
function frame(now: number): void {
  const seconds = (now - start) / 1000;
  if (state.playing) {
    state.t = (seconds / 5) % 1;
    input("t").value = String(state.t);
  }
  element("tOut").textContent = state.t.toFixed(2);
  const phase = state.flap ? 0.5 + 0.5 * Math.sin(seconds * 5) : undefined;
  const overlays = state.overlay ? state.kinds : undefined;
  for (const item of shown) item.view.update(snapshotOf(item.object, state.t, phase), overlays);
  for (const item of before) item.view.update(item.snapshot, overlays);
  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
