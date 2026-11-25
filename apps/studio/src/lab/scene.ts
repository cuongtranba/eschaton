import {
  assemblyId,
  foldProgress,
  foldonId,
  poseGeometry,
  type CreaseId,
  type FoldonDefinition,
  type FoldonId,
  type Pose,
  type PoseError,
  type PosedGeometry,
  type Result,
} from "@eschaton/foldon";
import { basisOf } from "./basis";
import { composeReferenceScene, type Composition } from "./composition/referenceScene";
import type { AssemblyLeaves, PlacedFoldon } from "./composition/district";
import { cellBounds, type Library, type ResolvedItem } from "./library";
import { scatterSpots, stressSpots } from "./scatter";
import type { LabState } from "./state";
import type { Basis, Bounds, InkScale, Ink, LeafBatch, ScenePoseError, SocketMarker, ViewModel } from "./viewModel";

const SCATTER_COUNT = 5;
const SCATTER_FRAGMENT = "P09";
const FRAME_MARGIN = 0.75;

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

type LabItem = Exclude<ResolvedItem, Readonly<{ kind: "scene" }>>;

const LAB_INK_SCALE: InkScale = { hazeStart: 40, hazeEnd: 220, hatchFrequency: 7, grainFrequency: 5 };
const SCENE_INK_SCALE: InkScale = { hazeStart: 120, hazeEnd: 620, hatchFrequency: 0.9, grainFrequency: 0.45 };
const NO_INK: Ink = { tone: 0 };

function boundsOfCells(cells: ReturnType<typeof cellBounds>): Bounds {
  return {
    min: [cells.min[0], cells.min[1], cells.min[2]],
    max: [cells.max[0] + 1, cells.max[1] + 1, cells.max[2] + 1],
  };
}

function leavesOf(library: Library, item: LabItem): readonly Leaf[] {
  if (item.kind === "primitive") {
    return [{ definition: item.definition, pose: { anchor: [0, 0, 0], rotation: 0 } }];
  }
  return library.catalog.flatten(item.definition.recipe.id, item.definition.recipe.version).flatMap((instance) => {
    const definition = library.catalog.foldon(instance.definitionId, instance.definitionVersion);
    return definition === undefined ? [] : [{ definition, pose: { anchor: instance.anchor, rotation: instance.rotation } }];
  });
}

function socketsOf(item: LabItem): readonly SocketMarker[] {
  return item.definition.sockets.map((socket) => ({ position: socket.position, normal: socket.normal, profile: socket.profile }));
}

type Group = { definition: FoldonDefinition; motion: PlacedFoldon["motion"]; bases: Basis[]; inks: Ink[] };

function poseGroups(groups: ReadonlyMap<string, Group>, state: LabState, selectedId: FoldonId | undefined) {
  const batches: LeafBatch[] = [];
  const errors: ScenePoseError[] = [];
  for (const [key, group] of groups) {
    const posed = poseDefinition(group.definition, state, selectedId);
    if (posed.ok) {
      batches.push({
        key,
        poseKey: posed.value.poseKey,
        geometry: posed.value.geometry,
        bases: group.bases,
        inks: group.inks,
        ...(group.motion === undefined ? {} : { motion: group.motion }),
      });
    } else errors.push({ definitionKey: key, error: posed.error });
  }
  return { batches, errors };
}

function addToGroup(groups: Map<string, Group>, definition: FoldonDefinition, motion: PlacedFoldon["motion"], basis: Basis, ink: Ink): void {
  const key = `${definition.id}@${definition.version}${motion === undefined ? "" : `:${motion}`}`;
  const group = groups.get(key) ?? { definition, motion, bases: [], inks: [] };
  group.bases.push(basis);
  group.inks.push(ink);
  groups.set(key, group);
}

export type ViewOptions = Readonly<{ stress: number }>;

