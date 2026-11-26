import { placeFootprint, placeSockets, type Catalog, type Cell } from "@eschaton/foldon";
import type { WorldState } from "@eschaton/world";
import type { DistrictPlan, Point } from "./plan";

const GROUND: Readonly<Record<string, string>> = { road: "paving", plaza: "paving", bridge: "bridge", water: "water" };
const GROUND_IDS: readonly string[] = ["paving", "bridge", "water"];
const NEIGHBOURS: readonly Point[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (cell: Cell): string => `${cell[0]},${cell[1]},${cell[2]}`;

/**
 * Checks a world state against a district plan from scratch: the right ground piece on every road, plaza, bridge
 * and water cell; nothing standing on the network or outside its lot; no piece that needs support over air; and
 * roads that really connect every gate to the plaza in the world itself, not only in the plan.
 */
export function auditDistrict(catalog: Catalog, state: WorldState, plan: DistrictPlan, at: Cell): readonly string[] {
  const [width, depth] = plan.size;
  const table = catalog.sockets();
  const needsMate = (profile: string): boolean => table.profiles.find((spec) => spec.id === profile)?.needsMate === true;
  const issues: string[] = [];
  const occupant = new Map<string, string>();
  const inDistrict = (cell: Cell): boolean => cell[0] >= at[0] && cell[2] >= at[2] && cell[0] < at[0] + width && cell[2] < at[2] + depth && cell[1] >= at[1];
  const placed = state.entities.flatMap((entity) => {
    const definition = catalog.foldon(entity.definition.id, entity.definition.version);
    if (entity.owner.kind !== "placed" || definition === undefined) return [];
    const cells = placeFootprint(definition, entity.owner);
    if (!cells.some(inDistrict)) return [];
    for (const cell of cells) occupant.set(key(cell), definition.id);
    return [{ entity, definition, cells, pose: entity.owner }];
  });

  plan.kinds.forEach((kind, index) => {
    const [x, z] = [index % width, Math.floor(index / width)];
    const found = occupant.get(key([at[0] + x, at[1], at[2] + z]));
    const expected = GROUND[kind];
    if (expected !== undefined && found !== expected) issues.push(`${kind} cell ${x},${z} holds ${found ?? "nothing"} instead of ${expected}`);
    if (kind === "open" && found !== undefined) issues.push(`open cell ${x},${z} holds ${found}`);
    if (kind === "lot" && found !== undefined && GROUND_IDS.includes(found)) issues.push(`lot cell ${x},${z} holds the ground piece ${found}`);
  });

  for (const { entity, definition, cells, pose } of placed) {
    const ground = GROUND_IDS.includes(definition.id);
    for (const cell of cells) {
      if (!inDistrict(cell)) {
        issues.push(`${entity.id} (${definition.id}) reaches outside the district`);
        continue;
      }
      const index = (cell[2] - at[2]) * width + (cell[0] - at[0]);
      const kind = plan.kinds[index] ?? "open";
      if (ground) {
        if (cell[1] !== at[1]) issues.push(`${entity.id} (${definition.id}) is not on the ground`);
        continue;
      }
      const lot = plan.lots[plan.lotOf[index] ?? -1];
      if (kind !== "lot" || lot === undefined) issues.push(`${entity.id} (${definition.id}) stands on a ${kind} cell`);
      else if (cell[1] >= at[1] + lot.height) issues.push(`${entity.id} (${definition.id}) is taller than lot ${lot.id} allows`);
    }
    for (const socket of placeSockets(definition, pose)) {
      if (socket.face !== "-y" || !needsMate(socket.profile) || socket.cell[1] === at[1]) continue;
      if (!occupant.has(key([socket.cell[0], socket.cell[1] - 1, socket.cell[2]]))) issues.push(`${entity.id} (${definition.id}) needs support and stands on air`);
    }
  }

  const paved = (x: number, z: number): boolean => ["paving", "bridge"].includes(occupant.get(key([at[0] + x, at[1], at[2] + z])) ?? "");
  const seen = new Set<string>();
  const queue: Point[] = [];
  const visit = (x: number, z: number): void => {
    if (x < 0 || z < 0 || x >= width || z >= depth || seen.has(`${x},${z}`) || !paved(x, z)) return;
    seen.add(`${x},${z}`);
    queue.push([x, z]);
  };
  visit(plan.plaza.min[0], plan.plaza.min[1]);
  for (let cell = queue.shift(); cell !== undefined; cell = queue.shift()) for (const [dx, dz] of NEIGHBOURS) visit(cell[0] + dx, cell[1] + dz);
  for (const gate of plan.gates) if (!seen.has(`${gate[0]},${gate[1]}`)) issues.push(`in the world, gate ${gate.join(",")} is not connected to the plaza by paving`);
  return issues;
}
