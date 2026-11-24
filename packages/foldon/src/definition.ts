import type { GeometryRecipe } from "./geometry";
import type { CreaseId, FoldonId, MaterialId, SocketId } from "./ids";
import { socketId } from "./ids";
import { add, distance, dot, scale, v3, type Cell, type Vec3 } from "./vec";

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

export const socketProfiles = ["empty", "ground", "deck", "base", "wall", "eave", "beam", "open"] as const;
export type SocketProfile = (typeof socketProfiles)[number];
export type SocketRole = "support" | "side" | "cap";

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

export function faceTangent(face: Face): Vec3 {
  return face === "+y" || face === "-y" ? v3(1, 0, 0) : v3(0, 1, 0);
}

function faceRole(face: Face): SocketRole {
  if (face === "-y") return "support";
  return face === "+y" ? "cap" : "side";
}

export const DEFAULT_SOCKET_TOLERANCE = 1e-6;

export function faceCentre(cell: Cell, face: Face): Vec3 {
  return add(add(cell, v3(0.5, 0.5, 0.5)), scale(faceNormal[face], 0.5));
}

export type FaceProfiles = Readonly<{ default: SocketProfile } & Partial<Record<Face, SocketProfile>>>;

export function faceSockets(footprint: readonly Cell[], profiles: FaceProfiles): readonly SocketDefinition[] {
  return externalFaces(footprint).map(({ cell, face }) => ({
    id: socketId(`${cellKey(cell)}${face}`),
    cell,
    face,
    position: faceCentre(cell, face),
    normal: faceNormal[face],
    tangent: faceTangent(face),
    profile: profiles[face] ?? profiles.default,
    role: faceRole(face),
    tolerance: DEFAULT_SOCKET_TOLERANCE,
  }));
}

const allowedProfilePairs: readonly (readonly [SocketProfile, SocketProfile])[] = [
  ["empty", "empty"],
  ["deck", "base"],
  ["ground", "base"],
  ["wall", "wall"],
  ["eave", "eave"],
  ["beam", "beam"],
  ["beam", "wall"],
];

function profilesCompatible(a: SocketProfile, b: SocketProfile): boolean {
  if (a === "open" || b === "open") return true;
  return allowedProfilePairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export function socketsCompatible(a: SocketDefinition, b: SocketDefinition): boolean {
  const tolerance = Math.max(a.tolerance, b.tolerance);
  return (
    distance(a.position, b.position) <= tolerance &&
    dot(a.normal, b.normal) <= -1 + tolerance &&
    dot(a.tangent, b.tangent) >= 1 - tolerance &&
    profilesCompatible(a.profile, b.profile)
  );
}
