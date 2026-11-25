import type { Cell } from "@eschaton/foldon";
import type { Region } from "@eschaton/world";
import type { DistrictPlan, Edge, Gate } from "./plan";

export type Continuation = Readonly<{ at: Cell; gates: readonly Gate[]; depends: readonly Region[] }>;

const DEPENDENCY_LENGTH = 12;
const OPPOSITE: Readonly<Record<Edge, Edge>> = { west: "east", east: "west", north: "south", south: "north" };

/**
 * How a new district continues an existing one across a shared edge: where it stands, which gates it must open to
 * meet the neighbour's roads, and which of the neighbour's road cells that claim depends on. Those cells lie
 * outside the new district's own box and its one-cell shell, so they are declared as nonlocal read dependencies.
 */
export function continueFrom(plan: DistrictPlan, at: Cell, edge: Edge): Continuation {
  const [width, depth] = plan.size;
  const onEdge = (x: number, z: number): boolean => (edge === "east" ? x === width - 1 : edge === "west" ? x === 0 : edge === "south" ? z === depth - 1 : z === 0);
  const origin: Cell =
    edge === "east" ? [at[0] + width, at[1], at[2]] : edge === "west" ? [at[0] - width, at[1], at[2]] : edge === "south" ? [at[0], at[1], at[2] + depth] : [at[0], at[1], at[2] - depth];
  const gates: Gate[] = [];
  const depends: Region[] = [];
  plan.gates.forEach((gate, index) => {
    if (!onEdge(gate[0], gate[1])) return;
    gates.push({ edge: OPPOSITE[edge], at: edge === "east" || edge === "west" ? gate[1] : gate[0] });
    for (const [x, z] of (plan.routes[index] ?? []).slice(0, DEPENDENCY_LENGTH)) {
      const cell: Cell = [at[0] + x, at[1], at[2] + z];
      depends.push({ min: cell, max: cell });
    }
  });
  return { at: origin, gates, depends };
}
