import { err, ok, type Catalog, type Result } from "@eschaton/foldon";
import { deepFreeze } from "./canonical";
import { checkInvariants } from "./invariants";
import { sortBonds } from "./model";
import { worldIssue, type WorldIssue } from "./issues";
import { applyOp, settleBonds, type Draft, type WorldOp } from "./ops";
import type { Revision, WorldState } from "./state";
import { hashState, versionIssues } from "./world";

export type { InstanceRef, SplitChild, WorldOp } from "./ops";

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

function patchShapeIssue(patch: Patch): WorldIssue | undefined {
  if (!Number.isSafeInteger(patch.baseRevision) || patch.baseRevision < 0) return worldIssue("patch-invalid", "baseRevision must be an integer >= 0");
  if (!Array.isArray(patch.ops) || patch.ops.length === 0) return worldIssue("patch-invalid", "a patch needs at least one op");
  if (typeof patch.origin.id !== "string" || patch.origin.id.length === 0) return worldIssue("patch-invalid", "a patch needs an origin id");
  return undefined;
}

export function applyPatch(catalog: Catalog, state: WorldState, patch: Patch): Result<Committed, Rejection> {
  const mismatch = versionIssues(catalog, state.header.versions);
  if (mismatch.length > 0) return err({ kind: "invalid", issues: mismatch });
  const current = state.header.revision;
  if (patch.baseRevision !== current) return err({ kind: "stale", base: patch.baseRevision, current });
  const shape = patchShapeIssue(patch);
  if (shape !== undefined) return err({ kind: "invalid", issues: [shape] });

  const draft: Draft = {
    revision: current + 1,
    entities: new Map(state.entities.map((entity) => [entity.id, entity])),
    lineage: [...state.lineage],
    moved: new Set(),
    bonds: [...state.bonds],
    conservation: state.conservation,
    nextOrdinal: 0,
  };
  for (const [index, op] of patch.ops.entries()) {
    const failure = applyOp(catalog, draft, op, index);
    if (failure !== undefined) return err({ kind: "invalid", issues: [failure] });
  }
  settleBonds(catalog, draft);

  const next: WorldState = deepFreeze(
    structuredClone({
      header: { ...state.header, revision: draft.revision },
      entities: [...draft.entities.values()],
      bonds: sortBonds(draft.bonds, [...draft.entities.values()]),
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
