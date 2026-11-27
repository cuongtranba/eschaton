import { err, ok, type Result, type Vec3 } from "@eschaton/foldon";
import { compileDesign, type Compiled } from "../v2/compile";
import type { Articulation, Design, DesignFace, ModuleJoint } from "../v2/design";
import { add, apply, cross, dist, IDENTITY, rigidBetween, scale, sub, unit, type Rigid } from "../v2/geom";
import { posedContacts } from "../v2/verify";
import { ACCEPTS, CONTRACTS, edgeFrame, q6, type EdgePort, type ModuleDef, type Port, type SectionPort } from "./module";

/** One placed use of a module definition. `decidedBy` names the solver variables whose values chose it. */
export type Instance = Readonly<{ id: string; slot: string; def: ModuleDef; decidedBy?: readonly string[] }>;

/** Plug `childPort` of `child` onto socket `parentPort` of `parent`. `angle`: orientation-free opening angle in degrees. */
export type Attachment = Readonly<{ child: string; childPort: string; parent: string; parentPort: string; angle?: number; flip?: boolean; articulation?: Articulation }>;

/** Two ports that must coincide in the assembled pose (closing a loop of the part graph), checked, never placed by. */
export type Seam = Readonly<{ a: string; aPort: string; b: string; bPort: string }>;

export type Elimination = Readonly<{ value: string; by: string }>;
export type Decision = Readonly<{ variable: string; value: string; eliminated: readonly Elimination[] }>;

export type Assembly = Readonly<{
  name: string;
  root: string;
  /** World translation of the root instance's module frame. */
  origin?: Vec3;
  instances: readonly Instance[];
  attachments: readonly Attachment[];
  seams: readonly Seam[];
  decisions: readonly Decision[];
}>;

export type AttachErrorCode = "unknown-instance" | "unknown-port" | "kind-mismatch" | "side-mismatch" | "length-mismatch" | "angle-not-allowed" | "port-in-use" | "ports-apart" | "not-a-tree" | "duplicate-id";
export type AttachError = Readonly<{ code: AttachErrorCode; message: string }>;

export type Built = Readonly<{
  assembly: Assembly;
  /** World position of every module-local vertex, per instance. */
  world: ReadonlyMap<string, readonly Vec3[]>;
  transforms: ReadonlyMap<string, Rigid>;
  /** Global (welded) vertex index of each module-local vertex, per instance. */
  global: ReadonlyMap<string, readonly number[]>;
  vertices: readonly Vec3[];
}>;

const WELD = 1e-9;
const O3: Vec3 = [0, 0, 0];
const fail = (code: AttachErrorCode, message: string): Result<never, AttachError> => err({ code, message });
const rot = (m: Rigid, v: Vec3): Vec3 => sub(apply(m, v), apply(m, O3));

function portOf(inst: Instance, name: string): Port | undefined {
  return inst.def.ports.find((p) => p.name === name);
}

function portVerts(p: Port): readonly number[] {
  return p.type === "edge" ? [p.a, p.b] : p.verts;
}

/** Vertex pairs (child local, parent local) that an attachment identifies. */
function pairs(child: Port, parent: Port, flip: boolean): readonly (readonly [number, number])[] {
  if (child.type === "edge" && parent.type === "edge") return flip ? [[child.a, parent.a], [child.b, parent.b]] : [[child.a, parent.b], [child.b, parent.a]];
  const [c, p] = [portVerts(child), portVerts(parent)];
  return c.map((v, i) => [v, p[i] ?? 0] as const);
}

