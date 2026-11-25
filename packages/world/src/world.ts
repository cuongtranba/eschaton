import { err, fnv1a64, ok, type Catalog, type Result } from "@eschaton/foldon";
import packageJson from "../package.json";
import { canonicalJson, deepFreeze } from "./canonical";
import { trust } from "./delta";
import { worldIssue, type WorldIssue } from "./issues";
import { SNAPSHOT_SCHEMA, type Conservation, type Versions, type WorldState } from "./state";

const INVARIANT_SET_VERSION = 2;

export const ENGINE_VERSION = `@eschaton/world@${packageJson.version}`;

export const catalogFingerprint = (catalog: Catalog): string => catalog.fingerprint;

export const rulesVersion = (catalog: Catalog): string => `sockets@${catalog.sockets().version}+invariants@${INVARIANT_SET_VERSION}`;

export function versionsOf(catalog: Catalog): Versions {
  return { catalog: catalogFingerprint(catalog), rules: rulesVersion(catalog), engine: ENGINE_VERSION };
}

export type WorldOptions = Readonly<{ catalog: Catalog; seed: number }>;

export function createWorld(options: WorldOptions): Result<WorldState, readonly WorldIssue[]> {
  const { seed } = options;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    return err([worldIssue("seed-invalid", `seed must be an integer in 0..2^32-1, got ${seed}`)]);
  }
  const conservation: Conservation = "off";
  const state: WorldState = deepFreeze({
    header: { schema: SNAPSHOT_SCHEMA, seed, versions: versionsOf(options.catalog), tick: 0, revision: 0 },
    entities: [],
    bonds: [],
    lineage: [],
    conservation,
  });
  trust(options.catalog, state);
  return ok(state);
}

const fragments = new WeakMap<object, string>();

/** Canonical JSON of one immutable part of a state. Frozen parts are shared between states, so their text is too. */
function fragment(value: object): string {
  if (!Object.isFrozen(value)) return canonicalJson(value);
  let text = fragments.get(value);
  if (text === undefined) {
    text = canonicalJson(value);
    fragments.set(value, text);
  }
  return text;
}

/** Exactly `canonicalJson(state)`, assembled from per-entity, per-bond and per-record fragments. */
function canonicalState(state: WorldState): string {
  const list = (items: readonly object[]): string => `[${items.map(fragment).join(",")}]`;
  return `{"bonds":${list(state.bonds)},"conservation":${canonicalJson(state.conservation)},"entities":${list(state.entities)},"header":${canonicalJson(state.header)},"lineage":${list(state.lineage)}}`;
}

export const hashState = (state: WorldState): string => fnv1a64(canonicalState(state));

export const serializeSnapshot = (state: WorldState): string => canonicalState(state);

export function versionIssues(catalog: Catalog, versions: Versions): readonly WorldIssue[] {
  const expected = versionsOf(catalog);
  const issues: WorldIssue[] = [];
  if (versions.catalog !== expected.catalog) {
    issues.push(worldIssue("catalog-mismatch", `state was built against catalog ${versions.catalog}, this catalog is ${expected.catalog}`));
  }
  if (versions.rules !== expected.rules) {
    issues.push(worldIssue("rules-mismatch", `state was built under rules ${versions.rules}, these rules are ${expected.rules}`));
  }
  return issues;
}
