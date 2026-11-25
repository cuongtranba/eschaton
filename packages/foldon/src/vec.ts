export type Vec3 = readonly [number, number, number];
export type Cell = readonly [number, number, number];

export const v3 = (x: number, y: number, z: number): Vec3 => [x + 0, y + 0, z + 0];

export const add = (a: Vec3, b: Vec3): Vec3 => v3(a[0] + b[0], a[1] + b[1], a[2] + b[2]);
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const scale = (a: Vec3, s: number): Vec3 => v3(a[0] * s, a[1] * s, a[2] * s);
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  v3(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const distance = (a: Vec3, b: Vec3): number => length(sub(a, b));

export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  return len === 0 ? v3(0, 0, 0) : scale(a, 1 / len);
}

export function centroid(points: readonly Vec3[]): Vec3 {
  const sum = points.reduce<Vec3>((acc, p) => add(acc, p), v3(0, 0, 0));
  return scale(sum, 1 / points.length);
}

export function rotateAboutAxis(point: Vec3, origin: Vec3, axis: Vec3, angle: number): Vec3 {
  const v = sub(point, origin);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const parallel = scale(axis, dot(axis, v) * (1 - cos));
  const rotated = add(add(scale(v, cos), scale(cross(axis, v), sin)), parallel);
  return add(origin, rotated);
}
