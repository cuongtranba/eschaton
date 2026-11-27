import type { EdgeRef, Mount, Seam, PartPlan } from "./object";
import type { Shape } from "./lattice";
import type { Articulation, Attach, SheetPlan } from "./sheet";

export const attach = (
  id: string,
  parent: string,
  parentEdge: number,
  shape: Shape,
  edge: number,
  kind: Attach["kind"],
  angle: number,
  articulation?: Articulation,
): Attach => ({ id, parent, parentEdge, shape, edge, kind, angle, ...(articulation === undefined ? {} : { articulation }) });

export const part = (name: string, root: Shape, attaches: readonly Attach[] = [], rootId = "root"): PartPlan => {
  const plan: SheetPlan = { id: name, root: { id: rootId, shape: root }, attach: attaches };
  return { name, plan };
};

export const edgeOf = (part: string, panel: string, edge: number): EdgeRef => ({ part, panel, edge });

export const seam = (a: EdgeRef, b: EdgeRef, angle: number, extra: Readonly<{ articulation?: Articulation; closing?: true }> = {}): Seam => ({
  kind: "seam",
  a,
  b,
  angle,
  ...(extra.articulation === undefined ? {} : { articulation: extra.articulation }),
  ...(extra.closing === undefined ? {} : { closing: true as const }),
});

export const mount = (
  host: Readonly<{ part: string; panel: string }>,
  child: string,
  placement: Readonly<{ at: readonly [number, number]; turn?: number; tilt?: number; lift?: number; anchor?: number; side?: 1 | -1 }>,
): Mount => ({
  kind: "mount",
  host,
  child,
  at: placement.at,
  turn: placement.turn ?? 0,
  tilt: placement.tilt ?? 0,
  lift: placement.lift ?? 1,
  anchor: placement.anchor ?? 0,
  side: placement.side ?? 1,
});

export const snap = (value: number, step: number): number => Math.round(value / step) * step;
