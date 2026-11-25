import { poseGeometry, type Catalog } from "@eschaton/foldon";
import { worldIssue, type WorldIssue } from "./issues";
import { bondsFromContacts, cellKey, contacts, definitionOf, occupancy, renderableMaterial, sortBonds, type Contact } from "./model";
import { entityIdOf, type Bond, type ContinuousTransform, type Entity, type EntityId, type Stamp, type WorldState } from "./state";

const QUATERNION_TOLERANCE = 1e-9;

export function transformIssue(transform: ContinuousTransform): string | undefined {
  const numbers = [...transform.position, ...transform.rotation, transform.scale];
  if (!numbers.every(Number.isFinite)) return "transform values must be finite";
  const norm = Math.hypot(...transform.rotation);
  if (Math.abs(norm - 1) > QUATERNION_TOLERANCE) return `rotation must be a unit quaternion (norm ${norm})`;
  if (transform.scale <= 0) return "scale must be positive";
  return undefined;
}

export const before = (a: Stamp, b: Stamp): boolean => a.revision < b.revision || (a.revision === b.revision && a.ordinal < b.ordinal);

export function materialTotals(entities: readonly Entity[]): Readonly<Record<string, number>> {
  const totals: Record<string, number> = {};
  for (const entity of entities) {
    if (entity.owner.kind === "consumed") continue;
    totals[entity.material] = (totals[entity.material] ?? 0) + entity.quantity;
  }
  return totals;
}

export function entityIssuesOf(catalog: Catalog, revision: number, entity: Entity, validPoses: Map<string, boolean>, issues: WorldIssue[]): void {
  const label = `entity ${entity.id}`;
  if (entity.id !== entityIdOf(entity.created) || entity.created.revision > revision) {
    issues.push(worldIssue("id-invalid", `${label} does not match its creation stamp`));
  }
  if (!Number.isSafeInteger(entity.quantity) || entity.quantity < 1) {
    issues.push(worldIssue("quantity-invalid", `${label} quantity must be an integer >= 1`));
  }
  const definition = definitionOf(catalog, entity.definition);
  if (definition === undefined) {
    issues.push(worldIssue("ref-unknown", `${label} references unknown definition ${entity.definition.id}@${entity.definition.version}`));
    return;
  }
  if (renderableMaterial(definition) !== entity.material) {
    issues.push(worldIssue("material-missing", `${label} material does not match its definition`));
  }
  const creases = definition.geometry.creases.map((crease) => crease.id as string).sort();
  const folded = Object.keys(entity.fold).sort();
  const poseKey = `${definition.id}@${definition.version}|${folded.map((key) => `${key}=${entity.fold[key] ?? Number.NaN}`).join(",")}`;
  const valid = validPoses.get(poseKey) ?? poseGeometry(definition.geometry, entity.fold).ok;
  validPoses.set(poseKey, valid);
  if (creases.join("|") !== folded.join("|") || !valid) {
    issues.push(worldIssue("fold-invalid", `${label} fold angles do not form a valid pose`));
  }
  const { owner } = entity;
  switch (owner.kind) {
    case "placed":
      if (!definition.rotations.includes(owner.rotation)) {
        issues.push(worldIssue("rotation-not-allowed", `${label} uses rotation ${owner.rotation}, which its definition does not allow`));
      }
      break;
    case "detached": {
      const problem = transformIssue(owner.transform);
      if (problem !== undefined) issues.push(worldIssue("transform-invalid", `${label}: ${problem}`));
      break;
    }
    case "inventory":
      if (owner.store.length === 0) issues.push(worldIssue("owner-invalid", `${label} is held by an unnamed store`));
      break;
    case "consumed":
      if (owner.by > revision) issues.push(worldIssue("owner-invalid", `${label} is consumed in the future`));
      break;
  }
}

