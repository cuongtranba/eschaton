import type { Vec3 } from "@eschaton/foldon";
import { add, cross, dot, norm, scale, sub, unit } from "../pose";

export { add, cross, dot, norm, scale, sub, unit };

export const EPS = 1e-7;

export const dist = (a: Vec3, b: Vec3): number => norm(sub(a, b));
export const lerp = (a: Vec3, b: Vec3, u: number): Vec3 => add(a, scale(sub(b, a), u));
export const centroid = (vs: readonly Vec3[]): Vec3 => scale(vs.reduce<Vec3>((s, v) => add(s, v), [0, 0, 0]), 1 / Math.max(1, vs.length));

const at = <T>(items: readonly T[], i: number): T => {
  const item = items[((i % items.length) + items.length) % items.length];
  if (item === undefined) throw new Error("index out of range on an empty list");
  return item;
};

export function newell(vs: readonly Vec3[]): Vec3 {
  let [x, y, z] = [0, 0, 0];
  vs.forEach((c, i) => {
    const n = at(vs, i + 1);
    x += (c[1] - n[1]) * (c[2] + n[2]);
    y += (c[2] - n[2]) * (c[0] + n[0]);
    z += (c[0] - n[0]) * (c[1] + n[1]);
  });
  return [x / 2, y / 2, z / 2];
}

export const area = (vs: readonly Vec3[]): number => norm(newell(vs));
export const normal = (vs: readonly Vec3[]): Vec3 => unit(newell(vs));

/** Same construction as Foldon's `hingeFrame` (not exported from the entry point): axis = n × inward. */
export function hingeAxis(parent: readonly Vec3[], e0: number, e1: number): Readonly<{ origin: Vec3; axis: Vec3 }> {
  const origin = at(parent, e0);
  const along = unit(sub(at(parent, e1), origin));
  const toCentre = sub(centroid(parent), origin);
  const inward = unit(sub(toCentre, scale(along, dot(toCentre, along))));
  return { origin, axis: unit(cross(normal(parent), inward)) };
}

export function rotate(p: Vec3, origin: Vec3, axis: Vec3, angle: number): Vec3 {
  const v = sub(p, origin);
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  return add(origin, add(add(scale(v, c), scale(cross(axis, v), s)), scale(axis, dot(axis, v) * (1 - c))));
}

/** Signed dihedral between two panels across a shared edge, in the Foldon/FOLD convention (valley > 0). */
export function dihedral(parent: readonly Vec3[], e0: number, e1: number, child: readonly Vec3[]): number {
  const { axis } = hingeAxis(parent, e0, e1);
  const [np, nc] = [normal(parent), normal(child)];
  return Math.atan2(dot(cross(np, nc), axis), dot(np, nc));
}

export type Rigid = Readonly<{ r: readonly [Vec3, Vec3, Vec3]; t: Vec3 }>;
export const IDENTITY: Rigid = { r: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 0] };
export const apply = (m: Rigid, p: Vec3): Vec3 => add([dot(m.r[0], p), dot(m.r[1], p), dot(m.r[2], p)], m.t);
const applyR = (m: Rigid, p: Vec3): Vec3 => [dot(m.r[0], p), dot(m.r[1], p), dot(m.r[2], p)];

export function compose(a: Rigid, b: Rigid): Rigid {
  const r = matrix((i, j) => AXES.reduce<number>((s, k) => s + a.r[i][k] * b.r[k][j], 0));
  return { r, t: apply(a, b.t) };
}

function frame(p0: Vec3, p1: Vec3, p2: Vec3): readonly [Vec3, Vec3, Vec3] {
  const x = unit(sub(p1, p0));
  const n = unit(cross(x, sub(p2, p0)));
  return [x, cross(n, x), n];
}

const AXES = [0, 1, 2] as const;
type Mat = readonly [Vec3, Vec3, Vec3];
const matrix = (entry: (i: 0 | 1 | 2, j: 0 | 1 | 2) => number): Mat => [
  [entry(0, 0), entry(0, 1), entry(0, 2)],
  [entry(1, 0), entry(1, 1), entry(1, 2)],
  [entry(2, 0), entry(2, 1), entry(2, 2)],
];

