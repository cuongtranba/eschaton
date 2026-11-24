import {
  foldProgress,
  foldonId,
  panelId,
  placeGeometry,
  poseGeometry,
  type CreaseId,
  type FoldonDefinition,
  type FoldonId,
  type Pose,
  type PoseError,
  type PosedGeometry,
  type Result,
  type Vec3,
} from "@eschaton/foldon";
import { cellBounds, type Library, type ResolvedItem } from "./library";
import { scatterSpots } from "./scatter";
import type { LabState } from "./state";
import type { Basis, Bounds, LeafBatch, ScenePoseError, SocketMarker, ViewModel } from "./viewModel";

const SCATTER_COUNT = 5;
const SCATTER_FRAGMENT = "P09";
const FRAME_MARGIN = 0.75;

const probe: PosedGeometry = {
  panels: [
    {
      id: panelId("probe"),
      vertices: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      normal: [0, 1, 0],
    },
  ],
  creases: [],
};

export function basisOf(pose: Pose): Basis {
  const placed = placeGeometry(probe, pose).panels[0]?.vertices;
  const [origin, x, y, z] = placed ?? [];
  if (origin === undefined || x === undefined || y === undefined || z === undefined) {
    return { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  }
  const axis = (end: Vec3): Vec3 => [end[0] - origin[0], end[1] - origin[1], end[2] - origin[2]];
  return { origin, x: axis(x), y: axis(y), z: axis(z) };
}

export function creaseTargets(
  definition: FoldonDefinition,
  state: LabState,
  selectedId: FoldonId | undefined,
): ReadonlyMap<CreaseId, number> {
  const base = foldProgress(definition.geometry, state.foldProgress);
  if (selectedId !== definition.id) return base;
  const targets = new Map<CreaseId, number>(base);
  for (const crease of definition.geometry.creases) {
    const override = state.creaseAngles[crease.id];
    if (override !== undefined) targets.set(crease.id, override);
  }
  return targets;
}

export function poseDefinition(
  definition: FoldonDefinition,
  state: LabState,
  selectedId: FoldonId | undefined,
): Result<LeafBatchGeometry, PoseError> {
  const targets = creaseTargets(definition, state, selectedId);
  const posed = poseGeometry(definition.geometry, targets);
  if (!posed.ok) return posed;
  return { ok: true, value: { geometry: posed.value, poseKey: JSON.stringify([...targets]) } };
}

type LeafBatchGeometry = Readonly<{ geometry: PosedGeometry; poseKey: string }>;

type Leaf = Readonly<{ definition: FoldonDefinition; pose: Pose }>;

function boundsOfCells(cells: ReturnType<typeof cellBounds>): Bounds {
  return {
    min: [cells.min[0], cells.min[1], cells.min[2]],
    max: [cells.max[0] + 1, cells.max[1] + 1, cells.max[2] + 1],
  };
}

function leavesOf(library: Library, item: ResolvedItem): readonly Leaf[] {
  if (item.kind === "primitive") {
    return [{ definition: item.definition, pose: { anchor: [0, 0, 0], rotation: 0 } }];
  }
  return library.catalog.flatten(item.definition.recipe.id, item.definition.recipe.version).flatMap((instance) => {
    const definition = library.catalog.foldon(instance.definitionId, instance.definitionVersion);
    return definition === undefined ? [] : [{ definition, pose: { anchor: instance.anchor, rotation: instance.rotation } }];
  });
}

function socketsOf(item: ResolvedItem): readonly SocketMarker[] {
  return item.definition.sockets.map((socket) => ({ position: socket.position, normal: socket.normal, profile: socket.profile }));
}

export function buildViewModel(library: Library, item: ResolvedItem, state: LabState): ViewModel {
  const itemId = item.kind === "primitive" ? item.definition.id : undefined;
  const footprint = item.definition.footprint;
  const cells = cellBounds(footprint);
  const leaves: Leaf[] = [...leavesOf(library, item)];

  if (state.overlays.scatter) {
    const fragment = library.catalog.foldon(foldonId(SCATTER_FRAGMENT));
    if (fragment !== undefined) {
      for (const spot of scatterSpots(state.seed, footprint, cells, SCATTER_COUNT)) {
        leaves.push({ definition: fragment, pose: spot });
      }
    }
  }

  const grouped = new Map<string, { definition: FoldonDefinition; bases: Basis[] }>();
  for (const leaf of leaves) {
    const key = `${leaf.definition.id}@${leaf.definition.version}`;
    const group = grouped.get(key) ?? { definition: leaf.definition, bases: [] };
    group.bases.push(basisOf(leaf.pose));
    grouped.set(key, group);
  }

  const batches: LeafBatch[] = [];
  const errors: ScenePoseError[] = [];
  for (const [key, group] of grouped) {
    const posed = poseDefinition(group.definition, state, itemId);
    if (posed.ok) batches.push({ key, poseKey: posed.value.poseKey, geometry: posed.value.geometry, bases: group.bases });
    else errors.push({ definitionKey: key, error: posed.error });
  }

  const itemKey = `${item.kind}:${item.kind === "primitive" ? item.definition.id : item.definition.recipe.id}`;
  const layoutKey = [
    itemKey,
    state.overlays.scatter ? `scatter:${state.seed}` : "no-scatter",
    ...batches.map((batch) => `${batch.key}x${batch.bases.length}`),
  ].join("|");

  const frame = boundsOfCells(cells);
  return {
    itemKey,
    layoutKey,
    cameraMode: state.cameraMode,
    overlays: state.overlays,
    batches,
    sockets: socketsOf(item),
    footprint,
    bounds: {
      min: [frame.min[0] - FRAME_MARGIN, frame.min[1], frame.min[2] - FRAME_MARGIN],
      max: [frame.max[0] + FRAME_MARGIN, frame.max[1], frame.max[2] + FRAME_MARGIN],
    },
    errors,
  };
}
