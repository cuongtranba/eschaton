import type { Cell, PoseError, PosedGeometry, SocketProfile, Vec3 } from "@eschaton/foldon";
import type { CameraMode, Overlays } from "./state";

export type Basis = Readonly<{ origin: Vec3; x: Vec3; y: Vec3; z: Vec3 }>;

export type LeafBatch = Readonly<{
  key: string;
  poseKey: string;
  geometry: PosedGeometry;
  bases: readonly Basis[];
}>;

export type SocketMarker = Readonly<{ position: Vec3; normal: Vec3; profile: SocketProfile }>;

export type Bounds = Readonly<{ min: Vec3; max: Vec3 }>;

export type ScenePoseError = Readonly<{ definitionKey: string; error: PoseError }>;

export type ViewModel = Readonly<{
  itemKey: string;
  layoutKey: string;
  cameraMode: CameraMode;
  overlays: Overlays;
  batches: readonly LeafBatch[];
  sockets: readonly SocketMarker[];
  footprint: readonly Cell[];
  bounds: Bounds;
  errors: readonly ScenePoseError[];
}>;
