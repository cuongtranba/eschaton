import type { CellKind, DistrictPlan, Point } from "./plan";

const NEIGHBOURS: readonly Point[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function reachable(plan: DistrictPlan, from: Point, through: readonly CellKind[]): ReadonlySet<number> {
  const [width, depth] = plan.size;
  const seen = new Set<number>();
  const queue: Point[] = [];
  const visit = (x: number, z: number): void => {
    if (x < 0 || z < 0 || x >= width || z >= depth) return;
    const index = z * width + x;
    if (seen.has(index) || !through.includes(plan.kinds[index] ?? "open")) return;
    seen.add(index);
    queue.push([x, z]);
  };
  visit(from[0], from[1]);
  for (let cell = queue.shift(); cell !== undefined; cell = queue.shift()) for (const [dx, dz] of NEIGHBOURS) visit(cell[0] + dx, cell[1] + dz);
  return seen;
}

/**
 * The global constraints of a plan, checked without the planner's own bookkeeping: every gate reaches the plaza over
 * road, bridge and plaza cells; the river runs unbroken from inlet to outlet; lots are disjoint rectangles of lot
 * cells; lots that are built on have road frontage.
 */
export function planIssues(plan: DistrictPlan): readonly string[] {
  const [width, depth] = plan.size;
  const issues: string[] = [];
  const kindAt = (x: number, z: number): CellKind | undefined => (x < 0 || z < 0 || x >= width || z >= depth ? undefined : plan.kinds[z * width + x]);
  if (plan.kinds.length !== width * depth || plan.lotOf.length !== width * depth) return ["the plan grids do not match the district size"];

  const network = reachable(plan, plan.plaza.min, ["road", "bridge", "plaza"]);
  if (network.size === 0) issues.push("the plaza is missing");
  for (const gate of plan.gates) if (!network.has(gate[1] * width + gate[0])) issues.push(`gate ${gate.join(",")} is not connected to the plaza`);
  plan.kinds.forEach((kind, index) => {
    if ((kind === "road" || kind === "bridge") && !network.has(index)) issues.push(`road cell ${index % width},${Math.floor(index / width)} is cut off from the plaza`);
  });

  if (plan.river !== undefined) {
    const water = reachable(plan, plan.river.inlet, ["water", "bridge"]);
    if (!water.has(plan.river.outlet[1] * width + plan.river.outlet[0])) issues.push("the river does not run from its inlet to its outlet");
  }

  const claimed = new Map<number, number>();
  for (const lot of plan.lots) {
    let frontage = false;
    for (let z = lot.min[1]; z <= lot.max[1]; z++) {
      for (let x = lot.min[0]; x <= lot.max[0]; x++) {
        const index = z * width + x;
        if (kindAt(x, z) !== "lot" || plan.lotOf[index] !== lot.id) issues.push(`lot ${lot.id} does not own cell ${x},${z}`);
        if (claimed.has(index)) issues.push(`lots ${claimed.get(index) ?? -1} and ${lot.id} overlap at ${x},${z}`);
        claimed.set(index, lot.id);
        frontage ||= NEIGHBOURS.some(([dx, dz]) => ["road", "bridge", "plaza"].includes(kindAt(x + dx, z + dz) ?? "open"));
      }
    }
    if ((lot.role === "tower" || lot.role === "house") && !frontage) issues.push(`lot ${lot.id} is a ${lot.role} without road frontage`);
    if (lot.height < 1) issues.push(`lot ${lot.id} has no height`);
  }
  plan.kinds.forEach((kind, index) => {
    if (kind === "lot" && !claimed.has(index)) issues.push(`cell ${index % width},${Math.floor(index / width)} is marked as a lot and belongs to none`);
  });
  return issues;
}
