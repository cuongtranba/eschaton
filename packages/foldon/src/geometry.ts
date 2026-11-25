import type { CreaseId, PanelId } from "./ids";
import { creaseId } from "./ids";
import { issue, type ValidationIssue } from "./issues";
import { err, ok, type Result } from "./result";
import {
  centroid,
  cross,
  distance,
  dot,
  normalize,
  rotateAboutAxis,
  scale,
  sub,
  v3,
  type Vec3,
} from "./vec";

export type Panel = Readonly<{ id: PanelId; vertices: readonly Vec3[] }>;

export type CreaseAssignment = "mountain" | "valley";

export type CreaseDefinition = Readonly<{
  id: CreaseId;
  parent: PanelId;
  child: PanelId;
  parentEdge: readonly [number, number];
  childEdge: readonly [number, number];
  assignment: CreaseAssignment;
  restAngle: number;
  range: readonly [number, number];
  stiffness: number;
}>;

export type GeometryRecipe = Readonly<{
  panels: readonly Panel[];
  root: PanelId;
  creases: readonly CreaseDefinition[];
}>;

export type PosedPanel = Readonly<{ id: PanelId; vertices: readonly Vec3[]; normal: Vec3 }>;
export type PosedCrease = Readonly<{ id: CreaseId; start: Vec3; end: Vec3; angle: number }>;
export type PosedGeometry = Readonly<{
  panels: readonly PosedPanel[];
  creases: readonly PosedCrease[];
}>;

export type PoseError =
  | Readonly<{ code: "invalid-recipe"; message: string; issues: readonly ValidationIssue[] }>
  | Readonly<{ code: "unknown-crease"; message: string; creaseId: string }>
  | Readonly<{ code: "non-finite-angle"; message: string; creaseId: CreaseId; angle: number }>
  | Readonly<{
      code: "angle-out-of-range";
      message: string;
      creaseId: CreaseId;
      angle: number;
      range: readonly [number, number];
    }>;

export type CreaseAngles = ReadonlyMap<CreaseId, number> | Readonly<Record<string, number>>;

const RANGE_TOLERANCE = 1e-12;
const COINCIDENT = 1e-9;

export function newellNormal(vertices: readonly Vec3[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  vertices.forEach((current, i) => {
    const next = vertices[(i + 1) % vertices.length];
    if (next === undefined) return;
    x += (current[1] - next[1]) * (current[2] + next[2]);
    y += (current[2] - next[2]) * (current[0] + next[0]);
    z += (current[0] - next[0]) * (current[1] + next[1]);
  });
  return normalize(v3(x, y, z));
}

function vertexAt(vertices: readonly Vec3[], index: number): Vec3 {
  const vertex = vertices[index];
  if (vertex === undefined) throw new Error(`vertex index ${index} out of range`);
  return vertex;
}

export function hingeFrame(
  parentVertices: readonly Vec3[],
  edge: readonly [number, number],
): Readonly<{ origin: Vec3; axis: Vec3; normal: Vec3 }> {
  const origin = vertexAt(parentVertices, edge[0]);
  const along = normalize(sub(vertexAt(parentVertices, edge[1]), origin));
  const toCentre = sub(centroid(parentVertices), origin);
  const inward = normalize(sub(toCentre, scale(along, dot(toCentre, along))));
  const normal = newellNormal(parentVertices);
  return { origin, axis: normalize(cross(normal, inward)), normal };
}

export function creaseAngle(
  parentVertices: readonly Vec3[],
  parentEdge: readonly [number, number],
  childVertices: readonly Vec3[],
): number {
  const { axis, normal } = hingeFrame(parentVertices, parentEdge);
  const childNormal = newellNormal(childVertices);
  return Math.atan2(dot(cross(normal, childNormal), axis), dot(normal, childNormal));
}

export function isConsecutiveEdge(vertexCount: number, edge: readonly [number, number]): boolean {
  const [a, b] = edge;
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < vertexCount;
  if (!inRange(a) || !inRange(b) || a === b) return false;
  const gap = (b - a + vertexCount) % vertexCount;
  return gap === 1 || gap === vertexCount - 1;
}

export type TreeAnalysis = Readonly<{
  order: readonly CreaseDefinition[];
  issues: readonly ValidationIssue[];
}>;

export function analyzeTree(recipe: GeometryRecipe): TreeAnalysis {
  const issues: ValidationIssue[] = [];
  const panels = new Map<PanelId, number>();
  recipe.panels.forEach((panel, i) => {
    if (panels.has(panel.id)) {
      issues.push(issue("panel-duplicate-id", `geometry.panels[${i}].id`, `duplicate panel id ${panel.id}`));
    } else {
      panels.set(panel.id, panel.vertices.length);
    }
  });
  if (!panels.has(recipe.root)) {
    issues.push(issue("root-unknown", "geometry.root", `root panel ${recipe.root} does not exist`));
  }

  const creaseIds = new Set<CreaseId>();
  const byParent = new Map<PanelId, CreaseDefinition[]>();
  recipe.creases.forEach((crease, i) => {
    const path = `geometry.creases[${i}]`;
    if (creaseIds.has(crease.id)) {
      issues.push(issue("crease-duplicate-id", `${path}.id`, `duplicate crease id ${crease.id}`));
      return;
    }
    creaseIds.add(crease.id);
    const parentCount = panels.get(crease.parent);
    const childCount = panels.get(crease.child);
    if (parentCount === undefined || childCount === undefined) {
      issues.push(issue("crease-unknown-panel", path, `crease ${crease.id} references a missing panel`));
      return;
    }
    if (!isConsecutiveEdge(parentCount, crease.parentEdge)) {
      issues.push(issue("crease-edge-invalid", `${path}.parentEdge`, "parent edge must join two consecutive vertices"));
      return;
    }
    if (!isConsecutiveEdge(childCount, crease.childEdge)) {
      issues.push(issue("crease-edge-invalid", `${path}.childEdge`, "child edge must join two consecutive vertices"));
      return;
    }
    byParent.set(crease.parent, [...(byParent.get(crease.parent) ?? []), crease]);
  });

  const order: CreaseDefinition[] = [];
  if (panels.has(recipe.root)) {
    const reached = new Set<PanelId>([recipe.root]);
    const queue: PanelId[] = [recipe.root];
    for (const current of queue) {
      for (const crease of byParent.get(current) ?? []) {
        if (reached.has(crease.child)) {
          issues.push(
            issue("crease-cycle", `geometry.creases.${crease.id}`, `crease ${crease.id} closes a loop onto panel ${crease.child}`),
          );
          continue;
        }
        reached.add(crease.child);
        order.push(crease);
        queue.push(crease.child);
      }
    }
    for (const id of panels.keys()) {
      if (!reached.has(id)) {
        issues.push(issue("panel-disconnected", `geometry.panels.${id}`, `panel ${id} is not connected to the root by open hinges`));
      }
    }
  }
  return { order, issues };
}

function required<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new Error("internal invariant violated: missing map entry");
  return value;
}

