import { err, fnv1a64, ok, placeFootprint, type Catalog, type Cell, type Result, type Rotation } from "@eschaton/foldon";
import { canonicalJson, deepFreeze } from "./canonical";
import { worldIssue, type WorldIssue } from "./issues";
import { cellsOf, definitionOf, isPlaced, resolvePlacement } from "./model";
import { opShapeIssue, type WorldOp } from "./ops";
import { advance, applyPatch, patchShapeIssue, type Committed, type Origin, type Patch, type Rejection } from "./patch";
import type { DefinitionRef, EntityId, Revision, WorldState } from "./state";
import { versionIssues } from "./world";

export type Region = Readonly<{ min: Cell; max: Cell }>;

export type RegionEntity = Readonly<{ id: EntityId; definition: DefinitionRef; anchor: Cell; rotation: Rotation; cells: readonly Cell[] }>;

export type RegionRead = Readonly<{
  region: Region;
  revision: Revision;
  digest: string;
  closed: boolean;
  entities: readonly RegionEntity[];
}>;

export type Proposal = Readonly<{
  region: Region;
  read: Readonly<{ revision: Revision; digest: string }>;
  /** Further regions the job relied on, each with the digest it had then (ADR 0016: nonlocal read dependencies). */
  depends?: readonly Readonly<{ region: Region; digest: string }>[];
  ops: readonly WorldOp[];
  origin: Origin;
}>;

export type ProposalRejection = Rejection | Readonly<{ kind: "conflict"; base: Revision; current: Revision }>;

const SHELL = 1;

const within = (cell: Cell, region: Region, pad: number): boolean =>
  [0, 1, 2].every((axis) => (cell[axis] ?? 0) >= (region.min[axis] ?? 0) - pad && (cell[axis] ?? 0) <= (region.max[axis] ?? 0) + pad);

export const cellInRegion = (cell: Cell, region: Region): boolean => within(cell, region, 0);

function regionIssue(region: Region): WorldIssue | undefined {
  const valid = [0, 1, 2].every((axis) => {
    const [low, high] = [region.min[axis], region.max[axis]];
    return low !== undefined && high !== undefined && Number.isSafeInteger(low) && Number.isSafeInteger(high) && low <= high;
  });
  return valid ? undefined : worldIssue("region-invalid", "a region needs integer cells with min <= max on every axis");
}

export function readRegion(catalog: Catalog, state: WorldState, region: Region): RegionRead {
  const entities: RegionEntity[] = [];
  for (const entity of state.entities) {
    if (!isPlaced(entity)) continue;
    const cells = cellsOf(catalog, entity);
    if (!cells.some((cell) => within(cell, region, SHELL))) continue;
    entities.push({ id: entity.id, definition: entity.definition, anchor: entity.owner.anchor, rotation: entity.owner.rotation, cells });
  }
  const closed = state.conservation !== "off";
  const { catalog: fingerprint, rules } = state.header.versions;
  const digest = fnv1a64(
    canonicalJson({
      catalog: fingerprint,
      rules,
      closed,
      region,
      entities: entities.map(({ id, definition, anchor, rotation }) => ({ id, definition, anchor, rotation })),
    }),
  );
  return deepFreeze({ region, revision: state.header.revision, digest, closed, entities });
}

function writeIssue(catalog: Catalog, state: WorldState, region: Region, op: WorldOp, index: number): WorldIssue | undefined {
  const outside = (what: string): WorldIssue => worldIssue("write-outside-region", `${what} is not entirely inside the proposal's region`, index);
  switch (op.op) {
    case "annotate":
      return undefined;
    case "instantiate": {
      const resolved = resolvePlacement(catalog, op.ref, { anchor: op.anchor, rotation: op.rotation });
      if (!resolved.ok) return worldIssue("ref-unknown", resolved.error, index);
      for (const leaf of resolved.value.leaves) {
        const definition = definitionOf(catalog, { id: leaf.id, version: leaf.version });
        if (definition === undefined) return worldIssue("ref-unknown", `foldon ${leaf.id}@${leaf.version} is not in the catalog`, index);
        if (!placeFootprint(definition, leaf).every((cell) => within(cell, region, 0))) return outside(`${op.ref.kind} ${op.ref.id}`);
      }
      return undefined;
    }
    case "consume": {
      const entity = state.entities.find((candidate) => candidate.id === op.entity);
      if (entity === undefined || !isPlaced(entity)) return worldIssue("entity-unknown", `entity ${op.entity} is not placed`, index);
      return cellsOf(catalog, entity).every((cell) => within(cell, region, 0)) ? undefined : outside(`entity ${op.entity}`);
    }
    case "detach":
    case "attach":
    case "store":
    case "retrieve":
    case "split":
    case "merge":
    case "conserve":
    case "fold":
      return worldIssue("op-invalid", `a region proposal may only instantiate and consume, not ${op.op}`, index);
  }
}

/** Every proposal check that comes before the patch itself: versions, shape, write set and read set. */
function proposalPatch(catalog: Catalog, state: WorldState, proposal: Proposal): Result<Patch, ProposalRejection> {
  const mismatch = versionIssues(catalog, state.header.versions);
  if (mismatch.length > 0) return err({ kind: "invalid", issues: mismatch });
  const badRegion = regionIssue(proposal.region);
  if (badRegion !== undefined) return err({ kind: "invalid", issues: [badRegion] });
  const shape = patchShapeIssue({ baseRevision: state.header.revision, ops: proposal.ops, origin: proposal.origin });
  if (shape !== undefined) return err({ kind: "invalid", issues: [shape] });
  for (const [index, op] of proposal.ops.entries()) {
    const issue = opShapeIssue(op, index) ?? writeIssue(catalog, state, proposal.region, op, index);
    if (issue !== undefined) return err({ kind: "invalid", issues: [issue] });
  }
  const now = readRegion(catalog, state, proposal.region);
  const conflict: ProposalRejection = { kind: "conflict", base: proposal.read.revision, current: state.header.revision };
  if (now.digest !== proposal.read.digest) return err(conflict);
  for (const dependency of proposal.depends ?? []) {
    const bad = regionIssue(dependency.region);
    if (bad !== undefined) return err({ kind: "invalid", issues: [bad] });
    if (readRegion(catalog, state, dependency.region).digest !== dependency.digest) return err(conflict);
  }
  return ok({ baseRevision: state.header.revision, ops: proposal.ops, origin: proposal.origin });
}

export function applyProposal(catalog: Catalog, state: WorldState, proposal: Proposal): Result<Committed, ProposalRejection> {
  const patch = proposalPatch(catalog, state, proposal);
  return patch.ok ? applyPatch(catalog, state, patch.value) : patch;
}

/**
 * The state `applyProposal` would commit, validated in exactly the same way, without a commit record and therefore
 * without hashing the state. For a job's private scratch work only: a drafted state has no record, so it cannot be
 * logged or replayed, and the job's real result still goes through `applyProposal`.
 */
export function draftProposal(catalog: Catalog, state: WorldState, proposal: Proposal): Result<WorldState, ProposalRejection> {
  const patch = proposalPatch(catalog, state, proposal);
  return patch.ok ? advance(catalog, state, patch.value) : patch;
}
