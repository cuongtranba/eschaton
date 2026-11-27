import {
  canonicalJson,
  defineFoldon,
  err,
  faceSockets,
  fnv1a64,
  foldable,
  foldedNet,
  foldonId,
  makePanel,
  materialId,
  ok,
  panelId,
  poseGeometry,
  rectangularFootprint,
  renderable,
  type CreaseId,
  type FoldonDefinition,
  type GeometryRecipe,
  type Result,
  type Vec3,
} from "@eschaton/foldon";
import type { Articulation, Design, DesignFace } from "./design";
import {
  apply,
  centroid,
  compose,
  cross,
  dist,
  dot,
  hingeAxis,
  IDENTITY,
  normal,
  overlap2d,
  rigidBetween,
  rotation,
  scale,
  sub,
  translation,
  unit,
  type Rigid,
} from "./geom";

type Pt2 = readonly [number, number];
export type EdgeKey = string;
export const edgeKey = (a: number, b: number): EdgeKey => (a < b ? `${a}:${b}` : `${b}:${a}`);

export type Link = Readonly<{
  parent: number;
  edge: readonly [number, number];
  kind: "crease" | "glue" | "joint";
  rest: number;
  articulation?: Articulation;
  /** +1 or -1: hinge-angle sign that moves the child toward the articulation's `toward` direction. */
  sense?: 1 | -1;
}>;

export type Piece = Readonly<{
  index: number;
  id: string;
  module: string;
  root: number;
  faces: readonly number[];
  recipe: GeometryRecipe;
  creaseOf: ReadonlyMap<number, CreaseId>;
  definition: FoldonDefinition;
  offset: Vec3;
  attach?: Readonly<{ piece: number; face: number; edge: readonly [number, number]; kind: "glue" | "joint"; articulation?: Articulation }>;
}>;

export type EdgeRole = "crease" | "join" | "seam" | "joint" | "boundary";
export type CompiledEdge = Readonly<{ a: number; b: number; faces: readonly number[]; role: EdgeRole; rest?: number; articulated: boolean }>;

export type Compiled = Readonly<{
  id: string;
  design: Design;
  pieces: readonly Piece[];
  pieceOf: readonly number[];
  links: ReadonlyMap<number, Link>;
  edges: readonly CompiledEdge[];
  flat: ReadonlyMap<number, readonly Pt2[]>;
}>;

export type CompileError = Readonly<{ code: "topology" | "articulation" | "foldon" | "define"; message: string }>;

const JOIN_EPS = 1e-6;

/** Sign of a hinge rotation that moves the child's centroid toward `toward` (Foldon axis convention on the parent face). */
function senseOf(parent: readonly Vec3[], slot: readonly [number, number], child: readonly Vec3[], toward: Vec3): 1 | -1 {
  const { origin, axis } = hingeAxis(parent, slot[0], slot[1]);
  return dot(cross(axis, sub(centroid(child), origin)), toward) >= 0 ? 1 : -1;
}
const rad = (d: number): number => (d * Math.PI) / 180;

function faceAt(design: Design, i: number): DesignFace {
  const f = design.faces[i];
  if (f === undefined) throw new Error(`face ${i} does not exist`);
  return f;
}

const positions = (design: Design, f: DesignFace): readonly Vec3[] =>
  f.v.map((i) => {
    const p = design.vertices[i];
    if (p === undefined) throw new Error(`vertex ${i} does not exist`);
    return p;
  });

function faceEdges(f: DesignFace): readonly (readonly [number, number])[] {
  return f.v.map((a, k): readonly [number, number] => [a, f.v[(k + 1) % f.v.length] ?? a]);
}

