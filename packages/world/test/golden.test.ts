import { assemblyCatalog, canonicalJson, createCatalog, fnv1a64, moduleContracts, presetAssemblies, presetFoldons, primitiveCatalog, type Catalog } from "@eschaton/foldon";
import {
  applyPatch,
  checkInvariants,
  createWorld,
  hashState,
  parseSnapshot,
  runSystem,
  serializeSnapshot,
  storeId,
  windFold,
  type Patch,
  type WorldOp,
  type WorldState,
} from "@eschaton/world";
import { expect, test } from "vitest";

/** The exact catalog content the recorded hashes were made with: a catalog change changes every state hash. */
const catalog: Catalog = (() => {
  const built = createCatalog({
    foldons: [...primitiveCatalog, ...presetFoldons.filter((foldon) => foldon.id === "leaf")],
    assemblies: [...assemblyCatalog, ...presetAssemblies.filter((recipe) => recipe.id === "column-3" || recipe.id === "l-block")],
    contracts: moduleContracts,
  });
  if (!built.ok) throw new Error("the pinned catalog must build");
  return built.value;
})();

const origin = { kind: "command", id: "golden" } as const;

function emptyWorld(seed: number): WorldState {
  const created = createWorld({ catalog, seed });
  if (!created.ok) throw new Error("world must build");
  return created.value;
}

// Recorded before the commit path was optimised (W3). Re-recorded once in Phase 3, when stored recipe numbers were
// rounded to be the same on every engine: that changed the catalog fingerprint, which every state hash includes.
test("a fixed history has the recorded state hashes", () => {
  let state = emptyWorld(77);
  const hashes: string[] = [];
  const step = (...ops: WorldOp[]): void => {
    const result = applyPatch(catalog, state, { baseRevision: state.header.revision, ops, origin });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    state = result.value.state;
    hashes.push(result.value.record.stateHash);
  };
  step(
    { op: "instantiate", ref: { kind: "assembly", id: "watchtower" }, anchor: [0, 0, 0], rotation: 1 },
    { op: "instantiate", ref: { kind: "assembly", id: "roof-house" }, anchor: [6, 0, 0], rotation: 0 },
    { op: "instantiate", ref: { kind: "foldon", id: "leaf" }, anchor: [12, 0, 0], rotation: 2 },
  );
  const [a, b, c] = state.entities.map((entity) => entity.id);
  if (a === undefined || b === undefined || c === undefined) throw new Error("entities expected");
  step({ op: "detach", entity: a }, { op: "store", entity: b, store: storeId("bin") });
  step({ op: "attach", entity: a, anchor: [20, 0, 0], rotation: 3 }, { op: "consume", entity: c });
  const wind = runSystem(catalog, state, windFold, { wind: [0.05, 0, 0] });
  if (!wind.ok) throw new Error("wind must commit");
  state = wind.value.state;
  hashes.push(wind.value.record.stateHash);
  step({ op: "conserve" });
  expect(hashes).toEqual(["ccf6bbfbd539d9ef", "003e6f72c33fd825", "8f4d495dea11f735", "a17a84dc0397003b", "68a3fbdb7ab3a443"]);
  expect([hashState(state), fnv1a64(serializeSnapshot(state)), fnv1a64(canonicalJson(state))]).toEqual(["68a3fbdb7ab3a443", "68a3fbdb7ab3a443", "68a3fbdb7ab3a443"]);
});

function randomPatches(seed: number): (state: WorldState) => Patch {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const pick = <T>(items: readonly T[]): T | undefined => items[next() % Math.max(1, items.length)];
  const refs = [
    { kind: "foldon", id: "P08" },
    { kind: "foldon", id: "P03" },
    { kind: "foldon", id: "P07" },
    { kind: "foldon", id: "leaf" },
    { kind: "assembly", id: "roof-module" },
    { kind: "assembly", id: "l-block" },
    { kind: "assembly", id: "column-3" },
  ] as const;
  return (state) => {
    const cell = (): readonly [number, number, number] => [next() % 7, next() % 3, next() % 7];
    const rotation = (): 0 | 1 | 2 | 3 => (next() % 4 === 0 ? 0 : next() % 4 === 1 ? 1 : next() % 2 === 0 ? 2 : 3);
    const ops: WorldOp[] = [];
    const size = 1 + (next() % 3);
    for (let i = 0; i < size; i++) {
      const entity = pick(state.entities);
      const roll = next() % 10;
      const ref = pick(refs);
      if (roll < 4 || entity === undefined) {
        if (ref !== undefined) ops.push({ op: "instantiate", ref, anchor: cell(), rotation: rotation() });
      } else if (roll < 6) ops.push({ op: "detach", entity: entity.id });
      else if (roll < 8) ops.push({ op: "attach", entity: entity.id, anchor: cell(), rotation: rotation() });
      else if (roll < 9) ops.push({ op: "store", entity: entity.id, store: storeId("bin") });
      else ops.push({ op: "consume", entity: entity.id });
    }
    return { baseRevision: state.header.revision, ops, origin };
  };
}

test("the incremental commit agrees with the full audit on a seeded sequence of valid and invalid patches", () => {
  const outcomes = { committed: 0, rejected: 0 };
  for (const seed of [1, 2, 3, 4]) {
    let state = emptyWorld(seed);
    const patchFor = randomPatches(seed * 7919);
    for (let i = 0; i < 150; i++) {
      const patch = patchFor(state);
      const fast = applyPatch(catalog, state, patch);
      const full = applyPatch(catalog, state, patch, { audit: "full" });
      expect(fast).toEqual(full);
      if (!fast.ok) {
        outcomes.rejected += 1;
        continue;
      }
      outcomes.committed += 1;
      state = fast.value.state;
      expect(checkInvariants(catalog, state)).toEqual([]);
      expect(hashState(state)).toBe(fnv1a64(canonicalJson(state)));
    }
  }
  expect(outcomes.committed).toBeGreaterThan(100);
  expect(outcomes.rejected).toBeGreaterThan(100);
});

test("a state loaded from a snapshot commits exactly like the live state it was saved from", () => {
  let state = emptyWorld(9);
  const patchFor = randomPatches(31337);
  for (let i = 0; i < 40; i++) {
    const result = applyPatch(catalog, state, patchFor(state));
    if (result.ok) state = result.value.state;
  }
  const loaded = parseSnapshot(catalog, serializeSnapshot(state));
  if (!loaded.ok) throw new Error("snapshot must load");
  const patch = patchFor(state);
  expect(applyPatch(catalog, loaded.value, patch)).toEqual(applyPatch(catalog, state, patch));
});