/** Rigid motion taking the triangle (a0, a1, a2) onto (b0, b1, b2); the triangles must be congruent. */
export function rigidBetween(a: readonly [Vec3, Vec3, Vec3], b: readonly [Vec3, Vec3, Vec3]): Rigid {
  const fa = frame(...a);
  const fb = frame(...b);
  const r = matrix((i, j) => AXES.reduce<number>((s, k) => s + fb[k][i] * fa[k][j], 0));
  return { r, t: sub(b[0], applyR({ r, t: [0, 0, 0] }, a[0])) };
}

export function rotation(origin: Vec3, axis: Vec3, angle: number): Rigid {
  const basis: Mat = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const cols = AXES.map((k) => rotate(basis[k], [0, 0, 0], axis, angle));
  const col = (j: 0 | 1 | 2): Vec3 => cols[j] ?? basis[j];
  const r = matrix((i, j) => col(j)[i]);
  return { r, t: sub(origin, applyR({ r, t: [0, 0, 0] }, origin)) };
}

export const translation = (t: Vec3): Rigid => ({ r: IDENTITY.r, t });

export type PanelQuality = Readonly<{
  area: number;
  planarity: number;
  convex: boolean;
  minAngleDeg: number;
  minAltitude: number;
  edges: readonly number[];
}>;

export function panelQuality(vs: readonly Vec3[]): PanelQuality {
  const n = normal(vs);
  const c = centroid(vs);
  const planarity = Math.max(...vs.map((v) => Math.abs(dot(sub(v, c), n))));
  const turns = vs.map((v, i) => dot(cross(sub(v, at(vs, i - 1)), sub(at(vs, i + 1), v)), n));
  const convex = turns.every((t) => t > 0);
  const angles = vs.map((v, i) => {
    const [a, b] = [sub(at(vs, i - 1), v), sub(at(vs, i + 1), v)];
    return (Math.atan2(norm(cross(a, b)), dot(a, b)) * 180) / Math.PI;
  });
  const edges = vs.map((v, i) => dist(v, at(vs, i + 1)));
  const a = area(vs);
  const altitudes = vs.map((v, i) => {
    const e = sub(at(vs, i + 1), v);
    return Math.max(...vs.map((w) => norm(cross(e, sub(w, v))) / Math.max(norm(e), 1e-300)));
  });
  return { area: a, planarity, convex, minAngleDeg: Math.min(...angles), minAltitude: Math.min(...altitudes), edges };
}

type Pt2 = readonly [number, number];

/** Interiors of two convex 2D polygons overlap (touching along an edge or at a vertex is not overlap). */
export function overlap2d(a: readonly Pt2[], b: readonly Pt2[], eps = EPS): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [p, q] = [at(poly, i), at(poly, i + 1)];
      const axis: Pt2 = [q[1] - p[1], p[0] - q[0]];
      const len = Math.hypot(axis[0], axis[1]);
      const proj = (pts: readonly Pt2[]): readonly [number, number] => {
        const values = pts.map((v) => (v[0] * axis[0] + v[1] * axis[1]) / len);
        return [Math.min(...values), Math.max(...values)];
      };
      const [[aLo, aHi], [bLo, bHi]] = [proj(a), proj(b)];
      if (aHi <= bLo + eps || bHi <= aLo + eps) return false;
    }
  }
  return true;
}

function clipLine(poly: readonly Vec3[], n: Vec3, o: Vec3, d: Vec3): readonly [number, number] | undefined {
  let [lo, hi] = [-Infinity, Infinity];
  for (let i = 0; i < poly.length; i++) {
    const [p, q] = [at(poly, i), at(poly, i + 1)];
    const inward = cross(n, sub(q, p));
    const [num, den] = [dot(inward, sub(o, p)), dot(inward, d)];
    if (Math.abs(den) < 1e-14) {
      if (num < -EPS * norm(inward)) return undefined;
    } else if (den > 0) lo = Math.max(lo, -num / den);
    else hi = Math.min(hi, -num / den);
  }
  return lo <= hi ? [lo, hi] : undefined;
}

function to2d(vs: readonly Vec3[], o: Vec3, x: Vec3, y: Vec3): readonly Pt2[] {
  return vs.map((v) => [dot(sub(v, o), x), dot(sub(v, o), y)]);
}

/**
 * `crossing`: the panels interpenetrate (the intersection runs through the interior of both).
 * `edge-touch`: an edge of one panel lies on the other panel without a shared boundary (resting or T-contact, no penetration).
 * `coplanar-overlap`: coplanar panels overlap with positive area.
 */
export type Contact = Readonly<{ kind: "crossing" | "edge-touch" | "coplanar-overlap"; at: Vec3; length: number }>;

