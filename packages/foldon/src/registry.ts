import {
  compileAssembly,
  type AssemblyDefinition,
  type AssemblyRecipe,
  type PartRef,
  type RefResolver,
} from "./assembly";
import { checkContract, contractIssues, type ContractRef, type ModuleContract } from "./contract";
import type { FoldonDefinition, Rotation } from "./definition";
import type { AssemblyId, ContractId, FoldonId } from "./ids";
import { canonicalJson, fnv1a64, immutable } from "./hash";
import { issue, type ValidationIssue } from "./issues";
import { catalogSocketIssues, defaultSocketTable, validateSocketTable, type SocketTable } from "./sockets";
import { err, ok, type Result } from "./result";
import { composePose, identityPose, type Pose } from "./transform";
import type { Cell } from "./vec";
import { validateFoldon } from "./validate";

export type FlatInstance = Readonly<{
  path: string;
  definitionId: FoldonId;
  definitionVersion: number;
  anchor: Cell;
  rotation: Rotation;
}>;

export type CatalogInput = Readonly<{
  foldons: readonly FoldonDefinition[];
  assemblies: readonly AssemblyRecipe[];
  contracts?: readonly ModuleContract[];
  sockets?: SocketTable;
}>;

export type Catalog = Readonly<{
  fingerprint: string;
  source: () => Required<CatalogInput>;
  foldon: (id: FoldonId, version?: number) => FoldonDefinition | undefined;
  assembly: (id: AssemblyId, version?: number) => AssemblyDefinition | undefined;
  foldons: () => readonly FoldonDefinition[];
  assemblies: () => readonly AssemblyDefinition[];
  contract: (id: ContractId, version?: number) => ModuleContract | undefined;
  contracts: () => readonly ModuleContract[];
  sockets: () => SocketTable;
  flatten: (id: AssemblyId, version?: number) => readonly FlatInstance[];
  satisfiesContract: (
    assembly: AssemblyId,
    contract: ContractId,
    rotation: Rotation,
    versions?: Readonly<{ assembly?: number; contract?: number }>,
  ) => Result<ContractRef, readonly ValidationIssue[]>;
}>;

type Versioned = Readonly<{ id: string; version: number }>;

const versionKey = (item: Versioned): string => `${item.id}@${item.version}`;

function indexVersions<T extends Versioned>(items: readonly T[]): ReadonlyMap<string, readonly T[]> {
  const byId = new Map<string, T[]>();
  for (const item of items) byId.set(item.id, [...(byId.get(item.id) ?? []), item]);
  for (const versions of byId.values()) versions.sort((a, b) => a.version - b.version);
  return byId;
}

function lookup<T extends Versioned>(
  index: ReadonlyMap<string, readonly T[]>,
  id: string,
  version: number | undefined,
): T | undefined {
  const versions = index.get(id);
  return version === undefined ? versions?.at(-1) : versions?.find((item) => item.version === version);
}

function duplicateIssues(items: readonly Versioned[], collection: string): ValidationIssue[] {
  const seen = new Set<string>();
  return items.flatMap((item, i) => {
    const key = versionKey(item);
    const duplicate = seen.has(key);
    seen.add(key);
    return duplicate ? [issue("duplicate-definition", `${collection}[${i}]`, `${key} is defined more than once`)] : [];
  });
}

const prefixed = (prefix: string, found: readonly ValidationIssue[]): ValidationIssue[] =>
  found.map((item) => issue(item.code, `${prefix}.${item.path}`, item.message));

const byVersionKey = (a: Versioned, b: Versioned): number => {
  const [x, y] = [versionKey(a), versionKey(b)];
  return x < y ? -1 : x > y ? 1 : 0;
};

