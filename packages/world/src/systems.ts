import { err, ok, type Catalog, type ComponentSpec, type FoldonDefinition, type Result, type Vec3 } from "@eschaton/foldon";
import { worldIssue, type WorldIssue } from "./issues";
import { definitionOf, isPlaced } from "./model";
import type { WorldOp } from "./ops";
import { applyPatch, type Committed, type Rejection } from "./patch";
import type { Entity, WorldState } from "./state";

export type ComponentKind = ComponentSpec["kind"];

export type SystemEntity = Readonly<{ entity: Entity; definition: FoldonDefinition }>;

export type SystemView = Readonly<{ revision: number; entities: readonly SystemEntity[] }>;

export type System<Input> = Readonly<{
  id: string;
  reads: readonly ComponentKind[];
  plan: (view: SystemView, input: Input) => Result<readonly WorldOp[], readonly WorldIssue[]>;
}>;

export function systemView(catalog: Catalog, state: WorldState, reads: readonly ComponentKind[]): SystemView {
  const entities = state.entities.filter(isPlaced).flatMap((entity) => {
    const definition = definitionOf(catalog, entity.definition);
    if (definition === undefined) return [];
    const kinds = new Set(definition.components.map((component) => component.kind));
    return reads.every((kind) => kinds.has(kind)) ? [{ entity, definition }] : [];
  });
  return { revision: state.header.revision, entities };
}

const touched = (op: WorldOp): readonly string[] => {
  switch (op.op) {
    case "annotate":
    case "instantiate":
    case "conserve":
      return [];
    case "merge":
      return op.entities;
    case "detach":
    case "attach":
    case "store":
    case "retrieve":
    case "split":
    case "consume":
    case "fold":
      return [op.entity];
  }
};

export function runSystem<Input>(
  catalog: Catalog,
  state: WorldState,
  system: System<Input>,
  input: Input,
): Result<Committed, Rejection> {
  const view = systemView(catalog, state, system.reads);
  const planned = system.plan(view, input);
  if (!planned.ok) return err({ kind: "invalid", issues: planned.error });
  const visible = new Set<string>(view.entities.map(({ entity }) => entity.id));
  const outside = planned.value.flatMap(touched).filter((id) => !visible.has(id));
  if (outside.length > 0) {
    return err({ kind: "invalid", issues: [worldIssue("op-invalid", `system ${system.id} touched entities outside its view: ${outside.join(", ")}`)] });
  }
  if (planned.value.length === 0) return err({ kind: "invalid", issues: [worldIssue("op-invalid", `system ${system.id} proposed no change`)] });
  return applyPatch(catalog, state, { baseRevision: state.header.revision, ops: planned.value, origin: { kind: "system", id: system.id } });
}

export type WindInput = Readonly<{ wind: Vec3 }>;

function componentValue(definition: FoldonDefinition): Readonly<{ creases: readonly string[]; stiffness: number; drag: number }> | undefined {
  let creases: readonly string[] | undefined;
  let stiffness: number | undefined;
  let drag: number | undefined;
  for (const component of definition.components) {
    if (component.kind === "foldable") {
      creases = component.creases;
      stiffness = component.stiffness;
    } else if (component.kind === "wind-responsive") {
      drag = component.drag;
    }
  }
  return creases === undefined || stiffness === undefined || drag === undefined ? undefined : { creases, stiffness, drag };
}

function remainingFold(load: number, stiffness: number): number {
  if (load === 0) return 1;
  return stiffness === 0 ? 0 : Math.max(0, 1 - load / stiffness);
}

export const windFold: System<WindInput> = {
  id: "wind-fold",
  reads: ["foldable", "wind-responsive"],
  plan: (view, { wind }) => {
    const strength = Math.hypot(wind[0], wind[1], wind[2]);
    if (!Number.isFinite(strength)) return err([worldIssue("op-invalid", "wind must be a finite vector")]);
    return ok(
      view.entities.flatMap(({ entity, definition }): WorldOp[] => {
        const data = componentValue(definition);
        if (data === undefined) return [];
        const factor = remainingFold(strength * data.drag, data.stiffness);
        const rest = new Map(definition.geometry.creases.map((crease) => [crease.id as string, crease.restAngle]));
        const angles = Object.fromEntries(data.creases.map((id) => [id, (rest.get(id) ?? 0) * factor]));
        return [{ op: "fold", entity: entity.id, angles }];
      }),
    );
  },
};
