import type { GeometryRecipe } from "./geometry";
import type { CreaseId, FoldonId, MaterialId, SocketId } from "./ids";
import { socketId } from "./ids";
import { add, distance, scale, v3, type Cell, type Vec3 } from "./vec";

export type Rotation = 0 | 1 | 2 | 3;
export const allRotations: readonly Rotation[] = [0, 1, 2, 3];

export type Face = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";
export const faces: readonly Face[] = ["+x", "-x", "+y", "-y", "+z", "-z"];

export const faceNormal: Readonly<Record<Face, Vec3>> = {
  "+x": v3(1, 0, 0),
  "-x": v3(-1, 0, 0),
  "+y": v3(0, 1, 0),
  "-y": v3(0, -1, 0),
  "+z": v3(0, 0, 1),
  "-z": v3(0, 0, -1),
};

export const oppositeFace: Readonly<Record<Face, Face>> = {
  "+x": "-x",
  "-x": "+x",
  "+y": "-y",
  "-y": "+y",
  "+z": "-z",
  "-z": "+z",
};

export type SocketProfile = string;
export type SocketRole = "support" | "side" | "cap";
export type Turn = 0 | 1 | 2 | 3;
export type Hand = "left" | "right";
export const hands: readonly Hand[] = ["left", "right"];

export type SocketDefinition = Readonly<{
  id: SocketId;
  cell: Cell;
  face: Face;
  position: Vec3;
  normal: Vec3;
  tangent: Vec3;
  profile: SocketProfile;
  role: SocketRole;
  tolerance: number;
  hand?: Hand;
}>;

export type ComponentSpec =
  | Readonly<{ kind: "foldable"; creases: readonly CreaseId[]; stiffness: number }>
  | Readonly<{ kind: "structural"; strength: number }>
  | Readonly<{ kind: "wind-responsive"; drag: number }>
  | Readonly<{ kind: "decayable"; resistance: number }>
  | Readonly<{ kind: "thermal"; capacity: number }>
  | Readonly<{ kind: "renderable"; material: MaterialId }>;

export type FoldonDefinition = Readonly<{
  id: FoldonId;
  version: number;
  name: string;
  footprint: readonly Cell[];
  geometry: GeometryRecipe;
  sockets: readonly SocketDefinition[];
  rotations: readonly Rotation[];
  components: readonly ComponentSpec[];
  tags: readonly string[];
  weight: number;
}>;

export type FoldonInput = Readonly<{
  id: FoldonId;
  version?: number;
  name: string;
  footprint: readonly Cell[];
  geometry: GeometryRecipe;
  sockets: readonly SocketDefinition[];
  rotations?: readonly Rotation[];
  components: readonly ComponentSpec[];
  tags?: readonly string[];
  weight?: number;
}>;

export const foldable = (spec: Readonly<{ creases: readonly CreaseId[]; stiffness: number }>): ComponentSpec => ({
  kind: "foldable",
  ...spec,
});
export const structural = (spec: Readonly<{ strength: number }>): ComponentSpec => ({ kind: "structural", ...spec });
export const windResponsive = (spec: Readonly<{ drag: number }>): ComponentSpec => ({ kind: "wind-responsive", ...spec });
export const decayable = (spec: Readonly<{ resistance: number }>): ComponentSpec => ({ kind: "decayable", ...spec });
export const thermal = (spec: Readonly<{ capacity: number }>): ComponentSpec => ({ kind: "thermal", ...spec });
export const renderable = (spec: Readonly<{ material: MaterialId }>): ComponentSpec => ({ kind: "renderable", ...spec });

export function rectangularFootprint(width: number, height: number, depth: number): readonly Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) cells.push(v3(x, y, z));
    }
  }
  return cells;
}

export const cellKey = (cell: Cell): string => `${cell[0]},${cell[1]},${cell[2]}`;

export type ExternalFace = Readonly<{ cell: Cell; face: Face }>;

export function externalFaces(footprint: readonly Cell[]): readonly ExternalFace[] {
  const occupied = new Set(footprint.map(cellKey));
  return footprint.flatMap((cell) =>
    faces
      .filter((face) => !occupied.has(cellKey(add(cell, faceNormal[face]))))
      .map((face) => ({ cell, face })),
  );
}

export const isVerticalFace = (face: Face): boolean => face === "+y" || face === "-y";

export const turnTangents: readonly [Vec3, Vec3, Vec3, Vec3] = [v3(1, 0, 0), v3(0, 0, -1), v3(-1, 0, 0), v3(0, 0, 1)];

const TURN_TOLERANCE = 1e-6;

export function turnOf(tangent: Vec3): Turn | undefined {
  const index = turnTangents.findIndex((axis) => distance(axis, tangent) <= TURN_TOLERANCE);
  switch (index) {
    case 0:
    case 1:
    case 2:
    case 3:
      return index;
    default:
      return undefined;
  }
}

export function faceTangent(face: Face, turn: Turn = 0): Vec3 {
  return isVerticalFace(face) ? turnTangents[turn] : v3(0, 1, 0);
}

function faceRole(face: Face): SocketRole {
  if (face === "-y") return "support";
  return face === "+y" ? "cap" : "side";
}

export const DEFAULT_SOCKET_TOLERANCE = 1e-6;

export function faceCentre(cell: Cell, face: Face): Vec3 {
  return add(add(cell, v3(0.5, 0.5, 0.5)), scale(faceNormal[face], 0.5));
}

export type FaceSocketSpec = SocketProfile | Readonly<{ profile: SocketProfile; turn?: Turn; hand?: Hand }>;

export type FaceProfiles = Readonly<{ default: FaceSocketSpec } & Partial<Record<Face, FaceSocketSpec>>>;

function faceSocket(cell: Cell, face: Face, spec: FaceSocketSpec): SocketDefinition {
  const { profile, turn, hand } = typeof spec === "string" ? { profile: spec, turn: undefined, hand: undefined } : spec;
  const socket: SocketDefinition = {
    id: socketId(`${cellKey(cell)}${face}`),
    cell,
    face,
    position: faceCentre(cell, face),
    normal: faceNormal[face],
    tangent: faceTangent(face, turn),
    profile,
    role: faceRole(face),
    tolerance: DEFAULT_SOCKET_TOLERANCE,
  };
  return hand === undefined || isVerticalFace(face) ? socket : { ...socket, hand };
}

export function faceSockets(footprint: readonly Cell[], profiles: FaceProfiles): readonly SocketDefinition[] {
  return externalFaces(footprint).map(({ cell, face }) => faceSocket(cell, face, profiles[face] ?? profiles.default));
}
