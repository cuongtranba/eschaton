import { err, ok, presetCatalog, type Catalog, type Cell, type Pose, type Result } from "@eschaton/foldon";
import {
  continueFrom,
  lastDistrict,
  settleDistrict,
  type DistrictMetrics,
  type DistrictPlan,
  type DistrictProgress,
  type DistrictRequest,
  type DistrictSettlement,
} from "@eschaton/genesis";
import {
  applyPatch,
  createWorld,
  findEntity,
  hashState,
  replay,
  runSystem,
  windFold,
  type CommitRecord,
  type Committed,
  type Entity,
  type EntityId,
  type Rejection,
  type WorldOp,
  type WorldState,
} from "@eschaton/world";
import { buildRebuild, REBUILD_CELL_SIZE, type RebuildReport } from "../rebuild/layout";
import { prepareRegion, settleJob, type RegionJob, type SettleStatus, type TileSpec, type WavePlacement, type WaveProgress } from "@eschaton/wave";
import { DEFAULT_SEED } from "../state";
import type { InkScale, ViewPreset } from "../viewModel";
import { compositionView } from "../composition/view";

export type WorldSession = Readonly<{
  catalog: Catalog;
  initial: WorldState;
  state: WorldState;
  log: readonly CommitRecord[];
  selected: EntityId | undefined;
  rejection: string;
  offsets: boolean;
  homes: ReadonlyMap<EntityId, Pose>;
  wind: number;
  replay: string;
  presentation: Presentation;
  wave: WaveSession;
  genesis: GenesisSession;
}>;

export const WAVE_SIZES = { small: [6, 4, 6], medium: [10, 5, 10], large: [16, 8, 16], huge: [28, 8, 28] } as const;
export type WaveSize = keyof typeof WAVE_SIZES;

export const WAVE_TILES: readonly TileSpec[] = [
  { ref: { kind: "foldon", id: "P08" }, weight: 6 },
  { ref: { kind: "foldon", id: "P03" }, weight: 3 },
  { ref: { kind: "foldon", id: "P07" }, weight: 1 },
  { ref: { kind: "assembly", id: "roof-module" }, weight: 2 },
  { ref: { kind: "assembly", id: "column-3" }, weight: 2 },
  { ref: { kind: "assembly", id: "l-block" }, weight: 2 },
  { ref: { kind: "assembly", id: "roof-house" }, weight: 1 },
];

export type WaveStatus = "idle" | "solving" | "refused" | SettleStatus;

export type WaveSession = Readonly<{
  status: WaveStatus;
  detail: string;
  run: number;
  job: RegionJob | undefined;
  cancelRequested: boolean;
  preview: readonly WavePlacement[];
  progress: string;
  x: number;
  z: number;
  size: WaveSize;
  seed: number;
}>;

const IDLE_WAVE: WaveSession = {
  status: "idle",
  detail: "",
  run: 0,
  job: undefined,
  cancelRequested: false,
  preview: [],
  progress: "",
  x: -2,
  z: -3,
  size: "medium",
  seed: 1,
};

export type GenesisStatus = "idle" | "generating" | DistrictSettlement["status"];

/** A district the world committed, with the plan it was audited against. The plan is kept for inspection only. */
export type GenesisDistrict = Readonly<{ plan: DistrictPlan; at: Cell; seed: number; revision: number; entities: number; metrics: DistrictMetrics; diagnostics: readonly string[] }>;

export type GenesisLayers = Readonly<{ roles: boolean; routes: boolean }>;

export type GenesisSession = Readonly<{
  status: GenesisStatus;
  detail: string;
  run: number;
  job: Readonly<{ request: DistrictRequest; base: WorldState }> | undefined;
  cancelRequested: boolean;
  /** The plan of the running job. A preview: it is not part of the world. */
  preview: DistrictProgress | undefined;
  seed: number;
  layers: GenesisLayers;
  districts: readonly GenesisDistrict[];
}>;

export const GENESIS_ORIGIN: Cell = [12, 0, -20];

const IDLE_GENESIS: GenesisSession = {
  status: "idle",
  detail: "",
  run: 0,
  job: undefined,
  cancelRequested: false,
  preview: undefined,
  seed: 1,
  layers: { roles: true, routes: true },
  districts: [],
};

export type Presentation = Readonly<{ cellSize: number; view: ViewPreset; inkScale: InkScale; study: RebuildReport | undefined }>;

