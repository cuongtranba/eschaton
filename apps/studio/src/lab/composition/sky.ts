import { type Vec3 } from "@eschaton/foldon";
import type { Ink, LeafBatch } from "../viewModel";
import { facePanel } from "./affine";
import type { Random } from "./random";
import { pointAtNdc, worldPerNdcY, type Frame } from "./view";

export const SKY_Z = -520;
const TOWARD: Vec3 = [0, 0, 1];

type Shape = Readonly<{ vertices: readonly Vec3[]; ink: Ink }>;

const PALE: Ink = { tone: -0.6, unlit: true };

const layerStrips: readonly (readonly [number, number])[] = [
  [1.9, 0.62],
  [0.78, 0.5],
  [0.5, 0.36],
  [0.26, 0.22],
  [0.06, 0.08],
];
const STRIP_FLOOR = -0.14;

function disc(centre: Vec3, radius: number, segments: number, ink: Ink, lift = 0): Shape {
  const vertices = Array.from({ length: segments }, (_, i): Vec3 => {
    const angle = (i / segments) * Math.PI * 2;
    return [centre[0] + Math.cos(angle) * radius, centre[1] + Math.sin(angle) * radius, centre[2] + lift];
  });
  return { vertices, ink };
}

function lobe(centre: Vec3, radius: number, height: number, ink: Ink): Shape {
  const arc = Array.from({ length: 9 }, (_, i): Vec3 => {
    const angle = (i / 8) * Math.PI;
    return [centre[0] + Math.cos(angle) * radius, centre[1] + Math.sin(angle) * height, centre[2]];
  });
  return { vertices: arc, ink };
}

function stars(frame: Frame, random: Random, sunNdc: readonly [number, number]): readonly Shape[] {
  const unit = worldPerNdcY(frame, SKY_Z);
  const shapes: Shape[] = [];
  for (let i = 0; i < 34; i++) {
    const x = random.range(-1.15, 1.15);
    const y = random.range(0.5, 0.98);
    if (Math.hypot((x - sunNdc[0]) * 1.2, y - sunNdc[1]) < 0.42) continue;
    const c = pointAtNdc(frame, x, y, SKY_Z + 2);
    const size = unit * random.range(0.006, 0.02);
    if (random.chance(0.45)) {
      const long = size * 2.6;
      const thin = size * 0.28;
      shapes.push({ vertices: [[c[0], c[1] - long, c[2]], [c[0] + thin, c[1], c[2]], [c[0], c[1] + long, c[2]], [c[0] - thin, c[1], c[2]]], ink: PALE });
      shapes.push({ vertices: [[c[0] - long, c[1], c[2]], [c[0], c[1] - thin, c[2]], [c[0] + long, c[1], c[2]], [c[0], c[1] + thin, c[2]]], ink: PALE });
    } else {
      shapes.push(disc(c, size * 0.8, 8, PALE));
    }
  }
  return shapes;
}

function sunShapes(frame: Frame, random: Random, sunNdc: readonly [number, number]): readonly Shape[] {
  const unit = worldPerNdcY(frame, SKY_Z);
  const centre = pointAtNdc(frame, sunNdc[0], sunNdc[1], SKY_Z + 3);
  const radius = unit * 0.2;
  const shapes: Shape[] = [disc(centre, radius, 64, PALE, 0)];
  const ringInner = radius * 1.035;
  const ringOuter = radius * 1.07;
  const ringInk: Ink = { tone: 0.78, unlit: true };
  for (let i = 0; i < 72; i++) {
    const a0 = (i / 72) * Math.PI * 2;
    const a1 = ((i + 1) / 72) * Math.PI * 2;
    const at = (r: number, a: number): Vec3 => [centre[0] + Math.cos(a) * r, centre[1] + Math.sin(a) * r, centre[2] + 1];
    shapes.push({ vertices: [at(ringInner, a0), at(ringOuter, a0), at(ringOuter, a1), at(ringInner, a1)], ink: ringInk });
  }
  for (let i = 0; i < 150; i++) {
    const angle = random.range(0, Math.PI * 2);
    const start = radius * random.range(1.12, 1.2);
    const end = radius * random.range(1.35, 2.15);
    const half = random.range(0.004, 0.011);
    const at = (r: number, a: number): Vec3 => [centre[0] + Math.cos(a) * r, centre[1] + Math.sin(a) * r, centre[2] + 2];
    shapes.push({ vertices: [at(start, angle - half), at(start, angle + half), at(end, angle)], ink: PALE });
  }
  return shapes;
}

