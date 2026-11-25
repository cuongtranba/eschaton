import type { Cell, PoseError, PosedGeometry, SocketProfile, Vec3 } from "@eschaton/foldon";
import type { LookSettings } from "./look";
import type { CameraMode, Overlays } from "./state";

export type Basis = Readonly<{ origin: Vec3; x: Vec3; y: Vec3; z: Vec3 }>;

export type Ink = Readonly<{ tone: number; unlit?: boolean }>;

export type BatchMotion = "cloud" | "dust";

export type BatchAuthority = "logical" | "fragment" | "none";

export type LeafBatch = Readonly<{
  key: string;
  poseKey: string;
  geometry: PosedGeometry;
  bases: readonly Basis[];
  inks?: readonly Ink[];
  panelInks?: readonly Ink[];
  outline?: boolean;
  motion?: BatchMotion;
  authority?: BatchAuthority;
}>;

export type SocketMarker = Readonly<{ position: Vec3; normal: Vec3; profile: SocketProfile }>;

export type Bounds = Readonly<{ min: Vec3; max: Vec3 }>;

export type ScenePoseError = Readonly<{ definitionKey: string; error: PoseError }>;

export type ViewPreset = Readonly<{ position: Vec3; target: Vec3; fov: number }>;

export type InkScale = Readonly<{
  hazeStart: number;
  hazeEnd: number;
  hatchFrequency: number;
  grainFrequency: number;
}>;

export type ViewModel = Readonly<{
  itemKey: string;
  layoutKey: string;
  layoutHash: string | undefined;
  cameraMode: CameraMode;
  overlays: Overlays;
  look: LookSettings;
  inkScale: InkScale;
  view: ViewPreset | undefined;
  motion: boolean;
  batches: readonly LeafBatch[];
  sockets: readonly SocketMarker[];
  footprint: readonly Cell[];
  bounds: Bounds;
  errors: readonly ScenePoseError[];
}>;
