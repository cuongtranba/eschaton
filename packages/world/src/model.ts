import {
  assemblyId,
  composePose,
  err,
  foldonId,
  ok,
  bondEligible,
  placeFootprint,
  placeSockets,
  socketMismatches,
  type Catalog,
  type Cell,
  type FoldonDefinition,
  type FoldonId,
  type MaterialId,
  type Pose,
  type Result,
  type Rotation,
  type SocketDefinition,
  type SocketMismatch,
} from "@eschaton/foldon";
import type { Bond, DefinitionRef, Entity, EntityId, Owner } from "./state";

export type Placed = Entity & Readonly<{ owner: Extract<Owner, { kind: "placed" }> }>;

export const isPlaced = (entity: Entity): entity is Placed => entity.owner.kind === "placed";

export const cellKey = (cell: Cell): string => `${cell[0]},${cell[1]},${cell[2]}`;

export const definitionOf = (catalog: Catalog, ref: DefinitionRef): FoldonDefinition | undefined =>
  catalog.foldon(ref.id, ref.version);

const poseOf = (entity: Placed) => ({ anchor: entity.owner.anchor, rotation: entity.owner.rotation });

export function cellsOf(catalog: Catalog, entity: Placed): readonly Cell[] {
  const definition = definitionOf(catalog, entity.definition);
  return definition === undefined ? [] : placeFootprint(definition, poseOf(entity));
}

export function socketsOf(catalog: Catalog, entity: Placed): readonly SocketDefinition[] {
  const definition = definitionOf(catalog, entity.definition);
  return definition === undefined ? [] : placeSockets(definition, poseOf(entity));
}

export function occupancy(catalog: Catalog, entities: readonly Entity[]): ReadonlyMap<string, readonly EntityId[]> {
  const index = new Map<string, EntityId[]>();
  for (const entity of entities) {
    if (!isPlaced(entity)) continue;
    for (const cell of cellsOf(catalog, entity)) {
      const key = cellKey(cell);
      index.set(key, [...(index.get(key) ?? []), entity.id]);
    }
  }
  return index;
}

export type ContactEnd = Readonly<{ entity: Placed; socket: SocketDefinition }>;
export type Contact = Readonly<{ a: ContactEnd; b: ContactEnd; mismatches: readonly SocketMismatch[] }>;

const OPPOSITE: Readonly<Record<string, string>> = { "+x": "-x", "-x": "+x", "+y": "-y", "-y": "+y", "+z": "-z", "-z": "+z" };

export function contacts(catalog: Catalog, entities: readonly Entity[]): readonly Contact[] {
  const placed = entities.filter(isPlaced);
  const order = new Map(placed.map((entity, i) => [entity.id, i]));
  const sockets = new Map(placed.map((entity) => [entity.id, socketsOf(catalog, entity)]));
  const byFace = new Map<string, ContactEnd>();
  for (const entity of placed) {
    for (const socket of sockets.get(entity.id) ?? []) byFace.set(`${cellKey(socket.cell)}${socket.face}`, { entity, socket });
  }
  const found: Contact[] = [];
  for (const entity of placed) {
    const own = order.get(entity.id) ?? 0;
    for (const socket of sockets.get(entity.id) ?? []) {
      const neighbourCell: Cell = [
        socket.cell[0] + Math.round(socket.normal[0]),
        socket.cell[1] + Math.round(socket.normal[1]),
        socket.cell[2] + Math.round(socket.normal[2]),
      ];
      const facing = byFace.get(`${cellKey(neighbourCell)}${OPPOSITE[socket.face] ?? ""}`);
      if (facing === undefined || facing.entity.id === entity.id || (order.get(facing.entity.id) ?? 0) <= own) continue;
      found.push({ a: { entity, socket }, b: facing, mismatches: socketMismatches(catalog.sockets(), socket, facing.socket) });
    }
  }
  return found;
}

