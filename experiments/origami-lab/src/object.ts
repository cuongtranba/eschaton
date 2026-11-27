import { canonicalJson, err, fnv1a64, ok, type FoldonDefinition, type Result } from "@eschaton/foldon";
import { compatible, type IncompatibleReason } from "./edges";
import { sheetToDefinition, type FoldonError } from "./foldon";
import { shapeVertices, variantId, type Pt } from "./lattice";
import {
  angleProblem,
  applyRigid,
  buildSheet,
  flatOverlap,
  rigidFromSegments,
  withEdgeKind,
  type Articulation,
  type Sheet,
  type SheetError,
  type SheetPanel,
  type SheetPlan,
} from "./sheet";

export const TURN_STEP = 15;
export const TILT_STEP = 7.5;

export type EdgeRef = Readonly<{ part: string; panel: string; edge: number }>;
export type PanelRef = Readonly<{ part: string; panel: string }>;

export type Seam = Readonly<{
  kind: "seam";
  a: EdgeRef;
  b: EdgeRef;
  angle: number;
  articulation?: Articulation;
  closing?: true;
}>;

export type Mount = Readonly<{
  kind: "mount";
  host: PanelRef;
  child: string;
  at: readonly [number, number];
  turn: number;
  tilt: number;
  lift: number;
  anchor: number;
  side: 1 | -1;
}>;

export type Connection = Seam | Mount;
export type PartPlan = Readonly<{ name: string; plan: SheetPlan }>;
export type ObjectRecipe = Readonly<{
  name: string;
  seed: number;
  parts: readonly PartPlan[];
  connections: readonly Connection[];
}>;

export type ObjectError =
  | Readonly<{ code: "part"; message: string; part: string; cause: SheetError }>
  | Readonly<{ code: "seam"; message: string; reason: IncompatibleReason | "unknown-edge" | "cycle" | "bad-angle" | "flat-overlap" }>
  | Readonly<{ code: "mount"; message: string }>
  | Readonly<{ code: "foldon"; message: string; component: string; cause: FoldonError }>;

export type Component = Readonly<{
  index: number;
  id: string;
  parts: readonly string[];
  sheet: Sheet;
  partOf: Readonly<Record<string, string>>;
  definition: FoldonDefinition;
}>;

export type MountPlacement = Readonly<{
  host: string;
  hostComponent: number;
  hostShapeVertices: readonly Pt[];
  child: number;
  at: readonly [number, number];
  turn: number;
  tilt: number;
  lift: number;
  anchor: number;
  side: 1 | -1;
}>;

export type LabObject = Readonly<{
  name: string;
  seed: number;
  recipe: ObjectRecipe;
  fingerprint: string;
  partSheets: Readonly<Record<string, Sheet>>;
  components: readonly Component[];
  mounts: readonly MountPlacement[];
  closures: readonly Readonly<{ a: string; b: string }>[];
}>;

const globalId = (part: string, panel: string): string => `${part}.${panel}`;

function prefixed(sheet: Sheet, part: string): Sheet {
  return {
    ...sheet,
    root: globalId(part, sheet.root),
    panels: sheet.panels.map((p) => ({ ...p, id: globalId(part, p.id) })),
    creases: sheet.creases.map((c) => ({ ...c, id: globalId(part, c.id), a: globalId(part, c.a), b: globalId(part, c.b) })),
  };
}

const seamErr = (reason: Extract<ObjectError, { code: "seam" }>["reason"], message: string): Result<never, ObjectError> =>
  err({ code: "seam", reason, message });

const panelOf = (sheet: Sheet, id: string): SheetPanel | undefined => sheet.panels.find((p) => p.id === id);

