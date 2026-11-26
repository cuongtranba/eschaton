import { validateFoldon, type Vec3 } from "@eschaton/foldon";
import { poseCompiled, posePieces, seamGap, type Compiled } from "./compile";
import { boxGap, boxOf, dihedral, dist, dot, normal, panelContact, panelDistance, panelQuality, sectorGap, sub, type Contact } from "./geom";

/** Hard numeric limits (geometry-quality-gates.md GEO-1). Lengths are in cells. */
export const LIMITS = {
  planarity: 1e-6,
  minAltitude: 0.004,
  thinAngleDeg: 6,
  seamGap: 1e-6,
  rigidity: 1e-7,
  flatness: 1e-6,
  maxDepth: 6,
} as const;

export type PairStatus = "analytic" | "static" | "certified" | "sampled" | "collision";
export type Collision = Readonly<{ a: string; b: string; u: number; contact: Contact }>;
export type SweepReport = Readonly<{
  name: string;
  pairs: number;
  counts: Readonly<Record<PairStatus, number>>;
  collisions: readonly Collision[];
  sampledPairs: readonly (readonly [string, string])[];
  /** Sampled-only pairs that share a design vertex; the rest approach each other only near a seam. */
  sampledTouching: number;
  /** Smallest u from which some sampled pair is no longer certified (1 when every pair is certified everywhere). */
  uncertifiedFrom: number;
  poses: number;
}>;

export type PanelIssue = Readonly<{ face: string; problem: "non-planar" | "non-convex" | "degenerate" | "thin-unannotated"; value: number }>;

export type GeoReport = Readonly<{
  panels: Readonly<{ count: number; issues: readonly PanelIssue[]; thinAnnotated: readonly string[]; minAngleDeg: number; minAltitude: number }>;
  flat: Readonly<{ pieces: number; maxOffPlane: number; overlaps: readonly Collision[] }>;
  rigidity: number;
  seamGap: Readonly<{ rest: number; articulated: number }>;
  definitions: Readonly<{ valid: number; invalid: readonly string[] }>;
  sweeps: readonly SweepReport[];
  rest: SweepReport;
}>;

type Step = Readonly<{ hinge: number; rate: number; reach: number }>;

function facePositions(c: Compiled, f: number): readonly Vec3[] {
  return (c.design.faces[f]?.v ?? []).map((i) => c.design.vertices[i] ?? [0, 0, 0]);
}

/**
 * Path from the sweep root to each face as hinge steps with a rigid speed bound. `reach` bounds the distance from the
 * hinge axis to any point of the face along a polyline through hinge-edge midpoints; each segment lies in one convex
 * panel, so its length is invariant under folding (isometry) and bounds the true distance at every configuration.
 */
