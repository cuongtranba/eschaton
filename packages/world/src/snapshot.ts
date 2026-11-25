import { err, ok, type Catalog, type Cell, type Face, type Result, type Rotation, type Vec3 } from "@eschaton/foldon";
import { deepFreeze } from "./canonical";
import { trust } from "./delta";
import { checkInvariants } from "./invariants";
import { worldIssue, type WorldIssue } from "./issues";
import {
  SNAPSHOT_SCHEMA,
  type Bond,
  type BondEnd,
  type Conservation,
  type ContinuousTransform,
  type Entity,
  type EntityId,
  type GroupId,
  type LineageRecord,
  type Owner,
  type Stamp,
  type StoreId,
  type WorldState,
} from "./state";
import { versionIssues } from "./world";

type Unknown = Readonly<Record<string, unknown>>;

const fail = (path: string, expected: string): never => {
  throw new SyntaxError(`${path}: expected ${expected}`);
};

const record = (value: unknown, path: string): Unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Unknown) : fail(path, "an object");

const list = (value: unknown, path: string): readonly unknown[] => (Array.isArray(value) ? value : fail(path, "an array"));

const text = (value: unknown, path: string): string => (typeof value === "string" ? value : fail(path, "a string"));

const finite = (value: unknown, path: string): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fail(path, "a finite number");

const integer = (value: unknown, path: string, min = 0): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min ? value : fail(path, `an integer >= ${min}`);

const vec3 = (value: unknown, path: string): Vec3 => {
  const items = list(value, path);
  if (items.length !== 3) fail(path, "three numbers");
  return [finite(items[0], `${path}[0]`), finite(items[1], `${path}[1]`), finite(items[2], `${path}[2]`)];
};

const cell = (value: unknown, path: string): Cell => {
  const v = vec3(value, path);
  return v.every(Number.isInteger) ? v : fail(path, "an integer cell");
};

const rotation = (value: unknown, path: string): Rotation =>
  value === 0 || value === 1 || value === 2 || value === 3 ? value : fail(path, "a rotation 0..3");

const FACES: readonly Face[] = ["+x", "-x", "+y", "-y", "+z", "-z"];
const face = (value: unknown, path: string): Face => FACES.find((f) => f === value) ?? fail(path, "a face");

const ID_PATTERN = /^[eg]\d+\.\d+$/;
const entityRef = (value: unknown, path: string): EntityId => {
  const id = text(value, path);
  return id.startsWith("e") && ID_PATTERN.test(id) ? (id as EntityId) : fail(path, "an entity id e<revision>.<ordinal>");
};
const groupRef = (value: unknown, path: string): GroupId | null => {
  if (value === null) return null;
  const id = text(value, path);
  return id.startsWith("g") && ID_PATTERN.test(id) ? (id as GroupId) : fail(path, "a group id or null");
};

const stamp = (value: unknown, path: string): Stamp => {
  const r = record(value, path);
  return { revision: integer(r.revision, `${path}.revision`, 1), ordinal: integer(r.ordinal, `${path}.ordinal`) };
};

const transform = (value: unknown, path: string): ContinuousTransform => {
  const r = record(value, path);
  const q = list(r.rotation, `${path}.rotation`);
  if (q.length !== 4) fail(`${path}.rotation`, "a quaternion of four numbers");
  return {
    position: vec3(r.position, `${path}.position`),
    rotation: [
      finite(q[0], `${path}.rotation[0]`),
      finite(q[1], `${path}.rotation[1]`),
      finite(q[2], `${path}.rotation[2]`),
      finite(q[3], `${path}.rotation[3]`),
    ],
    scale: finite(r.scale, `${path}.scale`),
  };
};

function owner(value: unknown, path: string): Owner {
  const r = record(value, path);
  switch (r.kind) {
    case "placed":
      return { kind: "placed", anchor: cell(r.anchor, `${path}.anchor`), rotation: rotation(r.rotation, `${path}.rotation`) };
    case "detached":
      return { kind: "detached", transform: transform(r.transform, `${path}.transform`) };
    case "inventory":
      return { kind: "inventory", store: text(r.store, `${path}.store`) as StoreId };
    case "consumed": {
      const reason = r.reason === "split" || r.reason === "merged" || r.reason === "destroyed" ? r.reason : fail(`${path}.reason`, "split|merged|destroyed");
      return { kind: "consumed", by: integer(r.by, `${path}.by`, 1), reason };
    }
    default:
      return fail(`${path}.kind`, "placed|detached|inventory|consumed");
  }
}

