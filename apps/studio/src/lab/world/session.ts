import { err, ok, presetCatalog, type Catalog, type Pose, type Result } from "@eschaton/foldon";
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
import { DEFAULT_SEED } from "../state";

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
}>;

export type WorldCommand =
  | Readonly<{ type: "selectEntity"; entity: EntityId }>
  | Readonly<{ type: "detach" }>
  | Readonly<{ type: "attach" }>
  | Readonly<{ type: "setWind"; strength: number }>
  | Readonly<{ type: "applyWind" }>
  | Readonly<{ type: "replay" }>
  | Readonly<{ type: "setOffsets"; enabled: boolean }>;

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
  }
}
