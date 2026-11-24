import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineSegments,
  Matrix4,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGPURenderer,
  Vector2,
} from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { flatLook, resolveLook } from "../lab/look";
import { palette } from "../lab/palette";
import type { OverlayName } from "../lab/state";
import type { Basis, Bounds, LeafBatch, ViewModel } from "../lab/viewModel";
import {
  creaseVertexCount,
  panelEdgeVertexCount,
  panelVertexCount,
  writeCreaseAxes,
  writeInstanceInks,
  writePanelEdges,
  writePanelInks,
  writePanelTriangles,
} from "./geometry";
import { createLabMaterials } from "./materials";
import { footprintSegments, gridSegments, socketSegments } from "./overlays";

export type RendererBackend = "WebGPU" | "WebGL2";

export type RendererStats = Readonly<{
  backend: RendererBackend;
  drawCalls: number;
  triangles: number;
  instances: number;
  geometries: number;
  textures: number;
  frames: number;
}>;

export type LabRendererOptions = Readonly<{
  forceWebGL: boolean;
  onFrame?: (stats: RendererStats) => void;
}>;

export type LabRenderer = Readonly<{
  apply: (viewModel: ViewModel) => void;
  resize: () => void;
  stats: () => RendererStats;
  dispose: () => void;
}>;

type BatchObjects = {
  batch: LeafBatch;
  mesh: InstancedMesh;
  geometry: BufferGeometry;
  positions: Float32Array;
  normals: Float32Array;
  positionAttribute: BufferAttribute;
  normalAttribute: BufferAttribute;
  basis: readonly Basis[];
};

type DynamicLines = {
  lines: LineSegments;
  positions: Float32Array;
  attribute: BufferAttribute;
};

type Content = {
  layoutKey: string;
  group: Group;
  batches: BatchObjects[];
  edges: DynamicLines;
  creaseEdges: DynamicLines;
  creases: DynamicLines;
  motion: readonly BatchObjects[];
  overlays: Readonly<Record<Exclude<OverlayName, "edges" | "creases" | "scatter">, LineSegments>>;
  poseKeys: string;
};

const FIELD_OF_VIEW = 32;
const FAR_PLANE = 1400;
const CLOUD_DRIFT_AMPLITUDE = 16;
const CLOUD_DRIFT_RATE = 0.035;
const ORBIT_DIRECTION = new Vector3(1, 0.75, 1.1).normalize();
const COMPOSITION_DIRECTION = new Vector3(1, 0.8, 1.3).normalize();
const FRAME_SLACK = 1.05;

function boundsCentre(bounds: Bounds): Vector3 {
  return new Vector3(
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  );
}

function boundsRadius(bounds: Bounds): number {
  return Math.hypot(
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ) / 2;
}

const isOutlined = (batch: LeafBatch): boolean => batch.outline !== false;

function createLines(positions: Float32Array, material: LineSegments["material"], colors?: Float32Array): LineSegments {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  if (colors !== undefined) geometry.setAttribute("color", new BufferAttribute(colors, 3));
  const lines = new LineSegments(geometry, material);
  lines.frustumCulled = false;
  return lines;
}