function entity(value: unknown, path: string): Entity {
  const r = record(value, path);
  const definition = record(r.definition, `${path}.definition`);
  const fold = record(r.fold, `${path}.fold`);
  return {
    id: entityRef(r.id, `${path}.id`),
    created: stamp(r.created, `${path}.created`),
    definition: { id: text(definition.id, `${path}.definition.id`) as Entity["definition"]["id"], version: integer(definition.version, `${path}.definition.version`, 1) },
    material: text(r.material, `${path}.material`) as Entity["material"],
    quantity: integer(r.quantity, `${path}.quantity`, 1),
    group: groupRef(r.group, `${path}.group`),
    fold: Object.fromEntries(Object.entries(fold).map(([key, angle]) => [key, finite(angle, `${path}.fold.${key}`)])),
    owner: owner(r.owner, `${path}.owner`),
  };
}

const bondEnd = (value: unknown, path: string): BondEnd => {
  const r = record(value, path);
  return { entity: entityRef(r.entity, `${path}.entity`), cell: cell(r.cell, `${path}.cell`), face: face(r.face, `${path}.face`) };
};

const bond = (value: unknown, path: string): Bond => {
  const r = record(value, path);
  return { a: bondEnd(r.a, `${path}.a`), b: bondEnd(r.b, `${path}.b`), strength: finite(r.strength, `${path}.strength`) };
};

function lineage(value: unknown, path: string): LineageRecord {
  const r = record(value, path);
  const at = integer(r.at, `${path}.at`, 1);
  switch (r.kind) {
    case "instantiated":
      return { kind: "instantiated", at, entity: entityRef(r.entity, `${path}.entity`), source: text(r.source, `${path}.source`) };
    case "detached":
    case "reattached":
    case "stored":
    case "retrieved":
      return { kind: r.kind, at, entity: entityRef(r.entity, `${path}.entity`) };
    case "split":
      return {
        kind: "split",
        at,
        parent: entityRef(r.parent, `${path}.parent`),
        children: list(r.children, `${path}.children`).map((c, i) => entityRef(c, `${path}.children[${i}]`)),
      };
    case "merged":
      return {
        kind: "merged",
        at,
        parents: list(r.parents, `${path}.parents`).map((p, i) => entityRef(p, `${path}.parents[${i}]`)),
        child: entityRef(r.child, `${path}.child`),
      };
    case "consumed":
      return r.reason === "destroyed"
        ? { kind: "consumed", at, entity: entityRef(r.entity, `${path}.entity`), reason: "destroyed" }
        : fail(`${path}.reason`, "destroyed");
    default:
      return fail(`${path}.kind`, "a lineage kind");
  }
}

function conservation(value: unknown, path: string): Conservation {
  if (value === "off") return "off";
  const r = record(value, path);
  if (r.mode !== "closed") fail(`${path}.mode`, "closed");
  const baseline = record(r.baseline, `${path}.baseline`);
  return {
    mode: "closed",
    baseline: Object.fromEntries(Object.entries(baseline).map(([key, total]) => [key, integer(total, `${path}.baseline.${key}`)])),
  };
}

function decode(value: unknown): WorldState {
  const root = record(value, "snapshot");
  const header = record(root.header, "header");
  const versions = record(header.versions, "header.versions");
  return {
    header: {
      schema: integer(header.schema, "header.schema", 1),
      seed: integer(header.seed, "header.seed"),
      versions: {
        catalog: text(versions.catalog, "header.versions.catalog"),
        rules: text(versions.rules, "header.versions.rules"),
        engine: text(versions.engine, "header.versions.engine"),
      },
      tick: integer(header.tick, "header.tick"),
      revision: integer(header.revision, "header.revision"),
    },
    entities: list(root.entities, "entities").map((e, i) => entity(e, `entities[${i}]`)),
    bonds: list(root.bonds, "bonds").map((b, i) => bond(b, `bonds[${i}]`)),
    lineage: list(root.lineage, "lineage").map((l, i) => lineage(l, `lineage[${i}]`)),
    conservation: conservation(root.conservation, "conservation"),
  };
}

export function parseSnapshot(catalog: Catalog, input: string): Result<WorldState, readonly WorldIssue[]> {
  let state: WorldState;
  try {
    const raw: unknown = JSON.parse(input);
    const schema = record(record(raw, "snapshot").header, "header").schema;
    if (typeof schema === "number" && schema > SNAPSHOT_SCHEMA) {
      return err([worldIssue("schema-newer", `snapshot schema ${schema} is newer than the supported schema ${SNAPSHOT_SCHEMA}`)]);
    }
    state = decode(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return err([worldIssue("snapshot-malformed", error.message)]);
  }
  if (state.header.schema !== SNAPSHOT_SCHEMA) {
    return err([worldIssue("snapshot-malformed", `unsupported snapshot schema ${state.header.schema}`)]);
  }
  const mismatch = versionIssues(catalog, state.header.versions);
  if (mismatch.length > 0) return err(mismatch);
  const broken = checkInvariants(catalog, state);
  if (broken.length > 0) return err(broken);
  const frozen = deepFreeze(state);
  trust(catalog, frozen);
  return ok(frozen);
}