function entityIssues(catalog: Catalog, state: WorldState): WorldIssue[] {
  const issues: WorldIssue[] = [];
  const validPoses = new Map<string, boolean>();
  let previous: Stamp | undefined;
  for (const entity of state.entities) {
    const at = issues.length;
    entityIssuesOf(catalog, state.header.revision, entity, validPoses, issues);
    if (previous !== undefined && !before(previous, entity.created)) {
      issues.splice(Math.min(issues.length, at + (issues[at]?.code === "id-invalid" ? 1 : 0)), 0, worldIssue("id-invalid", `entity ${entity.id} is not in creation order`));
    }
    previous = entity.created;
  }
  return issues;
}

function placementIssues(catalog: Catalog, state: WorldState, touching: readonly Contact[]): WorldIssue[] {
  const issues: WorldIssue[] = [];
  for (const [cell, occupants] of occupancy(catalog, state.entities)) {
    if (occupants.length > 1) issues.push(worldIssue("cell-occupied", `cell ${cell} is occupied by ${occupants.join(", ")}`));
  }
  for (const contact of touching) {
    if (contact.mismatches.length > 0) {
      issues.push(
        worldIssue(
          "socket-incompatible",
          `${contact.a.entity.id} ${contact.a.socket.profile} at ${contact.a.socket.cell.join(",")}${contact.a.socket.face} does not mate with ${contact.b.entity.id} ${contact.b.socket.profile} (${contact.mismatches.join(", ")})`,
        ),
      );
    }
  }
  return issues;
}

export function lineageIssues(state: WorldState): WorldIssue[] {
  const created = new Map<EntityId, Stamp>(state.entities.map((entity) => [entity.id, entity.created]));
  const issues: WorldIssue[] = [];
  const forward = (from: EntityId, to: EntityId): void => {
    const a = created.get(from);
    const b = created.get(to);
    if (a === undefined || b === undefined || !before(a, b)) {
      issues.push(worldIssue("lineage-invalid", `lineage edge ${from} -> ${to} does not point forward to known entities`));
    }
  };
  for (const record of state.lineage) {
    if (record.at > state.header.revision) issues.push(worldIssue("lineage-invalid", `lineage record at revision ${record.at} is in the future`));
    switch (record.kind) {
      case "split":
        for (const child of record.children) forward(record.parent, child);
        break;
      case "merged":
        for (const parent of record.parents) forward(parent, record.child);
        break;
      case "instantiated":
      case "detached":
      case "reattached":
      case "stored":
      case "retrieved":
      case "consumed":
        if (!created.has(record.entity)) issues.push(worldIssue("lineage-invalid", `lineage names unknown entity ${record.entity}`));
        break;
    }
  }
  return issues;
}

export function conservationIssues(state: WorldState): WorldIssue[] {
  if (state.conservation === "off") return [];
  const { baseline } = state.conservation;
  const totals = materialTotals(state.entities);
  const keys = new Set([...Object.keys(baseline), ...Object.keys(totals)]);
  return [...keys]
    .filter((key) => (baseline[key] ?? 0) !== (totals[key] ?? 0))
    .map((key) => worldIssue("conservation-violated", `material ${key} totals ${totals[key] ?? 0}; the closed baseline is ${baseline[key] ?? 0}`));
}

const bondKey = (bond: Bond): string =>
  `${bond.a.entity}|${cellKey(bond.a.cell)}|${bond.a.face}|${bond.b.entity}|${cellKey(bond.b.cell)}|${bond.b.face}|${bond.strength}`;

function bondIssues(catalog: Catalog, state: WorldState, touching: readonly Contact[]): WorldIssue[] {
  const expected = sortBonds(bondsFromContacts(catalog, touching), state.entities);
  return state.bonds.map(bondKey).join(";") === expected.map(bondKey).join(";")
    ? []
    : [worldIssue("bond-invalid", `stored bonds (${state.bonds.length}) differ from the mated socket pairs between placed entities (${expected.length})`)];
}


export function checkInvariants(catalog: Catalog, state: WorldState): readonly WorldIssue[] {
  const touching = contacts(catalog, state.entities);
  return [
    ...entityIssues(catalog, state),
    ...placementIssues(catalog, state, touching),
    ...bondIssues(catalog, state, touching),
    ...lineageIssues(state),
    ...conservationIssues(state),
  ];
}
