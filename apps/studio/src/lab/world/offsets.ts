import type { Vec3 } from "@eschaton/foldon";
import type { EntityId } from "@eschaton/world";
import { add, placeBasis } from "../composition/affine";
import { mulberry32 } from "../scatter";
import type { Basis } from "../viewModel";

export type Envelope = Readonly<{
  maxTranslation: Vec3;
  maxYaw: number;
  maxTilt: number;
  scale: Readonly<{ min: Vec3; max: Vec3 }>;
}>;

export type DecorativeOffset = Readonly<{
  translation: Vec3;
  yaw: number;
  pitch: number;
  roll: number;
  scale: Vec3;
}>;

const degrees = (value: number): number => (value * Math.PI) / 180;

export const ZERO_ENVELOPE: Envelope = {
  maxTranslation: [0, 0, 0],
  maxYaw: 0,
  maxTilt: 0,
  scale: { min: [1, 1, 1], max: [1, 1, 1] },
};

export const LOOK_DEV_ENVELOPE: Envelope = {
  maxTranslation: [0.15, 0.15, 0.15],
  maxYaw: degrees(4),
  maxTilt: degrees(3),
  scale: { min: [0.92, 0.92, 0.92], max: [1.08, 1.08, 1.08] },
};

function streamSeed(seed: number, id: EntityId): number {
  let hash = 0x811c9dc5 ^ (seed >>> 0);
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
  return hash >>> 0;
}

export function deriveOffset(seed: number, id: EntityId, envelope: Envelope): DecorativeOffset {
  const next = mulberry32(streamSeed(seed, id));
  const symmetric = (limit: number): number => (next() * 2 - 1) * limit;
  const between = (low: number, high: number): number => low + next() * (high - low);
  const [tx, ty, tz] = envelope.maxTranslation;
  const { min, max } = envelope.scale;
  return {
    translation: [symmetric(tx), symmetric(ty), symmetric(tz)],
    yaw: symmetric(envelope.maxYaw),
    pitch: symmetric(envelope.maxTilt),
    roll: symmetric(envelope.maxTilt),
    scale: [between(min[0], max[0]), between(min[1], max[1]), between(min[2], max[2])],
  };
}

const apply = (outer: Basis, v: Vec3): Vec3 => [
  outer.x[0] * v[0] + outer.y[0] * v[1] + outer.z[0] * v[2],
  outer.x[1] * v[0] + outer.y[1] * v[1] + outer.z[1] * v[2],
  outer.x[2] * v[0] + outer.y[2] * v[1] + outer.z[2] * v[2],
];

export function offsetBasis(basis: Basis, offset: DecorativeOffset, pivot: Vec3): Basis {
  const local = placeBasis(
    { position: add(pivot, offset.translation), yaw: offset.yaw, pitch: offset.pitch, roll: offset.roll, scale: offset.scale },
    { origin: [-pivot[0], -pivot[1], -pivot[2]], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
  );
  return {
    origin: add(basis.origin, apply(basis, local.origin)),
    x: apply(basis, local.x),
    y: apply(basis, local.y),
    z: apply(basis, local.z),
  };
}
