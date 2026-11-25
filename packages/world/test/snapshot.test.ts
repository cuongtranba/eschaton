import { createCatalog, defaultCatalog, primitiveCatalog, type Catalog } from "@eschaton/foldon";
import { applyPatch, createWorld, hashState, parseSnapshot, serializeSnapshot, storeId, type WorldIssue, type WorldOp, type WorldState } from "@eschaton/world";
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

function populated(): WorldState {
  let state = emptyWorld();
  const step = (...ops: WorldOp[]) => {
    const result = applyPatch(catalog, state, { baseRevision: state.header.revision, ops, origin: { kind: "command", id: "test" } });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    state = result.value.state;
  };
  step({ op: "instantiate", ref: { kind: "assembly", id: "roof-module" }, anchor: [0, 0, 0], rotation: 1 }, { op: "instantiate", ref: { kind: "foldon", id: "P09" }, anchor: [6, 0, 0], rotation: 0 }, { op: "instantiate", ref: { kind: "foldon", id: "P09" }, anchor: [8, 0, 0], rotation: 0 });
  const [roof, , first, second] = state.entities.map((entity) => entity.id);
  if (roof === undefined || first === undefined || second === undefined) throw new Error("entities expected");
  step({ op: "detach", entity: roof }, { op: "store", entity: first, store: storeId("bin") }, { op: "store", entity: second, store: storeId("bin") });
  step({ op: "merge", entities: [first, second], into: { id: "P09", version: 1 } }, { op: "conserve" });
  return state;
}

test("a populated world round-trips through a snapshot to an equal state and hash", () => {
  const world = populated();
  const parsed = parseSnapshot(catalog, serializeSnapshot(world));
  if (!parsed.ok) throw new Error(parsed.error.map((i) => i.message).join("; "));
  expect(parsed.value).toEqual(world);
  expect(hashState(parsed.value)).toBe(hashState(world));
});

test("a snapshot whose entities were tampered into overlapping cells is rejected on load", () => {
  const world = populated();
  const neighbour = world.entities[1]?.owner;
  if (neighbour?.kind !== "placed") throw new Error("the second roof slope stays placed");
  const placedOwner = `{"anchor":[${neighbour.anchor.join(",")}],"kind":"placed","rotation":${neighbour.rotation}}`;
  const text = serializeSnapshot(world).replace(/\{"kind":"detached","transform":\{[^{}]*\}\}/, placedOwner);
  expect(text).not.toBe(serializeSnapshot(world));
  const parsed = parseSnapshot(catalog, text);
  expect(parsed.ok ? [] : codes(parsed.error)).toContain("cell-occupied");
});