function labViewModel(library: Library, item: LabItem, state: LabState, stress: number): ViewModel {
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

  const frame = boundsOfCells(cells);
  const extent = { minX: frame.min[0], minZ: frame.min[2], maxX: frame.max[0], maxZ: frame.max[2] };
  const stressed = library.catalog.foldons();
  for (const spot of stressSpots(state.seed, stress, cells, stressed.length)) {
    const definition = stressed[spot.index];
    if (definition === undefined) continue;
    leaves.push({ definition, pose: { anchor: spot.anchor, rotation: spot.rotation } });
    extent.minX = Math.min(extent.minX, spot.anchor[0]);
    extent.minZ = Math.min(extent.minZ, spot.anchor[2]);
    extent.maxX = Math.max(extent.maxX, spot.anchor[0] + 2);
    extent.maxZ = Math.max(extent.maxZ, spot.anchor[2] + 2);
  }

  const groups = new Map<string, Group>();
  for (const leaf of leaves) addToGroup(groups, leaf.definition, undefined, basisOf(leaf.pose), NO_INK);
  const { batches, errors } = poseGroups(groups, state, itemId);

  const itemKey = `${item.kind}:${item.kind === "primitive" ? item.definition.id : item.definition.recipe.id}`;
  const layoutKey = [
    itemKey,
    state.overlays.scatter ? `scatter:${state.seed}` : "no-scatter",
    stress > 0 ? `stress:${stress}:${state.seed}` : "no-stress",
    ...batches.map((batch) => `${batch.key}x${batch.bases.length}`),
  ].join("|");

  return {
    itemKey,
    layoutKey,
    layoutHash: undefined,
    cameraMode: state.cameraMode,
    overlays: state.overlays,
    look: state.look,
    inkScale: LAB_INK_SCALE,
    view: undefined,
    motion: false,
    batches,
    sockets: socketsOf(item),
    footprint,
    bounds: {
      min: [extent.minX - FRAME_MARGIN, frame.min[1], extent.minZ - FRAME_MARGIN],
      max: [extent.maxX + FRAME_MARGIN, frame.max[1], extent.maxZ + FRAME_MARGIN],
    },
    errors,
  };
}

function assemblyLeaves(library: Library): AssemblyLeaves {
  return (id) => {
    const definition = library.catalog.assembly(assemblyId(id));
    if (definition === undefined) return [];
    return library.catalog
      .flatten(definition.recipe.id, definition.recipe.version)
      .map((instance) => ({ definitionId: instance.definitionId, basis: basisOf({ anchor: instance.anchor, rotation: instance.rotation }) }));
  };
}

let cachedComposition: Readonly<{ library: Library; seed: number; composition: Composition }> | undefined;

function compositionFor(library: Library, seed: number): Composition {
  if (cachedComposition?.library === library && cachedComposition.seed === seed) return cachedComposition.composition;
  const composition = composeReferenceScene(seed, assemblyLeaves(library));
  cachedComposition = { library, seed, composition };
  return composition;
}

export function layoutHashOf(batches: readonly LeafBatch[]): string {
  let hash = 0x811c9dc5;
  const mix = (value: number): void => {
    hash = Math.imul(hash ^ (Math.round(value * 100) & 0xffffff), 0x01000193) >>> 0;
  };
  for (const batch of batches) {
    for (const character of batch.key) mix(character.charCodeAt(0));
    for (const basis of batch.bases) {
      for (const vector of [basis.origin, basis.x, basis.y, basis.z]) vector.forEach(mix);
    }
    batch.inks?.forEach((ink) => { mix(ink.tone); });
  }
  return hash.toString(16).padStart(8, "0");
}

function sceneViewModel(library: Library, state: LabState): ViewModel {
  const composition = compositionFor(library, state.seed);
  const groups = new Map<string, Group>();
  for (const placed of composition.foldons) {
    const definition = library.catalog.foldon(foldonId(placed.definitionId));
    if (definition !== undefined) addToGroup(groups, definition, placed.motion, placed.basis, placed.ink);
  }
  const posed = poseGroups(groups, state, undefined);
  const batches = [...posed.batches, ...composition.panels];
  const itemKey = "scene:reference-composition";
  const instances = batches.reduce((sum, batch) => sum + batch.bases.length, 0);
  return {
    itemKey,
    layoutKey: `${itemKey}|seed:${state.seed}|${instances}|${batches.length}`,
    layoutHash: layoutHashOf(batches),
    cameraMode: state.cameraMode,
    overlays: state.overlays,
    look: state.look,
    inkScale: SCENE_INK_SCALE,
    view: composition.view,
    motion: !state.reducedMotion,
    batches,
    sockets: [],
    footprint: [],
    bounds: composition.bounds,
    errors: posed.errors,
  };
}

export function buildViewModel(
  library: Library,
  item: ResolvedItem,
  state: LabState,
  options: ViewOptions = { stress: 0 },
): ViewModel {
  return item.kind === "scene" ? sceneViewModel(library, state) : labViewModel(library, item, state, options.stress);
}
