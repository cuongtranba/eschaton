import type { Catalog, Cell } from "@eschaton/foldon";
import { compileTiles, prepareRegion, proposalOf, solve, type CompiledTiles } from "@eschaton/wave";
import { applyProposal, readRegion, type Origin, type Proposal, type Region, type WorldOp, type WorldState } from "@eschaton/world";
import { planDistrict, type DistrictPlan, type Gate, type Lot, type Role } from "./plan";
import type { DistrictPreset } from "./presets";
import { scopedSeed } from "./seed";
import { planIssues } from "./validate";

export type DistrictRequest = Readonly<{
  preset: DistrictPreset;
  seed: number;
  /** World cell of the district's north-west ground corner. Its y is the ground plane. */
  at: Cell;
  gates?: readonly Gate[];
  river?: Readonly<{ inlet: number; outlet: number }> | "none";
  /** Regions outside the district that the request relied on, for example a neighbour's road (ADR 0016). */
  depends?: readonly Region[];
}>;

export type DistrictMetrics = Readonly<{
  cells: number;
  roadCells: number;
  waterCells: number;
  bridgeCells: number;
  lots: Readonly<Record<Role, number>>;
  emptyLots: number;
  /** Instantiate operations. An assembly placement mints several entities, so this is not the entity count. */
  placements: number;
  ops: number;
  solverDecisions: number;
  solverBacktracks: number;
  planAttempts: number;
  lotRetries: number;
}>;

export type DistrictOutcome =
  | Readonly<{ kind: "generated"; plan: DistrictPlan; at: Cell; proposal: Proposal; metrics: DistrictMetrics; diagnostics: readonly string[] }>
  | Readonly<{ kind: "failed"; stage: string; reason: string }>;

export type DistrictProgress = Readonly<{ stage: "planning" | "network" | "lots" | "done"; lotsDone: number; lotsTotal: number; plan: DistrictPlan | undefined }>;

export type DistrictJob = Readonly<{ step: () => DistrictOutcome | undefined; progress: () => DistrictProgress }>;

const GROUND_PIECE = { road: "paving", plaza: "paving", bridge: "bridge", water: "water" } as const;
const LOT_ATTEMPTS = 3;
const LOT_BUDGET = { maxNodes: 60_000, maxBacktracks: 6_000 } as const;
const JOB_ORIGIN: Origin = { kind: "job", id: "genesis" };

export function districtRegion(preset: DistrictPreset, at: Cell): Region {
  const height = Math.max(...Object.values(preset.rules.heights).map(([, high]) => high));
  return { min: at, max: [at[0] + preset.size[0] - 1, at[1] + height - 1, at[2] + preset.size[1] - 1] };
}

/**
 * Generates one district as a job that advances one stage or one lot per step. It works on a private scratch state
 * and never touches the world: the result is a single inert proposal, or an explicit failure.
 */
