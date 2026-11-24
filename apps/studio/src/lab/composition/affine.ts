import { panelId, type PosedPanel, type Vec3 } from "@eschaton/foldon";
import type { Basis } from "../viewModel";

export type Placement3 = Readonly<{
  position: Vec3;
  yaw?: number;
  pitch?: number;
  roll?: number;
  scale?: Vec3;
}>;

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scaleVec = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => {
  const size = length(a);
  return size === 0 ? [0, 1, 0] : scaleVec(a, 1 / size);
};

function linear(placement: Placement3, v: Vec3): Vec3 {
  const scale = placement.scale ?? [1, 1, 1];
  const [sx, sy, sz] = [v[0] * scale[0], v[1] * scale[1], v[2] * scale[2]];
  const roll = placement.roll ?? 0;
  const pitch = placement.pitch ?? 0;
  const yaw = placement.yaw ?? 0;
  const [rx, ry] = [sx * Math.cos(roll) - sy * Math.sin(roll), sx * Math.sin(roll) + sy * Math.cos(roll)];
  const [py, pz] = [ry * Math.cos(pitch) - sz * Math.sin(pitch), ry * Math.sin(pitch) + sz * Math.cos(pitch)];
  return [rx * Math.cos(yaw) + pz * Math.sin(yaw), py, -rx * Math.sin(yaw) + pz * Math.cos(yaw)];
}

export function placeBasis(placement: Placement3, basis: Basis): Basis {
  return {
    origin: add(placement.position, linear(placement, basis.origin)),
    x: linear(placement, basis.x),
    y: linear(placement, basis.y),
    z: linear(placement, basis.z),
  };
}

export type Orientation = Readonly<{ yaw?: number; pitch?: number; roll?: number; extent?: Vec3 }>;

export function centredBasis(centre: Vec3, size: Vec3, orientation: Orientation = {}): Basis {
  const extent = orientation.extent ?? [1, 1, 1];
  const placement: Placement3 = { position: centre, ...orientation, scale: size };
  return placeBasis(placement, {
    origin: [-extent[0] / 2, 0, -extent[2] / 2],
    x: [1, 0, 0],
    y: [0, 1, 0],
    z: [0, 0, 1],
  });
}

export function beamBasis(from: Vec3, to: Vec3, thickness: number, length2 = 2): Basis {
  const along = sub(to, from);
  const direction = normalize(along);
  const reference: Vec3 = Math.abs(direction[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const side = normalize(cross(reference, direction));
  const up = normalize(cross(direction, side));
  const x = scaleVec(side, thickness);
  const y = scaleVec(up, thickness);
  const z = scaleVec(along, 1 / length2);
  return { origin: sub(sub(from, scaleVec(x, 0.5)), scaleVec(y, 0.5)), x, y, z };
}

export function facePanel(id: string, vertices: readonly Vec3[], toward: Vec3): PosedPanel {
  const [a, b, c] = vertices;
  if (a === undefined || b === undefined || c === undefined) throw new Error(`panel ${id} needs three vertices`);
  const normal = normalize(cross(sub(b, a), sub(c, a)));
  const flipped = dot(normal, toward) < 0;
  return {
    id: panelId(id),
    vertices: flipped ? [...vertices].reverse() : vertices,
    normal: flipped ? scaleVec(normal, -1) : normal,
  };
}