function onBoundary(poly: readonly Vec3[], x: Vec3, tol: number): boolean {
  return poly.some((p, i) => {
    const q = at(poly, i + 1);
    const e = sub(q, p);
    const u = Math.min(1, Math.max(0, dot(sub(x, p), e) / dot(e, e)));
    return dist(x, add(p, scale(e, u))) <= tol;
  });
}

/**
 * Exact intersection of two convex planar panels, ignoring contact on their shared boundary at this pose.
 * The shared boundary is derived geometrically: vertices of one panel that coincide with vertices of the other.
 * Returns the offending contact, or undefined when the panels meet at most on that shared boundary.
 */
export function panelContact(a: readonly Vec3[], b: readonly Vec3[], tol = 1e-7): Contact | undefined {
  const shared = a.filter((p) => b.some((q) => dist(p, q) <= tol));
  const [na, nb] = [normal(a), normal(b)];
  const line = cross(na, nb);
  const offPlane = Math.abs(dot(sub(at(b, 0), at(a, 0)), na));
  if (norm(line) < 1e-9) {
    if (offPlane > tol) return undefined;
    const x = unit(sub(at(a, 1), at(a, 0)));
    const y = cross(na, x);
    const [a2, b2] = [to2d(a, at(a, 0), x, y), to2d(b, at(a, 0), x, y)];
    const orient = (poly: readonly Pt2[]): readonly Pt2[] => {
      let s = 0;
      poly.forEach((p, i) => {
        const q = at(poly, i + 1);
        s += p[0] * q[1] - q[0] * p[1];
      });
      return s < 0 ? poly.toReversed() : poly;
    };
    return overlap2d(orient(a2), orient(b2), tol) ? { kind: "coplanar-overlap", at: centroid([...a, ...b]), length: 0 } : undefined;
  }
  const d = unit(line);
  const da = dot(na, at(a, 0));
  const db = dot(nb, at(b, 0));
  const n1n2 = dot(na, nb);
  const det = 1 - n1n2 * n1n2;
  const o = add(scale(na, (da - db * n1n2) / det), scale(nb, (db - da * n1n2) / det));
  const ia = clipLine(a, na, o, d);
  const ib = clipLine(b, nb, o, d);
  if (ia === undefined || ib === undefined) return undefined;
  const [lo, hi] = [Math.max(ia[0], ib[0]), Math.min(ia[1], ib[1])];
  if (hi < lo - tol) return undefined;
  const [p, q] = [add(o, scale(d, lo)), add(o, scale(d, Math.max(lo, hi)))];
  const length = Math.max(0, hi - lo);
  const onShared = (x: Vec3): boolean => {
    if (shared.length === 0) return false;
    if (shared.some((s) => dist(s, x) <= tol * 10)) return true;
    if (shared.length < 2) return false;
    const [s0, s1] = [at(shared, 0), at(shared, 1)];
    const e = sub(s1, s0);
    const u = dot(sub(x, s0), e) / dot(e, e);
    return u >= -1e-9 && u <= 1 + 1e-9 && dist(x, add(s0, scale(e, u))) <= tol * 10;
  };
  if (onShared(p) && onShared(q) && onShared(lerp(p, q, 0.5))) return undefined;
  if (length <= tol && shared.length > 0) return undefined;
  const mid = lerp(p, q, 0.5);
  const touching = onBoundary(a, mid, tol * 10) || onBoundary(b, mid, tol * 10);
  return { kind: touching ? "edge-touch" : "crossing", at: mid, length };
}

function segSeg(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): number {
  const [d1, d2, r] = [sub(q1, p1), sub(q2, p2), sub(p1, p2)];
  const [a, e, f] = [dot(d1, d1), dot(d2, d2), dot(d2, r)];
  let [s, t] = [0, 0];
  if (a <= 1e-18 && e <= 1e-18) return dist(p1, p2);
  if (a <= 1e-18) t = Math.min(1, Math.max(0, f / e));
  else {
    const c = dot(d1, r);
    if (e <= 1e-18) s = Math.min(1, Math.max(0, -c / a));
    else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom > 1e-18 ? Math.min(1, Math.max(0, (b * f - c * e) / denom)) : 0;
      t = (b * s + f) / e;
      if (t < 0) [t, s] = [0, Math.min(1, Math.max(0, -c / a))];
      else if (t > 1) [t, s] = [1, Math.min(1, Math.max(0, (b - c) / a))];
    }
  }
  return dist(add(p1, scale(d1, s)), add(p2, scale(d2, t)));
}