function mergeSeam(current: Sheet, anchor: EdgeRef, incoming: Sheet, joined: EdgeRef, seam: Seam): Result<Sheet, ObjectError> {
  const host = panelOf(current, globalId(anchor.part, anchor.panel));
  const guest = panelOf(incoming, globalId(joined.part, joined.panel));
  const hostEdge = host?.edges[anchor.edge];
  const guestEdge = guest?.edges[joined.edge];
  if (host === undefined || guest === undefined || hostEdge === undefined || guestEdge === undefined) {
    return seamErr("unknown-edge", `seam references a missing panel or edge (${anchor.part}.${anchor.panel} / ${joined.part}.${joined.panel})`);
  }
  const fit = compatible(hostEdge, guestEdge);
  if (!fit.ok) return seamErr(fit.error.code, fit.error.message);
  const problem = angleProblem("S", seam.angle, seam.articulation);
  if (problem !== undefined) return seamErr("bad-angle", problem);
  const [p0, p1] = [host.vertices[anchor.edge], host.vertices[(anchor.edge + 1) % host.vertices.length]];
  const [q0, q1] = [guest.vertices[joined.edge], guest.vertices[(joined.edge + 1) % guest.vertices.length]];
  if (p0 === undefined || p1 === undefined || q0 === undefined || q1 === undefined) return seamErr("unknown-edge", "seam edge has no vertices");
  const rigid = rigidFromSegments(q0, q1, p1, p0);
  const moved = incoming.panels.map((p): SheetPanel => ({ ...p, vertices: p.vertices.map((v) => applyRigid(rigid, v)) }));
  const [hostId, guestId] = [host.id, guest.id];
  const panels = [
    ...current.panels.map((p) => (p.id === hostId ? withEdgeKind(p, anchor.edge, "S") : p)),
    ...moved.map((p) => (p.id === guestId ? withEdgeKind(p, joined.edge, "S") : p)),
  ];
  const overlap = flatOverlap(panels);
  if (overlap !== undefined) return seamErr("flat-overlap", `panels ${overlap[0]} and ${overlap[1]} overlap once the seam is laid flat`);
  return ok({
    ...current,
    panels,
    creases: [
      ...current.creases,
      ...incoming.creases,
      {
        id: `seam.${hostId}~${guestId}`,
        kind: "S",
        a: hostId,
        aEdge: anchor.edge,
        b: guestId,
        bEdge: joined.edge,
        angle: seam.angle,
        ...(seam.articulation === undefined ? {} : { articulation: seam.articulation }),
      },
    ],
  });
}

function closeSeam(sheet: Sheet, seam: Seam): Result<Sheet, ObjectError> {
  const a = panelOf(sheet, globalId(seam.a.part, seam.a.panel));
  const b = panelOf(sheet, globalId(seam.b.part, seam.b.panel));
  const ea = a?.edges[seam.a.edge];
  const eb = b?.edges[seam.b.edge];
  if (a === undefined || b === undefined || ea === undefined || eb === undefined) return seamErr("unknown-edge", "closing seam references a missing panel or edge");
  const fit = compatible(ea, eb);
  if (!fit.ok) return seamErr(fit.error.code, fit.error.message);
  return ok({
    ...sheet,
    panels: sheet.panels.map((p) =>
      p.id === a.id ? withEdgeKind(p, seam.a.edge, "S") : p.id === b.id ? withEdgeKind(p, seam.b.edge, "S") : p,
    ),
  });
}

function pointInside(vertices: readonly Pt[], [x, y]: readonly [number, number]): boolean {
  return vertices.every((v, i) => {
    const w = vertices[(i + 1) % vertices.length];
    return w === undefined || (w[0] - v[0]) * (y - v[1]) - (w[1] - v[1]) * (x - v[0]) >= 0;
  });
}

const onStep = (value: number, step: number): boolean => Math.abs(value / step - Math.round(value / step)) < 1e-9;

function assembleComponents(
  recipe: ObjectRecipe,
  sheets: ReadonlyMap<string, Sheet>,
): Result<readonly Readonly<{ parts: readonly string[]; sheet: Sheet }>[], ObjectError> {
  const hinges = recipe.connections.filter((c): c is Seam => c.kind === "seam" && c.closing !== true);
  const closings = recipe.connections.filter((c): c is Seam => c.kind === "seam" && c.closing === true);
  const placed = new Set<string>();
  const used = new Set<Seam>();
  const components: { parts: string[]; sheet: Sheet }[] = [];
  for (const start of recipe.parts) {
    if (placed.has(start.name)) continue;
    const first = sheets.get(start.name);
    if (first === undefined) continue;
    let sheet = prefixed(first, start.name);
    const parts = [start.name];
    placed.add(start.name);
    let grew = true;
    while (grew) {
      grew = false;
      for (const seam of hinges) {
        if (used.has(seam)) continue;
        const [aIn, bIn] = [parts.includes(seam.a.part), parts.includes(seam.b.part)];
        if (aIn && bIn) return seamErr("cycle", `seam ${seam.a.part}-${seam.b.part} would close a cycle; mark it closing`);
        if (!aIn && !bIn) continue;
        const [anchor, joined] = aIn ? [seam.a, seam.b] : [seam.b, seam.a];
        const incoming = sheets.get(joined.part);
        if (incoming === undefined) return seamErr("unknown-edge", `unknown part ${joined.part}`);
        const merged = mergeSeam(sheet, anchor, prefixed(incoming, joined.part), joined, seam);
        if (!merged.ok) return merged;
        sheet = merged.value;
        used.add(seam);
        parts.push(joined.part);
        placed.add(joined.part);
        grew = true;
      }
    }
    for (const seam of closings) {
      if (!parts.includes(seam.a.part) || !parts.includes(seam.b.part)) continue;
      const closed = closeSeam(sheet, seam);
      if (!closed.ok) return closed;
      sheet = closed.value;
    }
    components.push({ parts, sheet });
  }
  return ok(components);
}

