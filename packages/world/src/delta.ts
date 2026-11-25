import { bondEligible, socketMismatches, type Catalog, type Cell, type SocketDefinition } from "@eschaton/foldon";
import { before, entityIssuesOf } from "./invariants";
import type { WorldIssue } from "./issues";
import { bondComparator, cellKey, cellsOf, definitionOf, isPlaced, socketsOf, structuralStrength, type Placed } from "./model";
import type { Draft } from "./ops";
import type { Bond, EntityId, WorldState } from "./state";

/**
 * Derived data for states this package has validated: which placed entity covers each cell. It is a cache, never
 * truth: it can always be rebuilt from the entities, and a state without it is simply validated in full.
 */
type CellIndex = ReadonlyMap<string, EntityId>;
const validated = new WeakMap<WorldState, CellIndex>();

export const indexOf = (state: WorldState): CellIndex | undefined => validated.get(state);

export function remember(state: WorldState, index: CellIndex): void {
  validated.set(state, index);
}

/** Marks a state that has just passed the full audit as validated, building its cell index from scratch. */
export function trust(catalog: Catalog, state: WorldState): void {
  const index = new Map<string, EntityId>();
  for (const entity of state.entities) {
    if (isPlaced(entity)) for (const cell of cellsOf(catalog, entity)) index.set(cellKey(cell), entity.id);
  }
  validated.set(state, index);
}

const OPPOSITE: Readonly<Record<string, string>> = { "+x": "-x", "-x": "+x", "+y": "-y", "-y": "+y", "+z": "-z", "-z": "+z" };

export type Settled = Readonly<{ bonds: readonly Bond[]; index: CellIndex }>;

/**
 * Validates only what a patch touched, against a base state that is already known to be valid, and derives the
 * bonds of the touched entities. Returns undefined as soon as anything looks wrong; the caller then runs the full
 * audit, which decides and words the rejection. So this path can accept, and never rejects by itself.
 */
export function settleTouched(catalog: Catalog, base: WorldState, baseIndex: CellIndex, draft: Draft): Settled | undefined {
  const index = new Map(baseIndex);
  for (const [id, previous] of draft.touched) {
    if (previous === undefined || !isPlaced(previous)) continue;
    for (const cell of cellsOf(catalog, previous)) if (index.get(cellKey(cell)) === id) index.delete(cellKey(cell));
  }
  const issues: WorldIssue[] = [];
  const validPoses = new Map<string, boolean>();
  const placed: Placed[] = [];
  for (const id of draft.touched.keys()) {
    const entity = draft.entities.get(id);
    if (entity === undefined) return undefined;
    entityIssuesOf(catalog, draft.revision, entity, validPoses, issues);
    if (issues.length > 0) return undefined;
    if (!isPlaced(entity)) continue;
    for (const cell of cellsOf(catalog, entity)) {
      const key = cellKey(cell);
      if (index.has(key)) return undefined;
      index.set(key, id);
    }
    placed.push(entity);
  }

  const table = catalog.sockets();
  const sockets = new Map<EntityId, readonly SocketDefinition[]>();
  const socketsFor = (entity: Placed): readonly SocketDefinition[] => {
    let known = sockets.get(entity.id);
    if (known === undefined) {
      known = socketsOf(catalog, entity);
      sockets.set(entity.id, known);
    }
    return known;
  };
  const seen = new Set<string>();
  const fresh: Bond[] = [];
  for (const entity of placed) {
    for (const socket of socketsFor(entity)) {
      const beyond: Cell = [socket.cell[0] + Math.round(socket.normal[0]), socket.cell[1] + Math.round(socket.normal[1]), socket.cell[2] + Math.round(socket.normal[2])];
      const beyondKey = cellKey(beyond);
      const otherId = index.get(beyondKey);
      if (otherId === undefined || otherId === entity.id) continue;
      const other = draft.entities.get(otherId);
      if (other === undefined || !isPlaced(other)) return undefined;
      const facing = socketsFor(other).find((candidate) => candidate.face === OPPOSITE[socket.face] && cellKey(candidate.cell) === beyondKey);
      if (facing === undefined) continue;
      const first = before(entity.created, other.created);
      const [a, aSocket, b, bSocket] = first ? [entity, socket, other, facing] : [other, facing, entity, socket];
      const pair = `${a.id}|${cellKey(aSocket.cell)}|${aSocket.face}`;
      if (seen.has(pair)) continue;
      seen.add(pair);
      if (socketMismatches(table, aSocket, bSocket).length > 0) return undefined;
      if (!bondEligible(table, aSocket, bSocket)) continue;
      fresh.push({
        a: { entity: a.id, cell: aSocket.cell, face: aSocket.face },
        b: { entity: b.id, cell: bSocket.cell, face: bSocket.face },
        strength: Math.min(structuralStrength(definitionOf(catalog, a.definition)), structuralStrength(definitionOf(catalog, b.definition))),
      });
    }
  }

  const kept = base.bonds.filter((bond) => !draft.touched.has(bond.a.entity) && !draft.touched.has(bond.b.entity));
  if (fresh.length === 0) return { bonds: kept, index };
  const compare = bondComparator([...draft.entities.values()]);
  fresh.sort(compare);
  const merged: Bond[] = [];
  let next = 0;
  for (const bond of kept) {
    for (let candidate = fresh[next]; candidate !== undefined && compare(candidate, bond) < 0; candidate = fresh[next]) {
      merged.push(candidate);
      next += 1;
    }
    merged.push(bond);
  }
  for (; next < fresh.length; next++) {
    const candidate = fresh[next];
    if (candidate !== undefined) merged.push(candidate);
  }
  return { bonds: merged, index };
}
