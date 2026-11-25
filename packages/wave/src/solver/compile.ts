import {
  assemblyId,
  err,
  foldonId,
  ok,
  placeFootprint,
  placeSockets,
  socketMismatches,
  turnOf,
  type Catalog,
  type Cell,
  type Face,
  type Pose,
  type Result,
  type Rotation,
  type SocketDefinition,
} from "@eschaton/foldon";

export type TileRef = Readonly<{ kind: "foldon" | "assembly"; id: string; version: number }>;
export type TileSpec = Readonly<{ ref: Readonly<{ kind: "foldon" | "assembly"; id: string; version?: number }>; weight: number }>;

export const DIRECTIONS: readonly Face[] = ["+x", "-x", "+y", "-y", "+z", "-z"];
export const OPPOSITE: readonly number[] = [1, 0, 3, 2, 5, 4];
export const STEP: readonly Cell[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export type VariantFace = Readonly<{ cell: number; direction: number; signature: number }>;

export type Variant = Readonly<{
  tile: number;
  ref: TileRef;
  rotation: Rotation;
  weight: number;
  cells: readonly Cell[];
  shift: Cell;
  faces: readonly VariantFace[];
}>;

export type CompiledTiles = Readonly<{
  fingerprint: string;
  variants: readonly Variant[];
  signatureCount: () => number;
  signatureOf: (socket: SocketDefinition) => number;
  legal: (a: number, b: number) => boolean;
  needsMate: (signature: number) => boolean;
}>;

const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];
const key = (cell: Cell): string => `${cell[0]},${cell[1]},${cell[2]}`;

type Shape = Readonly<{ ref: TileRef; footprint: readonly Cell[]; sockets: readonly SocketDefinition[]; rotations: readonly Rotation[] }>;

function shapeOf(catalog: Catalog, spec: TileSpec): Shape | string {
  const { ref } = spec;
  if (ref.kind === "foldon") {
    const found = catalog.foldon(foldonId(ref.id), ref.version);
    if (found === undefined) return `foldon ${ref.id} is not in the catalog`;
    return { ref: { kind: "foldon", id: found.id, version: found.version }, footprint: found.footprint, sockets: found.sockets, rotations: found.rotations };
  }
  const found = catalog.assembly(assemblyId(ref.id), ref.version);
  if (found === undefined) return `assembly ${ref.id} is not in the catalog`;
  return { ref: { kind: "assembly", id: found.recipe.id, version: found.recipe.version }, footprint: found.footprint, sockets: found.sockets, rotations: ROTATIONS };
}

export function compileTiles(catalog: Catalog, tiles: readonly TileSpec[]): Result<CompiledTiles, readonly string[]> {
  const table = catalog.sockets();
  const signatureIds = new Map<string, number>();
  const representatives: SocketDefinition[] = [];
  const mustMate: boolean[] = [];
  const memo = new Map<number, boolean>();

  const signatureOf = (socket: SocketDefinition): number => {
    const id = `${socket.face}|${socket.profile}|${turnOf(socket.tangent) ?? "-"}|${socket.hand ?? "-"}`;
    const known = signatureIds.get(id);
    if (known !== undefined) return known;
    const created = representatives.length;
    signatureIds.set(id, created);
    representatives.push(socket);
    mustMate.push(table.profiles.find((profile) => profile.id === socket.profile)?.needsMate === true);
    return created;
  };

  const legal = (a: number, b: number): boolean => {
    const slot = a * 65536 + b;
    const known = memo.get(slot);
    if (known !== undefined) return known;
    const [first, second] = [representatives[a], representatives[b]];
    const answer =
      first !== undefined && second !== undefined && socketMismatches(table, first, { ...second, position: first.position }).length === 0;
    memo.set(slot, answer);
    return answer;
  };

  const issues: string[] = [];
  const variants: Variant[] = [];
  const seenIds = new Set<string>();
  tiles.forEach((spec, tile) => {
    if (!Number.isSafeInteger(spec.weight) || spec.weight < 1) issues.push(`tile ${spec.ref.id}: weight must be an integer >= 1`);
    const shape = shapeOf(catalog, spec);
    if (typeof shape === "string") {
      issues.push(shape);
      return;
    }
    const identity = `${shape.ref.kind}:${shape.ref.id}@${shape.ref.version}`;
    if (seenIds.has(identity)) issues.push(`tile ${identity} is listed twice`);
    seenIds.add(identity);
    const seenShapes = new Set<string>();
    for (const rotation of shape.rotations) {
      const pose: Pose = { anchor: [0, 0, 0], rotation };
      const placed = placeFootprint(shape, pose);
      const min: Cell = [Math.min(...placed.map((c) => c[0])), Math.min(...placed.map((c) => c[1])), Math.min(...placed.map((c) => c[2]))];
      const cells = placed.map((c): Cell => [c[0] - min[0], c[1] - min[1], c[2] - min[2]]);
      const index = new Map(cells.map((cell, i) => [key(cell), i]));
      const faces = placeSockets(shape, pose)
        .map((socket): VariantFace => ({
          cell: index.get(key([socket.cell[0] - min[0], socket.cell[1] - min[1], socket.cell[2] - min[2]])) ?? -1,
          direction: DIRECTIONS.indexOf(socket.face),
          signature: signatureOf(socket),
        }))
        .filter((face) => face.cell >= 0);
      const shapeKey = `${[...index.keys()].sort().join(";")}#${faces.map((f) => `${key(cells[f.cell] ?? [0, 0, 0])}/${f.direction}/${f.signature}`).sort().join(";")}`;
      if (seenShapes.has(shapeKey)) continue;
      seenShapes.add(shapeKey);
      variants.push({ tile, ref: shape.ref, rotation, weight: spec.weight, cells, shift: min, faces });
    }
  });
  if (tiles.length === 0) issues.push("a tile set needs at least one tile");
  if (issues.length > 0) return err(issues);
  return ok(
    Object.freeze({
      fingerprint: catalog.fingerprint,
      variants: Object.freeze(variants),
      signatureCount: () => representatives.length,
      signatureOf,
      legal,
      needsMate: (signature: number) => mustMate[signature] === true,
    }),
  );
}
