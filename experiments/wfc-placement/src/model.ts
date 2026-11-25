import type { Faces, Offset, Problem, Rotation, Socket, TileDef, TileSet, TraceEvent } from "./types.ts";
import { EMPTY_TILE } from "./types.ts";
import { at } from "./util.ts";

export const DIRS: readonly Offset[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
export const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];
export const SOCKETS: readonly Socket[] = ["open", "ground", "road", "wall", "door"];
export const SOCKET_COUNT = SOCKETS.length;

export function opposite(dir: number): number {
  return (dir + 2) % 4;
}

export function rotateOffset([x, z]: Offset, rotation: Rotation): Offset {
  switch (rotation) {
    case 0:
      return [x, z];
    case 1:
      return [-z, x];
    case 2:
      return [-x, -z];
    case 3:
      return [z, -x];
  }
}

export function rotateFaces(faces: Faces, rotation: Rotation): Faces {
  const face = (dir: number): Socket => at(faces, (dir + 4 - rotation) % 4);
  return [face(0), face(1), face(2), face(3)];
}

export type VariantCell = { readonly offset: Offset; readonly delta: Offset; readonly faces: Faces };
export type Variant = { readonly tile: TileDef; readonly rotation: Rotation; readonly cells: readonly VariantCell[] };

export function makeVariant(tile: TileDef, rotation: Rotation): Variant {
  return {
    tile,
    rotation,
    cells: tile.cells.map((cell) => ({
      offset: cell.offset,
      delta: rotateOffset(cell.offset, rotation),
      faces: rotateFaces(cell.faces, rotation),
    })),
  };
}

function signature(variant: Variant): string {
  const minX = Math.min(...variant.cells.map((c) => c.delta[0]));
  const minZ = Math.min(...variant.cells.map((c) => c.delta[1]));
  return variant.cells
    .map((c) => `${c.delta[0] - minX},${c.delta[1] - minZ},${c.offset.join(",")},${c.faces.join(",")}`)
    .sort()
    .join(";");
}

export function tileVariants(tile: TileDef): readonly Variant[] {
  const seen = new Set<string>();
  const variants: Variant[] = [];
  for (const rotation of ROTATIONS) {
    const variant = makeVariant(tile, rotation);
    const key = signature(variant);
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(variant);
  }
  return variants;
}

export function canonicalRotation(tile: TileDef, rotation: Rotation): Rotation {
  const target = signature(makeVariant(tile, rotation));
  for (const candidate of ROTATIONS) {
    if (signature(makeVariant(tile, candidate)) === target) return candidate;
  }
  return rotation;
}

export function listTiles(tileSet: TileSet): readonly TileDef[] {
  if (tileSet.emptyWeight === null) return tileSet.tiles;
  const empty: TileDef = {
    id: EMPTY_TILE,
    weight: tileSet.emptyWeight,
    cells: [{ offset: [0, 0], faces: ["open", "open", "open", "open"] }],
  };
  return [...tileSet.tiles, empty];
}

export function socketIndex(socket: Socket): number {
  return SOCKETS.indexOf(socket);
}

export function socketCompatibility(tileSet: TileSet): Uint8Array {
  const matrix = new Uint8Array(SOCKET_COUNT * SOCKET_COUNT);
  for (const [a, b] of tileSet.compatible) {
    matrix[socketIndex(a) * SOCKET_COUNT + socketIndex(b)] = 1;
    matrix[socketIndex(b) * SOCKET_COUNT + socketIndex(a)] = 1;
  }
  return matrix;
}

export function boundaryMask(tileSet: TileSet): Uint8Array {
  const mask = new Uint8Array(SOCKET_COUNT);
  for (const socket of tileSet.boundary) mask[socketIndex(socket)] = 1;
  return mask;
}

export type ResolvedPin = {
  readonly tile: TileDef;
  readonly rotation: Rotation;
  readonly anchor: Offset;
  readonly cells: readonly { readonly x: number; readonly z: number; readonly offset: Offset }[];
};

export type Prepared = {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly TileDef[];
  readonly pins: readonly ResolvedPin[];
  readonly compat: Uint8Array;
  readonly boundary: Uint8Array;
};

export function prepareProblem(problem: Problem): { readonly ok: true; readonly prepared: Prepared } | { readonly ok: false; readonly detail: string } {
  const { width, height } = problem;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return { ok: false, detail: `invalid grid size ${width}x${height}` };
  }
  const tiles = listTiles(problem.tileSet);
  const ids = new Set<string>();
  for (const tile of tiles) {
    if (ids.has(tile.id)) return { ok: false, detail: `duplicate tile id ${tile.id}` };
    ids.add(tile.id);
    if (!(tile.weight > 0) || !Number.isFinite(tile.weight)) return { ok: false, detail: `tile ${tile.id} needs a positive finite weight` };
  }
  const claimed = new Map<number, number>();
  const pins: ResolvedPin[] = [];
  for (const [index, pin] of problem.pins.entries()) {
    const tile = tiles.find((t) => t.id === pin.tile);
    if (tile === undefined) return { ok: false, detail: `pin ${index}: unknown tile ${pin.tile}` };
    const rotation = canonicalRotation(tile, pin.rotation);
    const variant = makeVariant(tile, pin.rotation);
    const cells: { x: number; z: number; offset: Offset }[] = [];
    for (const cell of variant.cells) {
      const x = pin.anchor[0] + cell.delta[0];
      const z = pin.anchor[1] + cell.delta[1];
      if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x >= width || z >= height) {
        return { ok: false, detail: `pin ${index}: ${pin.tile} straddles the grid border` };
      }
      const previous = claimed.get(z * width + x);
      if (previous !== undefined) return { ok: false, detail: `pin ${index} overlaps pin ${previous} at ${x},${z}` };
      claimed.set(z * width + x, index);
      cells.push({ x, z, offset: cell.offset });
    }
    pins.push({ tile, rotation, anchor: pin.anchor, cells });
  }
  return {
    ok: true,
    prepared: {
      width,
      height,
      tiles,
      pins,
      compat: socketCompatibility(problem.tileSet),
      boundary: boundaryMask(problem.tileSet),
    },
  };
}

export function createTrace(limit = 24): { add: (event: TraceEvent) => void; events: () => readonly TraceEvent[] } {
  const events: TraceEvent[] = [];
  return {
    add: (event) => {
      events.push(event);
      if (events.length > limit) events.shift();
    },
    events: () => [...events],
  };
}