export const worldView: ViewPreset = { position: [3.2, 4.4, 11.5], target: [3, 0.5, 1], fov: 32 };
const WORLD_PRESENTATION: Presentation = {
  cellSize: 1,
  view: worldView,
  inkScale: { hazeStart: 120, hazeEnd: 620, hatchFrequency: 7, grainFrequency: 5 },
  study: undefined,
};

export type WorldCommand =
  | Readonly<{ type: "selectEntity"; entity: EntityId }>
  | Readonly<{ type: "detach" }>
  | Readonly<{ type: "attach" }>
  | Readonly<{ type: "setWind"; strength: number }>
  | Readonly<{ type: "applyWind" }>
  | Readonly<{ type: "replay" }>
  | Readonly<{ type: "setOffsets"; enabled: boolean }>
  | Readonly<{ type: "waveSet"; x?: number; z?: number; size?: WaveSize; seed?: number }>
  | Readonly<{ type: "waveStart" }>
  | Readonly<{ type: "waveCancel" }>
  | Readonly<{ type: "waveProgress"; run: number; progress: WaveProgress }>
  | Readonly<{ type: "waveDone"; run: number; outcome: unknown }>
  | Readonly<{ type: "genesisSet"; seed?: number; layers?: Partial<GenesisLayers> }>
  | Readonly<{ type: "genesisStart" }>
  | Readonly<{ type: "genesisCancel" }>
  | Readonly<{ type: "genesisProgress"; run: number; progress: DistrictProgress }>
  | Readonly<{ type: "genesisDone"; run: number; outcome: unknown }>;

export const INITIAL_OPS: readonly WorldOp[] = [
  { op: "instantiate", ref: { kind: "assembly", id: "roof-module" }, anchor: [0, 0, 0], rotation: 0 },
  { op: "instantiate", ref: { kind: "foldon", id: "leaf" }, anchor: [3, 0, 0], rotation: 0 },
  { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [5, 0, 0], rotation: 0 },
];

const STUDIO_ORIGIN = { kind: "command", id: "studio" } as const;

export function describeRejection(rejection: Rejection): string {
  switch (rejection.kind) {
    case "stale":
      return `stale: the command was based on revision ${rejection.base}, the world is at ${rejection.current}`;
    case "invalid":
      return rejection.issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ");
  }
}

export function createWorldSession(seed: number = DEFAULT_SEED): Result<WorldSession, string> {
  if (!presetCatalog.ok) return err(presetCatalog.error.map((issue) => `${issue.code} at ${issue.path}`).join("; "));
  const catalog = presetCatalog.value;
  const created = createWorld({ catalog, seed });
  if (!created.ok) return err(created.error.map((issue) => issue.message).join("; "));
  const committed = applyPatch(catalog, created.value, { baseRevision: 0, ops: INITIAL_OPS, origin: STUDIO_ORIGIN });
  if (!committed.ok) return err(describeRejection(committed.error));
  return ok({
    catalog,
    initial: created.value,
    state: committed.value.state,
    log: [committed.value.record],
    selected: committed.value.state.entities[0]?.id,
    rejection: "",
    offsets: false,
    homes: new Map(),
    wind: 0.1,
    replay: "",
    presentation: WORLD_PRESENTATION,
    wave: IDLE_WAVE,
    genesis: IDLE_GENESIS,
  });
}

export function createRebuildSession(seed: number = DEFAULT_SEED): Result<WorldSession, string> {
  if (!presetCatalog.ok) return err(presetCatalog.error.map((issue) => `${issue.code} at ${issue.path}`).join("; "));
  const catalog = presetCatalog.value;
  const rebuild = buildRebuild(catalog, seed);
  if (typeof rebuild === "string") return err(rebuild);
  return ok({
    catalog,
    initial: rebuild.initial,
    state: rebuild.state,
    log: rebuild.log,
    selected: undefined,
    rejection: "",
    offsets: false,
    homes: new Map(),
    wind: 0.1,
    replay: "",
    presentation: {
      cellSize: REBUILD_CELL_SIZE,
      view: compositionView,
      inkScale: { hazeStart: 120, hazeEnd: 620, hatchFrequency: 0.9, grainFrequency: 0.45 },
      study: rebuild.report,
    },
    wave: IDLE_WAVE,
    genesis: IDLE_GENESIS,
  });
}

