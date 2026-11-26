import { err, ok, type Result } from "@eschaton/foldon";
import { scopedSeed, stream } from "./seed";

export type CellKind = "open" | "water" | "road" | "bridge" | "plaza" | "lot";
export type Role = "tower" | "house" | "ruin" | "garden";
export type Edge = "west" | "east" | "north" | "south";
export type Gate = Readonly<{ edge: Edge; at: number }>;
export type Point = readonly [number, number];

export type PlanRules = Readonly<{
  id: string;
  plaza: Point;
  lot: Readonly<{ min: number; max: number }>;
  streets: number;
  maxBridges: number;
  core: number;
  heights: Readonly<Record<Role, readonly [number, number]>>;
}>;

export type PlanRequest = Readonly<{
  rules: PlanRules;
  worldSeed: number;
  seed: number;
  size: Point;
  gates: readonly Gate[];
  river?: Readonly<{ inlet: number; outlet: number }>;
}>;

export type Lot = Readonly<{ id: number; role: Role; min: Point; max: Point; frontage: boolean; height: number }>;

export type DistrictPlan = Readonly<{
  size: Point;
  kinds: readonly CellKind[];
  lotOf: readonly number[];
  gates: readonly Point[];
  river: Readonly<{ inlet: Point; outlet: Point }> | undefined;
  plaza: Readonly<{ min: Point; max: Point }>;
  routes: readonly (readonly Point[])[];
  lots: readonly Lot[];
  attempt: number;
}>;

export type PlanFailure = Readonly<{ stage: "request" | "river" | "plaza" | "roads" | "lots"; reason: string; attempts: number }>;

const MAX_ATTEMPTS = 6;
const NEIGHBOURS: readonly Point[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const gateCell = (gate: Gate, size: Point): Point => {
  switch (gate.edge) {
    case "west":
      return [0, gate.at];
    case "east":
      return [size[0] - 1, gate.at];
    case "north":
      return [gate.at, 0];
    case "south":
      return [gate.at, size[1] - 1];
  }
};

function requestIssue(request: PlanRequest): string | undefined {
  const [width, depth] = request.size;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(depth) || width < 12 || depth < 12 || width > 96 || depth > 96) return "a district is 12..96 cells on each side";
  if (!Number.isSafeInteger(request.seed) || request.seed < 0) return "the seed must be an integer >= 0";
  if (request.gates.length === 0) return "a district needs at least one road gate";
  for (const gate of request.gates) {
    const span = gate.edge === "west" || gate.edge === "east" ? depth : width;
    if (!Number.isSafeInteger(gate.at) || gate.at < 1 || gate.at > span - 2) return `gate ${gate.edge}@${gate.at} is not on its edge`;
  }
  const { river } = request;
  if (river !== undefined && [river.inlet, river.outlet].some((x) => !Number.isSafeInteger(x) || x < 1 || x > width - 3)) return "the river terminals must lie on the north and south edges";
  return undefined;
}

type Attempt = Result<DistrictPlan, Readonly<{ stage: PlanFailure["stage"]; reason: string }>>;

/** The gate cells and river terminals a plan for this request records. */
export function plannedTerminals(request: PlanRequest): Pick<DistrictPlan, "gates" | "river"> {
  const gates = request.gates.map((gate) => gateCell(gate, request.size));
  const depth = request.size[1];
  return { gates, river: request.river === undefined || gates.length === 0 ? undefined : { inlet: [request.river.inlet, 0], outlet: [request.river.outlet, depth - 1] } };
}

