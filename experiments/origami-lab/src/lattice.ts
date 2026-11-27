import { canonicalJson, err, fnv1a64, ok, type Result } from "@eschaton/foldon";
import type { EdgeDescriptor } from "./edges";

export const Q = 8;
export const MAX_UNITS = 64;
export const MIN_ANGLE_DEG = 10;
export const MAX_ASPECT = 12;

export type Pt = readonly [number, number];

export type TriangleSpec = Readonly<{ base: number; offset: number; height: number }>;
export type QuadSpec = Readonly<{ bottom: number; top: number; shift: number; height: number }>;
export type Shape =
  | Readonly<{ family: "tri"; spec: TriangleSpec }>
  | Readonly<{ family: "quad"; spec: QuadSpec }>;

export type TriangleClass = "acute" | "right" | "obtuse";
export type ShapeErrorCode =
  | "off-lattice"
  | "too-large"
  | "degenerate"
  | "sliver"
  | "aspect"
  | "triangle-inequality";
export type ShapeError = Readonly<{ code: ShapeErrorCode; message: string }>;

export const tri = (base: number, offset: number, height: number): Shape => ({ family: "tri", spec: { base, offset, height } });
export const quad = (bottom: number, top: number, shift: number, height: number): Shape => ({
  family: "quad",
  spec: { bottom, top, shift, height },
});
export const rect = (width: number, height: number): Shape => quad(width, width, 0, height);

const fail = (code: ShapeErrorCode, message: string): Result<never, ShapeError> => err({ code, message });

export function triangleVertices(spec: TriangleSpec): readonly [Pt, Pt, Pt] {
  return [
    [0, 0],
    [spec.base, 0],
    [spec.offset, spec.height],
  ];
}

export function quadVertices(spec: QuadSpec): readonly [Pt, Pt, Pt, Pt] {
  return [
    [0, 0],
    [spec.bottom, 0],
    [spec.shift + spec.top, spec.height],
    [spec.shift, spec.height],
  ];
}

export function shapeVertices(shape: Shape): readonly Pt[] {
  return shape.family === "tri" ? triangleVertices(shape.spec) : quadVertices(shape.spec);
}

const squaredDistance = (a: Pt, b: Pt): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

export function squaredSides(shape: Shape): readonly number[] {
  const vertices = shapeVertices(shape);
  return vertices.map((vertex, i) => squaredDistance(vertex, vertices[(i + 1) % vertices.length] ?? vertex));
}

export function shapeEdges(shape: Shape): readonly EdgeDescriptor[] {
  return squaredSides(shape).map((squaredLength) => ({ squaredLength, kind: "B", winding: "ccw" }));
}

export function classifyTriangle(spec: TriangleSpec): TriangleClass {
  const { base, offset, height } = spec;
  const dots = [base * offset, -base * (offset - base), offset * (offset - base) + height * height];
  if (dots.some((d) => d < 0)) return "obtuse";
  return dots.some((d) => d === 0) ? "right" : "acute";
}

export const shapeClass = (shape: Shape): TriangleClass | "quad" =>
  shape.family === "tri" ? classifyTriangle(shape.spec) : "quad";

export type TriangleTraits = Readonly<{
  class: TriangleClass;
  isosceles: boolean;
  nearEquilateral: boolean;
  squaredSides: readonly [number, number, number];
  anglesDeg: readonly [number, number, number];
}>;

const deg = (radians: number): number => (radians * 180) / Math.PI;

function interiorAnglesDeg(vertices: readonly Pt[]): readonly number[] {
  return vertices.map((vertex, i) => {
    const prev = vertices[(i + vertices.length - 1) % vertices.length] ?? vertex;
    const next = vertices[(i + 1) % vertices.length] ?? vertex;
    const [ax, ay] = [prev[0] - vertex[0], prev[1] - vertex[1]];
    const [bx, by] = [next[0] - vertex[0], next[1] - vertex[1]];
    return deg(Math.atan2(Math.abs(ax * by - ay * bx), ax * bx + ay * by));
  });
}

