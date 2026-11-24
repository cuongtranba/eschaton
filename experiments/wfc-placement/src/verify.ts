import { canonicalRotation, DIRS, listTiles, makeVariant, opposite, ROTATIONS, SOCKET_COUNT, socketCompatibility, socketIndex } from "./model.ts";
import type { Grid, Offset, Problem, Rotation, Socket, TileDef, Verification, Violation } from "./types.ts";
import { at } from "./util.ts";

type Derived = {
  readonly tile: TileDef;
  readonly rotation: Rotation;
  readonly key: string;
  readonly footprint: readonly { readonly x: number; readonly z: number; readonly offset: Offset }[];
};

export function hashGrid(grid: Grid): string {
  let hash = 0x811c9dc5;
  const text = `${grid.width}x${grid.height};${grid.cells.map((c) => `${c.tile}.${c.rotation}.${c.offset.join(",")}`).join("|")}`;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function verifySolution(problem: Problem, grid: Grid): Verification {
  const violations: Violation[] = [];
  const { width, height } = problem;
  const add = (kind: Violation["kind"], cell: Offset | null, detail: string): void => {
    violations.push({ kind, cell, detail });
  };
  if (grid.width !== width || grid.height !== height || grid.cells.length !== width * height) {
    add("coverage", null, `grid has ${grid.cells.length} cells for a ${width}x${height} problem`);
    return { ok: false, violations };
  }
  const tiles = listTiles(problem.tileSet);
  const compat = socketCompatibility(problem.tileSet);
  const boundary = new Set(problem.tileSet.boundary);
  const placements = new Map<string, Derived>();
  const owner: (string | null)[] = [];

  for (const [index, state] of grid.cells.entries()) {
    const x = index % width;
    const z = Math.floor(index / width);
    const tile = tiles.find((t) => t.id === state.tile);
    const local = tile?.cells.findIndex((c) => c.offset[0] === state.offset[0] && c.offset[1] === state.offset[1]) ?? -1;
    if (tile === undefined || local === -1 || !ROTATIONS.includes(state.rotation)) {
      add(tile === undefined ? "unknown-tile" : "coverage", [x, z], `cell holds ${state.tile} r${state.rotation} o${state.offset.join(",")}`);
      owner.push(null);
      continue;
    }
    const variant = makeVariant(tile, state.rotation);
    const delta = at(variant.cells, local).delta;
    const anchor: Offset = [x - delta[0], z - delta[1]];
    const key = `${tile.id}|${canonicalRotation(tile, state.rotation)}|${anchor.join(",")}`;
    owner.push(key);
    if (!placements.has(key)) {
      placements.set(key, {
        tile,
        rotation: state.rotation,
        key,
        footprint: variant.cells.map((c) => ({ x: anchor[0] + c.delta[0], z: anchor[1] + c.delta[1], offset: c.offset })),
      });
    }
  }
  if (violations.length > 0) return { ok: false, violations };

  const claims = new Map<number, string[]>();
  for (const placement of placements.values()) {
    for (const cell of placement.footprint) {
      if (cell.x < 0 || cell.z < 0 || cell.x >= width || cell.z >= height) {
        add("straddle", [cell.x, cell.z], `${placement.key} extends outside the grid`);
        continue;
      }
      const index = cell.z * width + cell.x;
      claims.set(index, [...(claims.get(index) ?? []), placement.key]);
      const held = at(grid.cells, index);
      if (held.tile !== placement.tile.id || canonicalRotation(placement.tile, held.rotation) !== canonicalRotation(placement.tile, placement.rotation) || held.offset[0] !== cell.offset[0] || held.offset[1] !== cell.offset[1]) {
        add("incomplete", [cell.x, cell.z], `${placement.key} needs offset ${cell.offset.join(",")} here`);
      }
    }
  }
  for (const [index, keys] of claims) {
    if (keys.length > 1) add("overlap", [index % width, Math.floor(index / width)], `claimed by ${keys.join(" and ")}`);
  }
  if (violations.length > 0) return { ok: false, violations };

  const socketAt = (index: number, dir: number): Socket => {
    const state = at(grid.cells, index);
    const tile = tiles.find((t) => t.id === state.tile);
    if (tile === undefined) return "open";
    const local = tile.cells.findIndex((c) => c.offset[0] === state.offset[0] && c.offset[1] === state.offset[1]);
    return at(at(makeVariant(tile, state.rotation).cells, local).faces, dir);
  };
  for (let index = 0; index < grid.cells.length; index++) {
    const x = index % width;
    const z = Math.floor(index / width);
    if (at(grid.cells, index).tile === "empty" && problem.tileSet.emptyWeight === null) add("empty-disallowed", [x, z], "empty cell where empty is not allowed");
    for (let dir = 0; dir < 4; dir++) {
      const nx = x + at(DIRS, dir)[0];
      const nz = z + at(DIRS, dir)[1];
      const socket = socketAt(index, dir);
      if (nx < 0 || nz < 0 || nx >= width || nz >= height) {
        if (!boundary.has(socket)) add("border", [x, z], `border face ${dir} is ${socket}`);
        continue;
      }
      if (dir > 1) continue;
      const neighbour = nz * width + nx;
      if (at(owner, index) === at(owner, neighbour)) continue;
      const other = socketAt(neighbour, opposite(dir));
      if (at(compat, socketIndex(socket) * SOCKET_COUNT + socketIndex(other)) !== 1) {
        add("incompatible", [x, z], `${socket} meets ${other} across face ${dir}`);
      }
    }
  }

  for (const [index, pin] of problem.pins.entries()) {
    const tile = tiles.find((t) => t.id === pin.tile);
    if (tile === undefined) {
      add("pin", null, `pin ${index} names unknown tile ${pin.tile}`);
      continue;
    }
    for (const cell of makeVariant(tile, pin.rotation).cells) {
      const x = pin.anchor[0] + cell.delta[0];
      const z = pin.anchor[1] + cell.delta[1];
      const held = x >= 0 && z >= 0 && x < width && z < height ? at(grid.cells, z * width + x) : undefined;
      const honoured =
        held?.tile === tile.id &&
        canonicalRotation(tile, held.rotation) === canonicalRotation(tile, pin.rotation) &&
        held.offset[0] === cell.offset[0] &&
        held.offset[1] === cell.offset[1];
      if (!honoured) add("pin", [x, z], `pin ${index} (${pin.tile}) is not honoured`);
    }
  }
  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}
