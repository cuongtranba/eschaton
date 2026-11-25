import {
  foldonId,
  poseGeometry,
  type Catalog,
  type Cell,
  type FoldonDefinition,
  type MaterialId,
  type Rotation,
} from "@eschaton/foldon";
import { materialTotals, transformIssue } from "./invariants";
import { worldIssue, type WorldIssue } from "./issues";
import { definitionOf, matedBonds, renderableMaterial, resolvePlacement, type Leaf, type PlacementRef } from "./model";
import {
  entityIdOf,
  groupIdOf,
  type Bond,
  type Conservation,
  type ContinuousTransform,
  type DefinitionRef,
  type Entity,
  type EntityId,
  type GroupId,
  type LineageRecord,
  type Owner,
  type Revision,
  type StoreId,
} from "./state";

export type InstanceRef = PlacementRef;
export type SplitChild = Readonly<{ definition: Readonly<{ id: string; version: number }>; quantity: number }>;

export type WorldOp =
  | Readonly<{ op: "annotate"; note: string }>
  | Readonly<{ op: "instantiate"; ref: InstanceRef; anchor: Cell; rotation: Rotation }>
  | Readonly<{ op: "detach"; entity: EntityId }>
  | Readonly<{ op: "attach"; entity: EntityId; anchor: Cell; rotation: Rotation }>
  | Readonly<{ op: "store"; entity: EntityId; store: StoreId }>
  | Readonly<{ op: "retrieve"; entity: EntityId; transform: ContinuousTransform }>
  | Readonly<{ op: "split"; entity: EntityId; children: readonly SplitChild[] }>
  | Readonly<{ op: "merge"; entities: readonly EntityId[]; into: Readonly<{ id: string; version: number }> }>
  | Readonly<{ op: "consume"; entity: EntityId }>
  | Readonly<{ op: "conserve" }>
  | Readonly<{ op: "fold"; entity: EntityId; angles: Readonly<Record<string, number>> }>;

export type Draft = {
  readonly revision: Revision;
  readonly entities: Map<EntityId, Entity>;
  readonly lineage: LineageRecord[];
  /** Entities this patch created or changed, with the value they had before the patch (undefined when created). */
  readonly touched: Map<EntityId, Entity | undefined>;
  bonds: Bond[];
  conservation: Conservation;
  nextOrdinal: number;
};

const MAX_NOTE_LENGTH = 256;
const HALF_SQRT2 = Math.SQRT1_2;

const QUARTER_TURNS: Readonly<Record<Rotation, Readonly<{ offset: Cell; rotation: ContinuousTransform["rotation"] }>>> = {
  0: { offset: [0, 0, 0], rotation: [0, 0, 0, 1] },
  1: { offset: [0, 0, 1], rotation: [0, HALF_SQRT2, 0, HALF_SQRT2] },
  2: { offset: [1, 0, 1], rotation: [0, 1, 0, 0] },
  3: { offset: [1, 0, 0], rotation: [0, HALF_SQRT2, 0, -HALF_SQRT2] },
};

export function logicalTransform(anchor: Cell, rotation: Rotation): ContinuousTransform {
  const turn = QUARTER_TURNS[rotation];
  return {
    position: [anchor[0] + turn.offset[0], anchor[1] + turn.offset[1], anchor[2] + turn.offset[2]],
    rotation: turn.rotation,
    scale: 1,
  };
}

const isCell = (cell: unknown): cell is Cell =>
  Array.isArray(cell) && cell.length === 3 && cell.every((n) => typeof n === "number" && Number.isSafeInteger(n));

const isRotation = (value: unknown): value is Rotation => value === 0 || value === 1 || value === 2 || value === 3;

function compareLeaves(a: Leaf, b: Leaf): number {
  for (let axis = 0; axis < 3; axis++) {
    const delta = (a.anchor[axis] ?? 0) - (b.anchor[axis] ?? 0);
    if (delta !== 0) return delta;
  }
  if (a.rotation !== b.rotation) return a.rotation - b.rotation;
  const [x, y] = [`${a.id}@${a.version}`, `${b.id}@${b.version}`];
  return x < y ? -1 : x > y ? 1 : 0;
}

