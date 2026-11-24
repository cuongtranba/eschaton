import type { Face, FoldonDefinition, Rotation, SocketDefinition } from "./definition";
import type { PlacementId, FoldonId } from "./ids";
import type { PosedGeometry } from "./geometry";
import { add, v3, type Cell, type Vec3 } from "./vec";

export type Placement = Readonly<{
  id: PlacementId;
  definitionId: FoldonId;
  definitionVersion: number;
  anchor: Cell;
  rotation: Rotation;
}>;

const rotatedFace: Readonly<Record<Rotation, Readonly<Record<Face, Face>>>> = {
  0: { "+x": "+x", "-x": "-x", "+y": "+y", "-y": "-y", "+z": "+z", "-z": "-z" },
  1: { "+x": "-z", "-z": "-x", "-x": "+z", "+z": "+x", "+y": "+y", "-y": "-y" },
  2: { "+x": "-x", "-x": "+x", "+z": "-z", "-z": "+z", "+y": "+y", "-y": "-y" },
  3: { "+x": "+z", "+z": "-x", "-x": "-z", "-z": "+x", "+y": "+y", "-y": "-y" },
};

function rotatePoint(p: Vec3, rotation: Rotation): Vec3 {
  switch (rotation) {
    case 0:
      return v3(p[0], p[1], p[2]);
    case 1:
      return v3(p[2], p[1], 1 - p[0]);
    case 2:
      return v3(1 - p[0], p[1], 1 - p[2]);
    case 3:
      return v3(1 - p[2], p[1], p[0]);
  }
}

function rotateDirection(d: Vec3, rotation: Rotation): Vec3 {
  switch (rotation) {
    case 0:
      return v3(d[0], d[1], d[2]);
    case 1:
      return v3(d[2], d[1], -d[0]);
    case 2:
      return v3(-d[0], d[1], -d[2]);
    case 3:
      return v3(-d[2], d[1], d[0]);
  }
}

const transformPoint = (p: Vec3, placement: Placement): Vec3 =>
  add(rotatePoint(p, placement.rotation), placement.anchor);

const transformDirection = (d: Vec3, placement: Placement): Vec3 => rotateDirection(d, placement.rotation);

function transformCell(cell: Cell, placement: Placement): Cell {
  const centre = transformPoint(add(cell, v3(0.5, 0.5, 0.5)), placement);
  return v3(Math.round(centre[0] - 0.5), Math.round(centre[1] - 0.5), Math.round(centre[2] - 0.5));
}

export function placeFootprint(definition: FoldonDefinition, placement: Placement): readonly Cell[] {
  return definition.footprint.map((cell) => transformCell(cell, placement));
}

export function placeSockets(definition: FoldonDefinition, placement: Placement): readonly SocketDefinition[] {
  return definition.sockets.map((socket) => ({
    ...socket,
    cell: transformCell(socket.cell, placement),
    face: rotatedFace[placement.rotation][socket.face],
    position: transformPoint(socket.position, placement),
    normal: transformDirection(socket.normal, placement),
    tangent: transformDirection(socket.tangent, placement),
  }));
}

export function placeGeometry(posed: PosedGeometry, placement: Placement): PosedGeometry {
  return {
    panels: posed.panels.map((panel) => ({
      id: panel.id,
      vertices: panel.vertices.map((v) => transformPoint(v, placement)),
      normal: transformDirection(panel.normal, placement),
    })),
    creases: posed.creases.map((crease) => ({
      id: crease.id,
      start: transformPoint(crease.start, placement),
      end: transformPoint(crease.end, placement),
      angle: crease.angle,
    })),
  };
}
