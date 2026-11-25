import { assemblyId, foldonId, type Catalog, type Cell, type Rotation, type SocketDefinition } from "@eschaton/foldon";

export type TileRef = Readonly<{ kind: "foldon" | "assembly"; id: string; version: number }>;
export type TileSpec = Readonly<{ ref: Readonly<{ kind: "foldon" | "assembly"; id: string; version?: number }>; weight: number }>;

/** The largest tile or air weight. It keeps every per-cell weight sum far below 2^32, the range of the draw. */
export const MAX_WEIGHT = 65_535;

export type Shape = Readonly<{ ref: TileRef; footprint: readonly Cell[]; sockets: readonly SocketDefinition[]; rotations: readonly Rotation[] }>;

const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

/**
 * A catalog item as the solver sees it: cells, external sockets and the quarter turns at which the world accepts
 * it. An assembly may only turn by a rotation that every one of its leaves allows after composing its own.
 */
export function shapeOf(catalog: Catalog, ref: TileSpec["ref"]): Shape | string {
  if (ref.kind === "foldon") {
    const found = catalog.foldon(foldonId(ref.id), ref.version);
    if (found === undefined) return `foldon ${ref.id} is not in the catalog`;
    return { ref: { kind: "foldon", id: found.id, version: found.version }, footprint: found.footprint, sockets: found.sockets, rotations: found.rotations };
  }
  const found = catalog.assembly(assemblyId(ref.id), ref.version);
  if (found === undefined) return `assembly ${ref.id} is not in the catalog`;
  const leaves = catalog.flatten(found.recipe.id, found.recipe.version);
  const rotations = ROTATIONS.filter((turn) =>
    leaves.every((leaf) => catalog.foldon(leaf.definitionId, leaf.definitionVersion)?.rotations.some((allowed) => allowed === (leaf.rotation + turn) % 4) === true),
  );
  return { ref: { kind: "assembly", id: found.recipe.id, version: found.recipe.version }, footprint: found.footprint, sockets: found.sockets, rotations };
}