type Resolved = Readonly<{ definition: FoldonDefinition; material: MaterialId }>;

function resolveDefinition(catalog: Catalog, ref: Readonly<{ id: string; version?: number }>): Resolved | string {
  const definition = catalog.foldon(foldonId(ref.id), ref.version);
  if (definition === undefined) return `foldon ${ref.id}@${ref.version ?? "latest"} is not in the catalog`;
  const material = renderableMaterial(definition);
  return material === undefined ? `${ref.id}@${definition.version} has no renderable material` : { definition, material };
}

const restFold = (definition: FoldonDefinition): Readonly<Record<string, number>> =>
  Object.fromEntries(definition.geometry.creases.map((crease) => [crease.id, crease.restAngle]));

function mint(draft: Draft, resolved: Resolved, quantity: number, group: GroupId | null, owner: Owner): Entity {
  const created = { revision: draft.revision, ordinal: draft.nextOrdinal };
  draft.nextOrdinal += 1;
  const ref: DefinitionRef = { id: resolved.definition.id, version: resolved.definition.version };
  const entity: Entity = { id: entityIdOf(created), created, definition: ref, material: resolved.material, quantity, group, fold: restFold(resolved.definition), owner };
  draft.entities.set(entity.id, entity);
  draft.touched.set(entity.id, undefined);
  return entity;
}

const update = (draft: Draft, entity: Entity, change: Partial<Pick<Entity, "owner" | "fold">>): void => {
  if (!draft.touched.has(entity.id)) draft.touched.set(entity.id, entity);
  draft.entities.set(entity.id, { ...entity, ...change });
};

export function settleBonds(catalog: Catalog, draft: Draft): void {
  if (draft.touched.size === 0) return;
  const moved = new Set(draft.touched.keys());
  draft.bonds = [
    ...draft.bonds.filter((bond) => !moved.has(bond.a.entity) && !moved.has(bond.b.entity)),
    ...matedBonds(catalog, [...draft.entities.values()], moved),
  ];
}

type Handler<K extends WorldOp["op"]> = (catalog: Catalog, draft: Draft, op: Extract<WorldOp, { op: K }>, index: number) => WorldIssue | undefined;

function live(draft: Draft, id: EntityId, index: number): Entity | WorldIssue {
  const entity = draft.entities.get(id);
  if (entity === undefined) return worldIssue("entity-unknown", `entity ${id} does not exist`, index);
  if (entity.owner.kind === "consumed") return worldIssue("owner-invalid", `entity ${id} is consumed and can never change owner again`, index);
  return entity;
}

const isIssue = (value: Entity | WorldIssue): value is WorldIssue => "code" in value;

const closedIssue = (draft: Draft, action: string, index: number): WorldIssue | undefined =>
  draft.conservation === "off" ? undefined : worldIssue("conservation-violated", `closed conservation forbids ${action}`, index);

const instantiate: Handler<"instantiate"> = (catalog, draft, op, index) => {
  if (!isCell(op.anchor) || !isRotation(op.rotation)) {
    return worldIssue("op-invalid", "instantiate needs an integer anchor cell and a rotation 0..3", index);
  }
  const closed = closedIssue(draft, "creating material with instantiate", index);
  if (closed !== undefined) return closed;
  const resolved = resolvePlacement(catalog, op.ref, { anchor: op.anchor, rotation: op.rotation });
  if (!resolved.ok) return worldIssue("ref-unknown", resolved.error, index);
  const group: GroupId | null = op.ref.kind === "assembly" ? groupIdOf({ revision: draft.revision, ordinal: draft.nextOrdinal }) : null;
  for (const leaf of [...resolved.value.leaves].sort(compareLeaves)) {
    const found = resolveDefinition(catalog, { id: leaf.id, version: leaf.version });
    if (typeof found === "string") return worldIssue("material-missing", found, index);
    const entity = mint(draft, found, 1, group, { kind: "placed", anchor: leaf.anchor, rotation: leaf.rotation });
    draft.lineage.push({ kind: "instantiated", at: draft.revision, entity: entity.id, source: resolved.value.source });
  }
  return undefined;
};

