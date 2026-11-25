import { assemblyId, composePose, err, foldonId, ok, type Catalog, type Cell, type FoldonId, type Result, type Rotation } from "@eschaton/foldon";
import { deepFreeze } from "./canonical";
import { checkInvariants } from "./invariants";
import { worldIssue, type WorldIssue } from "./issues";
import { definitionOf, renderableMaterial } from "./model";
import {
  entityIdOf,
  groupIdOf,
  type Bond,
  type Conservation,
  type Entity,
  type EntityId,
  type GroupId,
  type LineageRecord,
  type Revision,
  type WorldState,
} from "./state";
import { hashState, versionIssues } from "./world";

export type InstanceRef = Readonly<{ kind: "foldon" | "assembly"; id: string; version?: number }>;

export type WorldOp =
  | Readonly<{ op: "annotate"; note: string }>
  | Readonly<{ op: "instantiate"; ref: InstanceRef; anchor: Cell; rotation: Rotation }>;

export type Origin = Readonly<{ kind: "command" | "job" | "system"; id: string }>;

export type Patch = Readonly<{ baseRevision: Revision; ops: readonly WorldOp[]; origin: Origin }>;

export type Rejection =
  | Readonly<{ kind: "stale"; base: Revision; current: Revision }>
  | Readonly<{ kind: "invalid"; issues: readonly WorldIssue[] }>;

export type CommitRecord = Readonly<{
  revision: Revision;
  tick: number;
  origin: Origin;
  patch: Patch;
  stateHash: string;
}>;

export type Committed = Readonly<{ state: WorldState; record: CommitRecord }>;

type Draft = {
  readonly revision: Revision;
  readonly entities: Map<EntityId, Entity>;
  readonly lineage: LineageRecord[];
  readonly bonds: Bond[];
  conservation: Conservation;
  nextOrdinal: number;
};

const MAX_NOTE_LENGTH = 256;

const isCell = (cell: unknown): cell is Cell =>
  Array.isArray(cell) && cell.length === 3 && cell.every((n) => typeof n === "number" && Number.isSafeInteger(n));

const isRotation = (value: unknown): value is Rotation => value === 0 || value === 1 || value === 2 || value === 3;

type Leaf = Readonly<{ id: FoldonId; version: number; anchor: Cell; rotation: Rotation }>;

const leafKey = (leaf: Leaf): string => `${leaf.id}@${leaf.version}`;