function kinematics(c: Compiled, faces: readonly number[], rate: (face: number) => number, inScope: (face: number) => boolean): ReadonlyMap<number, readonly Step[]> {
  const mid = (f: number): Vec3 => {
    const link = c.links.get(f);
    const [a, b] = link?.edge ?? [0, 0];
    const [pa, pb] = [c.design.vertices[a] ?? [0, 0, 0], c.design.vertices[b] ?? [0, 0, 0]];
    return [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
  };
  const out = new Map<number, readonly Step[]>();
  for (const f of faces) {
    const chain: number[] = [];
    let cur: number | undefined = f;
    while (cur !== undefined && inScope(cur) && c.links.has(cur)) {
      chain.unshift(cur);
      const parent: number | undefined = c.links.get(cur)?.parent;
      cur = parent !== undefined && inScope(parent) ? parent : undefined;
    }
    const far = Math.max(0, ...facePositions(c, f).map((v) => (chain.length === 0 ? 0 : dist(mid(chain[chain.length - 1] ?? f), v))));
    const steps: Step[] = [];
    let reach = far;
    for (let k = chain.length - 1; k >= 0; k--) {
      const h = chain[k] ?? f;
      if (k < chain.length - 1) reach += dist(mid(h), mid(chain[k + 1] ?? h));
      steps.unshift({ hinge: h, rate: rate(h), reach });
    }
    out.set(f, steps);
  }
  return out;
}

function relativeBound(a: readonly Step[], b: readonly Step[]): number {
  let l = 0;
  while (l < a.length && l < b.length && a[l]?.hinge === b[l]?.hinge) l++;
  const sum = (steps: readonly Step[]): number => steps.slice(l).reduce((s, st) => s + Math.abs(st.rate) * st.reach, 0);
  return sum(a) + sum(b);
}

type PoseAt = (u: number) => ReadonlyMap<number, readonly Vec3[]>;

/**
 * Conservative swept collision check over u in [0, 1]. Hinged pairs are certified analytically (two convex panels that
 * share a full hinge edge meet only on that edge unless the dihedral reaches ±180°). Other pairs are certified on an
 * interval when their distance at its midpoint exceeds the summed rigid speed bound times the half-width; otherwise the
 * interval is bisected to depth `maxDepth`, and pairs still open there have only been tested exactly at sample points.
 */
function sweep(c: Compiled, name: string, faces: readonly number[], poseAt: PoseAt, steps: ReadonlyMap<number, readonly Step[]>, hingeAngles: (face: number) => readonly [number, number]): SweepReport {
  const idOf = (f: number): string => c.design.faces[f]?.id ?? String(f);
  const counts: Record<PairStatus, number> = { analytic: 0, static: 0, certified: 0, sampled: 0, collision: 0 };
  const collisions: Collision[] = [];
  const sampled: (readonly [string, string])[] = [];
  const quality = new Map(faces.map((f) => [f, panelQuality(facePositions(c, f))]));
  const open: { a: number; b: number; bound: number; apex?: Readonly<{ v: number; spin: number }> }[] = [];
  const cache = new Map<number, ReadonlyMap<number, readonly Vec3[]>>();
  const at = (u: number): ReadonlyMap<number, readonly Vec3[]> => {
    const hit = cache.get(u);
    if (hit !== undefined) return hit;
    const posed = poseAt(u);
    cache.set(u, posed);
    return posed;
  };
  const exact = (a: number, b: number, u: number): Contact | undefined => {
    const posed = at(u);
    const [pa, pb] = [posed.get(a) ?? [], posed.get(b) ?? []];
    if (boxGap(boxOf(pa), boxOf(pb)) > 1e-6) return undefined;
    return panelContact(pa, pb);
  };
  const status = new Map<string, PairStatus>();
  const relative = (a: number, b: number): readonly Step[] => {
    const [sa, sb] = [steps.get(a) ?? [], steps.get(b) ?? []];
    let l = 0;
    while (l < sa.length && l < sb.length && sa[l]?.hinge === sb[l]?.hinge) l++;
    return [...sa.slice(l), ...sb.slice(l)];
  };
  const apexOf = (a: number, b: number): Readonly<{ apex?: Readonly<{ v: number; spin: number }> }> => {
    const [va, vb] = [c.design.faces[a]?.v ?? [], c.design.faces[b]?.v ?? []];
    const shared = va.filter((x) => vb.includes(x));
    const moving = relative(a, b).filter((st) => st.rate !== 0);
    const v = shared.find((x) => moving.every((st) => c.links.get(st.hinge)?.edge.includes(x) === true));
    if (v === undefined) return {};
    return { apex: { v, spin: moving.reduce((s2, st) => s2 + Math.abs(st.rate), 0) } };
  };
  /**
   * Two convex panels that share a full edge and whose only relative motion is rotation about that edge meet only on it
   * unless their dihedral reaches ±180°; the dihedral is affine in u, so its two end values decide.
   */
  const coHinged = (a: number, b: number): boolean => {
    const [fa, fb] = [c.design.faces[a], c.design.faces[b]];
    if (fa === undefined || fb === undefined || quality.get(a)?.convex !== true || quality.get(b)?.convex !== true) return false;
    const slot = fa.v.findIndex((x, k) => {
      const y = fa.v[(k + 1) % fa.v.length] ?? x;
      return fb.v.includes(x) && fb.v.includes(y);
    });
    if (slot < 0) return false;
    const edge = [fa.v[slot] ?? 0, fa.v[(slot + 1) % fa.v.length] ?? 0];
    const moving = relative(a, b).filter((st) => st.rate !== 0);
    if (!moving.every((st) => edge.every((x) => c.links.get(st.hinge)?.edge.includes(x) === true))) return false;
    const angleAt = (u: number): number => dihedral(at(u).get(a) ?? [], slot, (slot + 1) % fa.v.length, at(u).get(b) ?? []);
    const [t0, t1] = [angleAt(0), angleAt(1)];
    return Math.max(Math.abs(t0), Math.abs(t1)) < Math.PI - 1e-6 && Math.abs(t1 - t0) < Math.PI;
  };
  const corner = (f: number, v: number, vs: readonly Vec3[]): readonly [Vec3, Vec3, Vec3] => {
    const ids = c.design.faces[f]?.v ?? [];
    const k = ids.indexOf(v);
    const n = ids.length;
    return [vs[k] ?? [0, 0, 0], vs[(k + 1) % n] ?? [0, 0, 0], vs[(k + n - 1) % n] ?? [0, 0, 0]];
  };
  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const [a, b] = [faces[i] ?? 0, faces[j] ?? 0];
      const key = `${a}|${b}`;
      const la = c.links.get(a);
      const lb = c.links.get(b);
      const hinged = la?.parent === b || lb?.parent === a;
      if (hinged && quality.get(a)?.convex === true && quality.get(b)?.convex === true) {
        const child = la?.parent === b ? a : b;
        const [t0, t1] = hingeAngles(child);
        if (Math.max(Math.abs(t0), Math.abs(t1)) < Math.PI - 1e-6) {
          status.set(key, "analytic");
          continue;
        }
      }
      if (coHinged(a, b)) {
        status.set(key, "analytic");
        continue;
      }
      const bound = relativeBound(steps.get(a) ?? [], steps.get(b) ?? []);
      const endpoint = exact(a, b, 0) ?? exact(a, b, 1);
      if (endpoint !== undefined) {
        status.set(key, "collision");
        collisions.push({ a: idOf(a), b: idOf(b), u: exact(a, b, 0) === undefined ? 1 : 0, contact: endpoint });
        continue;
      }
      if (bound === 0) {
        status.set(key, "static");
        continue;
      }
      status.set(key, "certified");
      open.push({ a, b, bound, ...apexOf(a, b) });
    }
  }
  let uncertifiedFrom = 1;
  const stack: { lo: number; hi: number; depth: number; pairs: number[] }[] = [{ lo: 0, hi: 1, depth: 0, pairs: open.map((_, i) => i) }];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) break;
    const um = (node.lo + node.hi) / 2;
    const half = (node.hi - node.lo) / 2;
    const posed = at(um);
    const next: number[] = [];
    for (const index of node.pairs) {
      const pair = open[index];
      if (pair === undefined) continue;
      const key = `${pair.a}|${pair.b}`;
      if (status.get(key) === "collision") continue;
      const margin = pair.bound * half + 1e-9;
      const [pa, pb] = [posed.get(pair.a) ?? [], posed.get(pair.b) ?? []];
      if (pair.apex !== undefined) {
        const [v, a1, a2] = corner(pair.a, pair.apex.v, pa);
        const [, b1, b2] = corner(pair.b, pair.apex.v, pb);
        if (sectorGap(v, a1, a2, b1, b2) > pair.apex.spin * half + 1e-9) continue;
      }
      if (boxGap(boxOf(pa), boxOf(pb)) > margin) continue;
      if (panelDistance(pa, pb) > margin) continue;
      const contact = panelContact(pa, pb);
      if (contact !== undefined) {
        status.set(key, "collision");
        collisions.push({ a: idOf(pair.a), b: idOf(pair.b), u: um, contact });
        continue;
      }
      next.push(index);
    }
    if (next.length === 0) continue;
    if (node.depth >= LIMITS.maxDepth) {
      uncertifiedFrom = Math.min(uncertifiedFrom, node.lo);
      for (const index of next) {
        const pair = open[index];
        if (pair === undefined) continue;
        const key = `${pair.a}|${pair.b}`;
        if (status.get(key) === "certified") {
          status.set(key, "sampled");
          sampled.push([idOf(pair.a), idOf(pair.b)]);
        }
      }
      continue;
    }
    stack.push({ lo: node.lo, hi: um, depth: node.depth + 1, pairs: next }, { lo: um, hi: node.hi, depth: node.depth + 1, pairs: next });
  }
  for (const s of status.values()) counts[s] += 1;
  const vertsOf = (id: string): readonly number[] => c.design.faces.find((f) => f.id === id)?.v ?? [];
  const sampledTouching = sampled.filter(([x, y]) => vertsOf(x).some((v) => vertsOf(y).includes(v))).length;
  return { name, pairs: status.size, counts, collisions, sampledPairs: sampled, sampledTouching, uncertifiedFrom, poses: cache.size };
}