const detach: Handler<"detach"> = (_catalog, draft, op, index) => {
  const entity = live(draft, op.entity, index);
  if (isIssue(entity)) return entity;
  if (entity.owner.kind !== "placed") return worldIssue("owner-invalid", `entity ${op.entity} is not placed`, index);
  update(draft, entity, { owner: { kind: "detached", transform: logicalTransform(entity.owner.anchor, entity.owner.rotation) } });
  draft.lineage.push({ kind: "detached", at: draft.revision, entity: entity.id });
  return undefined;
};

const attach: Handler<"attach"> = (_catalog, draft, op, index) => {
  const entity = live(draft, op.entity, index);
  if (isIssue(entity)) return entity;
  if (entity.owner.kind === "placed") return worldIssue("owner-invalid", `entity ${op.entity} is already placed`, index);
  if (!isCell(op.anchor) || !isRotation(op.rotation)) return worldIssue("op-invalid", "attach needs an integer anchor cell and a rotation 0..3", index);
  update(draft, entity, { owner: { kind: "placed", anchor: op.anchor, rotation: op.rotation } });
  draft.lineage.push({ kind: "reattached", at: draft.revision, entity: entity.id });
  return undefined;
};

const store: Handler<"store"> = (_catalog, draft, op, index) => {
  const entity = live(draft, op.entity, index);
  if (isIssue(entity)) return entity;
  if (entity.owner.kind === "inventory") return worldIssue("owner-invalid", `entity ${op.entity} is already in a store`, index);
  if (typeof op.store !== "string" || op.store.length === 0) return worldIssue("op-invalid", "store needs a store id", index);
  update(draft, entity, { owner: { kind: "inventory", store: op.store } });
  draft.lineage.push({ kind: "stored", at: draft.revision, entity: entity.id });
  return undefined;
};

const retrieve: Handler<"retrieve"> = (_catalog, draft, op, index) => {
  const entity = live(draft, op.entity, index);
  if (isIssue(entity)) return entity;
  if (entity.owner.kind !== "inventory") return worldIssue("owner-invalid", `entity ${op.entity} is not in a store`, index);
  const problem = transformIssue(op.transform);
  if (problem !== undefined) return worldIssue("transform-invalid", problem, index);
  update(draft, entity, { owner: { kind: "detached", transform: op.transform } });
  draft.lineage.push({ kind: "retrieved", at: draft.revision, entity: entity.id });
  return undefined;
};

const looseOwner = (entity: Entity, id: EntityId, index: number): WorldIssue | undefined =>
  entity.owner.kind === "detached" || entity.owner.kind === "inventory"
    ? undefined
    : worldIssue("owner-invalid", `entity ${id} must be detached or stored to split or merge`, index);

const split: Handler<"split"> = (catalog, draft, op, index) => {
  const parent = live(draft, op.entity, index);
  if (isIssue(parent)) return parent;
  const loose = looseOwner(parent, op.entity, index);
  if (loose !== undefined) return loose;
  if (op.children.length < 2) return worldIssue("op-invalid", "split needs at least two children", index);
  const planned: { resolved: Resolved; quantity: number }[] = [];
  for (const child of op.children) {
    const found = resolveDefinition(catalog, child.definition);
    if (typeof found === "string") return worldIssue("ref-unknown", found, index);
    if (found.material !== parent.material) return worldIssue("quantity-invalid", `split child ${child.definition.id} has material ${found.material}, not ${parent.material}`, index);
    if (!Number.isSafeInteger(child.quantity) || child.quantity < 1) return worldIssue("quantity-invalid", "split child quantity must be an integer >= 1", index);
    planned.push({ resolved: found, quantity: child.quantity });
  }
  const total = planned.reduce((sum, child) => sum + child.quantity, 0);
  if (total !== parent.quantity) return worldIssue("quantity-invalid", `split children total ${total}, the parent holds ${parent.quantity}`, index);
  const children = planned.map((child) => mint(draft, child.resolved, child.quantity, null, parent.owner).id);
  update(draft, parent, { owner: { kind: "consumed", by: draft.revision, reason: "split" } });
  draft.lineage.push({ kind: "split", at: draft.revision, parent: parent.id, children });
  return undefined;
};