/** Position of edge (a, b) in the face's cyclic order: [i, i + 1] such that {v[i], v[i+1]} = {a, b}. */
function edgeSlot(f: DesignFace, a: number, b: number): readonly [number, number] | undefined {
  for (let i = 0; i < f.v.length; i++) {
    const [p, q] = [f.v[i], f.v[(i + 1) % f.v.length]];
    if ((p === a && q === b) || (p === b && q === a)) return [i, (i + 1) % f.v.length];
  }
  return undefined;
}

function layoutAcross(design: Design, f: DesignFace, a: number, b: number, placed: ReadonlyMap<number, Pt2>, other: readonly Pt2[]): ReadonlyMap<number, Pt2> {
  const pa = design.vertices[a] ?? [0, 0, 0];
  const pb = design.vertices[b] ?? [0, 0, 0];
  const n = normal(positions(design, f));
  const x = unit(sub(pb, pa));
  const y = cross(n, x);
  const [A, B] = [placed.get(a) ?? [0, 0], placed.get(b) ?? [0, 0]];
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const X: Pt2 = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
  const Y: Pt2 = [-X[1], X[0]];
  const local = f.v.map((i): Pt2 => {
    const d = sub(design.vertices[i] ?? pa, pa);
    return [dot(d, x), dot(d, y)];
  });
  const cy = local.reduce((s, p) => s + p[1], 0) / local.length;
  const oc = other.reduce<Pt2>((s, p) => [s[0] + p[0] / other.length, s[1] + p[1] / other.length], [0, 0]);
  const side = X[0] * (oc[1] - A[1]) - X[1] * (oc[0] - A[0]);
  const flip = Math.sign(cy) === Math.sign(side) ? -1 : 1;
  return new Map(f.v.map((i, k) => {
    const [lx, ly] = local[k] ?? [0, 0];
    return [i, [A[0] + lx * X[0] + flip * ly * Y[0], A[1] + lx * X[1] + flip * ly * Y[1]] as const];
  }));
}

function seedLayout(design: Design, f: DesignFace): ReadonlyMap<number, Pt2> {
  const ps = positions(design, f);
  const o = ps[0] ?? [0, 0, 0];
  const x = unit(sub(ps[1] ?? o, o));
  const y = cross(normal(ps), x);
  return new Map(f.v.map((i, k) => [i, [dot(sub(ps[k] ?? o, o), x), dot(sub(ps[k] ?? o, o), y)] as const]));
}

type Grown = { faces: number[]; root: number; parent: Map<number, Readonly<{ face: number; edge: readonly [number, number] }>>; flat: Map<number, readonly Pt2[]> };

function growPiece(design: Design, root: number, moduleFaces: ReadonlySet<number>, taken: Set<number>, edgeFaces: ReadonlyMap<EdgeKey, readonly number[]>, scaleLen: number): Grown {
  const piece: Grown = { faces: [root], root, parent: new Map(), flat: new Map() };
  const layout = new Map<number, ReadonlyMap<number, Pt2>>([[root, seedLayout(design, faceAt(design, root))]]);
  const polygon = (i: number): readonly Pt2[] => {
    const l = layout.get(i);
    return faceAt(design, i).v.map((v): Pt2 => l?.get(v) ?? [0, 0]);
  };
  piece.flat.set(root, polygon(root));
  taken.add(root);
  const queue = [root];
  for (const current of queue) {
    const f = faceAt(design, current);
    for (const [a, b] of faceEdges(f)) {
      for (const next of edgeFaces.get(edgeKey(a, b)) ?? []) {
        if (taken.has(next) || !moduleFaces.has(next)) continue;
        const placed = layoutAcross(design, faceAt(design, next), a, b, layout.get(current) ?? new Map(), polygon(current));
        const poly = faceAt(design, next).v.map((v): Pt2 => placed.get(v) ?? [0, 0]);
        if (piece.faces.some((g) => overlap2d(poly, polygon(g), 1e-9 * scaleLen))) continue;
        layout.set(next, placed);
        piece.flat.set(next, poly);
        piece.faces.push(next);
        piece.parent.set(next, { face: current, edge: [a, b] });
        taken.add(next);
        queue.push(next);
      }
    }
  }
  return piece;
}

