import { err, ok, type Catalog, type Result } from "@eschaton/foldon";
import packageJson from "../package.json";
import { canonicalJson, deepFreeze, fnv1a64 } from "./canonical";
import { worldIssue, type WorldIssue } from "./issues";
import { SNAPSHOT_SCHEMA, type Conservation, type Versions, type WorldState } from "./state";

const INVARIANT_SET_VERSION = 1;

export const ENGINE_VERSION = `@eschaton/world@${packageJson.version}`;

const byKey = <T>(key: (item: T) => string) => (a: T, b: T): number => {
  const x = key(a);
  const y = key(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

export function catalogFingerprint(catalog: Catalog): string {
  const foldons = [...catalog.foldons()].sort(byKey((d) => `${d.id}@${d.version}`));
  const assemblies = [...catalog.assemblies()]
    .map((d) => ({ recipe: d.recipe, hash: d.hash }))
    .sort(byKey((d) => `${d.recipe.id}@${d.recipe.version}`));
  const contracts = [...catalog.contracts()].sort(byKey((c) => `${c.id}@${c.version}`));
  return fnv1a64(canonicalJson({ foldons, assemblies, contracts, sockets: catalog.sockets() }));
}

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
  return ok(
    deepFreeze({
      header: { schema: SNAPSHOT_SCHEMA, seed, versions: versionsOf(options.catalog), tick: 0, revision: 0 },
      entities: [],
      bonds: [],
      lineage: [],
      conservation,
    }),
  );
}

export const hashState = (state: WorldState): string => fnv1a64(canonicalJson(state));

export const serializeSnapshot = (state: WorldState): string => canonicalJson(state);

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
