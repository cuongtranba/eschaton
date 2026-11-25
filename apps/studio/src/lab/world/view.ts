import {
  placeFootprint,
  placeSockets,
  poseGeometry,
  type Cell,
  type FoldonDefinition,
  type Pose,
  type PosedGeometry,
  type Vec3,
} from "@eschaton/foldon";
import type { ContinuousTransform, Entity } from "@eschaton/world";
import { basisOf } from "../basis";
import { createRandom } from "../composition/random";
import { ridgeBatch } from "../composition/ridges";
import { cloudBatch, skyBatch } from "../composition/sky";
import { frameOf } from "../composition/view";
import { cellBounds } from "../library";
import type { LabState } from "../state";
import type { Basis, Bounds, Ink, LeafBatch, ScenePoseError, SocketMarker, ViewModel, ViewPreset } from "../viewModel";
import { deriveOffset, LOOK_DEV_ENVELOPE, offsetBasis, ZERO_ENVELOPE } from "./offsets";
import type { WorldSession } from "./session";

const scaleBasis = (basis: Basis, s: number): Basis =>
  s === 1
    ? basis
    : {
        origin: [basis.origin[0] * s, basis.origin[1] * s, basis.origin[2] * s],
        x: [basis.x[0] * s, basis.x[1] * s, basis.x[2] * s],
        y: [basis.y[0] * s, basis.y[1] * s, basis.y[2] * s],
        z: [basis.z[0] * s, basis.z[1] * s, basis.z[2] * s],
      };

export const WORLD_ITEM_KEY = "scene:world";

const BACKDROP_STREAM = { sky: 8, clouds: 9, ridges: 10 } as const;
const FRAME_MARGIN = 1;
const PLAIN: Ink = { tone: 0 };
const SELECTED: Ink = { tone: 0.3 };

type Authority = "logical" | "fragment";

type Group = { geometry: PosedGeometry; poseKey: string; authority: Authority; bases: Basis[]; inks: Ink[] };

export function transformBasis(transform: ContinuousTransform): Basis {
  const [x, y, z, w] = transform.rotation;
  const s = transform.scale;
  return {
    origin: transform.position,
    x: [s * (1 - 2 * (y * y + z * z)), s * 2 * (x * y + z * w), s * 2 * (x * z - y * w)],
    y: [s * 2 * (x * y - z * w), s * (1 - 2 * (x * x + z * z)), s * 2 * (y * z + x * w)],
    z: [s * 2 * (x * z + y * w), s * 2 * (y * z - x * w), s * (1 - 2 * (x * x + y * y))],
  };
}

function footprintPivot(definition: FoldonDefinition): Vec3 {
  const { min, max } = cellBounds(definition.footprint);
  return [(min[0] + max[0] + 1) / 2, min[1], (min[2] + max[2] + 1) / 2];
}