function compareLeaves(a: Leaf, b: Leaf): number {
  for (let axis = 0; axis < 3; axis++) {
    const delta = (a.anchor[axis] ?? 0) - (b.anchor[axis] ?? 0);
    if (delta !== 0) return delta;
  }
  if (a.rotation !== b.rotation) return a.rotation - b.rotation;
  const x = leafKey(a);
  const y = leafKey(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function resolveLeaves(catalog: Catalog, op: Extract<WorldOp, { op: "instantiate" }>): Result<readonly Leaf[], string> {
  const { ref, anchor, rotation } = op;
  if (ref.kind === "foldon") {
    const definition = catalog.foldon(foldonId(ref.id), ref.version);
    if (definition === undefined) return err(`foldon ${ref.id}@${ref.version ?? "latest"} is not in the catalog`);
    return ok([{ id: definition.id, version: definition.version, anchor, rotation }]);
  }
  const assembly = catalog.assembly(assemblyId(ref.id), ref.version);
  if (assembly === undefined) return err(`assembly ${ref.id}@${ref.version ?? "latest"} is not in the catalog`);
  return ok(
    catalog.flatten(assembly.recipe.id, assembly.recipe.version).map((leaf) => {
      const pose = composePose({ anchor, rotation }, { anchor: leaf.anchor, rotation: leaf.rotation });
      return { id: leaf.definitionId, version: leaf.definitionVersion, anchor: pose.anchor, rotation: pose.rotation };
    }),
  );
}

function instantiate(catalog: Catalog, draft: Draft, op: Extract<WorldOp, { op: "instantiate" }>, index: number): WorldIssue | undefined {
  if (!isCell(op.anchor) || !isRotation(op.rotation)) {
    return worldIssue("op-invalid", "instantiate needs an integer anchor cell and a rotation 0..3", index);
  }
  const leaves = resolveLeaves(catalog, op);
  if (!leaves.ok) return worldIssue("ref-unknown", leaves.error, index);
  const ordered = [...leaves.value].sort(compareLeaves);
  const group: GroupId | null = op.ref.kind === "assembly" ? groupIdOf({ revision: draft.revision, ordinal: draft.nextOrdinal }) : null;
  for (const leaf of ordered) {
    const definition = definitionOf(catalog, { id: leaf.id, version: leaf.version });
    const material = definition === undefined ? undefined : renderableMaterial(definition);
    if (definition === undefined || material === undefined) {
      return worldIssue("material-missing", `${leaf.id}@${leaf.version} has no renderable material`, index);
    }
    const created = { revision: draft.revision, ordinal: draft.nextOrdinal };
    draft.nextOrdinal += 1;
    const entity: Entity = {
      id: entityIdOf(created),
      created,
      definition: { id: definition.id, version: definition.version },
      material,
      quantity: 1,
      group,
      fold: Object.fromEntries(definition.geometry.creases.map((crease) => [crease.id, crease.restAngle])),
      owner: { kind: "placed", anchor: leaf.anchor, rotation: leaf.rotation },
    };
    draft.entities.set(entity.id, entity);
    draft.lineage.push({ kind: "instantiated", at: draft.revision, entity: entity.id, source: `${op.ref.kind}:${op.ref.id}@${op.ref.kind === "foldon" ? leaf.version : String(op.ref.version ?? "latest")}` });
  }
  return undefined;
}

function applyOp(catalog: Catalog, draft: Draft, op: WorldOp, index: number): WorldIssue | undefined {
  switch (op.op) {
    case "annotate":
      return typeof op.note === "string" && op.note.length > 0 && op.note.length <= MAX_NOTE_LENGTH
        ? undefined
        : worldIssue("op-invalid", `annotate needs a note of 1..${MAX_NOTE_LENGTH} characters`, index);
    case "instantiate":
      return instantiate(catalog, draft, op, index);
  }
}

function patchShapeIssue(patch: Patch): WorldIssue | undefined {
  if (!Number.isSafeInteger(patch.baseRevision) || patch.baseRevision < 0) return worldIssue("patch-invalid", "baseRevision must be an integer >= 0");
  if (!Array.isArray(patch.ops) || patch.ops.length === 0) return worldIssue("patch-invalid", "a patch needs at least one op");
  if (typeof patch.origin.id !== "string" || patch.origin.id.length === 0) return worldIssue("patch-invalid", "a patch needs an origin id");
  return undefined;
}

export function applyPatch(catalog: Catalog, state: WorldState, patch: Patch): Result<Committed, Rejection> {
  const current = state.header.revision;
  if (patch.baseRevision !== current) return err({ kind: "stale", base: patch.baseRevision, current });
  const shape = patchShapeIssue(patch);
  if (shape !== undefined) return err({ kind: "invalid", issues: [shape] });

  const draft: Draft = {
    revision: current + 1,
    entities: new Map(state.entities.map((entity) => [entity.id, entity])),
    lineage: [...state.lineage],
    bonds: [...state.bonds],
    conservation: state.conservation,
    nextOrdinal: 0,
  };
  for (const [index, op] of patch.ops.entries()) {
    const failure = applyOp(catalog, draft, op, index);
    if (failure !== undefined) return err({ kind: "invalid", issues: [failure] });
  }

  const next: WorldState = deepFreeze(
    structuredClone({
      header: { ...state.header, revision: draft.revision },
      entities: [...draft.entities.values()],
      bonds: draft.bonds,
      lineage: draft.lineage,
      conservation: draft.conservation,
    }),
  );
  const broken = checkInvariants(catalog, next);
  if (broken.length > 0) return err({ kind: "invalid", issues: broken });
  const record: CommitRecord = deepFreeze(
    structuredClone({ revision: draft.revision, tick: next.header.tick, origin: patch.origin, patch, stateHash: hashState(next) }),
  );
  return ok({ state: next, record });
}

export type ReplayDivergence = Readonly<{
  revision: Revision;
  reason: "version-mismatch" | "rejected" | "hash-mismatch";
  issues: readonly WorldIssue[];
}>;

export function replay(catalog: Catalog, initial: WorldState, log: readonly CommitRecord[]): Result<WorldState, ReplayDivergence> {
  const mismatch = versionIssues(catalog, initial.header.versions);
  if (mismatch.length > 0) return err({ revision: initial.header.revision, reason: "version-mismatch", issues: mismatch });
  let state = initial;
  for (const record of log) {
    const committed = applyPatch(catalog, state, record.patch);
    if (!committed.ok) {
      const issues = committed.error.kind === "invalid" ? committed.error.issues : [worldIssue("patch-invalid", "the recorded patch is stale")];
      return err({ revision: record.revision, reason: "rejected", issues });
    }
    if (committed.value.record.revision !== record.revision || committed.value.record.stateHash !== record.stateHash) {
      return err({
        revision: record.revision,
        reason: "hash-mismatch",
        issues: [worldIssue("snapshot-malformed", `replayed state hash ${committed.value.record.stateHash} differs from recorded ${record.stateHash}`)],
      });
    }
    state = committed.value.state;
  }
  return ok(state);
}
