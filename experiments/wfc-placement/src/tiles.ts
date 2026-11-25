import type { Faces, Offset, Pin, Problem, Socket, TileDef, TileSet } from "./types.ts";

const all = (socket: Socket): Faces => [socket, socket, socket, socket];

const ground: TileDef = { id: "ground", weight: 3, cells: [{ offset: [0, 0], faces: all("ground") }] };

const roadStraight: TileDef = {
  id: "road-straight",
  weight: 1.5,
  cells: [{ offset: [0, 0], faces: ["road", "ground", "road", "ground"] }],
};

const roadTurn: TileDef = {
  id: "road-turn",
  weight: 1,
  cells: [{ offset: [0, 0], faces: ["road", "road", "ground", "ground"] }],
};

const roadEnd: TileDef = {
  id: "road-end",
  weight: 0.6,
  cells: [{ offset: [0, 0], faces: ["road", "ground", "ground", "ground"] }],
};

const house: TileDef = {
  id: "house",
  weight: 1.5,
  cells: [
    { offset: [0, 0], faces: all("wall") },
    { offset: [1, 0], faces: all("wall") },
    { offset: [0, 1], faces: ["wall", "door", "wall", "wall"] },
    { offset: [1, 1], faces: all("wall") },
  ],
};

const tower: TileDef = { id: "tower", weight: 0.7, cells: [{ offset: [0, 0], faces: all("wall") }] };

const courtyard: TileDef = {
  id: "courtyard",
  weight: 1,
  cells: [
    { offset: [0, 0], faces: all("wall") },
    { offset: [1, 0], faces: all("wall") },
    { offset: [2, 0], faces: all("wall") },
    { offset: [0, 1], faces: all("wall") },
  ],
};

export const demoTileSet: TileSet = {
  tiles: [ground, roadStraight, roadTurn, roadEnd, house, tower, courtyard],
  compatible: [
    ["open", "open"],
    ["open", "ground"],
    ["open", "wall"],
    ["ground", "ground"],
    ["ground", "wall"],
    ["wall", "wall"],
    ["road", "road"],
    ["road", "door"],
  ],
  boundary: ["open", "ground"],
  emptyWeight: 1,
};

export const constrainedTileSet: TileSet = {
  ...demoTileSet,
  tiles: demoTileSet.tiles.filter((tile) => tile.id !== roadEnd.id),
};

export function createConstrainedProblem(width: number, height: number): Problem {
  const anchor: Offset = [Math.floor(width / 2) - 1, Math.floor(height / 2) - 1];
  return { width, height, tileSet: constrainedTileSet, pins: [{ tile: house.id, anchor, rotation: 0 }] };
}

export function createDemoProblem(width: number, height: number, pins: readonly Pin[] = []): Problem {
  return { width, height, tileSet: demoTileSet, pins };
}
