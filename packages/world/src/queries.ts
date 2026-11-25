import type { Catalog, Cell } from "@eschaton/foldon";
import { cellKey, occupancy } from "./model";
import type { Entity, EntityId, WorldState } from "./state";

export const findEntity = (state: WorldState, id: EntityId): Entity | undefined => state.entities.find((entity) => entity.id === id);

export const cellOccupant = (catalog: Catalog, state: WorldState, cell: Cell): EntityId | undefined =>
  occupancy(catalog, state.entities).get(cellKey(cell))?.[0];
