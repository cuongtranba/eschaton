import { defaultLook, mergeLook, type LookSettings } from "./look";

export const overlayNames = ["grid", "footprint", "sockets", "creases", "edges", "scatter"] as const;
export type OverlayName = (typeof overlayNames)[number];
export type Overlays = Readonly<Record<OverlayName, boolean>>;

export type CameraMode = "orbit" | "composition";

export type SelectedItem = Readonly<{ kind: "primitive" | "assembly" | "scene"; id: string }>;

export type LabState = Readonly<{
  selected: SelectedItem;
  foldProgress: number;
  creaseAngles: Readonly<Record<string, number>>;
  overlays: Overlays;
  look: LookSettings;
  cameraMode: CameraMode;
  seed: number;
  reducedMotion: boolean;
  playing: boolean;
  playDirection: 1 | -1;
}>;

export type LabCommand =
  | Readonly<{ type: "selectItem"; item: SelectedItem }>
  | Readonly<{ type: "setFoldProgress"; progress: number }>
  | Readonly<{ type: "setCreaseAngle"; creaseId: string; angle: number }>
  | Readonly<{ type: "toggleOverlay"; overlay: OverlayName }>
  | Readonly<{ type: "setLook"; patch: Partial<LookSettings> }>
  | Readonly<{ type: "setCameraMode"; mode: CameraMode }>
  | Readonly<{ type: "setSeed"; seed: number }>
  | Readonly<{ type: "rerollSeed" }>
  | Readonly<{ type: "setReducedMotion"; enabled: boolean }>
  | Readonly<{ type: "togglePlay" }>
  | Readonly<{ type: "tick"; elapsedMs: number }>;

export const PLAY_DURATION_MS = 3500;
export const DEFAULT_SEED = 20_261_124;

export function initialLabState(reducedMotion: boolean): LabState {
  return {
    selected: { kind: "assembly", id: "roof-house" },
    foldProgress: 1,
    creaseAngles: {},
    overlays: { grid: true, footprint: false, sockets: false, creases: false, edges: true, scatter: true },
    look: defaultLook,
    cameraMode: "orbit",
    seed: DEFAULT_SEED,
    reducedMotion,
    playing: false,
    playDirection: 1,
  };
}

const clampUnit = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function normalizeSeed(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) >>> 0 : DEFAULT_SEED;
}

export function nextSeed(seed: number): number {
  let z = (seed + 0x9e3779b9) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

function togglePlay(state: LabState): LabState {
  if (state.playing) return { ...state, playing: false };
  if (state.reducedMotion) {
    return { ...state, creaseAngles: {}, foldProgress: state.foldProgress < 1 ? 1 : 0 };
  }
  return { ...state, creaseAngles: {}, playing: true, playDirection: state.foldProgress >= 1 ? -1 : 1 };
}

function tick(state: LabState, elapsedMs: number): LabState {
  if (!state.playing) return state;
  const progress = state.foldProgress + (state.playDirection * Math.max(0, elapsedMs)) / PLAY_DURATION_MS;
  if (state.playDirection === 1 && progress >= 1) return { ...state, foldProgress: 1, playDirection: -1 };
  if (state.playDirection === -1 && progress <= 0) return { ...state, foldProgress: 0, playing: false };
  return { ...state, foldProgress: progress };
}

function selectItem(state: LabState, item: SelectedItem): LabState {
  const entering = item.kind === "scene" && state.selected.kind !== "scene";
  const overlays = entering ? { ...state.overlays, grid: false } : state.overlays;
  return { ...state, selected: item, overlays, creaseAngles: {}, playing: false };
}

export function labReducer(state: LabState, command: LabCommand): LabState {
  switch (command.type) {
    case "selectItem":
      return selectItem(state, command.item);
    case "setFoldProgress":
      return { ...state, foldProgress: clampUnit(command.progress), creaseAngles: {}, playing: false };
    case "setCreaseAngle":
      return { ...state, creaseAngles: { ...state.creaseAngles, [command.creaseId]: command.angle }, playing: false };
    case "toggleOverlay":
      return { ...state, overlays: { ...state.overlays, [command.overlay]: !state.overlays[command.overlay] } };
    case "setLook":
      return { ...state, look: mergeLook(state.look, command.patch) };
    case "setCameraMode":
      return { ...state, cameraMode: command.mode };
    case "setSeed":
      return { ...state, seed: normalizeSeed(command.seed) };
    case "rerollSeed":
      return { ...state, seed: nextSeed(state.seed) };
    case "setReducedMotion":
      return { ...state, reducedMotion: command.enabled, playing: command.enabled ? false : state.playing };
    case "togglePlay":
      return togglePlay(state);
    case "tick":
      return tick(state, command.elapsedMs);
  }
}
