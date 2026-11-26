import { creaseId, foldProgress, poseGeometry, type CreaseId, type PosedPanel as FoldonPosedPanel, type Vec3 } from "@eschaton/foldon";
import type { EdgeKind } from "./edges";
import { Q, type Shape } from "./lattice";
import type { Component, LabObject, MountPlacement } from "./object";

export type PosedPanel = Readonly<{
  id: string;
  part: string;
  component: number;
  shape: Shape;
  vertices: readonly Vec3[];
  normal: Vec3;
}>;

export type PosedEdge = Readonly<{ panel: string; a: Vec3; b: Vec3; kind: EdgeKind }>;

export type PosedObject = Readonly<{
  t: number;
  panels: readonly PosedPanel[];
  edges: readonly PosedEdge[];
}>;

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: Vec3): Vec3 => {
  const length = norm(a);
  return length === 0 ? [0, 0, 0] : scale(a, 1 / length);
};

type Frame = Readonly<{ origin: Vec3; x: Vec3; y: Vec3; n: Vec3 }>;

function panelFrame(vertices: readonly Vec3[], normal: Vec3, anchor: number): Frame {
  const [v0, v1, at] = [vertices[0], vertices[1], vertices[anchor]];
  if (v0 === undefined || v1 === undefined || at === undefined) throw new Error("panel has too few vertices for a frame");
  const x = unit(sub(v1, v0));
  return { origin: at, x, y: cross(normal, x), n: normal };
}

const rad = (degrees: number): number => (degrees * Math.PI) / 180;

type Mapper = Readonly<{ point: (p: Vec3) => Vec3; vector: (v: Vec3) => Vec3 }>;

function mountMap(mount: MountPlacement, host: FoldonPosedPanel, child: FoldonPosedPanel, t: number): Mapper {
  const hostFrame = panelFrame(host.vertices, host.normal, 0);
  const [u, v] = mount.at;
  const point = add(add(hostFrame.origin, scale(hostFrame.x, u / Q)), scale(hostFrame.y, v / Q));
  const n = scale(hostFrame.n, mount.side);
  const origin = add(point, scale(n, mount.lift / Q));
  const x0 = hostFrame.x;
  const y0 = cross(n, x0);
  const turn = rad(mount.turn);
  const x1 = add(scale(x0, Math.cos(turn)), scale(y0, Math.sin(turn)));
  const y1 = cross(n, x1);
  const tilt = rad(mount.tilt) * t;
  const y2 = add(scale(y1, Math.cos(tilt)), scale(n, Math.sin(tilt)));
  const n2 = sub(scale(n, Math.cos(tilt)), scale(y1, Math.sin(tilt)));
  const childFrame = panelFrame(child.vertices, child.normal, mount.anchor);
  const vector = (d: Vec3): Vec3=>
    add(add(scale(x1, dot(d, childFrame.x)), scale(y2, dot(d, childFrame.y))), scale(n2, dot(d, childFrame.n)));
  return { point: (p) => add(origin, vector(sub(p, childFrame.origin))), vector };
}

function componentPose(component: Component, t: number, phase: number | undefined): readonly FoldonPosedPanel[] {
  const recipe = component.definition.geometry;
  const angles = new Map<CreaseId, number>(foldProgress(recipe, t));
  if (phase !== undefined) {
    for (const crease of component.sheet.creases) {
      if (crease.articulation === undefined) continue;
      const id = creaseId(crease.id);
      const definition = recipe.creases.find((c) => c.id === id);
      if (definition === undefined) continue;
      const [lo, hi] = definition.range;
      const wanted = lo + (hi - lo) * Math.min(1, Math.max(0, phase));
      const clamped = Math.min(hi, Math.max(lo, (angles.get(id) ?? 0) + (wanted - definition.restAngle) * Math.min(1, Math.max(0, t))));
      angles.set(id, clamped);
    }
  }
  const posed = poseGeometry(recipe, angles);
  if (!posed.ok) throw new Error(`pose failed for ${component.id}: ${posed.error.message}`);
  return posed.value.panels;
}

export function poseObject(object: LabObject, t: number, articulationPhase?: number): PosedObject {
  const clampedT = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const poses = new Map<number, readonly FoldonPosedPanel[]>();
  const root = object.components[0];
  if (root === undefined) return { t: clampedT, panels: [], edges: [] };
  poses.set(0, componentPose(root, clampedT, articulationPhase));
  for (const mount of object.mounts) {
    const hostPanels = poses.get(mount.hostComponent);
    const child = object.components[mount.child];
    const host = hostPanels?.find((p) => p.id === mount.host);
    if (hostPanels === undefined || child === undefined || host === undefined) throw new Error(`mount host ${mount.host} is not posed`);
    const posed = componentPose(child, clampedT, articulationPhase);
    const rootPanel = posed.find((p) => p.id === child.sheet.root);
    if (rootPanel === undefined) throw new Error(`component ${child.id} lost its root`);
    const map = mountMap(mount, host, rootPanel, clampedT);
    poses.set(
      child.index,
      posed.map((p) => ({ id: p.id, vertices: p.vertices.map(map.point), normal: unit(map.vector(p.normal)) })),
    );
  }
  const panels: PosedPanel[] = [];
  const edges: PosedEdge[] = [];
  for (const component of object.components) {
    const secondSide = new Set(component.sheet.creases.map((c) => `${c.b}:${c.bEdge}`));
    for (const posed of poses.get(component.index) ?? []) {
      const sheetPanel = component.sheet.panels.find((p) => p.id === posed.id);
      if (sheetPanel === undefined) continue;
      panels.push({
        id: posed.id,
        part: component.partOf[posed.id] ?? "",
        component: component.index,
        shape: sheetPanel.shape,
        vertices: posed.vertices,
        normal: posed.normal,
      });
      sheetPanel.edges.forEach((edge, i) => {
        const [a, b] = [posed.vertices[i], posed.vertices[(i + 1) % posed.vertices.length]];
        if (a !== undefined && b !== undefined && !secondSide.has(`${posed.id}:${i}`)) edges.push({ panel: posed.id, a, b, kind: edge.kind });
      });
    }
  }
  return { t: clampedT, panels, edges };
}