/**
 * Unfolds every module into flat, non-overlapping pieces (greedy breadth-first edge unfolding, Mitani & Suzuki 2004 style),
 * compiles each piece to a Foldon recipe through `foldedNet` (rest angles measured from the design) and links pieces by glue
 * seams and module joints.
 */
export function compileDesign(design: Design): Result<Compiled, CompileError> {
  const fail = (code: CompileError["code"], message: string): Result<never, CompileError> => err({ code, message });
  const edgeFaces = new Map<EdgeKey, number[]>();
  design.faces.forEach((f, i) => {
    for (const [a, b] of faceEdges(f)) edgeFaces.set(edgeKey(a, b), [...(edgeFaces.get(edgeKey(a, b)) ?? []), i]);
  });
  const xs = design.vertices.map((v) => v[0]);
  const scaleLen = Math.max(1e-9, Math.max(...xs) - Math.min(...xs));
  const modules = [...new Set(design.faces.map((f) => f.module))];
  const ordered = [design.rootModule, ...modules.filter((m) => m !== design.rootModule)];
  const jointOf = new Map(design.joints.map((j) => [j.module, j]));
  const pieceOf: number[] = design.faces.map(() => -1);
  const grown: (Grown & { module: string; attach?: Piece["attach"] })[] = [];
  const taken = new Set<number>();

  for (const module of ordered) {
    const members = new Set(design.faces.flatMap((f, i) => (f.module === module ? [i] : [])));
    if (members.size === 0) return fail("topology", `module ${module} has no faces`);
    let root: number | undefined;
    let attach: Piece["attach"];
    if (module === design.rootModule) {
      root = design.faces.findIndex((f) => f.module === module && f.part === design.rootPart);
      if (root < 0) return fail("topology", `root part ${design.rootPart} not found`);
    } else {
      const joint = jointOf.get(module);
      if (joint === undefined) return fail("topology", `module ${module} has no joint`);
      const [a, b] = joint.edge;
      const sharing = edgeFaces.get(edgeKey(a, b)) ?? [];
      const child = sharing.find((i) => faceAt(design, i).module === module);
      const host = sharing.find((i) => faceAt(design, i).module === joint.parent);
      if (child === undefined || host === undefined) return fail("topology", `joint ${module}: edge ${a}-${b} is not shared by ${module} and ${joint.parent}`);
      root = child;
      attach = { piece: pieceOf[host] ?? -1, face: host, edge: [a, b], kind: "joint", ...(joint.articulation === undefined ? {} : { articulation: joint.articulation }) };
      if (attach.piece < 0) return fail("topology", `joint ${module}: parent ${joint.parent} is not compiled before it`);
    }
    const rule = design.sheets[module] ?? "module";
    const sheetOf = (f: number): string => {
      const part = faceAt(design, f).part;
      return rule === "module" ? module : rule === "part" ? part : (rule[part] ?? part);
    };
    while (root !== undefined) {
      const key = sheetOf(root);
      const sheet = new Set([...members].filter((f) => sheetOf(f) === key));
      const g = growPiece(design, root, sheet, taken, edgeFaces, scaleLen);
      for (const f of g.faces) pieceOf[f] = grown.length;
      grown.push({ ...g, module, ...(attach === undefined ? {} : { attach }) });
      root = undefined;
      attach = undefined;
      for (const f of [...members].sort((p, q) => p - q)) {
        if (taken.has(f)) continue;
        const neighbour = faceEdges(faceAt(design, f))
          .flatMap(([a, b]) => (edgeFaces.get(edgeKey(a, b)) ?? []).filter((g2) => taken.has(g2) && members.has(g2)).map((g2) => ({ g2, edge: [a, b] as const })))
          .at(0);
        if (neighbour === undefined) continue;
        root = f;
        attach = { piece: pieceOf[neighbour.g2] ?? -1, face: neighbour.g2, edge: neighbour.edge, kind: "glue" };
        break;
      }
      if (root === undefined && [...members].some((f) => !taken.has(f))) return fail("topology", `module ${module} is not edge-connected`);
    }
  }

  const articulatedEdge = new Map(design.articulated.map((a) => [edgeKey(a.edge[0], a.edge[1]), a]));
  const links = new Map<number, Link>();
  const pieces: Piece[] = [];
  for (const [index, g] of grown.entries()) {
    const id = `${design.kind}.${g.module}.p${index}`;
    const panels = g.faces.map((f) => makePanel(panelId(faceAt(design, f).id), positions(design, faceAt(design, f))));
    const creaseFor = (child: number): string => `${faceAt(design, g.parent.get(child)?.face ?? child).id}>${faceAt(design, child).id}`;
    const hinges = g.faces.filter((f) => f !== g.root).map((f) => ({ id: creaseFor(f), parent: panelId(faceAt(design, g.parent.get(f)?.face ?? f).id), child: panelId(faceAt(design, f).id) }));
    const net = foldedNet({ panels, root: panelId(faceAt(design, g.root).id), hinges });
    if (!net.ok) return fail("foldon", `${id}: ${net.error}`);
    const creaseOf = new Map<number, CreaseId>();
    const creases = net.value.creases.map((c) => {
      const child = g.faces.find((f) => faceAt(design, f).id === c.child);
      if (child === undefined) return c;
      creaseOf.set(child, c.id);
      const edge = g.parent.get(child)?.edge ?? [0, 0];
      const art = articulatedEdge.get(edgeKey(edge[0], edge[1]))?.articulation;
      const parentFace = faceAt(design, g.parent.get(child)?.face ?? child);
      const sense = art === undefined ? 1 : senseOf(positions(design, parentFace), edgeSlot(parentFace, edge[0], edge[1]) ?? [0, 1], positions(design, faceAt(design, child)), art.toward);
      const values = [0, c.restAngle, ...(art === undefined ? [] : [c.restAngle + sense * rad(art.lo), c.restAngle + sense * rad(art.hi)])];
      const range: readonly [number, number] =
        Math.abs(c.restAngle) < JOIN_EPS && art === undefined ? [Math.min(0, c.restAngle), Math.max(0, c.restAngle)] : [Math.max(-Math.PI, Math.min(...values)), Math.min(Math.PI, Math.max(...values))];
      links.set(child, { parent: g.parent.get(child)?.face ?? child, edge, kind: "crease", rest: c.restAngle, ...(art === undefined ? {} : { articulation: art, sense }) });
      return { ...c, range };
    });
    const recipe: GeometryRecipe = { ...net.value, creases };
    if (g.attach !== undefined) {
      const host = faceAt(design, g.attach.face);
      const slot = edgeSlot(host, g.attach.edge[0], g.attach.edge[1]);
      if (slot === undefined) return fail("topology", `${id}: attach edge not on host face`);
      const hostPos = positions(design, host);
      const { axis } = hingeAxis(hostPos, slot[0], slot[1]);
      const childPos = positions(design, faceAt(design, g.root));
      const rest = Math.atan2(dot(cross(normal(hostPos), normal(childPos)), axis), dot(normal(hostPos), normal(childPos)));
      const sense = g.attach.articulation === undefined ? 1 : senseOf(hostPos, slot, childPos, g.attach.articulation.toward);
      links.set(g.root, { parent: g.attach.face, edge: g.attach.edge, kind: g.attach.kind, rest, ...(g.attach.articulation === undefined ? {} : { articulation: g.attach.articulation, sense }) });
    }
    const all = recipe.panels.flatMap((p) => p.vertices);
    const min: Vec3 = [Math.min(...all.map((v) => v[0])), Math.min(...all.map((v) => v[1])), Math.min(...all.map((v) => v[2]))];
    const shifted = recipe.panels.map((p) => ({ ...p, vertices: p.vertices.map((v): Vec3 => [Math.round((v[0] - min[0]) * 1e9) / 1e9 + 0, Math.round((v[1] - min[1]) * 1e9) / 1e9 + 0, Math.round((v[2] - min[2]) * 1e9) / 1e9 + 0]) }));
    const extent = [0, 1, 2].map((k) => Math.max(1, Math.ceil(Math.max(...shifted.flatMap((p) => p.vertices.map((v) => v[k] ?? 0))) - 1e-9)));
    const footprint = rectangularFootprint(extent[0] ?? 1, extent[1] ?? 1, extent[2] ?? 1);
    const defined = defineFoldon({
      id: foldonId(id),
      name: id,
      footprint,
      geometry: { ...recipe, panels: shifted },
      sockets: faceSockets(footprint, { default: "open" }),
      components: [...(recipe.creases.length > 0 ? [foldable({ creases: recipe.creases.map((c) => c.id), stiffness: 0.5 })] : []), renderable({ material: materialId("paper") })],
      tags: ["origami-lab", "v2"],
    });
    if (!defined.ok) return fail("define", `${id}: ${defined.error.map((i) => `${i.code} at ${i.path}`).join("; ")}`);
    pieces.push({ index, id, module: g.module, root: g.root, faces: g.faces, recipe, creaseOf, definition: defined.value, offset: min, ...(g.attach === undefined ? {} : { attach: g.attach }) });
  }

  for (const art of design.articulated) {
    const sharing = edgeFaces.get(edgeKey(art.edge[0], art.edge[1])) ?? [];
    const hinged = sharing.some((f) => {
      const link = links.get(f);
      return link?.kind === "crease" && sharing.includes(link.parent) && edgeKey(link.edge[0], link.edge[1]) === edgeKey(art.edge[0], art.edge[1]);
    });
    if (!hinged) return fail("articulation", `articulated edge ${art.id} is not a hinge after unfolding (it became a cut)`);
  }

  const edges: CompiledEdge[] = [...edgeFaces.entries()].map(([key, faces]) => {
    const [a, b] = key.split(":").map(Number);
    const candidates = faces.map((f) => links.get(f)).filter((l): l is Link => l !== undefined && faces.includes(l.parent) && edgeKey(l.edge[0], l.edge[1]) === key);
    const linked = candidates.find((l) => l.kind === "joint") ?? candidates[0];
    const articulated = articulatedEdge.has(key) || (linked?.articulation !== undefined);
    const role: EdgeRole =
      faces.length === 1 ? "boundary" : linked === undefined ? "seam" : linked.kind === "joint" ? "joint" : linked.kind === "glue" ? "seam" : Math.abs(linked.rest) < JOIN_EPS ? "join" : "crease";
    return { a: a ?? 0, b: b ?? 0, faces, role, ...(linked === undefined ? {} : { rest: linked.rest }), articulated };
  });

  const flat = new Map<number, readonly Pt2[]>();
  for (const g of grown) for (const [f, poly] of g.flat) flat.set(f, poly);
  const id = fnv1a64(canonicalJson({ kind: design.kind, version: design.version, params: design.params }));
  return ok({ id, design, pieces, pieceOf, links, edges, flat });
}

