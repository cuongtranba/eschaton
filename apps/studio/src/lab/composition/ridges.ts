import type { Vec3 } from "@eschaton/foldon";
import type { Ink, LeafBatch } from "../viewModel";
import { facePanel } from "./affine";
import type { Random } from "./random";
import { pointAtNdc, type Frame } from "./view";

const RIDGE_COUNT = 5;
const FIRST_RIDGE_Z = -230;
const RIDGE_SPACING = 55;
const TOWARD: Vec3 = [0, 0.35, 1];

type Triangle = Readonly<{ vertices: readonly [Vec3, Vec3, Vec3]; ink: Ink }>;

const smoothstep = (low: number, high: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

function ridge(frame: Frame, random: Random, index: number): readonly Triangle[] {
  const z = FIRST_RIDGE_Z - index * RIDGE_SPACING;
  const depth = index / (RIDGE_COUNT - 1);
  const tone = 0.7 - depth * 0.36;
  const footNdc = -0.14 + depth * 0.2;
  const peakBase = 0.2 + depth * 0.1;
  const points = 8 + index;
  const xLow = -1.7;
  const xHigh = 1.8;
  const crest: Vec3[] = [];
  const shoulder: Vec3[] = [];
  const foot: Vec3[] = [];
  for (let i = 0; i <= points; i++) {
    const nx = xLow + ((xHigh - xLow) * i) / points + random.range(-0.05, 0.05);
    const isPeak = i % 2 === 1;
    const rise = 0.35 + 0.65 * smoothstep(-1, 1.1, nx);
    const peak = peakBase * rise * random.range(0.8, 1.5) * (1 + depth * 0.5);
    const top = isPeak ? peak : peak * random.range(0.2, 0.45);
    crest.push(pointAtNdc(frame, nx, footNdc + top, z));
    const shoulderNdc = footNdc + top * 0.45;
    shoulder.push(pointAtNdc(frame, nx + random.range(-0.06, 0.06), shoulderNdc, z + 9));
    foot.push(pointAtNdc(frame, nx + random.range(-0.03, 0.03), footNdc, z + 16));
  }
  const triangles: Triangle[] = [];
  const ink: Ink = { tone };
  for (let i = 0; i < points; i++) {
    const [c0, c1, s0, s1, f0, f1] = [crest[i], crest[i + 1], shoulder[i], shoulder[i + 1], foot[i], foot[i + 1]];
    if (c0 === undefined || c1 === undefined || s0 === undefined || s1 === undefined || f0 === undefined || f1 === undefined) continue;
    triangles.push(
      { vertices: [c0, c1, s0], ink },
      { vertices: [c1, s1, s0], ink: { tone: tone + random.range(-0.06, 0.06) } },
      { vertices: [s0, s1, f0], ink: { tone: tone + 0.1 } },
      { vertices: [s1, f1, f0], ink: { tone: tone + 0.12 } },
    );
  }
  return triangles;
}

export function ridgeBatch(frame: Frame, random: Random): LeafBatch {
  const triangles = Array.from({ length: RIDGE_COUNT }, (_, index) => ridge(frame, random, index)).flat();
  return {
    key: "ridges",
    poseKey: "static",
    geometry: {
      panels: triangles.map((triangle, i) => facePanel(`ridge-${i}`, triangle.vertices, TOWARD)),
      creases: [],
    },
    bases: [{ origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }],
    panelInks: triangles.map((triangle) => triangle.ink),
  };
}
