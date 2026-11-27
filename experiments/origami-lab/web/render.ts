import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EDGE_COLORS, type EdgeKind } from "../src/index.ts";

export type Panel3 = Readonly<{ id: string; vertices: readonly (readonly [number, number, number])[] }>;
export type Edge3 = Readonly<{ a: readonly [number, number, number]; b: readonly [number, number, number]; kind: EdgeKind }>;
export type Snapshot = Readonly<{ panels: readonly Panel3[]; edges: readonly Edge3[] }>;
export type Overlays = Readonly<Record<EdgeKind, boolean>>;

const PAPER = new THREE.Color("#f4efe6");

function tone(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) >>> 0;
  return 0.93 + 0.07 * ((hash % 97) / 96);
}

export type PaperView = Readonly<{
  element: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  update: (snapshot: Snapshot, overlays: Overlays | undefined) => void;
  fit: (snapshot: Snapshot, azimuth?: number, elevation?: number) => void;
}>;

export type Stage = Readonly<{
  addView: (element: HTMLElement) => PaperView;
  removeView: (view: PaperView) => void;
  render: () => void;
}>;

const KINDS: readonly EdgeKind[] = ["M", "V", "F", "J", "B", "S"];

function createPaperView(element: HTMLElement): PaperView {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x555a66, 1.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3);
  sun.position.set(3, 8, 5);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  camera.position.set(6, 5, 8);
  const controls = new OrbitControls(camera, element);
  controls.enableDamping = true;
  const paper = new THREE.Group();
  const lines = new THREE.Group();
  scene.add(paper, lines);
  let signature = "";
  const meshes = new Map<string, THREE.Mesh>();
  const segments = new Map<EdgeKind, THREE.LineSegments>();

  const rebuild = (snapshot: Snapshot): void => {
    paper.clear();
    lines.clear();
    meshes.clear();
    segments.clear();
    for (const panel of snapshot.panels) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Math.max(0, panel.vertices.length - 2) * 9), 3));
      const color = PAPER.clone().multiplyScalar(tone(panel.id));
      const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
      mesh.frustumCulled = false;
      meshes.set(panel.id, mesh);
      paper.add(mesh);
    }
    for (const kind of KINDS) {
      const count = snapshot.edges.filter((e) => e.kind === kind).length;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 6), 3));
      const material =
        kind === "J"
          ? new THREE.LineDashedMaterial({ color: EDGE_COLORS[kind], dashSize: 0.06, gapSize: 0.05 })
          : new THREE.LineBasicMaterial({ color: EDGE_COLORS[kind], transparent: kind === "B", opacity: kind === "B" ? 0.85 : 1 });
      const line = new THREE.LineSegments(geometry, material);
      line.frustumCulled = false;
      segments.set(kind, line);
      lines.add(line);
    }
  };

  const update = (snapshot: Snapshot, overlays: Overlays | undefined): void => {
    const key = `${snapshot.panels.map((p) => `${p.id}:${p.vertices.length}`).join(",")}|${KINDS.map((k) => snapshot.edges.filter((e) => e.kind === k).length).join(",")}`;
    if (key !== signature) {
      signature = key;
      rebuild(snapshot);
    }
    for (const panel of snapshot.panels) {
      const position = meshes.get(panel.id)?.geometry.getAttribute("position");
      if (position === undefined) continue;
      let at = 0;
      const [first = [0, 0, 0] as const] = panel.vertices;
      for (let i = 1; i + 1 < panel.vertices.length; i++) {
        for (const v of [first, panel.vertices[i] ?? first, panel.vertices[i + 1] ?? first]) {
          position.setXYZ(at++, v[0], v[1], v[2]);
        }
      }
      position.needsUpdate = true;
      meshes.get(panel.id)?.geometry.computeVertexNormals();
    }
    for (const kind of KINDS) {
      const line = segments.get(kind);
      if (line === undefined) continue;
      line.visible = overlays === undefined ? kind === "B" : overlays[kind];
      const position = line.geometry.getAttribute("position");
      let at = 0;
      for (const edge of snapshot.edges.filter((e) => e.kind === kind)) {
        position.setXYZ(at++, edge.a[0], edge.a[1], edge.a[2]);
        position.setXYZ(at++, edge.b[0], edge.b[1], edge.b[2]);
      }
      position.needsUpdate = true;
      if (kind === "J") line.computeLineDistances();
    }
  };

  const fit = (snapshot: Snapshot, azimuth = 40, elevation = 30): void => {
    const [az, el] = [(azimuth * Math.PI) / 180, (elevation * Math.PI) / 180];
    const box = new THREE.Box3();
    for (const panel of snapshot.panels) for (const v of panel.vertices) box.expandByPoint(new THREE.Vector3(v[0], v[1], v[2]));
    if (box.isEmpty()) return;
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.5, box.getSize(new THREE.Vector3()).length() / 2);
    controls.target.copy(centre);
    camera.position.copy(centre).add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar((radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.05));
    camera.near = radius / 50;
    camera.far = radius * 40;
    camera.updateProjectionMatrix();
    controls.update();
  };

  return { element, scene, camera, controls, update, fit };
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setClearColor(0x17181b, 1);
  renderer.setScissorTest(true);
  const views = new Set<PaperView>();
  const render = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    renderer.setScissor(0, 0, width, height);
    renderer.setViewport(0, 0, width, height);
    renderer.clear();
    for (const view of views) {
      const rect = view.element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > height || rect.width < 2 || rect.height < 2) continue;
      const [x, y] = [Math.max(0, rect.left), Math.max(0, height - rect.bottom)];
      renderer.setViewport(rect.left, height - rect.bottom, rect.width, rect.height);
      renderer.setScissor(x, y, Math.min(rect.width, width - x), Math.min(rect.height, rect.height));
      view.camera.aspect = rect.width / rect.height;
      view.camera.updateProjectionMatrix();
      view.controls.update();
      renderer.render(view.scene, view.camera);
    }
  };
  return {
    addView: (element) => {
      const view = createPaperView(element);
      views.add(view);
      return view;
    },
    removeView: (view) => {
      view.controls.dispose();
      views.delete(view);
    },
    render,
  };
}