export function createDistrictJob(catalog: Catalog, state: WorldState, request: DistrictRequest): DistrictJob {
  const { preset, at } = request;
  const region = districtRegion(preset, at);
  const diagnostics: string[] = [];
  const ops: WorldOp[] = [];
  const compiled = new Map<Role, CompiledTiles>();
  let plan: DistrictPlan | undefined;
  let scratch = state;
  let stage: DistrictProgress["stage"] = "planning";
  let lotIndex = 0;
  let finished: DistrictOutcome | undefined;
  let [decisions, backtracks, retries, empty] = [0, 0, 0, 0];
  const base = readRegion(catalog, state, region);
  const dependencies = (request.depends ?? []).map((dependency) => ({ region: dependency, digest: readRegion(catalog, state, dependency).digest }));

  const fail = (failedStage: string, reason: string): DistrictOutcome => {
    finished = { kind: "failed", stage: failedStage, reason };
    return finished;
  };

  const planStep = (): DistrictOutcome | undefined => {
    if (![...at].every(Number.isSafeInteger)) return fail("request", "the district corner must be an integer cell");
    if (base.closed) return fail("world", "generation mints new entities and is refused while conservation is closed");
    if (base.entities.some((entity) => entity.cells.some((cell) => cell.every((value, axis) => value >= (region.min[axis] ?? 0) && value <= (region.max[axis] ?? 0))))) {
      return fail("world", "the district box already holds entities; Phase 3 generates into empty ground only");
    }
    const river = request.river === "none" ? undefined : (request.river ?? preset.river);
    const planned = planDistrict({ rules: preset.rules, worldSeed: state.header.seed, seed: request.seed, size: preset.size, gates: request.gates ?? preset.gates, ...(river === undefined ? {} : { river }) });
    if (!planned.ok) return fail(`plan:${planned.error.stage}`, `${planned.error.reason} (after ${planned.error.attempts} attempts)`);
    const issues = planIssues(planned.value);
    if (issues.length > 0) return fail("plan:validation", issues.slice(0, 3).join("; "));
    for (const role of ["tower", "house", "ruin", "garden"] as const) {
      const tiles = compileTiles(catalog, preset.roles[role].tiles);
      if (!tiles.ok) return fail("tiles", `${role}: ${tiles.error.join("; ")}`);
      compiled.set(role, tiles.value);
    }
    plan = planned.value;
    stage = "network";
    return undefined;
  };

  const networkStep = (current: DistrictPlan): DistrictOutcome | undefined => {
    const [width] = current.size;
    const network: WorldOp[] = [];
    current.kinds.forEach((kind, index) => {
      if (kind === "open" || kind === "lot") return;
      network.push({ op: "instantiate", ref: { kind: "foldon", id: GROUND_PIECE[kind] }, anchor: [at[0] + (index % width), at[1], at[2] + Math.floor(index / width)], rotation: 0 });
    });
    const laid = applyProposal(catalog, scratch, { region, read: { revision: base.revision, digest: base.digest }, ops: network, origin: JOB_ORIGIN });
    if (!laid.ok) return fail("network", laid.error.kind === "invalid" ? laid.error.issues.map((issue) => issue.code).join(", ") : laid.error.kind);
    scratch = laid.value.state;
    ops.push(...network);
    stage = current.lots.length === 0 ? "done" : "lots";
    return undefined;
  };

  const lotStep = (current: DistrictPlan, lot: Lot): void => {
    const tiles = compiled.get(lot.role);
    if (tiles === undefined) return;
    const lotRegion: Region = { min: [at[0] + lot.min[0], at[1], at[2] + lot.min[1]], max: [at[0] + lot.max[0], at[1] + lot.height - 1, at[2] + lot.max[1]] };
    for (let attempt = 0; attempt < LOT_ATTEMPTS; attempt++) {
      const job = prepareRegion(catalog, scratch, {
        region: lotRegion,
        seed: scopedSeed(request.seed, preset.rules.id, `lot:${lot.id}`, current.attempt, attempt),
        airWeight: preset.roles[lot.role].airWeight,
        ground: { y: at[1], profile: "ground" },
        budget: LOT_BUDGET,
      });
      if (!job.ok) {
        diagnostics.push(`lot ${lot.id} (${lot.role}) could not be prepared: ${job.error.join("; ")}`);
        break;
      }
      const outcome = solve(tiles, job.value.problem);
      if (outcome.kind !== "solved") {
        diagnostics.push(`lot ${lot.id} (${lot.role}) attempt ${attempt}: ${outcome.kind}`);
        retries += 1;
        continue;
      }
      decisions += outcome.stats.nodes;
      backtracks += outcome.stats.backtracks;
      if (outcome.placements.length === 0) {
        retries += 1;
        continue;
      }
      const proposal = proposalOf(job.value, outcome, JOB_ORIGIN);
      const applied = applyProposal(catalog, scratch, proposal);
      if (!applied.ok) {
        diagnostics.push(`lot ${lot.id} (${lot.role}) attempt ${attempt} was rejected by the world: ${applied.error.kind}`);
        retries += 1;
        continue;
      }
      scratch = applied.value.state;
      ops.push(...proposal.ops.filter((op) => op.op === "instantiate"));
      return;
    }
    empty += 1;
    if (lot.role !== "garden") diagnostics.push(`lot ${lot.id} (${lot.role}) stayed empty after ${LOT_ATTEMPTS} attempts`);
  };

  const finish = (current: DistrictPlan): DistrictOutcome => {
    const count = (kind: string): number => current.kinds.filter((cell) => cell === kind).length;
    const lots = { tower: 0, house: 0, ruin: 0, garden: 0 };
    for (const lot of current.lots) lots[lot.role] += 1;
    const note: WorldOp = { op: "annotate", note: `genesis ${preset.rules.id} seed ${request.seed} at ${at.join(",")}` };
    finished = {
      kind: "generated",
      plan: current,
      at,
      proposal: { region, read: { revision: base.revision, digest: base.digest }, ...(dependencies.length === 0 ? {} : { depends: dependencies }), ops: [note, ...ops], origin: JOB_ORIGIN },
      metrics: {
        cells: current.kinds.length,
        roadCells: count("road") + count("plaza"),
        waterCells: count("water"),
        bridgeCells: count("bridge"),
        lots,
        emptyLots: empty,
        placements: ops.length,
        ops: ops.length + 1,
        solverDecisions: decisions,
        solverBacktracks: backtracks,
        planAttempts: current.attempt + 1,
        lotRetries: retries,
      },
      diagnostics,
    };
    return finished;
  };

  const step = (): DistrictOutcome | undefined => {
    if (finished !== undefined) return finished;
    if (stage === "planning") return planStep();
    if (plan === undefined) return fail("plan", "the plan is missing");
    if (stage === "network") return networkStep(plan);
    if (stage === "lots") {
      const lot = plan.lots[lotIndex];
      if (lot !== undefined) lotStep(plan, lot);
      lotIndex += 1;
      if (lotIndex >= plan.lots.length) stage = "done";
      return undefined;
    }
    return finish(plan);
  };

  return { step, progress: () => ({ stage, lotsDone: lotIndex, lotsTotal: plan?.lots.length ?? 0, plan }) };
}

export function generateDistrict(catalog: Catalog, state: WorldState, request: DistrictRequest): DistrictOutcome {
  const job = createDistrictJob(catalog, state, request);
  for (;;) {
    const outcome = job.step();
    if (outcome !== undefined) return outcome;
  }
}
