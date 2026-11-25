import { err, fnv1a64, ok, placeSockets, type Catalog, type Cell, type Face, type Result } from "@eschaton/foldon";
import { cellInRegion, readRegion, type EntityId, type Origin, type Proposal, type Region, type RegionRead, type WorldOp, type WorldState } from "@eschaton/world";
import type { BoundaryFace, WaveOutcome, WaveProblem } from "./solver/solve";

export type RegionRequest = Readonly<{
  region: Region;
  seed: number;
  airWeight: number;
  ground?: Readonly<{ y: number; profile: string }>;
  clear?: readonly EntityId[];
  budget: WaveProblem["budget"];
}>;

export type RegionJob = Readonly<{
  problem: WaveProblem;
  region: Region;
  read: Readonly<{ revision: number; digest: string }>;
  pins: readonly EntityId[];
  clear: readonly EntityId[];
}>;

const OPPOSITE: Readonly<Record<Face, Face>> = { "+x": "-x", "-x": "+x", "+y": "-y", "-y": "+y", "+z": "-z", "-z": "+z" };
const STEP: Readonly<Record<Face, Cell>> = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] };

const key = (cell: Cell): string => `${cell[0]},${cell[1]},${cell[2]}`;

function solveSeed(worldSeed: number, request: RegionRequest): number {
  const text = `${worldSeed}|${request.seed}|${request.region.min.join(",")}|${request.region.max.join(",")}`;
  return Number.parseInt(fnv1a64(text).slice(8), 16);
}

/**
 * Turns "solve this region of this world" into a plain-data problem for the solver, plus the read set the result
 * will be checked against. Placed entities that reach into the region are pins: their cells are blocked and their
 * sockets become the frozen boundary. Entities listed in `clear` are left out, so their cells are solved again.
 */
export function prepareRegion(catalog: Catalog, state: WorldState, request: RegionRequest): Result<RegionJob, readonly string[]> {
  const { region } = request;
  const read: RegionRead = readRegion(catalog, state, region);
  if (read.closed) return err(["generation mints new entities and is refused while conservation is closed"]);
  const clear = new Set(request.clear ?? []);
  const issues: string[] = [];
  const local = (cell: Cell): Cell => [cell[0] - region.min[0], cell[1] - region.min[1], cell[2] - region.min[2]];
  const blocked: Cell[] = [];
  const occupied = new Set<string>();
  const frozen = read.entities.filter((entity) => {
    if (!clear.has(entity.id)) return true;
    if (!entity.cells.every((cell) => cellInRegion(cell, region))) issues.push(`entity ${entity.id} cannot be cleared: it is not entirely inside the region`);
    return false;
  });
  for (const id of clear) if (!read.entities.some((entity) => entity.id === id)) issues.push(`entity ${id} cannot be cleared: it is not placed in the region`);
  if (issues.length > 0) return err(issues);
  for (const entity of frozen) {
    for (const cell of entity.cells) {
      occupied.add(key(cell));
      if (cellInRegion(cell, region)) blocked.push(local(cell));
    }
  }
  const boundary: BoundaryFace[] = [];
  for (const entity of frozen) {
    const definition = catalog.foldon(entity.definition.id, entity.definition.version);
    if (definition === undefined) continue;
    for (const socket of placeSockets(definition, entity)) {
      const step = STEP[socket.face];
      const beyond: Cell = [socket.cell[0] + step[0], socket.cell[1] + step[1], socket.cell[2] + step[2]];
      if (cellInRegion(beyond, region) && !occupied.has(key(beyond))) boundary.push({ cell: local(beyond), face: OPPOSITE[socket.face], socket });
    }
  }
  const size: Cell = [region.max[0] - region.min[0] + 1, region.max[1] - region.min[1] + 1, region.max[2] - region.min[2] + 1];
  const ground = request.ground?.y === region.min[1] ? { profile: request.ground.profile } : undefined;
  return ok({
    problem: {
      size,
      seed: solveSeed(state.header.seed, request),
      airWeight: request.airWeight,
      blocked,
      boundary,
      ...(ground === undefined ? {} : { ground }),
      budget: request.budget,
    },
    region,
    read: { revision: read.revision, digest: read.digest },
    pins: frozen.filter((entity) => entity.cells.some((cell) => cellInRegion(cell, region))).map((entity) => entity.id),
    clear: [...clear],
  });
}

/** The inert proposal for a solved job: one atomic change, valid only while the job's read set still holds. */
export function proposalOf(job: RegionJob, outcome: Extract<WaveOutcome, { kind: "solved" }>, origin: Origin): Proposal {
  const { min } = job.region;
  const ops: WorldOp[] = [
    { op: "annotate", note: `wave ${job.region.min.join(",")}..${job.region.max.join(",")} seed ${job.problem.seed}` },
    ...job.clear.map((entity): WorldOp => ({ op: "consume", entity })),
    ...outcome.placements.map((placement): WorldOp => ({
      op: "instantiate",
      ref: placement.ref,
      anchor: [placement.anchor[0] + min[0], placement.anchor[1] + min[1], placement.anchor[2] + min[2]],
      rotation: placement.rotation,
    })),
  ];
  return { region: job.region, read: job.read, ops, origin };
}
