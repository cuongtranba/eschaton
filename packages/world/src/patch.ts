import { err, ok, type Catalog, type Result } from "@eschaton/foldon";
import { deepFreeze } from "./canonical";
import { indexOf, remember, settleTouched, trust } from "./delta";
import { checkInvariants, conservationIssues, lineageIssues } from "./invariants";
import { sortBonds } from "./model";
import { worldIssue, type WorldIssue } from "./issues";
import { applyOp, settleBonds, type Draft, type WorldOp } from "./ops";
import type { Bond, Entity, Revision, WorldState } from "./state";
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

export type PatchOptions = Readonly<{
  /**
   * "incremental" (default) validates only what the patch touched when the base state is one this package has
   * already validated. "full" always runs the complete invariant audit. Both give the same result; "full" is the
   * reference the incremental path is tested against.
   */
  audit?: "incremental" | "full";
}>;

function assemble(state: WorldState, draft: Draft, bonds: readonly Bond[]): WorldState {
  const entities: Entity[] = [];
  for (const entity of draft.entities.values()) entities.push(draft.touched.has(entity.id) ? structuredClone(entity) : entity);
  const lineage = [...state.lineage, ...structuredClone(draft.lineage.slice(state.lineage.length))];
  const conservation = draft.conservation === state.conservation ? state.conservation : structuredClone(draft.conservation);
  return deepFreeze({ header: { ...state.header, revision: draft.revision }, entities, bonds: [...bonds], lineage, conservation });
}

export function applyPatch(catalog: Catalog, state: WorldState, patch: Patch, options: PatchOptions = {}): Result<Committed, Rejection> {
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
    touched: new Map(),
    bonds: [...state.bonds],
    conservation: state.conservation,
    nextOrdinal: 0,
  };
  for (const [index, op] of patch.ops.entries()) {
    const failure = applyOp(catalog, draft, op, index);
    if (failure !== undefined) return err({ kind: "invalid", issues: [failure] });
  }

  const baseIndex = options.audit === "full" ? undefined : indexOf(state);
  const settled = baseIndex === undefined ? undefined : settleTouched(catalog, state, baseIndex, draft);
  let next: WorldState | undefined;
  if (settled !== undefined) {
    const candidate = assemble(state, draft, settled.bonds);
    if (lineageIssues(candidate).length === 0 && conservationIssues(candidate).length === 0) {
      next = candidate;
      remember(next, settled.index);
    }
  }
  if (next === undefined) {
    settleBonds(catalog, draft);
    const audited = assemble(state, draft, sortBonds(draft.bonds, [...draft.entities.values()]));
    const broken = checkInvariants(catalog, audited);
    if (broken.length > 0) return err({ kind: "invalid", issues: broken });
    next = audited;
    trust(catalog, next);
  }
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