const rad = (d: number): number => (d * Math.PI) / 180;

/** Runs every automated GEO-1 check on a compiled design. */
export function verifyCompiled(c: Compiled): GeoReport {
  const issues: PanelIssue[] = [];
  const thin: string[] = [];
  let [minAngle, minAlt] = [Infinity, Infinity];
  c.design.faces.forEach((f, i) => {
    const q = panelQuality(facePositions(c, i));
    minAngle = Math.min(minAngle, q.minAngleDeg);
    minAlt = Math.min(minAlt, q.minAltitude);
    if (q.planarity > LIMITS.planarity) issues.push({ face: f.id, problem: "non-planar", value: q.planarity });
    if (!q.convex) issues.push({ face: f.id, problem: "non-convex", value: 0 });
    if (q.minAltitude < LIMITS.minAltitude) issues.push({ face: f.id, problem: "degenerate", value: q.minAltitude });
    if (q.minAngleDeg < LIMITS.thinAngleDeg) {
      if (f.thin === true) thin.push(f.id);
      else issues.push({ face: f.id, problem: "thin-unannotated", value: q.minAngleDeg });
    }
  });

  const sweeps: SweepReport[] = [];
  let maxOffPlane = 0;
  const flatOverlaps: Collision[] = [];
  let rigidity = 0;
  const restLengths = new Map(c.design.faces.map((_, i) => [i, panelQuality(facePositions(c, i)).edges] as const));
  const checkRigid = (posed: ReadonlyMap<number, readonly Vec3[]>): void => {
    for (const [f, vs] of posed) {
      const rest = restLengths.get(f) ?? [];
      vs.forEach((v, k) => {
        rigidity = Math.max(rigidity, Math.abs(dist(v, vs[(k + 1) % vs.length] ?? v) - (rest[k] ?? 0)));
      });
    }
  };
  for (const piece of c.pieces) {
    const inPiece = new Set(piece.faces);
    const steps = kinematics(c, piece.faces, (f) => c.links.get(f)?.rest ?? 0, (f) => inPiece.has(f));
    const poseAt: PoseAt = (u) => {
      const all = posePieces(c, u);
      return new Map(piece.faces.map((f) => [f, all.get(f) ?? []] as const));
    };
    const flat = poseAt(0);
    const rootFace = flat.get(piece.root) ?? [];
    const n = normal(rootFace);
    const o: Vec3 = rootFace[0] ?? [0, 0, 0];
    for (const vs of flat.values()) for (const v of vs) maxOffPlane = Math.max(maxOffPlane, Math.abs(dot(sub(v, o), n)));
    checkRigid(flat);
    checkRigid(poseAt(0.5));
    const report = sweep(c, `fold ${piece.id}`, piece.faces, poseAt, steps, (f) => [0, c.links.get(f)?.rest ?? 0]);
    for (const col of report.collisions) if (col.u === 0) flatOverlaps.push(col);
    sweeps.push(report);
  }

  const all = c.design.faces.map((_, i) => i);
  const articulationRate = (f: number): number => {
    const art = c.links.get(f)?.articulation;
    return art === undefined ? 0 : rad(art.hi - art.lo);
  };
  const phaseSteps = kinematics(c, all, articulationRate, () => true);
  const phasePose: PoseAt = (u) => new Map(poseCompiled(c, 1, u).faces.map((pf) => [pf.face, pf.vertices] as const));
  const hingeRange = (f: number): readonly [number, number] => {
    const link = c.links.get(f);
    const rest = link?.rest ?? 0;
    const art = link?.articulation;
    return art === undefined ? [rest, rest] : [rest + rad(art.lo), rest + rad(art.hi)];
  };
  const articulation = sweep(c, "articulation phase 0→1 at t = 1", all, phasePose, phaseSteps, hingeRange);
  sweeps.push(articulation);
  checkRigid(phasePose(0));
  checkRigid(phasePose(1));
  const restPose: PoseAt = () => new Map(poseCompiled(c, 1).faces.map((pf) => [pf.face, pf.vertices] as const));
  const rest = sweep(c, "assembled rest pose (t = 1, no articulation)", all, restPose, kinematics(c, all, () => 0, () => true), (f) => [c.links.get(f)?.rest ?? 0, c.links.get(f)?.rest ?? 0]);

  const invalid = c.pieces.filter((p) => !validateFoldon(p.definition).ok).map((p) => p.id);
  return {
    panels: { count: c.design.faces.length, issues, thinAnnotated: thin, minAngleDeg: minAngle, minAltitude: minAlt },
    flat: { pieces: c.pieces.length, maxOffPlane, overlaps: flatOverlaps },
    rigidity,
    seamGap: { rest: seamGap(c, poseCompiled(c, 1)), articulated: Math.max(seamGap(c, poseCompiled(c, 1, 0)), seamGap(c, poseCompiled(c, 1, 1))) },
    definitions: { valid: c.pieces.length - invalid.length, invalid },
    sweeps,
    rest,
  };
}