/** Checks an attachment's contract (kinds, sides, lengths, angle ladder) before placement. */
export function checkContract(child: Instance, parent: Instance, a: Attachment): Result<readonly [Port, Port], AttachError> {
  const [cp, pp] = [portOf(child, a.childPort), portOf(parent, a.parentPort)];
  if (cp === undefined) return fail("unknown-port", `${child.id} has no port ${a.childPort}`);
  if (pp === undefined) return fail("unknown-port", `${parent.id} has no port ${a.parentPort}`);
  if (cp.kind !== pp.kind && !(ACCEPTS[pp.kind] ?? []).includes(cp.kind)) return fail("kind-mismatch", `${child.id}.${cp.name} is ${cp.kind}, ${parent.id}.${pp.name} is ${pp.kind}`);
  if (cp.type !== pp.type) return fail("kind-mismatch", `${cp.type} port onto ${pp.type} port`);
  const sides = cp.type === "edge" ? cp.side === "plug" && pp.side === "socket" : cp.side === "seam" ? pp.side === "seam" : cp.side !== pp.side && pp.side !== "seam";
  if (!sides) return fail("side-mismatch", `${child.id}.${cp.name} (${cp.side}) onto ${parent.id}.${pp.name} (${pp.side})`);
  if (cp.type === "edge" && pp.type === "edge") {
    if (Math.abs(cp.length - pp.length) > 1e-6) return fail("length-mismatch", `${child.id}.${cp.name} length ${cp.length} ≠ ${parent.id}.${pp.name} length ${pp.length}`);
    const ladder = CONTRACTS[cp.kind]?.angles ?? [];
    const angle = Math.round((a.angle ?? 180) * 1000) / 1000;
    if (!ladder.includes(angle)) return fail("angle-not-allowed", `${angle}° is not on the ${cp.kind} ladder`);
  } else if (portVerts(cp).length !== portVerts(pp).length) return fail("kind-mismatch", "section vertex counts differ");
  return ok([cp, pp] as const);
}

function placeEdge(child: Instance, cp: EdgePort, parentWorld: readonly Vec3[], parentT: Rigid, parent: Instance, pp: EdgePort, angleDeg: number, flip: boolean): Rigid {
  const pf = edgeFrame(parent.def.vertices, parent.def.panels[pp.panel]?.v ?? [], pp.a, pp.b);
  const [P0, P1] = [parentWorld[pp.a] ?? O3, parentWorld[pp.b] ?? O3];
  const [wp, np] = [rot(parentT, pf.inward), rot(parentT, pf.normal)];
  const theta = (angleDeg * Math.PI) / 180;
  const target = add(scale(wp, Math.cos(theta)), scale(np, Math.sin(theta)));
  const cf = edgeFrame(child.def.vertices, child.def.panels[cp.panel]?.v ?? [], cp.a, cp.b);
  const [Q0, x] = flip ? [P0, unit(sub(P1, P0))] : [P1, unit(sub(P0, P1))];
  const cx = unit(sub(cf.p1, cf.p0));
  return rigidBetween([cf.p0, add(cf.p0, cx), add(cf.p0, cf.inward)], [Q0, add(Q0, x), add(Q0, target)]);
}

function placeSection(child: Instance, cp: SectionPort, parentWorld: readonly Vec3[], pp: SectionPort): Rigid {
  const c = cp.verts.map((v) => child.def.vertices[v] ?? O3);
  const p = pp.verts.map((v) => parentWorld[v] ?? O3);
  const last = c.length - 1;
  return rigidBetween([c[0] ?? O3, c[1] ?? O3, c[last] ?? O3], [p[0] ?? O3, p[1] ?? O3, p[last] ?? O3]);
}

/**
 * Places every instance through its single parent attachment (the part graph must be a tree over attachments), checks
 * every contract and that every attached and seamed port pair coincides, and welds vertices only at declared ports.
 */
