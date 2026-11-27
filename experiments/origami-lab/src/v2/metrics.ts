import type { Vec3 } from "@eschaton/foldon";
import type { Compiled, Pose } from "./compile";
import { newell } from "./geom";

export type BirdMetrics = Readonly<{
  length: number;
  spanRatio: number;
  tailRatio: number;
  beakRatio: number;
  headWidthRatio: number;
  wingAspect: number;
  wristSweepDeg: number;
}>;

/** Landmark ratios measured on the built mesh (not read back from the parameters). */
export function birdMetrics(c: Compiled): BirdMetrics {
  const lm = c.design.landmarks;
  const get = (k: string): Vec3 => lm[k] ?? [0, 0, 0];
  const length = get("beakTip")[0] - get("tailTip")[0];
  const span = get("wingTipL")[2] - get("wingTipR")[2];
  const tailRoot = c.design.joints.find((j) => j.module === "tail")?.edge ?? [0, 0];
  const rootX = c.design.vertices[tailRoot[0]]?.[0] ?? 0;
  const gape = Math.max(...c.design.faces.filter((f) => f.part === "beak").flatMap((f) => f.v.map((v) => c.design.vertices[v]?.[0] ?? 0)).filter((x) => x < get("beakTip")[0]));
  const crownWidth = Math.max(...c.design.faces.filter((f) => f.part === "crown").flatMap((f) => f.v.map((v) => Math.abs(c.design.vertices[v]?.[2] ?? 0)))) * 2;
  const wingL = c.design.faces.filter((f) => f.module === "wingL").map((f) => f.v.map((v) => c.design.vertices[v] ?? ([0, 0, 0] as const)));
  const planform = wingL.reduce((s, vs) => s + Math.abs(newell(vs.map((p): Vec3 => [p[0], 0, p[2]]))[1]), 0);
  const halfSpan = span / 2;
  const wrist = get("wristL");
  const shoulder = c.design.vertices[c.design.joints.find((j) => j.module === "wingL")?.edge[0] ?? 0] ?? [0, 0, 0];
  return {
    length,
    spanRatio: span / length,
    tailRatio: (rootX - get("tailTip")[0]) / length,
    beakRatio: (get("beakTip")[0] - gape) / length,
    headWidthRatio: crownWidth / length,
    wingAspect: (halfSpan * halfSpan) / planform,
    wristSweepDeg: (Math.atan2(shoulder[0] - wrist[0], wrist[2] - shoulder[2]) * 180) / Math.PI,
  };
}

export type Silhouette = Readonly<{ n: number; cells: Uint8Array }>;

/** Orthographic occupancy raster of a pose on a fixed world window (identical scale for every variant). */
export function silhouette(pose: Pose, view: "top" | "side" | "front", n = 96, half = 5.5): Silhouette {
  const cells = new Uint8Array(n * n);
  const project = (p: Vec3): readonly [number, number] => (view === "top" ? [p[0], p[2]] : view === "side" ? [p[0], p[1]] : [p[2], p[1]]);
  for (const f of pose.faces) {
    const pts = f.vertices.map(project);
    const first = pts[0];
    if (first === undefined) continue;
    for (let k = 1; k + 1 < pts.length; k++) {
      const [b, c2] = [pts[k], pts[k + 1]];
      if (b === undefined || c2 === undefined) continue;
      const tri = [first, b, c2] as const;
      const xs = tri.map((p) => p[0]);
      const ys = tri.map((p) => p[1]);
      const toCell = (v: number): number => Math.floor(((v + half) / (2 * half)) * n);
      for (let i = Math.max(0, toCell(Math.min(...xs))); i <= Math.min(n - 1, toCell(Math.max(...xs))); i++) {
        for (let j = Math.max(0, toCell(Math.min(...ys))); j <= Math.min(n - 1, toCell(Math.max(...ys))); j++) {
          const x = -half + ((i + 0.5) * 2 * half) / n;
          const y = -half + ((j + 0.5) * 2 * half) / n;
          const s = (p: readonly [number, number], q: readonly [number, number]): number => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
          const [d1, d2, d3] = [s(tri[0], tri[1]), s(tri[1], tri[2]), s(tri[2], tri[0])];
          if ((d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0)) cells[j * n + i] = 1;
        }
      }
    }
  }
  return { n, cells };
}

export function iou(a: Silhouette, b: Silhouette): number {
  let [both, any] = [0, 0];
  for (let i = 0; i < a.cells.length; i++) {
    const [x, y] = [a.cells[i] ?? 0, b.cells[i] ?? 0];
    if (x === 1 && y === 1) both++;
    if (x === 1 || y === 1) any++;
  }
  return any === 0 ? 1 : both / any;
}

