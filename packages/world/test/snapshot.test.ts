import { createCatalog, defaultCatalog, primitiveCatalog, type Catalog } from "@eschaton/foldon";
import { createWorld, hashState, parseSnapshot, serializeSnapshot, type WorldIssue, type WorldState } from "@eschaton/world";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!defaultCatalog.ok) throw new Error("the default catalog must build");
  return defaultCatalog.value;
})();

function emptyWorld(seed = 7): WorldState {
  const world = createWorld({ catalog, seed });
  if (!world.ok) throw new Error(world.error.map((i) => i.message).join("; "));
  return world.value;
}

const codes = (issues: readonly WorldIssue[]) => issues.map((i) => i.code);

test("an empty world round-trips through a snapshot to an equal state and hash", () => {
  const world = emptyWorld();
  const parsed = parseSnapshot(catalog, serializeSnapshot(world));
  if (!parsed.ok) throw new Error(parsed.error.map((i) => i.message).join("; "));
  expect(parsed.value).toEqual(world);
  expect(hashState(parsed.value)).toBe(hashState(world));
});

test("a snapshot from a newer schema is rejected", () => {
  const text = serializeSnapshot(emptyWorld()).replace('"schema":1', '"schema":2');
  const parsed = parseSnapshot(catalog, text);
  expect(parsed.ok ? [] : codes(parsed.error)).toEqual(["schema-newer"]);
});

test("a snapshot whose catalog version differs is rejected", () => {
  const primitivesOnly = createCatalog({ foldons: primitiveCatalog, assemblies: [] });
  if (!primitivesOnly.ok) throw new Error("primitive catalog must build");
  const parsed = parseSnapshot(primitivesOnly.value, serializeSnapshot(emptyWorld()));
  expect(parsed.ok ? [] : codes(parsed.error)).toEqual(["catalog-mismatch"]);
});

test("a world state cannot be mutated through its nested collections", () => {
  const world = emptyWorld();
  expect(Reflect.set(world.entities, 0, {})).toBe(false);
  expect(Reflect.set(world.header.versions, "catalog", "x")).toBe(false);
  expect(world.entities).toEqual([]);
});