export function placeAssembly(asm: Assembly): Result<Built, AttachError> {
  const byId = new Map<string, Instance>();
  for (const inst of asm.instances) {
    if (byId.has(inst.id)) return fail("duplicate-id", `instance ${inst.id} appears twice`);
    byId.set(inst.id, inst);
  }
  if (!byId.has(asm.root)) return fail("unknown-instance", `root ${asm.root}`);
  const used = new Set<string>();
  const use = (inst: string, port: string): Result<true, AttachError> => {
    const key = `${inst}.${port}`;
    if (used.has(key)) return fail("port-in-use", key);
    used.add(key);
    return ok(true);
  };
  const parentOf = new Map<string, Attachment>();
  for (const a of asm.attachments) {
    if (!byId.has(a.child) || !byId.has(a.parent)) return fail("unknown-instance", `${a.child} → ${a.parent}`);
    if (parentOf.has(a.child) || a.child === asm.root) return fail("not-a-tree", `${a.child} has more than one parent attachment`);
    parentOf.set(a.child, a);
    for (const [i, p] of [[a.child, a.childPort], [a.parent, a.parentPort]] as const) {
      const r = use(i, p);
      if (!r.ok) return r;
    }
  }
  for (const s of asm.seams) {
    for (const [i, p] of [[s.a, s.aPort], [s.b, s.bPort]] as const) {
      if (!byId.has(i)) return fail("unknown-instance", i);
      const r = use(i, p);
      if (!r.ok) return r;
    }
  }
  const rootT: Rigid = { r: IDENTITY.r, t: asm.origin ?? O3 };
  const transforms = new Map<string, Rigid>([[asm.root, rootT]]);
  const world = new Map<string, readonly Vec3[]>();
  const rootInst = byId.get(asm.root);
  if (rootInst !== undefined) world.set(asm.root, rootInst.def.vertices.map((v) => apply(rootT, v)));
  const order = [asm.root];
  for (const pid of order) {
    for (const a of asm.attachments.filter((x) => x.parent === pid)) {
      const [child, parent] = [byId.get(a.child), byId.get(a.parent)];
      if (child === undefined || parent === undefined) return fail("unknown-instance", a.child);
      const contract = checkContract(child, parent, a);
      if (!contract.ok) return contract;
      const [cp, pp] = contract.value;
      const pw = world.get(pid) ?? [];
      const t = cp.type === "edge" && pp.type === "edge" ? placeEdge(child, cp, pw, transforms.get(pid) ?? IDENTITY, parent, pp, a.angle ?? 180, a.flip === true) : cp.type === "section" && pp.type === "section" ? placeSection(child, cp, pw, pp) : IDENTITY;
      transforms.set(a.child, t);
      const cw = child.def.vertices.map((v) => apply(t, v));
      world.set(a.child, cw);
      for (const [c, p] of pairs(cp, pp, a.flip === true)) {
        if (dist(cw[c] ?? O3, pw[p] ?? O3) > WELD) return fail("ports-apart", `${a.child}.${a.childPort} does not land on ${a.parent}.${a.parentPort} (${dist(cw[c] ?? O3, pw[p] ?? O3).toExponential(2)})`);
      }
      order.push(a.child);
    }
  }
  if (order.length !== asm.instances.length) return fail("not-a-tree", `${asm.instances.length - order.length} instances are not reachable from ${asm.root}`);

  const parentKey = new Map<string, string>();
  const find = (k: string): string => {
    let r = k;
    while (parentKey.has(r)) r = parentKey.get(r) ?? r;
    return r;
  };
  const union = (x: string, y: string): void => {
    const [a, b] = [find(x), find(y)];
    if (a !== b) parentKey.set(a, b);
  };
  for (const a of asm.attachments) {
    const [ci, pi] = [byId.get(a.child), byId.get(a.parent)];
    const [cp, pp] = [ci === undefined ? undefined : portOf(ci, a.childPort), pi === undefined ? undefined : portOf(pi, a.parentPort)];
    if (cp === undefined || pp === undefined) continue;
    for (const [c, p] of pairs(cp, pp, a.flip === true)) union(`${a.child}:${c}`, `${a.parent}:${p}`);
  }
  for (const s of asm.seams) {
    const [ia, ib] = [byId.get(s.a), byId.get(s.b)];
    const [pa, pb] = [ia === undefined ? undefined : portOf(ia, s.aPort), ib === undefined ? undefined : portOf(ib, s.bPort)];
    if (pa === undefined || pb === undefined) return fail("unknown-port", `${s.a}.${s.aPort} / ${s.b}.${s.bPort}`);
    const [va, vb] = [portVerts(pa), portVerts(pb)];
    const [wa, wb] = [world.get(s.a) ?? [], world.get(s.b) ?? []];
    const direct = va.every((v, i) => dist(wa[v] ?? O3, wb[vb[i] ?? 0] ?? O3) <= WELD);
    const reversed = va.every((v, i) => dist(wa[v] ?? O3, wb[vb[vb.length - 1 - i] ?? 0] ?? O3) <= WELD);
    if (va.length !== vb.length || (!direct && !reversed)) return fail("ports-apart", `seam ${s.a}.${s.aPort} / ${s.b}.${s.bPort} is open`);
    va.forEach((v, i) => { union(`${s.a}:${v}`, `${s.b}:${vb[direct ? i : vb.length - 1 - i] ?? 0}`); });
  }
  const index = new Map<string, number>();
  const vertices: Vec3[] = [];
  const global = new Map<string, readonly number[]>();
  for (const id of order) {
    const inst = byId.get(id);
    if (inst === undefined) continue;
    const ws = world.get(id) ?? [];
    global.set(
      id,
      inst.def.vertices.map((_, v) => {
        const root = find(`${id}:${v}`);
        const known = index.get(root);
        if (known !== undefined) return known;
        vertices.push(ws[v] ?? O3);
        index.set(root, vertices.length - 1);
        return vertices.length - 1;
      }),
    );
  }
  return ok({ assembly: { ...asm, instances: order.flatMap((id) => { const inst = byId.get(id); return inst === undefined ? [] : [inst]; }) }, world, transforms, global, vertices });
}