export async function createLabRenderer(canvas: HTMLCanvasElement, options: LabRendererOptions): Promise<LabRenderer> {
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL: options.forceWebGL });
  await renderer.init();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const backend: RendererBackend = "isWebGPUBackend" in renderer.backend ? "WebGPU" : "WebGL2";
  const materials = createLabMaterials();
  const scene = new Scene();
  scene.background = new Color(palette.paper);

  const perspective = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, FAR_PLANE);
  const composition = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const presetCamera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 1, FAR_PLANE);
  const controls = new OrbitControls(perspective, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.listenToKeyEvents(canvas);
  canvas.tabIndex = 0;

  let content: Content | undefined;
  let current: ViewModel | undefined;
  let framedItem = "";
  let framedMode = "";
  let dirty = true;
  let frames = 0;
  let disposed = false;
  let instances = 0;

  const markDirty = (): void => {
    dirty = true;
  };
  controls.addEventListener("change", markDirty);

  const readStats = (): RendererStats => ({
    backend,
    drawCalls: renderer.info.render.drawCalls,
    triangles: renderer.info.render.triangles,
    instances,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    frames,
  });

  function buildContent(viewModel: ViewModel): Content {
    const group = new Group();
    const matrix = new Matrix4();
    const batches = viewModel.batches.map((batch): BatchObjects => {
      const vertexCount = panelVertexCount(batch.geometry);
      const positions = new Float32Array(vertexCount * 3);
      const normals = new Float32Array(vertexCount * 3);
      const vertexInks = new Float32Array(vertexCount * 2);
      const instanceInks = new Float32Array(batch.bases.length * 2);
      writePanelTriangles(batch.geometry, positions, normals);
      writePanelInks(batch.geometry, batch.panelInks, vertexInks);
      writeInstanceInks(batch.inks, batch.bases.length, instanceInks);
      const positionAttribute = new BufferAttribute(positions, 3);
      const normalAttribute = new BufferAttribute(normals, 3);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", positionAttribute);
      geometry.setAttribute("normal", normalAttribute);
      geometry.setAttribute("ink", new BufferAttribute(vertexInks, 2));
      geometry.setAttribute("instanceInk", new InstancedBufferAttribute(instanceInks, 2));
      const mesh = new InstancedMesh(geometry, materials.paper, batch.bases.length);
      mesh.frustumCulled = false;
      batch.bases.forEach((basis, index) => {
        setInstance(matrix, basis);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
      return { batch, mesh, geometry, positions, normals, positionAttribute, normalAttribute, basis: batch.bases };
    });

    const outlined = viewModel.batches.filter(isOutlined);
    const edgeCount = outlined.reduce((sum, b) => sum + panelEdgeVertexCount(b.geometry, b.bases.length), 0);
    const creaseCount = outlined.reduce((sum, b) => sum + creaseVertexCount(b.geometry, b.bases.length), 0);
    const axisCount = viewModel.batches.reduce((sum, b) => sum + creaseVertexCount(b.geometry, b.bases.length), 0);
    const edgePositions = new Float32Array(edgeCount * 3);
    const creaseEdgePositions = new Float32Array(creaseCount * 3);
    const creasePositions = new Float32Array(axisCount * 3);
    const edgeLines = createLines(edgePositions, materials.panelEdges);
    const creaseEdgeLines = createLines(creaseEdgePositions, materials.creaseEdges);
    const creaseLines = createLines(creasePositions, materials.creaseAxes);
    creaseLines.renderOrder = 10;
    const grid = createLines(gridSegments(viewModel.bounds), materials.grid);
    const footprint = createLines(footprintSegments(viewModel.footprint), materials.footprint);
    const markers = socketSegments(viewModel.sockets);
    const sockets = createLines(markers.positions, materials.sockets, markers.colors);
    group.add(edgeLines, creaseEdgeLines, creaseLines, grid, footprint, sockets);

    const attributeOf = (lines: LineSegments): BufferAttribute => {
      const attribute = lines.geometry.getAttribute("position");
      if (!(attribute instanceof BufferAttribute)) throw new Error("line geometry lost its position attribute");
      return attribute;
    };
    return {
      layoutKey: viewModel.layoutKey,
      group,
      batches,
      motion: batches.filter((objects) => objects.batch.motion !== undefined),
      edges: { lines: edgeLines, positions: edgePositions, attribute: attributeOf(edgeLines) },
      creaseEdges: { lines: creaseEdgeLines, positions: creaseEdgePositions, attribute: attributeOf(creaseEdgeLines) },
      creases: { lines: creaseLines, positions: creasePositions, attribute: attributeOf(creaseLines) },
      overlays: { grid, footprint, sockets },
      poseKeys: "",
    };
  }

  function disposeContent(): void {
    if (content === undefined) return;
    scene.remove(content.group);
    for (const objects of content.batches) {
      objects.mesh.dispose();
      objects.geometry.dispose();
    }
    const lines = [content.edges.lines, content.creaseEdges.lines, content.creases.lines, ...Object.values(content.overlays)];
    for (const line of lines) line.geometry.dispose();
    content = undefined;
  }

  function updatePoses(target: Content, viewModel: ViewModel): void {
    const keys = viewModel.batches.map((b) => b.poseKey).join("|");
    if (keys === target.poseKeys) return;
    target.poseKeys = keys;
    let edgeCursor = 0;
    let creaseEdgeCursor = 0;
    let creaseCursor = 0;
    target.batches.forEach((objects, index) => {
      const batch = viewModel.batches[index];
      if (batch === undefined) return;
      objects.batch = batch;
      writePanelTriangles(batch.geometry, objects.positions, objects.normals);
      objects.positionAttribute.needsUpdate = true;
      objects.normalAttribute.needsUpdate = true;
      if (isOutlined(batch)) {
        edgeCursor = writePanelEdges(batch.geometry, batch.bases, target.edges.positions, edgeCursor);
        creaseEdgeCursor = writeCreaseAxes(batch.geometry, batch.bases, target.creaseEdges.positions, creaseEdgeCursor, 0);
      }
      creaseCursor = writeCreaseAxes(batch.geometry, batch.bases, target.creases.positions, creaseCursor);
    });
    target.edges.attribute.needsUpdate = true;
    target.creaseEdges.attribute.needsUpdate = true;
    target.creases.attribute.needsUpdate = true;
  }

  function frameCamera(viewModel: ViewModel): void {
    if (viewModel.view !== undefined) {
      const { position, target, fov } = viewModel.view;
      perspective.fov = fov;
      perspective.position.set(...position);
      perspective.lookAt(...target);
      controls.target.set(...target);
      controls.update();
      presetCamera.fov = fov;
      presetCamera.position.set(...position);
      presetCamera.lookAt(...target);
      presetCamera.aspect = perspective.aspect;
      presetCamera.updateProjectionMatrix();
      perspective.updateProjectionMatrix();
      return;
    }
    perspective.fov = FIELD_OF_VIEW;
    perspective.updateProjectionMatrix();
    const centre = boundsCentre(viewModel.bounds);
    const radius = Math.max(boundsRadius(viewModel.bounds), 1);
    const aspect = perspective.aspect;
    const fitFov = (FIELD_OF_VIEW * Math.PI) / 360;
    const horizontal = Math.atan(Math.tan(fitFov) * Math.min(aspect, 1));
    const distance = (radius / Math.sin(Math.min(fitFov, horizontal))) * FRAME_SLACK;
    perspective.position.copy(centre).addScaledVector(ORBIT_DIRECTION, distance);
    perspective.lookAt(centre);
    controls.target.copy(centre);
    controls.update();

    composition.position.copy(centre).addScaledVector(COMPOSITION_DIRECTION, radius * 4);
    composition.lookAt(centre);
    compositionRadius = radius * FRAME_SLACK;
    updateCompositionFrustum();
  }

  let compositionRadius = 1;
  function updateCompositionFrustum(): void {
    const aspect = perspective.aspect;
    const half = compositionRadius;
    composition.left = -half * Math.max(aspect, 1);
    composition.right = half * Math.max(aspect, 1);
    composition.top = half / Math.min(aspect, 1);
    composition.bottom = -half / Math.min(aspect, 1);
    composition.far = compositionRadius * 12;
    composition.updateProjectionMatrix();
  }

  function applyVisibility(target: Content, viewModel: ViewModel): void {
    const { overlays } = viewModel;
    target.overlays.grid.visible = overlays.grid;
    target.overlays.footprint.visible = overlays.footprint;
    target.overlays.sockets.visible = overlays.sockets;
    target.creases.lines.visible = overlays.creases;
  }

  function apply(viewModel: ViewModel): void {
    if (disposed) return;
    current = viewModel;
    if (content?.layoutKey !== viewModel.layoutKey) {
      disposeContent();
      content = buildContent(viewModel);
      scene.add(content.group);
      instances = viewModel.batches.reduce((sum, b) => sum + b.bases.length, 0);
    }
    updatePoses(content, viewModel);
    applyVisibility(content, viewModel);
    if (framedItem !== viewModel.itemKey || framedMode !== viewModel.cameraMode) {
      if (framedItem !== viewModel.itemKey) frameCamera(viewModel);
      framedItem = viewModel.itemKey;
      framedMode = viewModel.cameraMode;
    }
    controls.enabled = viewModel.cameraMode === "orbit";
    dirty = true;
  }

  function resize(): void {
    const host = canvas.parentElement;
    if (host === null || disposed) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    perspective.aspect = width / height;
    perspective.updateProjectionMatrix();
    presetCamera.aspect = perspective.aspect;
    presetCamera.updateProjectionMatrix();
    if (current !== undefined) updateCompositionFrustum();
    dirty = true;
  }

  const matrixScratch = new Matrix4();
  function animate(target: Content, seconds: number): void {
    for (const objects of target.motion) {
      if (objects.batch.motion === "cloud") {
        objects.mesh.position.x = Math.sin(seconds * CLOUD_DRIFT_RATE) * CLOUD_DRIFT_AMPLITUDE;
        continue;
      }
      objects.basis.forEach((basis, index) => {
        const phase = index * 2.399;
        const drift: Basis = {
          ...basis,
          origin: [
            basis.origin[0] + Math.sin(seconds * 0.11 + phase) * 4,
            basis.origin[1] + Math.sin(seconds * 0.07 + phase * 1.7) * 2.5,
            basis.origin[2] + Math.cos(seconds * 0.09 + phase) * 3,
          ],
        };
        setInstance(matrixScratch, drift);
        objects.mesh.setMatrixAt(index, matrixScratch);
      });
      objects.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  function setOutlines(target: Content, visible: boolean): void {
    target.edges.lines.visible = visible;
    target.creaseEdges.lines.visible = visible;
  }

  const sizeScratch = new Vector2();
  function draw(camera: PerspectiveCamera | OrthographicCamera, target: Content, viewModel: ViewModel): void {
    const look = resolveLook(viewModel.look);
    const edgesOn = viewModel.overlays.edges;
    if (!viewModel.look.compare) {
      materials.setLook(look, viewModel.inkScale);
      setOutlines(target, edgesOn && look.outlines);
      renderer.render(scene, camera);
      return;
    }
    const flat = flatLook(viewModel.look);
    materials.setLook(flat, viewModel.inkScale);
    setOutlines(target, edgesOn && flat.outlines);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);
    renderer.getSize(sizeScratch);
    const half = Math.floor(sizeScratch.x / 2);
    renderer.setScissor(half, 0, Math.ceil(sizeScratch.x - half), sizeScratch.y);
    renderer.setScissorTest(true);
    renderer.autoClearColor = false;
    materials.setLook(look, viewModel.inkScale);
    setOutlines(target, edgesOn && look.outlines);
    renderer.render(scene, camera);
    renderer.autoClearColor = true;
    renderer.setScissorTest(false);
  }

  function renderFrame(time: number): void {
    if (disposed) return;
    const moved = controls.update();
    const animating = current?.motion === true && content !== undefined && content.motion.length > 0;
    if (!dirty && !moved && !animating) return;
    dirty = false;
    if (animating && content !== undefined) animate(content, time / 1000);
    const camera =
      current?.cameraMode === "composition" ? (current.view === undefined ? composition : presetCamera) : perspective;
    if (current !== undefined && content !== undefined) draw(camera, content, current);
    frames += 1;
    options.onFrame?.(readStats());
  }

  void renderer.setAnimationLoop(renderFrame);
  resize();

  return {
    apply,
    resize,
    stats: readStats,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      void renderer.setAnimationLoop(null);
      controls.removeEventListener("change", markDirty);
      controls.dispose();
      disposeContent();
      materials.dispose();
      void renderer.dispose();
    },
  };
}

function setInstance(matrix: Matrix4, basis: Basis): void {
  matrix.makeBasis(new Vector3(...basis.x), new Vector3(...basis.y), new Vector3(...basis.z));
  matrix.setPosition(basis.origin[0], basis.origin[1], basis.origin[2]);
}