export const selectedEntity = (session: WorldSession): Entity | undefined =>
  session.selected === undefined ? undefined : findEntity(session.state, session.selected);

export const canDetach = (session: WorldSession): boolean => selectedEntity(session)?.owner.kind === "placed";

export function canAttach(session: WorldSession): boolean {
  const entity = selectedEntity(session);
  return entity?.owner.kind === "detached" && session.homes.has(entity.id);
}

function settle(
  session: WorldSession,
  result: Result<Committed, Rejection>,
  homes: WorldSession["homes"] = session.homes,
): WorldSession {
  if (!result.ok) return { ...session, rejection: describeRejection(result.error) };
  return {
    ...session,
    state: result.value.state,
    log: [...session.log, result.value.record],
    homes,
    rejection: "",
    replay: "",
  };
}

const command = (session: WorldSession, ops: readonly WorldOp[]): Result<Committed, Rejection> =>
  applyPatch(session.catalog, session.state, { baseRevision: session.state.header.revision, ops, origin: STUDIO_ORIGIN });

function detach(session: WorldSession): WorldSession {
  const entity = selectedEntity(session);
  if (entity === undefined) return { ...session, rejection: "select an entity to detach" };
  const { owner } = entity;
  if (owner.kind !== "placed") return { ...session, rejection: `entity ${entity.id} is ${owner.kind}, not placed` };
  const homes = new Map(session.homes).set(entity.id, { anchor: owner.anchor, rotation: owner.rotation });
  return settle(session, command(session, [{ op: "detach", entity: entity.id }]), homes);
}

function attach(session: WorldSession): WorldSession {
  const entity = selectedEntity(session);
  const home = entity === undefined ? undefined : session.homes.get(entity.id);
  if (entity === undefined || home === undefined) return { ...session, rejection: "no previous pose is known for the selected entity" };
  const homes = new Map(session.homes);
  homes.delete(entity.id);
  return settle(session, command(session, [{ op: "attach", entity: entity.id, anchor: home.anchor, rotation: home.rotation }]), homes);
}

const clampUnit = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

function replayLog(session: WorldSession): WorldSession {
  const replayed = replay(session.catalog, session.initial, session.log);
  if (!replayed.ok) return { ...session, replay: `diverged at ${replayed.error.revision}` };
  const hash = hashState(replayed.value);
  const live = hashState(session.state);
  return { ...session, replay: hash === live ? `match ${hash}` : `diverged at ${session.state.header.revision}` };
}

const integer = (value: number | undefined, fallback: number): number => (value !== undefined && Number.isSafeInteger(value) ? value : fallback);

function waveStart(session: WorldSession): WorldSession {
  const { wave } = session;
  if (wave.status === "solving") return session;
  const [sx, sy, sz] = WAVE_SIZES[wave.size];
  const prepared = prepareRegion(session.catalog, session.state, {
    region: { min: [wave.x, 0, wave.z], max: [wave.x + sx - 1, sy - 1, wave.z + sz - 1] },
    seed: wave.seed,
    airWeight: 8,
    ground: { y: 0, profile: "ground" },
    budget: { maxNodes: 200_000, maxBacktracks: 20_000 },
  });
  if (!prepared.ok) return { ...session, wave: { ...wave, status: "refused", detail: prepared.error.join("; "), job: undefined, preview: [] } };
  return { ...session, wave: { ...wave, status: "solving", detail: "", run: wave.run + 1, job: prepared.value, cancelRequested: false, preview: [], progress: "" } };
}

function waveDone(session: WorldSession, outcome: unknown): WorldSession {
  const { wave } = session;
  if (wave.job === undefined) return session;
  const settled = settleJob(session.catalog, session.state, wave.job, WAVE_TILES, outcome, {
    origin: { kind: "job", id: `wave-${wave.run}` },
    cancelRequested: wave.cancelRequested,
  });
  const next: WorldSession = { ...session, wave: { ...wave, status: settled.status, detail: settled.detail, job: undefined, cancelRequested: false, preview: [] } };
  if (settled.status !== "committed") return next;
  return { ...next, state: settled.committed.state, log: [...session.log, settled.committed.record], rejection: "", replay: "" };
}

