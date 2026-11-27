import type { Vec3 } from "@eschaton/foldon";
import { compatible, type IncompatibleReason } from "./edges";
import { validateShape, variantId, type ShapeError } from "./lattice";
import type { LabObject, Seam } from "./object";
import { add, cross, dot, poseObject, scale, sub, unit, type PosedObject } from "./pose";

export const SAMPLE_TIMES: readonly number[] = [0, 0.25, 0.5, 0.75, 1];
const SHRINK = 0.04;
const EPS = 1e-7;

export type Overlap = Readonly<{ t: number; a: string; b: string }>;

type Poly = Readonly<{ id: string; v: readonly Vec3[]; n: Vec3; lo: Vec3; hi: Vec3; inward: readonly Vec3[] }>;

function prepare(id: string, vertices: readonly Vec3[]): Poly {
  const c = scale(vertices.reduce<Vec3>((sum, p) => add(sum, p), [0, 0, 0]), 1 / vertices.length);
  const v = vertices.map((p) => add(c, scale(sub(p, c), 1 - SHRINK)));
  const [p0, p1, p2] = [v[0], v[1], v[2]];
  const n = p0 === undefined || p1 === undefined || p2 === undefined ? ([0, 0, 0] as const) : unit(cross(sub(p1, p0), sub(p2, p0)));
  const inward = v.map((p, i) => cross(n, sub(v[(i + 1) % v.length] ?? p, p)));
  const axis = (k: 0 | 1 | 2): readonly [number, number] => [Math.min(...v.map((p) => p[k])), Math.max(...v.map((p) => p[k]))];
  return { id, v, n, lo: [axis(0)[0], axis(1)[0], axis(2)[0]], hi: [axis(0)[1], axis(1)[1], axis(2)[1]], inward };
}

function insidePolygon(poly: Poly, x: Vec3): boolean {
  return poly.v.every((p, i) => dot(poly.inward[i] ?? [0, 0, 0], sub(x, p)) >= -EPS);
}

function segmentHits(a: Vec3, b: Vec3, poly: Poly): boolean {
  const origin = poly.v[0];
  if (origin === undefined) return false;
  const [sa, sb] = [dot(poly.n, sub(a, origin)), dot(poly.n, sub(b, origin))];
  if (Math.abs(sa) <= EPS && Math.abs(sb) <= EPS) {
    let [lo, hi] = [0, 1];
    const d = sub(b, a);
    for (const [i, p] of poly.v.entries()) {
      const m = poly.inward[i] ?? [0, 0, 0];
      const [num, den] = [dot(m, sub(a, p)), dot(m, d)];
      if (Math.abs(den) <= EPS) {
        if (num < -EPS) return false;
      } else if (den > 0) lo = Math.max(lo, -num / den);
      else hi = Math.min(hi, -num / den);
    }
    return lo <= hi + EPS;
  }
  if ((sa > EPS && sb > EPS) || (sa < -EPS && sb < -EPS)) return false;
  const hit = add(a, scale(sub(b, a), sa / (sa - sb)));
  return insidePolygon(poly, hit);
}

function polygonsIntersect(p: Poly, q: Poly): boolean {
  for (const k of [0, 1, 2] as const) if (p.hi[k] < q.lo[k] - EPS || q.hi[k] < p.lo[k] - EPS) return false;
  const edgesHit = (from: Poly, into: Poly): boolean =>
    from.v.some((a, i) => segmentHits(a, from.v[(i + 1) % from.v.length] ?? a, into));
  return edgesHit(p, q) || edgesHit(q, p);
}

export function posedOverlaps(object: LabObject, posed: PosedObject): readonly Overlap[] {
  const adjacent = new Set<string>();
  const link = (a: string, b: string): void => void adjacent.add([a, b].sort().join("|"));
  for (const component of object.components) for (const crease of component.sheet.creases) link(crease.a, crease.b);
  for (const closure of object.closures) link(closure.a, closure.b);
  const polys = posed.panels.map((p) => prepare(p.id, p.vertices));
  const found: Overlap[] = [];
  for (const [i, p] of polys.entries()) {
    for (const q of polys.slice(i + 1)) {
      if (!adjacent.has([p.id, q.id].sort().join("|")) && polygonsIntersect(p, q)) found.push({ t: posed.t, a: p.id, b: q.id });
    }
  }
  return found;
}

/** Folded-state check: no two non-adjacent panels of one object intersect at the sampled fold progress values. */
export function foldedOverlaps(object: LabObject, times: readonly number[] = SAMPLE_TIMES, phase?: number): readonly Overlap[] {
  return times.flatMap((t) => posedOverlaps(object, poseObject(object, t, phase)));
}

export type SeamCheck = Readonly<{ seam: string; closing: boolean; ok: boolean; reason?: IncompatibleReason }>;

/** Re-evaluates the edge compatibility rule for every seam against the pristine part sheets. */
export function seamChecks(object: LabObject): readonly SeamCheck[] {
  return object.recipe.connections
    .filter((c): c is Seam => c.kind === "seam")
    .map((seam) => {
      const edge = (ref: Seam["a"]) => object.partSheets[ref.part]?.panels.find((p) => p.id === ref.panel)?.edges[ref.edge];
      const [a, b] = [edge(seam.a), edge(seam.b)];
      const name = `${seam.a.part}.${seam.a.panel}[${seam.a.edge}]~${seam.b.part}.${seam.b.panel}[${seam.b.edge}]`;
      if (a === undefined || b === undefined) return { seam: name, closing: seam.closing === true, ok: false };
      const fit = compatible(a, b);
      return fit.ok
        ? { seam: name, closing: seam.closing === true, ok: true }
        : { seam: name, closing: seam.closing === true, ok: false, reason: fit.error.code };
    });
}

/** Every panel of every part must still satisfy the family validation (non-degenerate, not a sliver, bounded aspect). */
export function invalidPanels(object: LabObject): readonly Readonly<{ panel: string; error: ShapeError }>[] {
  return object.components.flatMap((component) =>
    component.sheet.panels.flatMap((panel) => {
      const checked = validateShape(panel.shape);
      return checked.ok ? [] : [{ panel: panel.id, error: checked.error }];
    }),
  );
}

export type ReuseReport = Readonly<{
  families: readonly string[];
  variantUse: Readonly<Record<string, readonly string[]>>;
  shared: readonly string[];
}>;

/** Which panel variants are used by which objects; `shared` lists variants appearing in more than one object. */
export function reuseReport(objects: readonly LabObject[]): ReuseReport {
  const users = new Map<string, Set<string>>();
  const families = new Set<string>();
  for (const object of objects) {
    for (const panel of object.components.flatMap((c) => c.sheet.panels)) {
      families.add(panel.shape.family);
      users.set(variantId(panel.shape), (users.get(variantId(panel.shape)) ?? new Set<string>()).add(object.name));
    }
  }
  return {
    families: [...families].sort(),
    variantUse: Object.fromEntries([...users].map(([id, names]) => [id, [...names].sort()])),
    shared: [...users].filter(([, names]) => names.size > 1).map(([id]) => id).sort(),
  };
}
