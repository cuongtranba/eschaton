import {
  placeFootprint,
  placeSockets,
  socketsCompatible,
  type Catalog,
  type Cell,
  type FoldonDefinition,
  type MaterialId,
  type SocketDefinition,
} from "@eschaton/foldon";
import type { DefinitionRef, Entity, EntityId, Owner } from "./state";

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
export type Contact = Readonly<{ a: ContactEnd; b: ContactEnd; compatible: boolean }>;

const NEIGHBOUR_TOLERANCE = 1e-6;

export function contacts(catalog: Catalog, entities: readonly Entity[]): readonly Contact[] {
  const placed = entities.filter(isPlaced);
  const order = new Map(placed.map((entity, i) => [entity.id, i]));
  const byCell = new Map<string, Placed>();
  for (const entity of placed) for (const cell of cellsOf(catalog, entity)) byCell.set(cellKey(cell), entity);
  const found: Contact[] = [];
  for (const entity of placed) {
    const own = order.get(entity.id) ?? 0;
    for (const socket of socketsOf(catalog, entity)) {
      const neighbourCell: Cell = [
        socket.cell[0] + Math.round(socket.normal[0]),
        socket.cell[1] + Math.round(socket.normal[1]),
        socket.cell[2] + Math.round(socket.normal[2]),
      ];
      const neighbour = byCell.get(cellKey(neighbourCell));
      if (neighbour === undefined || (order.get(neighbour.id) ?? 0) <= own) continue;
      const facing = socketsOf(catalog, neighbour).find(
        (other) =>
          cellKey(other.cell) === cellKey(neighbourCell) &&
          Math.abs(other.position[0] - socket.position[0]) < NEIGHBOUR_TOLERANCE &&
          Math.abs(other.position[1] - socket.position[1]) < NEIGHBOUR_TOLERANCE &&
          Math.abs(other.position[2] - socket.position[2]) < NEIGHBOUR_TOLERANCE,
      );
      if (facing === undefined) continue;
      found.push({ a: { entity, socket }, b: { entity: neighbour, socket: facing }, compatible: socketsCompatible(socket, facing) });
    }
  }
  return found;
}

export function renderableMaterial(definition: FoldonDefinition): MaterialId | undefined {
  for (const component of definition.components) if (component.kind === "renderable") return component.material;
  return undefined;
}
