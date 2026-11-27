import { err, ok, type Result } from "@eschaton/foldon";
import { compatible, type EdgeDescriptor, type EdgeKind, type IncompatibleReason } from "./edges";
import { shapeEdges, shapeVertices, validateShape, type Pt, type Shape, type ShapeError } from "./lattice";

export const ANGLE_STEP = 7.5;
const SHRINK = 0.03;

export type CreaseKind = "M" | "V" | "F" | "J" | "S";
export type Articulation = Readonly<{ lo: number; hi: number }>;

export type SheetPanel = Readonly<{
  id: string;
  shape: Shape;
  vertices: readonly Pt[];
  edges: readonly EdgeDescriptor[];
}>;

/** Undirected hinge between edge `aEdge` of panel `a` and edge `bEdge` of panel `b`; angles are degrees. */
export type SheetCrease = Readonly<{
  id: string;
  kind: CreaseKind;
  a: string;
  aEdge: number;
  b: string;
  bEdge: number;
  angle: number;
  articulation?: Articulation;
}>;

export type Sheet = Readonly<{
  id: string;
  root: string;
  panels: readonly SheetPanel[];
  creases: readonly SheetCrease[];
}>;

export type Attach = Readonly<{
  id: string;
  parent: string;
  parentEdge: number;
  shape: Shape;
  edge: number;
  kind: "M" | "V" | "F" | "J";
  angle: number;
  articulation?: Articulation;
}>;

export type SheetPlan = Readonly<{
  id: string;
  root: Readonly<{ id: string; shape: Shape }>;
  attach: readonly Attach[];
}>;

export type SheetError =
  | Readonly<{ code: "invalid-shape"; message: string; panel: string; cause: ShapeError }>
  | Readonly<{ code: "duplicate-panel" | "unknown-panel" | "bad-edge" | "edge-in-use" | "bad-angle"; message: string; panel: string }>
  | Readonly<{ code: "incompatible-edge"; message: string; panel: string; reason: IncompatibleReason }>
  | Readonly<{ code: "flat-overlap"; message: string; panels: readonly [string, string] }>;

export type Rigid = Readonly<{ cos: number; sin: number; tx: number; ty: number }>;

export const applyRigid = (m: Rigid, p: Pt): Pt => [m.cos * p[0] - m.sin * p[1] + m.tx, m.sin * p[0] + m.cos * p[1] + m.ty];

/** Rigid motion (no reflection) taking c0 to p0 and c1 to p1; the segments have equal length. */
export function rigidFromSegments(c0: Pt, c1: Pt, p0: Pt, p1: Pt): Rigid {
  const turn = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) - Math.atan2(c1[1] - c0[1], c1[0] - c0[0]);
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  return { cos, sin, tx: p0[0] - (cos * c0[0] - sin * c0[1]), ty: p0[1] - (sin * c0[0] + cos * c0[1]) };
}

const vertexOf = (panel: SheetPanel, index: number): Pt => {
  const vertex = panel.vertices[index % panel.vertices.length];
  if (vertex === undefined) throw new Error("vertex index out of range");
  return vertex;
};

export function angleProblem(kind: CreaseKind, angle: number, articulation: Articulation | undefined): string | undefined {
  const onStep = (value: number): boolean => Math.abs(value / ANGLE_STEP - Math.round(value / ANGLE_STEP)) < 1e-9;
  if (!onStep(angle) || !Number.isFinite(angle)) return `angle ${angle} is not a multiple of ${ANGLE_STEP} degrees`;
  const inSign = (value: number): boolean => {
    switch (kind) {
      case "M":
        return value >= -180 && value < 0;
      case "V":
        return value > 0 && value <= 180;
      case "F":
      case "J":
        return value === 0;
      case "S":
        return value >= -180 && value <= 180;
    }
  };
  if (!inSign(angle)) return `angle ${angle} is outside the range of a ${kind} crease`;
  if (articulation === undefined) return undefined;
  const { lo, hi } = articulation;
  if (kind === "F" || kind === "J") return "flat creases cannot articulate";
  if (!onStep(lo) || !onStep(hi) || lo > hi) return `articulation [${lo}, ${hi}] is not an ordered range on the ${ANGLE_STEP} degree step`;
  const within = kind === "M" ? lo >= -180 && hi <= 0 : kind === "V" ? lo >= 0 && hi <= 180 : lo >= -180 && hi <= 180;
  if (!within || angle < lo || angle > hi) return `articulation [${lo}, ${hi}] must stay in the ${kind} sign range, include the flat state or start at it, and contain ${angle}`;
  if (lo > 0 || hi < 0) return `articulation [${lo}, ${hi}] must include the flat state so fold progress 0 stays flat`;
  return undefined;
}

const centroidOf = (vertices: readonly Pt[]): Pt => [
  vertices.reduce((sum, v) => sum + v[0], 0) / vertices.length,
  vertices.reduce((sum, v) => sum + v[1], 0) / vertices.length,
];

