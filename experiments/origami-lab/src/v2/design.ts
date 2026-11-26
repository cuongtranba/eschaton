import type { Vec3 } from "@eschaton/foldon";
import { area, centroid, dist, dot, newell, normal, sub } from "./geom";

/** A face of the designed (assembled, rest-pose) surface. Vertex indices are CCW seen from the face's front. */
export type DesignFace = Readonly<{ id: string; module: string; part: string; v: readonly number[]; thin?: true }>;

/** A module hangs from its parent module on one shared edge; the edge is the joint's hinge axis. */
export type ModuleJoint = Readonly<{ module: string; parent: string; edge: readonly [number, number]; articulation?: Articulation }>;

/** Angular offset in degrees added to a hinge at articulation phase 0 (lo) to 1 (hi); rest is offset 0. */
export type Articulation = Readonly<{ lo: number; hi: number }>;

export type ArticulatedEdge = Readonly<{ id: string; edge: readonly [number, number]; articulation: Articulation }>;

export type Design = Readonly<{
  kind: string;
  version: number;
  params: Readonly<Record<string, number | string>>;
  vertices: readonly Vec3[];
  faces: readonly DesignFace[];
  rootModule: string;
  rootPart: string;
  joints: readonly ModuleJoint[];
  articulated: readonly ArticulatedEdge[];
  landmarks: Readonly<Record<string, Vec3>>;
  /** How a module is cut into sheets before unfolding: one sheet per module, or one per semantic part (strip bands). */
  sheets: Readonly<Record<string, "module" | "part">>;
}>;

export type Facing = (faceCentroid: Vec3) => Vec3;

const PLANAR_QUAD = 1e-10;

/**
 * Builds one design surface. Shared edges are shared vertex indices, so every seam and joint is exact by
 * construction (topological identity), independent of edge-length arithmetic.
 */
export function createBuilder() {
  const vertices: Vec3[] = [];
  const faces: DesignFace[] = [];
  const counters = new Map<string, number>();
  const pos = (i: number): Vec3 => {
    const v = vertices[i];
    if (v === undefined) throw new Error(`vertex ${i} does not exist`);
    return v;
  };

  const point = (p: Vec3): number => {
    vertices.push([p[0] + 0, p[1] + 0, p[2] + 0]);
    return vertices.length - 1;
  };

  const face = (module: string, part: string, v: readonly number[], facing: Facing, thin = false): void => {
    const ps = v.map(pos);
    if (area(ps) <= 1e-14) throw new Error(`${module}.${part}: zero-area face`);
    const oriented = dot(newell(ps), facing(centroid(ps))) < 0 ? v.toReversed() : v;
    const key = `${module}.${part}`;
    const n = counters.get(key) ?? 0;
    counters.set(key, n + 1);
    faces.push({ id: `${key}.${n}`, module, part, v: oriented, ...(thin ? { thin: true as const } : {}) });
  };

  /** Quad a0 a1 b1 b0 as one planar panel when it is planar, else two triangles split on the shorter diagonal. */
  const quad = (module: string, part: string, a0: number, a1: number, b1: number, b0: number, facing: Facing): void => {
    const [p0, p1, q1, q0] = [a0, a1, b1, b0].map(pos);
    if (p0 === undefined || p1 === undefined || q1 === undefined || q0 === undefined) return;
    const n = normal([p0, p1, q1]);
    const scale = Math.max(dist(p0, q1), dist(p1, q0));
    if (Math.abs(dot(sub(q0, p0), n)) <= PLANAR_QUAD * scale) {
      face(module, part, [a0, a1, b1, b0], facing);
      return;
    }
    if (dist(p0, q1) <= dist(p1, q0)) {
      face(module, part, [a0, a1, b1], facing);
      face(module, part, [a0, b1, b0], facing);
    } else {
      face(module, part, [a0, a1, b0], facing);
      face(module, part, [a1, b1, b0], facing);
    }
  };

  /** Loft between two closed rings with the same vertex count. */
  const ringLoft = (module: string, part: string, a: readonly number[], b: readonly number[], facing: Facing): void => {
    if (a.length !== b.length) throw new Error(`${module}.${part}: ring sizes differ`);
    a.forEach((ai, k) => {
      const [a1, b1, b0] = [a[(k + 1) % a.length], b[(k + 1) % b.length], b[k]];
      if (a1 !== undefined && b1 !== undefined && b0 !== undefined) quad(module, part, ai, a1, b1, b0, facing);
    });
  };

  /** Greedy shorter-diagonal stitch between two open polylines of any length (each segment ends up in exactly one triangle). */
  const stitch = (module: string, part: string, a: readonly number[], b: readonly number[], facing: Facing, thin = false): void => {
    let [i, j] = [0, 0];
    while (i < a.length - 1 || j < b.length - 1) {
      const [ai, an, bj, bn] = [a[i], a[i + 1], b[j], b[j + 1]];
      if (ai === undefined || bj === undefined) return;
      const advanceA = an !== undefined && (bn === undefined || dist(pos(an), pos(bj)) <= dist(pos(ai), pos(bn)));
      if (advanceA) {
        face(module, part, [ai, an, bj], facing, thin);
        i++;
      } else if (bn !== undefined) {
        face(module, part, [ai, bn, bj], facing, thin);
        j++;
      }
    }
  };

  /** Closes a ring (closed) or polyline (open) to an apex point. */
  const fan = (module: string, part: string, apex: number, rim: readonly number[], closed: boolean, facing: Facing, thin = false): void => {
    const count = closed ? rim.length : rim.length - 1;
    for (let k = 0; k < count; k++) {
      const [r0, r1] = [rim[k], rim[(k + 1) % rim.length]];
      if (r0 !== undefined && r1 !== undefined) face(module, part, [r0, r1, apex], facing, thin);
    }
  };

  return { point, pos, face, quad, ringLoft, stitch, fan, vertices: (): readonly Vec3[] => vertices, faces: (): readonly DesignFace[] => faces };
}

export type Builder = ReturnType<typeof createBuilder>;
