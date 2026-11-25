import { err, ok, type Catalog, type Cell, type FoldonId, type Result, type Rotation } from "@eschaton/foldon";
import { resolvePlacement } from "./model";
import { worldIssue, type WorldIssue } from "./issues";
import { applyPatch, type CommitRecord, type Patch, type Rejection } from "./patch";
import type { Entity, EntityId, StoreId, WorldState } from "./state";

export type AssemblyRequest = Readonly<{
  target: Readonly<{ id: string; version?: number }>;
  anchor: Cell;
  rotation: Rotation;
  from: StoreId;
}>;

type Slot = Readonly<{ definition: FoldonId; version: number; anchor: Cell; rotation: Rotation }>;

function bottomUp(a: Slot, b: Slot): number {
  for (const axis of [1, 0, 2]) {
    const delta = (a.anchor[axis] ?? 0) - (b.anchor[axis] ?? 0);
    if (delta !== 0) return delta;
  }
  if (a.rotation !== b.rotation) return a.rotation - b.rotation;
  const [x, y] = [`${a.definition}@${a.version}`, `${b.definition}@${b.version}`];
  return x < y ? -1 : x > y ? 1 : 0;
}

const stampOrder = (a: Entity, b: Entity): number =>
  a.created.revision - b.created.revision || a.created.ordinal - b.created.ordinal;

export function planAssembly(catalog: Catalog, state: WorldState, request: AssemblyRequest): Result<readonly Patch[], readonly WorldIssue[]> {
  const resolved = resolvePlacement(catalog, { kind: "assembly", ...request.target }, { anchor: request.anchor, rotation: request.rotation });
  if (!resolved.ok) return err([worldIssue("ref-unknown", resolved.error)]);
  const slots: Slot[] = resolved.value.leaves.map((leaf) => ({ definition: leaf.id, version: leaf.version, anchor: leaf.anchor, rotation: leaf.rotation }));
  slots.sort(bottomUp);

  const available = new Map<string, Entity[]>();
  for (const entity of [...state.entities].sort(stampOrder)) {
    if (entity.owner.kind !== "inventory" || entity.owner.store !== request.from) continue;
    const key = `${entity.definition.id}@${entity.definition.version}`;
    available.set(key, [...(available.get(key) ?? []), entity]);
  }
  const steps: { slot: Slot; entity: EntityId }[] = [];
  const missing = new Map<string, number>();
  for (const slot of slots) {
    const key = `${slot.definition}@${slot.version}`;
    const next = available.get(key)?.shift();
    if (next === undefined) missing.set(key, (missing.get(key) ?? 0) + 1);
    else steps.push({ slot, entity: next.id });
  }
  if (missing.size > 0) {
    const list = [...missing].map(([key, count]) => `${count} × ${key}`).join(", ");
    return err([worldIssue("entity-unknown", `store ${request.from} lacks ${list} for ${resolved.value.source}`)]);
  }

  const origin = { kind: "job", id: `assemble:${resolved.value.source}` } as const;
  return ok(
    steps.map(({ slot, entity }, i): Patch => ({
      baseRevision: state.header.revision + i,
      ops: [{ op: "attach", entity, anchor: slot.anchor, rotation: slot.rotation }],
      origin,
    })),
  );
}

export type AssemblyOutcome = Readonly<{ state: WorldState; records: readonly CommitRecord[] }>;
export type AssemblyFailure = AssemblyOutcome & Readonly<{ rejection: Rejection }>;

export function assemble(catalog: Catalog, state: WorldState, request: AssemblyRequest): Result<AssemblyOutcome, AssemblyFailure> {
  const planned = planAssembly(catalog, state, request);
  if (!planned.ok) return err({ state, records: [], rejection: { kind: "invalid", issues: planned.error } });
  let current = state;
  const records: CommitRecord[] = [];
  for (const patch of planned.value) {
    const committed = applyPatch(catalog, current, patch);
    if (!committed.ok) return err({ state: current, records, rejection: committed.error });
    current = committed.value.state;
    records.push(committed.value.record);
  }
  return ok({ state: current, records });
}