/** The assembled object in the lab's design format: one module (one sheet) per instance, joints = attachments. */
export function toDesign(b: Built, kind: string, params: Readonly<Record<string, number | string>>, landmarks: Readonly<Record<string, Vec3>> = {}): Design {
  const faces: DesignFace[] = [];
  for (const inst of b.assembly.instances) {
    const g = b.global.get(inst.id) ?? [];
    inst.def.panels.forEach((p, k) => faces.push({ id: `${inst.id}#${k}`, module: inst.id, part: `${inst.slot}/${p.part}`, v: p.v.map((v) => g[v] ?? 0), ...(p.thin === true ? { thin: true as const } : {}) }));
  }
  const byId = new Map(b.assembly.instances.map((i) => [i.id, i] as const));
  const joints: ModuleJoint[] = b.assembly.attachments.map((a) => {
    const [child, parent] = [byId.get(a.child), byId.get(a.parent)];
    const cp = child === undefined ? undefined : portOf(child, a.childPort);
    const gc = b.global.get(a.child) ?? [];
    const verts = cp === undefined ? [] : portVerts(cp);
    const edgeOf = (inst: Instance | undefined, x: number, y: number): boolean => inst?.def.panels.some((p) => p.v.some((v, k) => (v === x && p.v[(k + 1) % p.v.length] === y) || (v === y && p.v[(k + 1) % p.v.length] === x))) === true;
    const pp = parent === undefined ? undefined : portOf(parent, a.parentPort);
    const pverts = pp === undefined ? [] : portVerts(pp);
    const k = cp?.type === "edge" ? 0 : verts.findIndex((v, i) => i + 1 < verts.length && edgeOf(child, v, verts[i + 1] ?? 0) && edgeOf(parent, pverts[i] ?? 0, pverts[i + 1] ?? 0));
    const edge = [gc[verts[Math.max(0, k)] ?? 0] ?? 0, gc[verts[Math.max(0, k) + 1] ?? 0] ?? 0] as const;
    return { module: a.child, parent: a.parent, edge, ...(a.articulation === undefined ? {} : { articulation: a.articulation }) };
  });
  const rootInst = byId.get(b.assembly.root);
  return {
    kind,
    version: 3,
    params,
    vertices: b.vertices,
    faces,
    rootModule: b.assembly.root,
    rootPart: `${rootInst?.slot ?? ""}/${rootInst?.def.panels[0]?.part ?? ""}`,
    joints,
    articulated: [],
    landmarks,
    sheets: {},
  };
}