export type PosedFace = Readonly<{ face: number; id: string; module: string; part: string; piece: number; vertices: readonly Vec3[] }>;
export type Pose = Readonly<{ t: number; phase: number | undefined; faces: readonly PosedFace[] }>;

const offsetOf = (link: Link | undefined, phase: number | undefined): number => {
  const art = link?.articulation;
  return art === undefined || phase === undefined ? 0 : (link?.sense ?? 1) * rad(art.lo + (art.hi - art.lo) * Math.min(1, Math.max(0, phase)));
};

/** Local pose of every piece: its root face stays at the design position, creases at t * (rest + articulation offset). */
export function posePieces(c: Compiled, t: number, phase?: number): ReadonlyMap<number, readonly Vec3[]> {
  const out = new Map<number, readonly Vec3[]>();
  for (const piece of c.pieces) {
    const angles = new Map<CreaseId, number>();
    for (const [face, id] of piece.creaseOf) {
      const link = c.links.get(face);
      if (link === undefined) continue;
      angles.set(id, t * (link.rest + offsetOf(link, phase)));
    }
    const posed = poseGeometry(piece.recipe, angles);
    if (!posed.ok) throw new Error(`${piece.id}: ${posed.error.message}`);
    piece.faces.forEach((f, k) => out.set(f, posed.value.panels[k]?.vertices ?? []));
  }
  return out;
}