function pointPanel(p: Vec3, poly: readonly Vec3[]): number {
  const n = normal(poly);
  const h = dot(sub(p, at(poly, 0)), n);
  const foot = sub(p, scale(n, h));
  const inside = poly.every((v, i) => dot(cross(n, sub(at(poly, i + 1), v)), sub(foot, v)) >= 0);
  return inside ? Math.abs(h) : Infinity;
}

/** Euclidean distance between two convex planar panels (0 when they touch or intersect). */
export function panelDistance(a: readonly Vec3[], b: readonly Vec3[]): number {
  let best = Infinity;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) best = Math.min(best, segSeg(at(a, i), at(a, i + 1), at(b, j), at(b, j + 1)));
  for (const p of a) best = Math.min(best, pointPanel(p, b));
  for (const p of b) best = Math.min(best, pointPanel(p, a));
  if (best > 1e-12 && (a.some((p, i) => pierces(p, at(a, i + 1), b)) || b.some((p, i) => pierces(p, at(b, i + 1), a)))) return 0;
  return best;
}

function pierces(p: Vec3, q: Vec3, poly: readonly Vec3[]): boolean {
  const n = normal(poly);
  const o = at(poly, 0);
  const [sp, sq] = [dot(sub(p, o), n), dot(sub(q, o), n)];
  if ((sp > 0 && sq > 0) || (sp < 0 && sq < 0) || sp === sq) return false;
  const x = lerp(p, q, sp / (sp - sq));
  return poly.every((v, i) => dot(cross(n, sub(at(poly, i + 1), v)), sub(x, v)) >= 0);
}

export type Box = Readonly<{ lo: Vec3; hi: Vec3 }>;
export const boxOf = (vs: readonly Vec3[]): Box => ({
  lo: [Math.min(...vs.map((v) => v[0])), Math.min(...vs.map((v) => v[1])), Math.min(...vs.map((v) => v[2]))],
  hi: [Math.max(...vs.map((v) => v[0])), Math.max(...vs.map((v) => v[1])), Math.max(...vs.map((v) => v[2]))],
});
export const boxGap = (a: Box, b: Box): number =>
  Math.max(0, ...AXES.map((k) => Math.max(a.lo[k] - b.hi[k], b.lo[k] - a.hi[k])));

/**
 * Chord distance on the unit sphere between the corner sectors of two convex panels at a shared apex `v`.
 * Panel A lies in the cone v + {λ1 (a1 - v) + λ2 (a2 - v), λ ≥ 0}; two such cones meet beyond the apex exactly when
 * their unit arcs meet, so a positive value proves the panels touch only at v. 0 means the sectors overlap.
 */
export function sectorGap(v: Vec3, a1: Vec3, a2: Vec3, b1: Vec3, b2: Vec3): number {
  const [u1, u2, w1, w2] = [unit(sub(a1, v)), unit(sub(a2, v)), unit(sub(b1, v)), unit(sub(b2, v))];
  const na = unit(cross(u1, u2));
  const nb = unit(cross(w1, w2));
  const inArc = (x: Vec3, e1: Vec3, e2: Vec3, n: Vec3): boolean => dot(cross(e1, x), n) >= -1e-12 && dot(cross(x, e2), n) >= -1e-12;
  const toArc = (x: Vec3, e1: Vec3, e2: Vec3, n: Vec3): number => {
    const p = sub(x, scale(n, dot(x, n)));
    if (norm(p) > 1e-12) {
      const q = unit(p);
      if (inArc(q, e1, e2, n)) return dist(x, q);
    }
    return Math.min(dist(x, e1), dist(x, e2));
  };
  const line = cross(na, nb);
  if (norm(line) > 1e-9) {
    const d = unit(line);
    for (const x of [d, scale(d, -1)]) if (inArc(x, u1, u2, na) && inArc(x, w1, w2, nb)) return 0;
  } else if (Math.abs(dot(na, nb)) > 0) {
    const nb2 = dot(na, nb) > 0 ? na : scale(na, -1);
    if ([w1, w2].some((x) => inArc(x, u1, u2, na)) || [u1, u2].some((x) => inArc(x, w1, w2, nb2))) return 0;
  }
  return Math.min(toArc(u1, w1, w2, nb), toArc(u2, w1, w2, nb), toArc(w1, u1, u2, na), toArc(w2, u1, u2, na));
}