export function objectFingerprint(recipe: ObjectRecipe): string {
  const variants = recipe.parts.map((part) => [
    part.name,
    [part.plan.root, ...part.plan.attach].map((p) => variantId(p.shape)),
    part.plan.attach.map((a) => [a.kind, a.angle, a.articulation ?? null]),
  ]);
  return fnv1a64(canonicalJson({ name: recipe.name, variants, connections: recipe.connections }));
}

export function buildObject(recipe: ObjectRecipe): Result<LabObject, ObjectError> {
  const sheets = new Map<string, Sheet>();
  for (const part of recipe.parts) {
    const built = buildSheet(part.plan);
    if (!built.ok) return err({ code: "part", message: `${part.name}: ${built.error.message}`, part: part.name, cause: built.error });
    sheets.set(part.name, built.value);
  }
  const assembled = assembleComponents(recipe, sheets);
  if (!assembled.ok) return assembled;
  const components: Component[] = [];
  for (const [index, item] of assembled.value.entries()) {
    const id = `${recipe.name}.${item.parts[0] ?? index}`;
    const definition = sheetToDefinition(item.sheet, id, id);
    if (!definition.ok) return err({ code: "foldon", message: `${id}: ${definition.error.message}`, component: id, cause: definition.error });
    const partOf = Object.fromEntries(item.sheet.panels.map((p) => [p.id, p.id.slice(0, p.id.indexOf("."))]));
    components.push({ index, id, parts: item.parts, sheet: item.sheet, partOf, definition: definition.value });
  }

  const mounts: MountPlacement[] = [];
  for (const mount of recipe.connections.filter((c): c is Mount => c.kind === "mount")) {
    const hostComponent = components.find((c) => c.parts.includes(mount.host.part));
    const child = components.find((c) => c.parts[0] === mount.child);
    const hostPanel = hostComponent === undefined ? undefined : panelOf(hostComponent.sheet, globalId(mount.host.part, mount.host.panel));
    const rootPanel = child === undefined ? undefined : panelOf(child.sheet, child.sheet.root);
    if (hostComponent === undefined || hostPanel === undefined) return err({ code: "mount", message: `mount host ${mount.host.part}.${mount.host.panel} does not exist` });
    if (child === undefined || rootPanel === undefined) return err({ code: "mount", message: `mount child ${mount.child} must be the first part of a seam component` });
    if (child.index === hostComponent.index) return err({ code: "mount", message: "a component cannot mount on itself" });
    if (!onStep(mount.turn, TURN_STEP) || !onStep(mount.tilt, TILT_STEP)) return err({ code: "mount", message: "turn must be a multiple of 15 and tilt a multiple of 7.5 degrees" });
    if (!Number.isInteger(mount.at[0]) || !Number.isInteger(mount.at[1]) || !Number.isInteger(mount.lift)) return err({ code: "mount", message: "mount coordinates are lattice integers" });
    const hostLocal = shapeVertices(hostPanel.shape);
    if (!pointInside(hostLocal, mount.at)) return err({ code: "mount", message: `mount point ${mount.at.join(",")} lies outside ${hostPanel.id}` });
    if (mount.anchor < 0 || mount.anchor >= rootPanel.vertices.length) return err({ code: "mount", message: "anchor vertex out of range" });
    mounts.push({
      host: hostPanel.id,
      hostComponent: hostComponent.index,
      hostShapeVertices: hostLocal,
      child: child.index,
      at: mount.at,
      turn: mount.turn,
      tilt: mount.tilt,
      lift: mount.lift,
      anchor: mount.anchor,
      side: mount.side,
    });
  }
  const mountedChildren = new Set(mounts.map((m) => m.child));
  const orphan = components.find((c) => c.index !== 0 && !mountedChildren.has(c.index));
  if (orphan !== undefined) return err({ code: "mount", message: `component ${orphan.id} is neither the root nor mounted` });
  const order: MountPlacement[] = [];
  const seen = new Set<number>([0]);
  while (order.length < mounts.length) {
    const next = mounts.find((m) => !order.includes(m) && seen.has(m.hostComponent));
    if (next === undefined) return err({ code: "mount", message: "mounts form a cycle or hang from an unmounted component" });
    order.push(next);
    seen.add(next.child);
  }
  return ok({
    name: recipe.name,
    seed: recipe.seed,
    recipe,
    fingerprint: objectFingerprint(recipe),
    partSheets: Object.fromEntries(sheets),
    components,
    mounts: order,
    closures: recipe.connections.flatMap((c) =>
      c.kind === "seam" && c.closing === true ? [{ a: globalId(c.a.part, c.a.panel), b: globalId(c.b.part, c.b.panel) }] : [],
    ),
  });
}