export function triangleTraits(spec: TriangleSpec): TriangleTraits {
  const sides = squaredSides({ family: "tri", spec });
  const [ab = 0, bc = 0, ca = 0] = sides;
  const angles = interiorAnglesDeg(triangleVertices(spec));
  const longest = Math.max(ab, bc, ca);
  const shortest = Math.min(ab, bc, ca);
  return {
    class: classifyTriangle(spec),
    isosceles: ab === bc || bc === ca || ca === ab,
    nearEquilateral: longest * 10 <= shortest * 11,
    squaredSides: [ab, bc, ca],
    anglesDeg: [angles[0] ?? 0, angles[1] ?? 0, angles[2] ?? 0],
  };
}

export function validateTriangle(spec: TriangleSpec): Result<TriangleSpec, ShapeError> {
  const { base, offset, height } = spec;
  if (![base, offset, height].every(Number.isInteger)) return fail("off-lattice", "triangle parameters must be integers in 1/Q cell units");
  if (base <= 0 || height <= 0) return fail("degenerate", "base and height must be positive");
  if (base > MAX_UNITS || height > MAX_UNITS || Math.abs(offset) > MAX_UNITS) return fail("too-large", `triangle exceeds ${MAX_UNITS} lattice units`);
  const traits = triangleTraits(spec);
  if (Math.min(...traits.anglesDeg) < MIN_ANGLE_DEG) return fail("sliver", `minimum interior angle is below ${MIN_ANGLE_DEG} degrees`);
  if (Math.max(...traits.squaredSides) > MAX_ASPECT * base * height) return fail("aspect", `longest side exceeds ${MAX_ASPECT} times its altitude`);
  return ok(spec);
}

export function validateQuad(spec: QuadSpec): Result<QuadSpec, ShapeError> {
  const { bottom, top, shift, height } = spec;
  if (![bottom, top, shift, height].every(Number.isInteger)) return fail("off-lattice", "quad parameters must be integers in 1/Q cell units");
  if (bottom <= 0 || top <= 0 || height <= 0) return fail("degenerate", "bottom, top and height must be positive");
  if (bottom > MAX_UNITS || top > MAX_UNITS || height > MAX_UNITS || Math.abs(shift) > MAX_UNITS) {
    return fail("too-large", `quad exceeds ${MAX_UNITS} lattice units`);
  }
  if (Math.min(...interiorAnglesDeg(quadVertices(spec))) < MIN_ANGLE_DEG) {
    return fail("sliver", `minimum interior angle is below ${MIN_ANGLE_DEG} degrees`);
  }
  return ok(spec);
}

export function validateShape(shape: Shape): Result<Shape, ShapeError> {
  const checked = shape.family === "tri" ? validateTriangle(shape.spec) : validateQuad(shape.spec);
  return checked.ok ? ok(shape) : checked;
}

/** Boundary form only: the canonical stored form of a triangle is (base, offset, height). */
export function triangleFromSides(ab: number, bc: number, ca: number): Result<TriangleSpec, ShapeError> {
  if (![ab, bc, ca].every(Number.isInteger)) return fail("off-lattice", "side lengths must be integers in 1/Q cell units");
  if (ab <= 0 || bc <= 0 || ca <= 0) return fail("degenerate", "side lengths must be positive");
  if (ab + bc <= ca || bc + ca <= ab || ca + ab <= bc) return fail("triangle-inequality", "side lengths violate the triangle inequality");
  const twiceOffset = ab * ab + ca * ca - bc * bc;
  if (twiceOffset % (2 * ab) !== 0) return fail("off-lattice", "apex does not fall on the lattice (non-integer offset)");
  const offset = twiceOffset / (2 * ab);
  const heightSquared = ca * ca - offset * offset;
  const height = Math.round(Math.sqrt(heightSquared));
  if (height * height !== heightSquared) return fail("off-lattice", "apex does not fall on the lattice (non-integer height)");
  return validateTriangle({ base: ab, offset, height });
}

export function variantId(shape: Shape): string {
  if (shape.family === "tri") {
    const { base, offset, height } = shape.spec;
    return `tri.b${base}.o${offset}.h${height}`;
  }
  const { bottom, top, shift, height } = shape.spec;
  return `quad.b${bottom}.t${top}.s${shift}.h${height}`;
}

export const shapeFingerprint = (shape: Shape): string => fnv1a64(canonicalJson(shape.spec));