export type CompiledAssembly = Readonly<{ built: Built; compiled: Compiled; design: Design }>;

/** Places, converts and compiles; refuses unless every compiled sheet is exactly one instance's panels. */
export function compileAssembly(asm: Assembly, kind: string, params: Readonly<Record<string, number | string>>, landmarks: (b: Built) => Readonly<Record<string, Vec3>> = () => ({})): Result<CompiledAssembly, AttachError | Readonly<{ code: "compile" | "sheet-split"; message: string }>> {
  const built = placeAssembly(asm);
  if (!built.ok) return built;
  const design = toDesign(built.value, kind, params, landmarks(built.value));
  const compiled = compileDesign(design);
  if (!compiled.ok) return err({ code: "compile", message: `${compiled.error.code}: ${compiled.error.message}` });
  const sizes = new Map(asm.instances.map((i) => [i.id, i.def.panels.length] as const));
  const split = compiled.value.pieces.find((p) => sizes.get(p.module) !== p.faces.length) ?? (compiled.value.pieces.length === asm.instances.length ? undefined : compiled.value.pieces[0]);
  if (split !== undefined) return err({ code: "sheet-split", message: `${split.module} did not compile to exactly one sheet` });
  return ok({ built: built.value, compiled: compiled.value, design });
}

/**
 * Contacts between panels that are not on a boundary they share (exact test, rest pose). Instance bounding boxes are a
 * broadphase only: two instances whose boxes are more than 1e-6 apart cannot touch, every other panel pair is tested.
 */
export function assemblyContacts(b: Built): ReturnType<typeof posedContacts> {
  const groups = b.assembly.instances.map((inst) => {
    const w = b.world.get(inst.id) ?? [];
    const panels = inst.def.panels.map((p, k) => ({ id: `${inst.id}#${k}`, vertices: p.v.map((v) => w[v] ?? O3) }));
    const all = panels.flatMap((p) => p.vertices);
    const lo: Vec3 = [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.min(...all.map((p) => p[2]))];
    const hi: Vec3 = [Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1])), Math.max(...all.map((p) => p[2]))];
    return { panels, lo, hi };
  });
  const apart = (x: (typeof groups)[number], y: (typeof groups)[number]): boolean => [0, 1, 2].some((k) => (x.lo[k] ?? 0) - (y.hi[k] ?? 0) > 1e-6 || (y.lo[k] ?? 0) - (x.hi[k] ?? 0) > 1e-6);
  const found: ReturnType<typeof posedContacts>[number][] = [];
  groups.forEach((g, i) => {
    found.push(...posedContacts(g.panels));
    for (let j = i + 1; j < groups.length; j++) {
      const h = groups[j];
      if (h === undefined || apart(g, h)) continue;
      const pairs = posedContacts([...g.panels, ...h.panels]);
      const own = new Set(g.panels.map((p) => p.id));
      found.push(...pairs.filter((c) => own.has(c.a) !== own.has(c.b)));
    }
  });
  return found;
}

/**
 * Smallest distance between panels of two instance groups (diagnostic for designed layer clearance). Only pairs that
 * share no welded vertex are measured.
 */
export function clearance(b: Built, a: readonly string[], c: readonly string[], distance: (p: readonly Vec3[], q: readonly Vec3[]) => number): number {
  let best = Infinity;
  for (const x of a) {
    const ix = b.assembly.instances.find((i) => i.id === x);
    for (const y of c) {
      const iy = b.assembly.instances.find((i) => i.id === y);
      if (ix === undefined || iy === undefined) continue;
      const [gx, gy] = [b.global.get(x) ?? [], b.global.get(y) ?? []];
      for (const p of ix.def.panels) {
        for (const q of iy.def.panels) {
          if (p.v.some((v) => q.v.some((w) => gx[v] === gy[w]))) continue;
          best = Math.min(best, distance(p.v.map((v) => b.vertices[gx[v] ?? 0] ?? O3), q.v.map((v) => b.vertices[gy[v] ?? 0] ?? O3)));
        }
      }
    }
  }
  return best;
}