const foldKey = (fold: Entity["fold"]): string =>
  JSON.stringify(Object.entries(fold).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

let cachedBackdrop: Readonly<{ seed: number; view: ViewPreset; batches: readonly LeafBatch[] }> | undefined;

export function backdropBatches(seed: number, view: ViewPreset): readonly LeafBatch[] {
  if (cachedBackdrop?.seed === seed && cachedBackdrop.view === view) return cachedBackdrop.batches;
  const frame = frameOf(view);
  const rng = (stream: number) => createRandom(seed, stream);
  const batches: readonly LeafBatch[] = [
    { ...skyBatch(frame, rng(BACKDROP_STREAM.sky)), authority: "none" },
    { ...cloudBatch(frame, rng(BACKDROP_STREAM.clouds)), authority: "none" },
    { ...ridgeBatch(frame, rng(BACKDROP_STREAM.ridges)), authority: "none" },
  ];
  cachedBackdrop = { seed, view, batches };
  return batches;
}

type Drawn = Readonly<{ basis: Basis; authority: Authority; cells: readonly Cell[]; pose: Pose | undefined }>;

function drawnEntity(session: WorldSession, entity: Entity, definition: FoldonDefinition): Drawn | undefined {
  const { owner } = entity;
  switch (owner.kind) {
    case "placed": {
      const pose: Pose = { anchor: owner.anchor, rotation: owner.rotation };
      const envelope = session.offsets ? LOOK_DEV_ENVELOPE : ZERO_ENVELOPE;
      const offset = deriveOffset(session.state.header.seed, entity.id, envelope);
      return { basis: offsetBasis(basisOf(pose), offset, footprintPivot(definition)), authority: "logical", cells: placeFootprint(definition, pose), pose };
    }
    case "detached": {
      const { position } = owner.transform;
      const cell: Cell = [Math.floor(position[0]), Math.floor(position[1]), Math.floor(position[2])];
      return { basis: transformBasis(owner.transform), authority: "fragment", cells: [cell], pose: undefined };
    }
    case "inventory":
    case "consumed":
      return undefined;
  }
}

function groupFor(
  groups: Map<string, Group>,
  entity: Entity,
  definition: FoldonDefinition,
  authority: Authority,
  errors: ScenePoseError[],
): Group | undefined {
  const poseKey = foldKey(entity.fold);
  const key = `${definition.id}@${definition.version}|${authority}|${poseKey}`;
  const existing = groups.get(key);
  if (existing !== undefined) return existing;
  const posed = poseGeometry(definition.geometry, entity.fold);
  if (!posed.ok) {
    errors.push({ definitionKey: `${entity.id} (${definition.id})`, error: posed.error });
    return undefined;
  }
  const created: Group = { geometry: posed.value, poseKey, authority, bases: [], inks: [] };
  groups.set(key, created);
  return created;
}

export function worldViewModel(session: WorldSession, state: LabState): ViewModel {
  const groups = new Map<string, Group>();
  const errors: ScenePoseError[] = [];
  const footprint: Cell[] = [];
  const extentCells: Cell[] = [];
  const sockets: SocketMarker[] = [];
  for (const entity of session.state.entities) {
    const definition = session.catalog.foldon(entity.definition.id, entity.definition.version);
    if (definition === undefined) continue;
    const drawn = drawnEntity(session, entity, definition);
    if (drawn === undefined) continue;
    extentCells.push(...drawn.cells);
    if (drawn.pose !== undefined) {
      footprint.push(...drawn.cells);
      for (const socket of placeSockets(definition, drawn.pose)) sockets.push({ position: socket.position, normal: socket.normal, profile: socket.profile });
    }
    const group = groupFor(groups, entity, definition, drawn.authority, errors);
    if (group === undefined) continue;
    group.bases.push(scaleBasis(drawn.basis, session.presentation.cellSize));
    group.inks.push(entity.id === session.selected ? SELECTED : PLAIN);
  }

  const entityBatches: LeafBatch[] = [...groups].map(([key, group]) => ({
    key,
    poseKey: group.poseKey,
    geometry: group.geometry,
    bases: group.bases,
    inks: group.inks,
    authority: group.authority,
  }));
  const batches = [...entityBatches, ...backdropBatches(session.state.header.seed, session.presentation.view)];
  const cell = session.presentation.cellSize;
  const extent = cellBounds(extentCells.length === 0 ? [[0, 0, 0]] : extentCells);
  const bounds: Bounds = {
    min: [(extent.min[0] - FRAME_MARGIN) * cell, 0, (extent.min[2] - FRAME_MARGIN) * cell],
    max: [(extent.max[0] + 1 + FRAME_MARGIN) * cell, (extent.max[1] + 1) * cell, (extent.max[2] + 1 + FRAME_MARGIN) * cell],
  };
  const layoutKey = [
    WORLD_ITEM_KEY,
    `cell:${cell}`,
    `rev:${session.state.header.revision}`,
    `offsets:${session.offsets ? "look-dev" : "zero"}`,
    `selected:${session.selected ?? "none"}`,
    ...entityBatches.map((batch) => `${batch.key}x${batch.bases.length}`),
  ].join("|");

  return {
    itemKey: WORLD_ITEM_KEY,
    layoutKey,
    layoutHash: undefined,
    cameraMode: state.cameraMode,
    overlays: state.overlays,
    look: state.look,
    inkScale: session.presentation.inkScale,
    view: session.presentation.view,
    motion: !state.reducedMotion,
    batches,
    sockets,
    footprint,
    bounds,
    errors,
  };
}