export function skyBatch(frame: Frame, random: Random): LeafBatch {
  const sunNdc = [0.04, 0.5] as const;
  const shapes: Shape[] = [];
  const xLow = -2.8;
  const xHigh = 2.8;
  layerStrips.forEach(([top, tone], index) => {
    const bottom = layerStrips[index + 1]?.[0] ?? STRIP_FLOOR;
    const corner = (x: number, y: number): Vec3 => pointAtNdc(frame, x, y, SKY_Z);
    shapes.push({
      vertices: [corner(xLow, bottom), corner(xHigh, bottom), corner(xHigh, top), corner(xLow, top)],
      ink: { tone, unlit: true },
    });
  });
  shapes.push(...sunShapes(frame, random, sunNdc), ...stars(frame, random, sunNdc));
  return {
    key: "sky",
    poseKey: "static",
    geometry: {
      panels: shapes.map((shape, i) => facePanel(`sky-${i}`, shape.vertices, TOWARD)),
      creases: [],
    },
    bases: [{ origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }],
    panelInks: shapes.map((shape) => shape.ink),
    outline: false,
  };
}

type CloudSpec = Readonly<{ x: number; y: number; width: number; scale: number; tone: number; lobes: number }>;

const cloudSpecs: readonly CloudSpec[] = [
  { x: 0.74, y: 0.58, width: 1.0, scale: 0.9, tone: 0.9, lobes: 8 },
  { x: 0.58, y: 0.46, width: 1.3, scale: 1.0, tone: 0.86, lobes: 10 },
  { x: 0.9, y: 0.37, width: 0.8, scale: 0.6, tone: 0.78, lobes: 6 },
  { x: 0.42, y: 0.32, width: 0.6, scale: 0.45, tone: 0.7, lobes: 5 },
  { x: -0.62, y: 0.58, width: 0.6, scale: 0.6, tone: 0.45, lobes: 5 },
  { x: -0.2, y: 0.4, width: 0.5, scale: 0.4, tone: 0.4, lobes: 4 },
];

export function cloudBatch(frame: Frame, random: Random): LeafBatch {
  const unit = worldPerNdcY(frame, SKY_Z);
  const shapes: Shape[] = [];
  cloudSpecs.forEach((spec, layer) => {
    const ink: Ink = { tone: spec.tone, unlit: true };
    const z = SKY_Z + 6 + layer * 0.5;
    const left = spec.x - spec.width / 2;
    const base = pointAtNdc(frame, left, spec.y, z);
    const widthWorld = unit * spec.width * 1.2;
    const thickness = unit * 0.02 * spec.scale;
    shapes.push({
      vertices: [
        [base[0], base[1] - thickness, z],
        [base[0] + widthWorld, base[1] - thickness, z],
        [base[0] + widthWorld, base[1] + thickness, z],
        [base[0], base[1] + thickness, z],
      ],
      ink,
    });
    for (let i = 0; i < spec.lobes; i++) {
      const t = (i + 0.5) / spec.lobes;
      const radius = unit * spec.scale * random.range(0.05, 0.1);
      const height = radius * random.range(0.6, 1.0);
      const cx = base[0] + widthWorld * (0.08 + 0.84 * t) + random.range(-radius, radius) * 0.3;
      shapes.push(lobe([cx, base[1] + thickness * 0.4, z + 0.1], radius, height, ink));
    }
  });
  return {
    key: "clouds",
    poseKey: "static",
    geometry: {
      panels: shapes.map((shape, i) => facePanel(`cloud-${i}`, shape.vertices, TOWARD)),
      creases: [],
    },
    bases: [{ origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }],
    panelInks: shapes.map((shape) => shape.ink),
    outline: false,
    motion: "cloud",
  };
}
