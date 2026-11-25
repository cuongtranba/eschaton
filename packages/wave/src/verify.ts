import { placeFootprint, placeSockets, socketId, socketMismatches, type Catalog, type Cell, type Face, type SocketDefinition } from "@eschaton/foldon";
import { shapeOf, type TileSpec } from "./solver/shape";
import type { WavePlacement, WaveProblem } from "./solver/solve";

const OPPOSITE: Readonly<Record<Face, Face>> = { "+x": "-x", "-x": "+x", "+y": "-y", "-y": "+y", "+z": "-z", "-z": "+z" };
const STEP: Readonly<Record<Face, Cell>> = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] };
const FACES: readonly Face[] = ["+x", "-x", "+y", "-y", "+z", "-z"];

const key = (cell: Cell): string => `${cell[0]},${cell[1]},${cell[2]}`;
const isCell = (value: unknown): value is Cell => Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isSafeInteger(n));

/**
 * Checks a set of placements against a problem from the rules alone (ADR 0015), sharing nothing with the solver's
 * tables: tiles and rotations allowed, cells inside the region, free and not overlapping, every external face legal
 * against its neighbour, the frozen boundary, the ground or air, and no air beside a frozen face that needs a mate.
 * An empty result means the placements are a valid solution. Nothing is assumed about where they came from.
 */
export function verifyPlacements(catalog: Catalog, tiles: readonly TileSpec[], problem: WaveProblem, placements: readonly WavePlacement[]): readonly string[] {
  const table = catalog.sockets();
  const [nx, ny, nz] = problem.size;
  const inside = (cell: Cell): boolean => cell[0] >= 0 && cell[1] >= 0 && cell[2] >= 0 && cell[0] < nx && cell[1] < ny && cell[2] < nz;
  const needsMate = (profile: string): boolean => table.profiles.find((spec) => spec.id === profile)?.needsMate === true;
  const blocked = new Set((problem.blocked ?? []).map(key));
  const boundary = new Map((problem.boundary ?? []).map((entry) => [`${key(entry.cell)}|${entry.face}`, entry.socket]));
  const issues: string[] = [];
  const owner = new Map<string, number>();
  const faces = new Map<string, SocketDefinition>();

  placements.forEach((placement, index) => {
    const label = `placement ${index}`;
    if (typeof placement !== "object" || !isCell(placement.anchor) || ![0, 1, 2, 3].includes(placement.rotation)) {
      issues.push(`${label} is malformed`);
      return;
    }
    const allowed = tiles.some((tile) => tile.ref.kind === placement.ref.kind && tile.ref.id === placement.ref.id && (tile.ref.version ?? placement.ref.version) === placement.ref.version);
    const shape = shapeOf(catalog, placement.ref);
    if (!allowed || typeof shape === "string") {
      issues.push(`${label} uses a tile that is not in the tile set`);
      return;
    }
    if (!shape.rotations.includes(placement.rotation)) issues.push(`${label} uses a rotation its tile does not allow`);
    for (const cell of placeFootprint(shape, placement)) {
      if (!inside(cell)) issues.push(`${label} leaves the region at ${key(cell)}`);
      else if (blocked.has(key(cell))) issues.push(`${label} covers the blocked cell ${key(cell)}`);
      else if (owner.has(key(cell))) issues.push(`${label} overlaps placement ${owner.get(key(cell)) ?? -1} at ${key(cell)}`);
      else owner.set(key(cell), index);
    }
    for (const socket of placeSockets(shape, placement)) faces.set(`${key(socket.cell)}|${socket.face}`, socket);
  });
  if (issues.length > 0) return issues;

  const mates = (socket: SocketDefinition, other: SocketDefinition): boolean => socketMismatches(table, socket, { ...other, position: socket.position }).length === 0;
  for (const [slot, socket] of faces) {
    const step = STEP[socket.face];
    const beyond: Cell = [socket.cell[0] + step[0], socket.cell[1] + step[1], socket.cell[2] + step[2]];
    const facing = faces.get(`${key(beyond)}|${OPPOSITE[socket.face]}`);
    const frozen = boundary.get(slot);
    if (inside(beyond) && !blocked.has(key(beyond))) {
      if (facing !== undefined ? !mates(socket, facing) : needsMate(socket.profile)) issues.push(`face ${slot} (${socket.profile}) is not legal against its neighbour`);
    } else if (frozen !== undefined) {
      if (!mates(socket, frozen)) issues.push(`face ${slot} (${socket.profile}) does not mate with the frozen ${frozen.profile}`);
    } else if (socket.face === "-y" && !inside(beyond) && problem.ground !== undefined) {
      const ground: SocketDefinition = { id: socketId("ground"), cell: beyond, face: "+y", position: socket.position, normal: [0, 1, 0], tangent: [1, 0, 0], profile: problem.ground.profile, role: "cap", tolerance: 1e-6 };
      if (!mates(socket, ground)) issues.push(`face ${slot} (${socket.profile}) cannot stand on the ground`);
    } else if (needsMate(socket.profile)) {
      issues.push(`face ${slot} (${socket.profile}) needs a mate and faces nothing`);
    }
  }
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      for (let z = 0; z < nz; z++) {
        const cell: Cell = [x, y, z];
        if (owner.has(key(cell)) || blocked.has(key(cell))) continue;
        for (const face of FACES) {
          const frozen = boundary.get(`${key(cell)}|${face}`);
          if (frozen !== undefined && needsMate(frozen.profile)) issues.push(`air at ${key(cell)} leaves the frozen ${frozen.profile} on its ${face} side without a mate`);
        }
      }
    }
  }
  return issues;
}