/**
 * Assembled pose. At t = 1 every piece sits at its design position (seams closed). For t < 1 pieces fold about their own
 * root face and are drawn exploded away from their parent by `explode * (1 - t)`: the lab shows each sheet folding, it does
 * not claim a collision-free physical assembly path between pieces.
 */
export function poseCompiled(c: Compiled, t: number, phase?: number, explode = 0): Pose {
  const tt = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const local = posePieces(c, tt, phase);
  const transforms = new Map<number, Rigid>();
  const rest = (f: number): readonly Vec3[] => positions(c.design, faceAt(c.design, f));
  const pieceCentre = (p: Piece): Vec3 => centroid(p.faces.flatMap(rest));
  for (const piece of c.pieces) {
    if (piece.attach === undefined) {
      transforms.set(piece.index, IDENTITY);
      continue;
    }
    const parent = transforms.get(piece.attach.piece) ?? IDENTITY;
    const hostRest = rest(piece.attach.face);
    const hostNow = local.get(piece.attach.face) ?? hostRest;
    const m = rigidBetween([hostRest[0] ?? [0, 0, 0], hostRest[1] ?? [0, 0, 0], hostRest[2] ?? [0, 0, 0]], [hostNow[0] ?? [0, 0, 0], hostNow[1] ?? [0, 0, 0], hostNow[2] ?? [0, 0, 0]]);
    const slot = edgeSlot(faceAt(c.design, piece.attach.face), piece.attach.edge[0], piece.attach.edge[1]) ?? [0, 1];
    const { origin, axis } = hingeAxis(hostRest, slot[0], slot[1]);
    const turn = rotation(origin, axis, tt * offsetOf(c.links.get(piece.root), phase));
    const parentPiece = c.pieces[piece.attach.piece];
    const away = parentPiece === undefined ? ([0, 0, 0] as const) : unit(sub(pieceCentre(piece), pieceCentre(parentPiece)));
    const shift = translation(scale(away, explode * (1 - tt)));
    transforms.set(piece.index, compose(compose(compose(parent, m), shift), turn));
  }
  const faces = c.design.faces.map((f, i): PosedFace => {
    const piece = c.pieceOf[i] ?? 0;
    const m = transforms.get(piece) ?? IDENTITY;
    return { face: i, id: f.id, module: f.module, part: f.part, piece, vertices: (local.get(i) ?? rest(i)).map((p) => apply(m, p)) };
  });
  return { t: tt, phase, faces };
}

/** Largest distance between posed copies of one design vertex (0 when every seam and joint is closed). */
export function seamGap(c: Compiled, pose: Pose): number {
  const copies = new Map<number, Vec3[]>();
  pose.faces.forEach((pf) => {
    const f = faceAt(c.design, pf.face);
    f.v.forEach((v, k) => copies.set(v, [...(copies.get(v) ?? []), pf.vertices[k] ?? [0, 0, 0]]));
  });
  let worst = 0;
  for (const list of copies.values()) for (const p of list) worst = Math.max(worst, dist(p, list[0] ?? p));
  return worst;
}
