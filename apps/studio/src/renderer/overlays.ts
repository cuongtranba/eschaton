import { Color } from "three/webgpu";
import type { Cell, Vec3 } from "@eschaton/foldon";
import { socketProfileColor } from "../lab/palette";
import type { Bounds, SocketMarker } from "../lab/viewModel";

export const GRID_PADDING = 3;
const MARKER_RADIUS = 0.07;
const TICK_LENGTH = 0.2;

export type ColoredSegments = Readonly<{ positions: Float32Array; colors: Float32Array }>;

export function gridSegments(bounds: Bounds): Float32Array {
  const x0 = Math.floor(bounds.min[0]) - GRID_PADDING;
  const x1 = Math.ceil(bounds.max[0]) + GRID_PADDING;
  const z0 = Math.floor(bounds.min[2]) - GRID_PADDING;
  const z1 = Math.ceil(bounds.max[2]) + GRID_PADDING;
  const out: number[] = [];
  for (let x = x0; x <= x1; x++) out.push(x, 0, z0, x, 0, z1);
  for (let z = z0; z <= z1; z++) out.push(x0, 0, z, x1, 0, z);
  return new Float32Array(out);
}

const BOX_EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 3], [3, 2], [2, 0],
  [4, 5], [5, 7], [7, 6], [6, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

export function footprintSegments(cells: readonly Cell[]): Float32Array {
  const out: number[] = [];
  for (const cell of cells) {
    const corners: Vec3[] = [];
    for (let i = 0; i < 8; i++) {
      corners.push([cell[0] + (i & 1), cell[1] + ((i >> 2) & 1), cell[2] + ((i >> 1) & 1)]);
    }
    for (const [a, b] of BOX_EDGES) {
      const from = corners[a];
      const to = corners[b];
      if (from !== undefined && to !== undefined) out.push(...from, ...to);
    }
  }
  return new Float32Array(out);
}

export function socketSegments(markers: readonly SocketMarker[]): ColoredSegments {
  const positions: number[] = [];
  const colors: number[] = [];
  const tint = new Color();
  const line = (from: Vec3, to: Vec3, hex: string): void => {
    tint.set(hex);
    positions.push(...from, ...to);
    colors.push(tint.r, tint.g, tint.b, tint.r, tint.g, tint.b);
  };
  for (const { position: p, normal: n, profile } of markers) {
    const hex = socketProfileColor(profile);
    const r = MARKER_RADIUS;
    line([p[0] - r, p[1], p[2]], [p[0] + r, p[1], p[2]], hex);
    line([p[0], p[1] - r, p[2]], [p[0], p[1] + r, p[2]], hex);
    line([p[0], p[1], p[2] - r], [p[0], p[1], p[2] + r], hex);
    line(p, [p[0] + n[0] * TICK_LENGTH, p[1] + n[1] * TICK_LENGTH, p[2] + n[2] * TICK_LENGTH], hex);
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
}
