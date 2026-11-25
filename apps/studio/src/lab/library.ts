import {
  assemblyId,
  defaultCatalog,
  foldonId,
  type AssemblyDefinition,
  type Catalog,
  type Cell,
  type FoldonDefinition,
  type Result,
  type ValidationIssue,
} from "@eschaton/foldon";

export const REFERENCE_SCENE_ID = "reference-composition";
export const WORLD_SCENE_ID = "world";

export type SceneDefinition = Readonly<{ id: string; name: string; summary: string }>;

export const referenceScene: SceneDefinition = {
  id: REFERENCE_SCENE_ID,
  name: "Reference composition",
  summary: "The Last District (look-dev)",
};

export const worldScene: SceneDefinition = {
  id: WORLD_SCENE_ID,
  name: "World",
  summary: "Driven by @eschaton/world",
};

export const scenes: readonly SceneDefinition[] = [referenceScene, worldScene];

export type ItemRef = Readonly<{ kind: "primitive" | "assembly" | "scene"; id: string }>;

export type ResolvedItem =
  | Readonly<{ kind: "primitive"; definition: FoldonDefinition }>
  | Readonly<{ kind: "assembly"; definition: AssemblyDefinition }>
  | Readonly<{ kind: "scene"; definition: SceneDefinition }>;

export type Library = Readonly<{ catalog: Catalog; items: readonly ItemRef[] }>;

export const itemKey = (ref: ItemRef): string => `${ref.kind}:${ref.id}`;

export const sameItem = (a: ItemRef, b: ItemRef): boolean => a.kind === b.kind && a.id === b.id;

export function loadLibrary(): Result<Library, readonly ValidationIssue[]> {
  if (!defaultCatalog.ok) return defaultCatalog;
  const catalog = defaultCatalog.value;
  const items: readonly ItemRef[] = [
    ...scenes.map((scene): ItemRef => ({ kind: "scene", id: scene.id })),
    ...catalog.foldons().map((definition): ItemRef => ({ kind: "primitive", id: definition.id })),
    ...catalog.assemblies().map((definition): ItemRef => ({ kind: "assembly", id: definition.recipe.id })),
  ];
  return { ok: true, value: { catalog, items } };
}

export function resolveItem(library: Library, ref: ItemRef): ResolvedItem | undefined {
  if (ref.kind === "scene") {
    const definition = scenes.find((scene) => scene.id === ref.id);
    return definition === undefined ? undefined : { kind: "scene", definition };
  }
  if (ref.kind === "primitive") {
    const definition = library.catalog.foldon(foldonId(ref.id));
    return definition === undefined ? undefined : { kind: "primitive", definition };
  }
  const definition = library.catalog.assembly(assemblyId(ref.id));
  return definition === undefined ? undefined : { kind: "assembly", definition };
}

export function neighbourItem(items: readonly ItemRef[], current: ItemRef, offset: number): ItemRef {
  const index = items.findIndex((item) => sameItem(item, current));
  const next = (Math.max(index, 0) + offset + items.length) % items.length;
  return items[next] ?? current;
}

export function cellBounds(cells: readonly Cell[]): Readonly<{ min: Cell; max: Cell }> {
  const axis = (i: 0 | 1 | 2): readonly [number, number] => [
    Math.min(...cells.map((c) => c[i])),
    Math.max(...cells.map((c) => c[i])),
  ];
  const [x, y, z] = [axis(0), axis(1), axis(2)];
  return { min: [x[0], y[0], z[0]], max: [x[1], y[1], z[1]] };
}

export function footprintSize(cells: readonly Cell[]): readonly [number, number, number] {
  if (cells.length === 0) return [0, 0, 0];
  const { min, max } = cellBounds(cells);
  return [max[0] - min[0] + 1, max[1] - min[1] + 1, max[2] - min[2] + 1];
}