/** The first district stands at a fixed origin. Each later one continues the previous district's roads to the east. */
function genesisRequest(genesis: GenesisSession): DistrictRequest {
  const previous = genesis.districts.at(-1);
  if (previous === undefined) return { preset: lastDistrict, seed: genesis.seed, at: GENESIS_ORIGIN };
  const link = continueFrom(previous.plan, previous.at, "east");
  return {
    preset: lastDistrict,
    seed: genesis.seed,
    at: link.at,
    gates: [...link.gates, ...lastDistrict.gates.filter((gate) => gate.edge !== "west")],
    depends: link.depends,
  };
}

function genesisStart(session: WorldSession): WorldSession {
  const { genesis } = session;
  if (genesis.status === "generating" || session.wave.status === "solving") return session;
  return {
    ...session,
    genesis: { ...genesis, status: "generating", detail: "", run: genesis.run + 1, job: { request: genesisRequest(genesis), base: session.state }, cancelRequested: false, preview: undefined },
  };
}

function genesisDone(session: WorldSession, outcome: unknown): WorldSession {
  const { genesis } = session;
  if (genesis.job === undefined) return session;
  const settled = settleDistrict(session.catalog, session.state, outcome, { cancelRequested: genesis.cancelRequested });
  const next: GenesisSession = { ...genesis, status: settled.status, detail: settled.detail, job: undefined, cancelRequested: false, preview: undefined };
  if (settled.status !== "committed") return { ...session, genesis: next };
  const { plan, at, metrics, diagnostics } = settled.district;
  const { state, record } = settled.committed;
  const district: GenesisDistrict = { plan, at, seed: genesis.job.request.seed, revision: state.header.revision, entities: state.entities.length - session.state.entities.length, metrics, diagnostics };
  return { ...session, state, log: [...session.log, record], rejection: "", replay: "", genesis: { ...next, districts: [...genesis.districts, district] } };
}

export function worldReducer(session: WorldSession, change: WorldCommand): WorldSession {
  switch (change.type) {
    case "selectEntity":
      return findEntity(session.state, change.entity) === undefined ? session : { ...session, selected: change.entity, rejection: "" };
    case "detach":
      return detach(session);
    case "attach":
      return attach(session);
    case "setWind":
      return { ...session, wind: clampUnit(change.strength) };
    case "applyWind":
      return settle(session, runSystem(session.catalog, session.state, windFold, { wind: [session.wind, 0, 0] }));
    case "replay":
      return replayLog(session);
    case "setOffsets":
      return { ...session, offsets: change.enabled };
    case "waveSet":
      return session.wave.status === "solving"
        ? session
        : {
            ...session,
            wave: {
              ...session.wave,
              x: integer(change.x, session.wave.x),
              z: integer(change.z, session.wave.z),
              seed: Math.max(0, integer(change.seed, session.wave.seed)),
              size: change.size ?? session.wave.size,
            },
          };
    case "waveStart":
      return session.genesis.status === "generating" ? session : waveStart(session);
    case "waveCancel":
      return session.wave.status === "solving" ? { ...session, wave: { ...session.wave, cancelRequested: true } } : session;
    case "waveProgress":
      return change.run === session.wave.run && session.wave.status === "solving"
        ? {
            ...session,
            wave: {
              ...session.wave,
              preview: change.progress.placements,
              progress: `${change.progress.decided} of ${change.progress.stats.cells} cells decided, ${change.progress.stats.nodes} decisions, ${change.progress.stats.backtracks} backtracks`,
            },
          }
        : session;
    case "waveDone":
      return change.run === session.wave.run && session.wave.status === "solving" ? waveDone(session, change.outcome) : session;
    case "genesisSet":
      return session.genesis.status === "generating"
        ? session
        : { ...session, genesis: { ...session.genesis, seed: Math.max(0, integer(change.seed, session.genesis.seed)), layers: { ...session.genesis.layers, ...change.layers } } };
    case "genesisStart":
      return genesisStart(session);
    case "genesisCancel":
      return session.genesis.status === "generating" ? { ...session, genesis: { ...session.genesis, cancelRequested: true } } : session;
    case "genesisProgress":
      return change.run === session.genesis.run && session.genesis.status === "generating" ? { ...session, genesis: { ...session.genesis, preview: change.progress } } : session;
    case "genesisDone":
      return change.run === session.genesis.run && session.genesis.status === "generating" ? genesisDone(session, change.outcome) : session;
  }
}