/** Splits off the subtree rooted at `id`. Instance ids, definitions and internal attachments are unchanged. */
export function detach(asm: Assembly, id: string): Result<Readonly<{ rest: Assembly; part: Assembly }>, AttachError> {
  if (id === asm.root) return fail("not-a-tree", "cannot detach the root");
  if (!asm.instances.some((i) => i.id === id)) return fail("unknown-instance", id);
  const sub = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const a of asm.attachments) {
      if (sub.has(a.parent) && !sub.has(a.child)) {
        sub.add(a.child);
        grew = true;
      }
    }
  }
  const inside = (x: string): boolean => sub.has(x);
  return ok({
    rest: { ...asm, instances: asm.instances.filter((i) => !inside(i.id)), attachments: asm.attachments.filter((a) => !inside(a.child)), seams: asm.seams.filter((s) => !inside(s.a) && !inside(s.b)) },
    part: { ...asm, name: `${asm.name}/${id}`, root: id, instances: asm.instances.filter((i) => inside(i.id)), attachments: asm.attachments.filter((a) => inside(a.child) && inside(a.parent)), seams: asm.seams.filter((s) => inside(s.a) && inside(s.b)), decisions: [] },
  });
}

/** Attaches a detached part (its root's plug) to a socket of the host; the contract and placement are re-validated. */
export function attach(host: Assembly, part: Assembly, at: Omit<Attachment, "child">): Result<Assembly, AttachError> {
  const merged: Assembly = { ...host, instances: [...host.instances, ...part.instances], attachments: [...host.attachments, ...part.attachments, { ...at, child: part.root }], seams: [...host.seams, ...part.seams] };
  const placed = placeAssembly(merged);
  return placed.ok ? ok(merged) : placed;
}

export type ReuseRow = Readonly<{ id: string; family: string; params: string; mirrorOf?: string; uses: Readonly<Record<string, number>> }>;

/** Definition ids per object: which concrete definitions each object uses and how often (GEO-7.5). */
export function reuseTable(objects: readonly Assembly[]): readonly ReuseRow[] {
  const rows = new Map<string, { id: string; family: string; params: string; mirrorOf?: string; uses: Record<string, number> }>();
  for (const o of objects) {
    for (const inst of o.instances) {
      const row = rows.get(inst.def.id) ?? { id: inst.def.id, family: inst.def.family, params: JSON.stringify(inst.def.params), ...(inst.def.mirrorOf === undefined ? {} : { mirrorOf: inst.def.mirrorOf }), uses: {} };
      row.uses[o.name] = (row.uses[o.name] ?? 0) + 1;
      rows.set(inst.def.id, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.family.localeCompare(b.family) || a.id.localeCompare(b.id));
}

export type ProvenanceNode = Readonly<{ instance: string; slot: string; definition: string; family: string; parent?: string; via?: string; decidedBy: readonly string[] }>;

/** The part graph as a provenance DAG (instance → parent attachment → deciding variables); acyclic by construction. */
export function provenance(asm: Assembly): readonly ProvenanceNode[] {
  return asm.instances.map((inst) => {
    const a = asm.attachments.find((x) => x.child === inst.id);
    return { instance: inst.id, slot: inst.slot, definition: inst.def.id, family: inst.def.family, ...(a === undefined ? {} : { parent: a.parent, via: `${a.childPort}→${a.parentPort}${a.angle === undefined ? "" : `@${a.angle}°`}` }), decidedBy: inst.decidedBy ?? [] };
  });
}

export const portLength = (def: ModuleDef, name: string): number => {
  const p = def.ports.find((x) => x.name === name);
  return p?.type === "edge" ? p.length : 0;
};

export const lengthOf = (a: Vec3, b: Vec3): number => q6(dist(a, b));
export const normalOf = (a: Vec3, b: Vec3, c: Vec3): Vec3 => unit(cross(sub(b, a), sub(c, a)));
