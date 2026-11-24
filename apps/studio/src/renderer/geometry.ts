import type { PosedGeometry, Vec3 } from "@eschaton/foldon";
import type { Basis, Ink } from "../lab/viewModel";

export const CREASE_EXTENSION = 0.25;

export function panelVertexCount(posed: PosedGeometry): number {
  return posed.panels.reduce((sum, panel) => sum + Math.max(0, panel.vertices.length - 2) * 3, 0);
}

export function writePanelTriangles(posed: PosedGeometry, positions: Float32Array, normals: Float32Array): void {
  let cursor = 0;
  const push = (vertex: Vec3, normal: Vec3): void => {
    positions.set(vertex, cursor);
    normals.set(normal, cursor);
    cursor += 3;
  };
  for (const panel of posed.panels) {
    const [first, ...rest] = panel.vertices;
    if (first === undefined) continue;
    for (let i = 0; i + 1 < rest.length; i++) {
      const second = rest[i];
      const third = rest[i + 1];
      if (second === undefined || third === undefined) continue;
      push(first, panel.normal);
      push(second, panel.normal);
      push(third, panel.normal);
    }
  }
}

export function writePanelInks(posed: PosedGeometry, panelInks: readonly Ink[] | undefined, out: Float32Array): void {
  let cursor = 0;
  posed.panels.forEach((panel, index) => {
    const ink = panelInks?.[index];
    const triangles = Math.max(0, panel.vertices.length - 2) * 3;
    for (let i = 0; i < triangles; i++) {
      out[cursor++] = ink?.tone ?? 0;
      out[cursor++] = ink?.unlit === true ? 1 : 0;
    }
  });
}

export function writeInstanceInks(inks: readonly Ink[] | undefined, count: number, out: Float32Array): void {
  for (let i = 0; i < count; i++) {
    out[i * 2] = inks?.[i]?.tone ?? 0;
    out[i * 2 + 1] = inks?.[i]?.unlit === true ? 1 : 0;
  }
}

export const transformPoint = (basis: Basis, p: Vec3): Vec3 => [
  basis.origin[0] + basis.x[0] * p[0] + basis.y[0] * p[1] + basis.z[0] * p[2],
  basis.origin[1] + basis.x[1] * p[0] + basis.y[1] * p[1] + basis.z[1] * p[2],
  basis.origin[2] + basis.x[2] * p[0] + basis.y[2] * p[1] + basis.z[2] * p[2],
];

export function panelEdgeVertexCount(posed: PosedGeometry, instances: number): number {
  return posed.panels.reduce((sum, panel) => sum + panel.vertices.length * 2, 0) * instances;
}

export function creaseVertexCount(posed: PosedGeometry, instances: number): number {
  return posed.creases.length * 2 * instances;
}

export function writePanelEdges(
  posed: PosedGeometry,
  bases: readonly Basis[],
  out: Float32Array,
  offset: number,
): number {
  let cursor = offset;
  for (const basis of bases) {
    for (const panel of posed.panels) {
      panel.vertices.forEach((vertex, i) => {
        const next = panel.vertices[(i + 1) % panel.vertices.length] ?? vertex;
        out.set(transformPoint(basis, vertex), cursor);
        out.set(transformPoint(basis, next), cursor + 3);
        cursor += 6;
      });
    }
  }
  return cursor;
}

export function writeCreaseAxes(
  posed: PosedGeometry,
  bases: readonly Basis[],
  out: Float32Array,
  offset: number,
  extension = CREASE_EXTENSION,
): number {
  let cursor = offset;
  for (const basis of bases) {
    for (const crease of posed.creases) {
      const length = Math.hypot(
        crease.end[0] - crease.start[0],
        crease.end[1] - crease.start[1],
        crease.end[2] - crease.start[2],
      );
      const k = length === 0 ? 0 : extension / length;
      const direction: Vec3 = [
        (crease.end[0] - crease.start[0]) * k,
        (crease.end[1] - crease.start[1]) * k,
        (crease.end[2] - crease.start[2]) * k,
      ];
      const start: Vec3 = [crease.start[0] - direction[0], crease.start[1] - direction[1], crease.start[2] - direction[2]];
      const end: Vec3 = [crease.end[0] + direction[0], crease.end[1] + direction[1], crease.end[2] + direction[2]];
      out.set(transformPoint(basis, start), cursor);
      out.set(transformPoint(basis, end), cursor + 3);
      cursor += 6;
    }
  }
  return cursor;
}