function subtreeOf(order: readonly CreaseDefinition[], start: PanelId): readonly PanelId[] {
  const members: PanelId[] = [start];
  for (const current of members) {
    for (const crease of order) {
      if (crease.parent === current) members.push(crease.child);
    }
  }
  return members;
}

function resolveTargets(
  recipe: GeometryRecipe,
  angles: CreaseAngles,
): Result<ReadonlyMap<CreaseId, number>, PoseError> {
  const known = new Map<string, CreaseDefinition>(recipe.creases.map((c) => [c.id, c]));
  const entries: readonly (readonly [string, number])[] =
    angles instanceof Map ? [...angles] : Object.entries(angles);
  const targets = new Map<CreaseId, number>();
  for (const [key, angle] of entries) {
    const crease = known.get(key);
    if (crease === undefined) {
      return err({ code: "unknown-crease", message: `crease ${key} does not exist`, creaseId: key });
    }
    if (!Number.isFinite(angle)) {
      return err({ code: "non-finite-angle", message: `target angle for ${key} is not finite`, creaseId: crease.id, angle });
    }
    const [low, high] = crease.range;
    if (angle < low - RANGE_TOLERANCE || angle > high + RANGE_TOLERANCE) {
      return err({
        code: "angle-out-of-range",
        message: `target angle ${angle} for ${key} is outside [${low}, ${high}]`,
        creaseId: crease.id,
        angle,
        range: crease.range,
      });
    }
    targets.set(crease.id, angle);
  }
  return ok(targets);
}

export function poseGeometry(recipe: GeometryRecipe, angles: CreaseAngles): Result<PosedGeometry, PoseError> {
  const tree = analyzeTree(recipe);
  if (tree.issues.length > 0) {
    return err({ code: "invalid-recipe", message: "geometry recipe is not a valid crease tree", issues: tree.issues });
  }
  const targets = resolveTargets(recipe, angles);
  if (!targets.ok) return targets;

  const posed = new Map<PanelId, readonly Vec3[]>(recipe.panels.map((p) => [p.id, p.vertices]));
  for (const crease of tree.order) {
    const delta = (targets.value.get(crease.id) ?? crease.restAngle) - crease.restAngle;
    if (delta === 0) continue;
    const { origin, axis } = hingeFrame(required(posed, crease.parent), crease.parentEdge);
    for (const id of subtreeOf(tree.order, crease.child)) {
      posed.set(id, required(posed, id).map((p) => rotateAboutAxis(p, origin, axis, delta)));
    }
  }

  const panels = recipe.panels.map((p): PosedPanel => {
    const vertices = required(posed, p.id);
    return { id: p.id, vertices, normal: newellNormal(vertices) };
  });
  const creases = recipe.creases.map((c): PosedCrease => {
    const parent = required(posed, c.parent);
    return {
      id: c.id,
      start: vertexAt(parent, c.parentEdge[0]),
      end: vertexAt(parent, c.parentEdge[1]),
      angle: creaseAngle(parent, c.parentEdge, required(posed, c.child)),
    };
  });
  return ok({ panels, creases });
}