const merge: Handler<"merge"> = (catalog, draft, op, index) => {
  if (op.entities.length < 2 || new Set(op.entities).size !== op.entities.length) {
    return worldIssue("op-invalid", "merge needs at least two distinct entities", index);
  }
  const into = resolveDefinition(catalog, op.into);
  if (typeof into === "string") return worldIssue("ref-unknown", into, index);
  const parents: Entity[] = [];
  for (const id of op.entities) {
    const parent = live(draft, id, index);
    if (isIssue(parent)) return parent;
    const loose = looseOwner(parent, id, index);
    if (loose !== undefined) return loose;
    if (parent.material !== into.material) return worldIssue("quantity-invalid", `merge parent ${id} has material ${parent.material}, not ${into.material}`, index);
    parents.push(parent);
  }
  const [first] = parents;
  if (first === undefined) return worldIssue("op-invalid", "merge needs parents", index);
  const quantity = parents.reduce((sum, parent) => sum + parent.quantity, 0);
  const child = mint(draft, into, quantity, null, first.owner);
  for (const parent of parents) update(draft, parent, { owner: { kind: "consumed", by: draft.revision, reason: "merged" } });
  draft.lineage.push({ kind: "merged", at: draft.revision, parents: parents.map((parent) => parent.id), child: child.id });
  return undefined;
};

const consume: Handler<"consume"> = (_catalog, draft, op, index) => {
  const entity = live(draft, op.entity, index);
  if (isIssue(entity)) return entity;
  const closed = closedIssue(draft, "destroying material", index);
  if (closed !== undefined) return closed;
  update(draft, entity, { owner: { kind: "consumed", by: draft.revision, reason: "destroyed" } });
  draft.lineage.push({ kind: "consumed", at: draft.revision, entity: entity.id, reason: "destroyed" });
  return undefined;
};

const conserve: Handler<"conserve"> = (_catalog, draft, _op, index) => {
  if (draft.conservation !== "off") return worldIssue("op-invalid", "conservation is already closed", index);
  draft.conservation = { mode: "closed", baseline: materialTotals([...draft.entities.values()]) };
  return undefined;
};

const fold: Handler<"fold"> = (catalog, draft, op, index) => {
  const entity = live(draft, op.entity, index);
  if (isIssue(entity)) return entity;
  if (entity.owner.kind !== "placed") return worldIssue("owner-invalid", `entity ${op.entity} must be placed to fold`, index);
  const definition = definitionOf(catalog, entity.definition);
  if (definition === undefined) return worldIssue("ref-unknown", `entity ${op.entity} has an unknown definition`, index);
  const unknown = Object.keys(op.angles).filter((key) => !(key in entity.fold));
  if (unknown.length > 0) return worldIssue("fold-invalid", `entity ${op.entity} has no crease ${unknown.join(", ")}`, index);
  const angles = { ...entity.fold, ...op.angles };
  const posed = poseGeometry(definition.geometry, angles);
  if (!posed.ok) return worldIssue("fold-invalid", posed.error.message, index);
  update(draft, entity, { fold: angles });
  return undefined;
};

const annotate: Handler<"annotate"> = (_catalog, _draft, op, index) =>
  typeof op.note === "string" && op.note.length > 0 && op.note.length <= MAX_NOTE_LENGTH
    ? undefined
    : worldIssue("op-invalid", `annotate needs a note of 1..${MAX_NOTE_LENGTH} characters`, index);

export function applyOp(catalog: Catalog, draft: Draft, op: WorldOp, index: number): WorldIssue | undefined {
  switch (op.op) {
    case "annotate":
      return annotate(catalog, draft, op, index);
    case "instantiate":
      return instantiate(catalog, draft, op, index);
    case "detach":
      return detach(catalog, draft, op, index);
    case "attach":
      return attach(catalog, draft, op, index);
    case "store":
      return store(catalog, draft, op, index);
    case "retrieve":
      return retrieve(catalog, draft, op, index);
    case "split":
      return split(catalog, draft, op, index);
    case "merge":
      return merge(catalog, draft, op, index);
    case "consume":
      return consume(catalog, draft, op, index);
    case "conserve":
      return conserve(catalog, draft, op, index);
    case "fold":
      return fold(catalog, draft, op, index);
  }
}