function attemptPlan(request: PlanRequest, attempt: number): Attempt {
  const { rules } = request;
  const [width, depth] = request.size;
  const at = (x: number, z: number): number => z * width + x;
  const inside = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < width && z < depth;
  const kinds: CellKind[] = new Array<CellKind>(width * depth).fill("open");
  const seedOf = (scope: string): number => scopedSeed(request.worldSeed, request.seed, rules.id, scope, attempt);

  if (request.river !== undefined) {
    const random = stream(seedOf("river"));
    let x = request.river.inlet;
    for (let z = 0; z < depth; z++) {
      kinds[at(x, z)] = "water";
      kinds[at(x + 1, z)] = "water";
      const rows = depth - 1 - z;
      const needed = request.river.outlet - x;
      if (rows === 0) break;
      let step = Math.abs(needed) >= rows ? Math.sign(needed) : random.below(3) - 1;
      if (Math.abs(needed - step) > rows - 1) step = Math.sign(needed);
      x = Math.min(width - 3, Math.max(1, x + step));
    }
    if (x !== request.river.outlet) return err({ stage: "river", reason: "the river cannot reach its outlet" });
  }

  const [plazaWidth, plazaDepth] = rules.plaza;
  const plazaRandom = stream(seedOf("plaza"));
  const centre: Point = [Math.floor((width - plazaWidth) / 2) + plazaRandom.below(7) - 3, Math.floor((depth - plazaDepth) / 2) + plazaRandom.below(7) - 3];
  let plazaMin: Point | undefined;
  for (let radius = 0; radius < Math.max(width, depth) && plazaMin === undefined; radius++) {
    for (let dz = -radius; dz <= radius && plazaMin === undefined; dz++) {
      for (let dx = -radius; dx <= radius && plazaMin === undefined; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const [x0, z0] = [centre[0] + dx, centre[1] + dz];
        let fits = x0 >= 2 && z0 >= 2 && x0 + plazaWidth <= width - 2 && z0 + plazaDepth <= depth - 2;
        for (let z = z0 - 1; z <= z0 + plazaDepth && fits; z++) for (let x = x0 - 1; x <= x0 + plazaWidth && fits; x++) fits = kinds[at(x, z)] === "open";
        if (fits) plazaMin = [x0, z0];
      }
    }
  }
  if (plazaMin === undefined) return err({ stage: "plaza", reason: "there is no room for the plaza on land" });
  const plazaMax: Point = [plazaMin[0] + plazaWidth - 1, plazaMin[1] + plazaDepth - 1];
  for (let z = plazaMin[1]; z <= plazaMax[1]; z++) for (let x = plazaMin[0]; x <= plazaMax[0]; x++) kinds[at(x, z)] = "plaza";

  const noiseSeed = seedOf("roads");
  const noise = (index: number): number => scopedSeed(noiseSeed, index) % 3;
  const stepCost = (index: number): number => {
    const kind = kinds[index];
    if (kind === "road" || kind === "bridge" || kind === "plaza") return 1;
    return kind === "water" ? 14 : 2 + noise(index);
  };
  /** Cheapest 4-connected path from a cell to the existing network (plaza, road or bridge). Ties go to the lower cell index. */
  const route = (from: Point): Point[] | undefined => {
    const total = width * depth;
    const cost = new Int32Array(total).fill(-1);
    const previous = new Int32Array(total).fill(-1);
    const done = new Uint8Array(total);
    const start = at(from[0], from[1]);
    cost[start] = 0;
    for (;;) {
      let best = -1;
      for (let index = 0; index < total; index++) {
        const value = cost[index] ?? -1;
        if (done[index] === 0 && value >= 0 && (best < 0 || value < (cost[best] ?? 0))) best = index;
      }
      if (best < 0) return undefined;
      done[best] = 1;
      const kind = kinds[best];
      if (best !== start && (kind === "plaza" || kind === "road" || kind === "bridge")) {
        const path: Point[] = [];
        for (let index = best; index >= 0; index = previous[index] ?? -1) path.push([index % width, Math.floor(index / width)]);
        return path.reverse();
      }
      const [x, z] = [best % width, Math.floor(best / width)];
      for (const [dx, dz] of NEIGHBOURS) {
        if (!inside(x + dx, z + dz)) continue;
        const next = at(x + dx, z + dz);
        const value = (cost[best] ?? 0) + stepCost(next);
        if (done[next] === 0 && ((cost[next] ?? -1) < 0 || value < (cost[next] ?? 0))) {
          cost[next] = value;
          previous[next] = best;
        }
      }
    }
  };
  const routes: Point[][] = [];
  let bridges = 0;
  const pave = (path: readonly Point[]): void => {
    let onWater = false;
    for (const [x, z] of path) {
      const index = at(x, z);
      const kind = kinds[index];
      if (kind === "water") {
        kinds[index] = "bridge";
        if (!onWater) bridges += 1;
        onWater = true;
      } else {
        if (kind === "open") kinds[index] = "road";
        onWater = kind === "bridge";
      }
    }
    routes.push([...path]);
  };
  const { gates, river } = plannedTerminals(request);
  for (const gate of gates) {
    if (kinds[at(gate[0], gate[1])] !== "open") return err({ stage: "roads", reason: `gate ${gate.join(",")} is not on open land` });
    const path = route(gate);
    if (path === undefined) return err({ stage: "roads", reason: `gate ${gate.join(",")} cannot reach the plaza` });
    pave(path);
  }
  const streetRandom = stream(seedOf("streets"));
  for (let street = 0; street < rules.streets; street++) {
    for (let tries = 0; tries < 20; tries++) {
      const from: Point = [2 + streetRandom.below(width - 4), 2 + streetRandom.below(depth - 4)];
      if (kinds[at(from[0], from[1])] !== "open") continue;
      const path = route(from);
      if (path !== undefined && path.length >= 5) {
        pave(path);
        break;
      }
    }
  }
  if (bridges > rules.maxBridges) return err({ stage: "roads", reason: `the roads need ${bridges} bridges and the rules allow ${rules.maxBridges}` });

  const lotOf: number[] = new Array<number>(width * depth).fill(-1);
  const lots: Lot[] = [];
  const lotRandom = stream(seedOf("lots"));
  const free = (x: number, z: number): boolean => inside(x, z) && kinds[at(x, z)] === "open";
  const network = (x: number, z: number): boolean => inside(x, z) && ["road", "bridge", "plaza"].includes(kinds[at(x, z)] ?? "open");
  for (let z = 1; z < depth - 1; z++) {
    for (let x = 1; x < width - 1; x++) {
      if (!free(x, z)) continue;
      const span = rules.lot.max - rules.lot.min + 1;
      const [wantWidth, wantDepth] = [rules.lot.min + lotRandom.below(span), rules.lot.min + lotRandom.below(span)];
      let lotWidth = 0;
      while (lotWidth < wantWidth && x + lotWidth < width - 1 && free(x + lotWidth, z)) lotWidth += 1;
      let lotDepth = 0;
      for (; lotDepth < wantDepth && z + lotDepth < depth - 1; lotDepth++) {
        let row = true;
        for (let dx = 0; dx < lotWidth && row; dx++) row = free(x + dx, z + lotDepth);
        if (!row) break;
      }
      if (lotWidth < 2 || lotDepth < 2) continue;
      const id = lots.length;
      let frontage = false;
      for (let dz = 0; dz < lotDepth; dz++) {
        for (let dx = 0; dx < lotWidth; dx++) {
          kinds[at(x + dx, z + dz)] = "lot";
          lotOf[at(x + dx, z + dz)] = id;
          frontage ||= NEIGHBOURS.some(([nx, nz]) => network(x + dx + nx, z + dz + nz));
        }
      }
      const distance = Math.abs(x + lotWidth / 2 - (plazaMin[0] + plazaWidth / 2)) + Math.abs(z + lotDepth / 2 - (plazaMin[1] + plazaDepth / 2));
      const roll = stream(scopedSeed(request.worldSeed, request.seed, rules.id, `role:${x},${z}`, attempt)).below(100);
      const small = Math.min(lotWidth, lotDepth) < 3;
      const role: Role = !frontage ? "garden" : distance <= rules.core ? (roll < 70 && !small ? "tower" : "house") : roll < 60 ? "house" : roll < 82 ? "ruin" : "garden";
      const [low, high] = rules.heights[role];
      const height = low + stream(scopedSeed(request.worldSeed, request.seed, rules.id, `height:${x},${z}`, attempt)).below(high - low + 1);
      lots.push({ id, role, min: [x, z], max: [x + lotWidth - 1, z + lotDepth - 1], frontage, height });
    }
  }
  if (!lots.some((lot) => lot.role === "house" || lot.role === "tower")) return err({ stage: "lots", reason: "no lot with road frontage could be laid out" });

  return ok({
    size: request.size,
    kinds,
    lotOf,
    gates,
    river,
    plaza: { min: plazaMin, max: plazaMax },
    routes,
    lots,
    attempt,
  });
}

/** Plans a district. Global constraints that cannot be met end as an explicit failure after bounded, seeded retries. */
export function planDistrict(request: PlanRequest): Result<DistrictPlan, PlanFailure> {
  const invalid = requestIssue(request);
  if (invalid !== undefined) return err({ stage: "request", reason: invalid, attempts: 0 });
  let last: Readonly<{ stage: PlanFailure["stage"]; reason: string }> = { stage: "request", reason: "no attempt was made" };
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = attemptPlan(request, attempt);
    if (result.ok) return result;
    last = result.error;
  }
  return err({ ...last, attempts: MAX_ATTEMPTS });
}
