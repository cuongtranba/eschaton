import { faces, socketProfiles, type Face, type Rotation, type SocketDefinition, type SocketProfile } from "./definition";
import type { ContractId } from "./ids";
import { issue, type ValidationIssue } from "./issues";
import { placeFootprint, placeSockets } from "./transform";
import type { Cell } from "./vec";

export type ModuleSpan = 2 | 4;

export type ContractRef = Readonly<{ id: ContractId; version: number }>;

export type ModuleContract = Readonly<{
  id: ContractId;
  version: number;
  name: string;
  size: Readonly<{ x: ModuleSpan; z: ModuleSpan }>;
  height?: Readonly<{ min: number; max: number }>;
  boundary: Readonly<Partial<Record<Face, readonly SocketProfile[]>>>;
}>;

type ContractTarget = Readonly<{
  bounds: Readonly<{ min: Cell; max: Cell }>;
  footprint: readonly Cell[];
  sockets: readonly SocketDefinition[];
}>;

const SPANS: readonly number[] = [2, 4];

export function contractIssues(contract: ModuleContract): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (contract.id.length === 0) issues.push(issue("id-invalid", "id", "id must not be empty"));
  if (!Number.isInteger(contract.version) || contract.version < 1) {
    issues.push(issue("version-invalid", "version", "version must be an integer >= 1"));
  }
  if (!SPANS.includes(contract.size.x) || !SPANS.includes(contract.size.z)) {
    issues.push(issue("contract-invalid", "size", "size must be 2 or 4 cells along each axis"));
  }
  const { height } = contract;
  if (height !== undefined && !(Number.isInteger(height.min) && Number.isInteger(height.max) && height.min >= 1 && height.max >= height.min)) {
    issues.push(issue("contract-invalid", "height", "height needs integers with 1 <= min <= max"));
  }
  for (const side of faces) {
    const allowed = contract.boundary[side];
    if (allowed === undefined) continue;
    if (allowed.length === 0 || !allowed.every((profile) => socketProfiles.includes(profile))) {
      issues.push(issue("contract-invalid", `boundary.${side}`, "boundary needs at least one known socket profile"));
    }
  }
  return issues;
}

function footprintIssues(contract: ModuleContract, assembly: ContractTarget, shifted: readonly Cell[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { x: sizeX, z: sizeZ } = contract.size;
  if (assembly.bounds.min[0] !== 0 || assembly.bounds.min[2] !== 0) {
    issues.push(issue("contract-footprint-mismatch", "footprint", "the footprint must start at the XZ origin"));
  }
  const columns = new Set(shifted.map((cell) => `${cell[0]},${cell[2]}`));
  const outside = [...columns].filter((key) => {
    const [x = -1, z = -1] = key.split(",").map(Number);
    return x < 0 || x >= sizeX || z < 0 || z >= sizeZ;
  });
  const missing = sizeX * sizeZ - (columns.size - outside.length);
  if (outside.length > 0 || missing > 0) {
    issues.push(
      issue(
        "contract-footprint-mismatch",
        "footprint",
        `the XZ projection must exactly fill ${sizeX}x${sizeZ}; ${missing} columns are empty and ${outside.length} lie outside`,
      ),
    );
  }
  const ys = shifted.map((cell) => cell[1]);
  const height = Math.max(...ys) - Math.min(...ys) + 1;
  if (contract.height !== undefined && (height < contract.height.min || height > contract.height.max)) {
    issues.push(
      issue("contract-footprint-mismatch", "footprint", `height ${height} is outside ${contract.height.min}..${contract.height.max}`),
    );
  }
  return issues;
}

function sidePositions(contract: ModuleContract, side: Face): readonly (readonly [number, number])[] {
  const { x: sizeX, z: sizeZ } = contract.size;
  const columns = Array.from({ length: sizeX }, (_, x) => Array.from({ length: sizeZ }, (_, z) => [x, z] as const)).flat();
  switch (side) {
    case "+x":
      return columns.filter(([x]) => x === sizeX - 1);
    case "-x":
      return columns.filter(([x]) => x === 0);
    case "+z":
      return columns.filter(([, z]) => z === sizeZ - 1);
    case "-z":
      return columns.filter(([, z]) => z === 0);
    case "+y":
    case "-y":
      return columns;
  }
}

function boundaryIssues(contract: ModuleContract, sockets: readonly SocketDefinition[]): ValidationIssue[] {
  return faces.flatMap((side) => {
    const allowed = contract.boundary[side];
    if (allowed === undefined) return [];
    return sidePositions(contract, side).flatMap(([x, z]): ValidationIssue[] => {
      const path = `boundary.${side}`;
      return sockets
        .filter((socket) => socket.face === side && socket.cell[0] === x && socket.cell[2] === z)
        .filter((socket) => !allowed.includes(socket.profile))
        .map((socket) =>
          issue(
            "contract-boundary-incompatible",
            path,
            `${socket.profile} at ${socket.cell.join(",")} is not one of ${allowed.join("|")}`,
          ),
        );
    });
  });
}

export function checkContract(contract: ModuleContract, assembly: ContractTarget, rotation: Rotation): readonly ValidationIssue[] {
  const turned = placeFootprint(assembly, { anchor: [0, 0, 0], rotation });
  const minX = Math.min(...turned.map((cell) => cell[0]));
  const minZ = Math.min(...turned.map((cell) => cell[2]));
  const shift = ([x, y, z]: Cell): Cell => [x - minX, y, z - minZ];
  const footprint = footprintIssues(contract, assembly, turned.map(shift));
  if (footprint.length > 0) return footprint;
  const sockets = placeSockets(assembly, { anchor: [0, 0, 0], rotation }).map((socket) => ({ ...socket, cell: shift(socket.cell) }));
  return boundaryIssues(contract, sockets);
}
