import type { TileSpec } from "@eschaton/wave";
import type { Gate, PlanRules, Point, Role } from "./plan";

export type RoleRules = Readonly<{ tiles: readonly TileSpec[]; airWeight: number }>;

export type DistrictPreset = Readonly<{
  rules: PlanRules;
  size: Point;
  gates: readonly Gate[];
  river: Readonly<{ inlet: number; outlet: number }> | undefined;
  roles: Readonly<Record<Role, RoleRules>>;
}>;

const tile = (kind: "foldon" | "assembly", id: string, weight: number): TileSpec => ({ ref: { kind, id }, weight });

/**
 * "The Last District" as data: a river from north to south, three road gates, a plaza, and four lot roles. The roles
 * only choose tiles, weights and heights; every structure is still assembled from Foldons by the solver.
 */
export const lastDistrict: DistrictPreset = {
  rules: {
    id: "last-district",
    plaza: [4, 4],
    lot: { min: 3, max: 6 },
    streets: 5,
    maxBridges: 3,
    core: 11,
    heights: { tower: [5, 7], house: [3, 4], ruin: [2, 3], garden: [1, 1] },
  },
  size: [40, 40],
  gates: [
    { edge: "west", at: 14 },
    { edge: "east", at: 24 },
    { edge: "south", at: 12 },
  ],
  river: { inlet: 27, outlet: 23 },
  roles: {
    tower: { tiles: [tile("foldon", "P08", 6), tile("assembly", "column-3", 5), tile("foldon", "P07", 2), tile("foldon", "P03", 1), tile("assembly", "l-block", 2)], airWeight: 3 },
    house: { tiles: [tile("assembly", "roof-house", 3), tile("assembly", "roof-module", 4), tile("foldon", "P08", 4), tile("foldon", "P03", 4), tile("assembly", "l-block", 2)], airWeight: 7 },
    ruin: { tiles: [tile("assembly", "l-block", 3), tile("foldon", "P08", 2), tile("foldon", "P09", 4), tile("assembly", "column-3", 1)], airWeight: 12 },
    garden: { tiles: [tile("foldon", "leaf", 4), tile("foldon", "P09", 1), tile("foldon", "P07", 1)], airWeight: 14 },
  },
};

export const presets: readonly DistrictPreset[] = [lastDistrict];