export function foldProgress(recipe: GeometryRecipe, t: number): ReadonlyMap<CreaseId, number> {
  const progress = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  return new Map(
    recipe.creases.map((c) => [c.id, Math.min(c.range[1], Math.max(c.range[0], c.restAngle * progress))]),
  );
}

export function makePanel(id: PanelId, vertices: readonly Vec3[], facing?: Vec3): Panel {
  const normalized = vertices.map((v) => v3(v[0], v[1], v[2]));
  if (facing !== undefined && dot(newellNormal(normalized), facing) < 0) {
    return { id, vertices: normalized.toReversed() };
  }
  return { id, vertices: normalized };
}

export type HingeSpec = Readonly<{
  id: string;
  parent: PanelId;
  child: PanelId;
  stiffness?: number;
  range?: readonly [number, number];
}>;

export type NetInput = Readonly<{
  panels: readonly Panel[];
  root: PanelId;
  hinges: readonly HingeSpec[];
}>;

type SharedEdge = Readonly<{ parentEdge: readonly [number, number]; childEdge: readonly [number, number] }>;

function findSharedEdge(parent: Panel, child: Panel): SharedEdge | undefined {
  const n = parent.vertices.length;
  const m = child.vertices.length;
  for (let i = 0; i < n; i++) {
    const pa = vertexAt(parent.vertices, i);
    const pb = vertexAt(parent.vertices, (i + 1) % n);
    for (let k = 0; k < m; k++) {
      const next = (k + 1) % m;
      const ca = vertexAt(child.vertices, k);
      const cb = vertexAt(child.vertices, next);
      if (distance(pa, ca) < COINCIDENT && distance(pb, cb) < COINCIDENT) {
        return { parentEdge: [i, (i + 1) % n], childEdge: [k, next] };
      }
      if (distance(pa, cb) < COINCIDENT && distance(pb, ca) < COINCIDENT) {
        return { parentEdge: [i, (i + 1) % n], childEdge: [next, k] };
      }
    }
  }
  return undefined;
}

/**
 * Numbers stored in a recipe (panel vertices and rest angles) are multiples of 1 / this. They become part of the
 * definition and so of the catalog fingerprint and of world state hashes, but `sin`, `cos`, `atan2` and `hypot` may
 * differ in the last bits between JavaScript engines. Rounding to a grid far coarser than that difference makes the
 * stored recipe the same on every engine. Authored decimals with up to nine places are unchanged by it.
 */
const STORED_STEPS = 1e9;

function stored(value: number): number {
  const steps = Math.round(value * STORED_STEPS);
  return steps === 0 ? 0 : steps / STORED_STEPS;
}

export function foldedNet(input: NetInput): Result<GeometryRecipe, string> {
  const net = input.panels.map((p): Panel => ({ ...p, vertices: p.vertices.map((v) => v3(stored(v[0]), stored(v[1]), stored(v[2]))) }));
  const panels = new Map<PanelId, Panel>(net.map((p) => [p.id, p]));
  const creases: CreaseDefinition[] = [];
  for (const hinge of input.hinges) {
    const parent = panels.get(hinge.parent);
    const child = panels.get(hinge.child);
    if (parent === undefined || child === undefined) {
      return err(`hinge ${hinge.id} references a missing panel`);
    }
    const shared = findSharedEdge(parent, child);
    if (shared === undefined) {
      return err(`hinge ${hinge.id}: panels ${hinge.parent} and ${hinge.child} share no edge`);
    }
    const measured = creaseAngle(parent.vertices, shared.parentEdge, child.vertices);
    const restAngle = stored(measured);
    const range: readonly [number, number] =
      hinge.range ?? (restAngle > 0 ? [0, Math.PI] : restAngle < 0 ? [-Math.PI, 0] : [-Math.PI, Math.PI]);
    creases.push({
      id: creaseId(hinge.id),
      parent: hinge.parent,
      child: hinge.child,
      ...shared,
      assignment: restAngle < 0 ? "mountain" : "valley",
      restAngle,
      range,
      stiffness: hinge.stiffness ?? 0.5,
    });
  }
  return ok({ panels: net, root: input.root, creases });
}