export function renderableMaterial(definition: FoldonDefinition): MaterialId | undefined {
  for (const component of definition.components) if (component.kind === "renderable") return component.material;
  return undefined;
}

function structuralStrength(definition: FoldonDefinition | undefined): number {
  for (const component of definition?.components ?? []) if (component.kind === "structural") return component.strength;
  return 0;
}

export function bondsFromContacts(catalog: Catalog, touching: readonly Contact[]): readonly Bond[] {
  return touching
    .filter((contact) => bondEligible(catalog.sockets(), contact.a.socket, contact.b.socket))
    .map((contact) => ({
      a: { entity: contact.a.entity.id, cell: contact.a.socket.cell, face: contact.a.socket.face },
      b: { entity: contact.b.entity.id, cell: contact.b.socket.cell, face: contact.b.socket.face },
      strength: Math.min(
        structuralStrength(definitionOf(catalog, contact.a.entity.definition)),
        structuralStrength(definitionOf(catalog, contact.b.entity.definition)),
      ),
    }));
}

export function matedBonds(catalog: Catalog, entities: readonly Entity[], only?: ReadonlySet<EntityId>): readonly Bond[] {
  const touching = contacts(catalog, entities).filter(
    (contact) => only === undefined || only.has(contact.a.entity.id) || only.has(contact.b.entity.id),
  );
  return bondsFromContacts(catalog, touching);
}

export function sortBonds(bonds: readonly Bond[], entities: readonly Entity[]): readonly Bond[] {
  const order = new Map(entities.map((entity, i) => [entity.id, i]));
  const key = (bond: Bond): readonly (number | string)[] => [
    order.get(bond.a.entity) ?? -1,
    cellKey(bond.a.cell),
    bond.a.face,
    order.get(bond.b.entity) ?? -1,
    cellKey(bond.b.cell),
    bond.b.face,
  ];
  return [...bonds].sort((x, y) => {
    const [kx, ky] = [key(x), key(y)];
    for (let i = 0; i < kx.length; i++) {
      const [p, q] = [kx[i] ?? 0, ky[i] ?? 0];
      if (p !== q) return p < q ? -1 : 1;
    }
    return 0;
  });
}

export type PlacementRef = Readonly<{ kind: "foldon" | "assembly"; id: string; version?: number }>;
export type Leaf = Readonly<{ id: FoldonId; version: number; anchor: Cell; rotation: Rotation }>;
export type ResolvedPlacement = Readonly<{ source: string; leaves: readonly Leaf[] }>;

/**
 * The one definition of "this catalog item placed at this world pose". A module contract is a claim about an
 * assembly in its own frame, proved once by createCatalog, so it turns with the assembly and is not re-checked here;
 * `catalog.satisfiesContract(..., rotation)` answers the different question of fitting a slot.
 */
export function resolvePlacement(catalog: Catalog, ref: PlacementRef, pose: Pose): Result<ResolvedPlacement, string> {
  if (ref.kind === "foldon") {
    const definition = catalog.foldon(foldonId(ref.id), ref.version);
    if (definition === undefined) return err(`foldon ${ref.id}@${ref.version ?? "latest"} is not in the catalog`);
    return ok({ source: `foldon:${definition.id}@${definition.version}`, leaves: [{ id: definition.id, version: definition.version, ...pose }] });
  }
  const assembly = catalog.assembly(assemblyId(ref.id), ref.version);
  if (assembly === undefined) return err(`assembly ${ref.id}@${ref.version ?? "latest"} is not in the catalog`);
  const { id, version } = assembly.recipe;
  return ok({
    source: `assembly:${id}@${version}`,
    leaves: catalog.flatten(id, version).map((leaf) => {
      const placed = composePose(pose, { anchor: leaf.anchor, rotation: leaf.rotation });
      return { id: leaf.definitionId, version: leaf.definitionVersion, anchor: placed.anchor, rotation: placed.rotation };
    }),
  });
}