export function createCatalog(given: CatalogInput): Result<Catalog, readonly ValidationIssue[]> {
  const input = Object.freeze({
    foldons: immutable([...given.foldons]),
    assemblies: immutable([...given.assemblies]),
    contracts: immutable([...(given.contracts ?? [])]),
    sockets: immutable(given.sockets ?? defaultSocketTable),
  });
  const contractList = input.contracts;
  const contractIndex = indexVersions(contractList);
  const table = input.sockets;
  const tableResult = validateSocketTable(table);
  const issues: ValidationIssue[] = [
    ...(tableResult.ok ? [] : prefixed("sockets", tableResult.error)),
    ...duplicateIssues(input.foldons, "foldons"),
    ...duplicateIssues(input.assemblies, "assemblies"),
    ...duplicateIssues(contractList, "contracts"),
  ];
  contractList.forEach((contract, i) => issues.push(...prefixed(`contracts[${i}]`, contractIssues(contract, table))));
  input.foldons.forEach((definition, i) => {
    const validated = validateFoldon(definition);
    if (!validated.ok) issues.push(...prefixed(`foldons[${i}]`, validated.error));
    issues.push(...prefixed(`foldons[${i}]`, catalogSocketIssues(table, definition.sockets)));
  });

  const foldonIndex = indexVersions(input.foldons);
  const recipeByKey = new Map(input.assemblies.map((recipe) => [versionKey(recipe), recipe]));
  const compiled = new Map<string, AssemblyDefinition | "failed" | "visiting">();

  const resolve: RefResolver = (ref: PartRef) => {
    if (ref.kind === "foldon") {
      const definition = lookup(foldonIndex, ref.id, ref.version);
      if (definition !== undefined) return ok({ kind: "foldon", definition });
      return err(foldonIndex.has(ref.id) ? "ref-version-unknown" : "ref-unknown");
    }
    const entry = compiled.get(versionKey(ref));
    if (entry !== undefined && entry !== "failed" && entry !== "visiting") {
      return ok({ kind: "assembly", definition: entry });
    }
    const known = input.assemblies.some((recipe) => recipe.id === ref.id);
    return err(known ? "ref-version-unknown" : "ref-unknown");
  };

  function build(recipe: AssemblyRecipe): void {
    const key = versionKey(recipe);
    if (compiled.has(key)) return;
    compiled.set(key, "visiting");
    const path = `assemblies[${input.assemblies.indexOf(recipe)}]`;
    const failedDependencies = recipe.parts.map((part, i) => {
      if (part.ref.kind !== "assembly") return false;
      const dependency = recipeByKey.get(versionKey(part.ref));
      if (dependency === undefined) return false;
      if (compiled.get(versionKey(dependency)) === "visiting") {
        issues.push(issue("assembly-cycle", `${path}.parts[${i}].ref`, `${key} reaches itself through ${versionKey(part.ref)}`));
        return true;
      }
      build(dependency);
      return compiled.get(versionKey(dependency)) === "failed";
    });
    if (failedDependencies.includes(true)) {
      compiled.set(key, "failed");
      return;
    }
    const result = compileAssembly(recipe, resolve, table);
    if (!result.ok) {
      issues.push(...prefixed(path, result.error));
      compiled.set(key, "failed");
      return;
    }
    const declared = recipe.contract;
    if (declared !== undefined) {
      const contract = lookup(contractIndex, declared.id, declared.version);
      const failures =
        contract === undefined
          ? [issue("contract-unknown", "contract", `contract ${declared.id}@${declared.version} is not in the catalog`)]
          : checkContract(contract, result.value, 0);
      if (failures.length > 0) {
        issues.push(...prefixed(path, failures));
        compiled.set(key, "failed");
        return;
      }
    }
    compiled.set(key, result.value);
  }

  input.assemblies.forEach(build);

  const definitions = [...compiled.values()].flatMap((entry) => (typeof entry === "object" ? [entry] : []));
  const firstWithHash = new Map<string, AssemblyDefinition>();
  for (const definition of definitions) {
    const original = firstWithHash.get(definition.hash);
    if (original === undefined) {
      firstWithHash.set(definition.hash, definition);
    } else if (original.recipe.id !== definition.recipe.id) {
      const path = `assemblies[${input.assemblies.findIndex((recipe) => versionKey(recipe) === versionKey(definition.recipe))}]`;
      issues.push(
        issue("duplicate-recipe", path, `${versionKey(definition.recipe)} has the same canonical hash as ${versionKey(original.recipe)}`),
      );
    }
  }

  if (issues.length > 0) return err(issues);

  const assemblyIndex = indexVersions(
    definitions.map((definition) => ({ id: definition.recipe.id, version: definition.recipe.version, definition })),
  );
  const foldons = input.foldons;
  Object.freeze(definitions);
  const fingerprint = fnv1a64(
    canonicalJson({
      foldons: [...foldons].sort(byVersionKey),
      assemblies: definitions
        .map((definition) => ({ recipe: definition.recipe, hash: definition.hash }))
        .sort((a, b) => byVersionKey(a.recipe, b.recipe)),
      contracts: [...contractList].sort(byVersionKey),
      sockets: table,
    }),
  );

  const flattenInto = (definition: AssemblyDefinition, pose: Pose, prefix: string, out: FlatInstance[]): void => {
    for (const part of definition.recipe.parts) {
      const world = composePose(pose, { anchor: part.anchor, rotation: part.rotation });
      const path = `${prefix}/${part.id}`;
      if (part.ref.kind === "foldon") {
        out.push({ path, definitionId: part.ref.id, definitionVersion: part.ref.version, anchor: world.anchor, rotation: world.rotation });
        continue;
      }
      const child = lookup(assemblyIndex, part.ref.id, part.ref.version);
      if (child !== undefined) flattenInto(child.definition, world, path, out);
    }
  };

  return ok(Object.freeze<Catalog>({
    fingerprint,
    source: () => input,
    foldon: (id, version) => lookup(foldonIndex, id, version),
    assembly: (id, version) => lookup(assemblyIndex, id, version)?.definition,
    foldons: () => foldons,
    assemblies: () => definitions,
    contract: (id, version) => lookup(contractIndex, id, version),
    contracts: () => contractList,
    sockets: () => table,
    satisfiesContract: (assembly, contract, rotation, versions) => {
      const target = lookup(assemblyIndex, assembly, versions?.assembly);
      if (target === undefined) return err([issue("ref-unknown", "assembly", `assembly ${assembly} is not in the catalog`)]);
      const found = lookup(contractIndex, contract, versions?.contract);
      if (found === undefined) return err([issue("contract-unknown", "contract", `contract ${contract} is not in the catalog`)]);
      const failures = checkContract(found, target.definition, rotation);
      return failures.length > 0 ? err(failures) : ok({ id: found.id, version: found.version });
    },
    flatten: (id, version) => {
      const root = lookup(assemblyIndex, id, version);
      const out: FlatInstance[] = [];
      if (root !== undefined) flattenInto(root.definition, identityPose, root.definition.recipe.id, out);
      return out;
    },
  }));
}