export type Verdict = "PASS" | "FAIL" | "NOT VERIFIED";

/** GEO-1 automated verdict: any hard failure is FAIL; sampled-only coverage keeps an otherwise clean result NOT VERIFIED. */
export function geo1Verdict(r: GeoReport): Readonly<{ verdict: Verdict; reasons: readonly string[] }> {
  const reasons: string[] = [];
  if (r.panels.issues.length > 0) reasons.push(`${r.panels.issues.length} invalid panels`);
  if (r.flat.maxOffPlane > LIMITS.flatness) reasons.push(`flat net off-plane ${r.flat.maxOffPlane}`);
  if (r.flat.overlaps.length > 0) reasons.push(`${r.flat.overlaps.length} flat-net overlaps`);
  if (r.rigidity > LIMITS.rigidity) reasons.push(`edge length drift ${r.rigidity}`);
  if (r.seamGap.rest > LIMITS.seamGap || r.seamGap.articulated > LIMITS.seamGap) reasons.push(`seam gap ${Math.max(r.seamGap.rest, r.seamGap.articulated)}`);
  if (r.definitions.invalid.length > 0) reasons.push(`${r.definitions.invalid.length} Foldon definitions invalid`);
  const collisions = [...r.sweeps, r.rest].reduce((s, w) => s + w.collisions.length, 0);
  if (collisions > 0) reasons.push(`${collisions} collisions`);
  if (reasons.length > 0) return { verdict: "FAIL", reasons };
  const sampled = [...r.sweeps, r.rest].reduce((s, w) => s + w.counts.sampled, 0);
  const touching = [...r.sweeps, r.rest].reduce((s, w) => s + w.sampledTouching, 0);
  const from = Math.min(...[...r.sweeps, r.rest].map((w) => w.uncertifiedFrom));
  return sampled > 0
    ? { verdict: "NOT VERIFIED", reasons: [`${sampled} pairs (${touching} sharing a design vertex) are certified only for u < ${from.toFixed(4)}; above it they were tested exactly at interval midpoints (1/${2 ** LIMITS.maxDepth}) with no collision found`] }
    : { verdict: "PASS", reasons: [] };
}


export type PosedPanelLike = Readonly<{ id: string; vertices: readonly Vec3[] }>;

/**
 * Exact contact test of every panel pair at one pose. Contact on a boundary the two panels share at this pose
 * (coincident vertices or a coincident edge) is allowed; any other crossing or coplanar overlap is reported.
 * Adjacent panels are not exempt.
 */
export function posedContacts(panels: readonly PosedPanelLike[]): readonly Readonly<{ a: string; b: string; contact: Contact }>[] {
  const boxes = panels.map((p) => boxOf(p.vertices));
  const found: { a: string; b: string; contact: Contact }[] = [];
  panels.forEach((p, i) => {
    for (let j = i + 1; j < panels.length; j++) {
      const q = panels[j];
      const [bp, bq] = [boxes[i], boxes[j]];
      if (q === undefined || bp === undefined || bq === undefined || boxGap(bp, bq) > 1e-6) continue;
      const contact = panelContact(p.vertices, q.vertices);
      if (contact !== undefined) found.push({ a: p.id, b: q.id, contact });
    }
  });
  return found;
}