function shrunk(vertices: readonly Pt[]): readonly Pt[] {
  const c = centroidOf(vertices);
  return vertices.map((v): Pt => [c[0] + (v[0] - c[0]) * (1 - SHRINK), c[1] + (v[1] - c[1]) * (1 - SHRINK)]);
}

function separated(a: readonly Pt[], b: readonly Pt[]): boolean {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i];
      const q = polygon[(i + 1) % polygon.length];
      if (p === undefined || q === undefined) continue;
      const axis: Pt = [q[1] - p[1], p[0] - q[0]];
      const range = (points: readonly Pt[]): readonly [number, number] => {
        const values = points.map((v) => v[0] * axis[0] + v[1] * axis[1]);
        return [Math.min(...values), Math.max(...values)];
      };
      const [aLo, aHi] = range(a);
      const [bLo, bHi] = range(b);
      if (aHi <= bLo + 1e-9 || bHi <= aLo + 1e-9) return true;
    }
  }
  return false;
}

export function flatOverlap(panels: readonly SheetPanel[]): readonly [string, string] | undefined {
  const outlines = panels.map((p) => shrunk(p.vertices));
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const [a, b, pa, pb] = [outlines[i], outlines[j], panels[i], panels[j]];
      if (a !== undefined && b !== undefined && pa !== undefined && pb !== undefined && !separated(a, b)) return [pa.id, pb.id];
    }
  }
  return undefined;
}

export function withEdgeKind(panel: SheetPanel, edge: number, kind: EdgeKind): SheetPanel {
  return { ...panel, edges: panel.edges.map((e, i) => (i === edge ? { ...e, kind } : e)) };
}

export function buildSheet(plan: SheetPlan): Result<Sheet, SheetError> {
  const rootShape = validateShape(plan.root.shape);
  if (!rootShape.ok) return err({ code: "invalid-shape", message: rootShape.error.message, panel: plan.root.id, cause: rootShape.error });
  const panels = new Map<string, SheetPanel>([
    [plan.root.id, { id: plan.root.id, shape: plan.root.shape, vertices: shapeVertices(plan.root.shape), edges: shapeEdges(plan.root.shape) }],
  ]);
  const creases: SheetCrease[] = [];
  for (const step of plan.attach) {
    const where = step.id;
    const parent = panels.get(step.parent);
    if (parent === undefined) return err({ code: "unknown-panel", message: `parent ${step.parent} does not exist yet`, panel: where });
    if (panels.has(step.id)) return err({ code: "duplicate-panel", message: `panel ${step.id} already exists`, panel: where });
    const checked = validateShape(step.shape);
    if (!checked.ok) return err({ code: "invalid-shape", message: checked.error.message, panel: where, cause: checked.error });
    const childLocal = shapeVertices(step.shape);
    const childEdges = shapeEdges(step.shape);
    const [parentEdge, childEdge] = [parent.edges[step.parentEdge], childEdges[step.edge]];
    if (parentEdge === undefined || childEdge === undefined) return err({ code: "bad-edge", message: "edge index out of range", panel: where });
    if (parentEdge.kind !== "B") return err({ code: "edge-in-use", message: `edge ${step.parentEdge} of ${step.parent} is already glued`, panel: where });
    const fit = compatible(parentEdge, childEdge);
    if (!fit.ok) return err({ code: "incompatible-edge", message: fit.error.message, panel: where, reason: fit.error.code });
    const problem = angleProblem(step.kind, step.angle, step.articulation);
    if (problem !== undefined) return err({ code: "bad-angle", message: problem, panel: where });
    const c0 = childLocal[step.edge];
    const c1 = childLocal[(step.edge + 1) % childLocal.length];
    if (c0 === undefined || c1 === undefined) return err({ code: "bad-edge", message: "edge index out of range", panel: where });
    const rigid = rigidFromSegments(c0, c1, vertexOf(parent, step.parentEdge + 1), vertexOf(parent, step.parentEdge));
    const placed: SheetPanel = withEdgeKind(
      { id: step.id, shape: step.shape, vertices: childLocal.map((v) => applyRigid(rigid, v)), edges: childEdges },
      step.edge,
      step.kind,
    );
    panels.set(step.parent, withEdgeKind(parent, step.parentEdge, step.kind));
    panels.set(step.id, placed);
    creases.push({
      id: step.id,
      kind: step.kind,
      a: step.parent,
      aEdge: step.parentEdge,
      b: step.id,
      bEdge: step.edge,
      angle: step.angle,
      ...(step.articulation === undefined ? {} : { articulation: step.articulation }),
    });
  }
  const placedPanels = [...panels.values()];
  const overlap = flatOverlap(placedPanels);
  if (overlap !== undefined) {
    return err({ code: "flat-overlap", message: `panels ${overlap[0]} and ${overlap[1]} overlap in the flat net`, panels: overlap });
  }
  return ok({ id: plan.id, root: plan.root.id, panels: placedPanels, creases });
}
