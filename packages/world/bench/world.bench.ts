import { test } from "vitest";
import { defaultCatalog, presetCatalog, type Cell } from "@eschaton/foldon";
import {
  applyPatch,
  assemble,
  createWorld,
  hashState,
  replay,
  runSystem,
  storeId,
  windFold,
  type CommitRecord,
  type WorldOp,
  type WorldState,
} from "@eschaton/world";

const OPTIONS = { warmupIterations: 20, warmupTime: 300, time: 1500 } as const;

const catalog = presetCatalog.ok ? presetCatalog.value : undefined;
if (catalog === undefined || !defaultCatalog.ok) throw new Error("catalogs failed to build");

const origin = { kind: "command", id: "bench" } as const;

function commit(state: WorldState, ops: readonly WorldOp[]): { state: WorldState; record: CommitRecord } {
  if (catalog === undefined) throw new Error("catalog missing");
  const result = applyPatch(catalog, state, { baseRevision: state.header.revision, ops, origin });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const empty = (() => {
  const created = createWorld({ catalog, seed: 1 });
  if (!created.ok) throw new Error("world failed to build");
  return created.value;
})();

const box = (cell: Cell): WorldOp => ({ op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: cell, rotation: 0 });

function boxes(count: number): WorldState {
  const side = Math.ceil(Math.sqrt(count));
  const ops: WorldOp[] = [];
  for (let i = 0; i < count; i++) ops.push(box([i % side, 0, Math.floor(i / side)]));
  return commit(empty, ops).state;
}

const world100 = boxes(100);
const world1000 = boxes(1000);
const first100 = world100.entities[0]?.id;
const first1000 = world1000.entities[0]?.id;
if (first100 === undefined || first1000 === undefined) throw new Error("box worlds are empty");

const log: CommitRecord[] = [];
let logged = empty;
for (let i = 0; i < 50; i++) {
  const step = commit(logged, [box([i * 2, 0, 0])]);
  log.push(step.record);
  logged = step.state;
}

const bin = storeId("bin");
const towerParts = commit(empty, [{ op: "instantiate", ref: { kind: "assembly", id: "watchtower" }, anchor: [0, 0, 0], rotation: 0 }]).state;
const storedTower = commit(towerParts, towerParts.entities.map((entity): WorldOp => ({ op: "store", entity: entity.id, store: bin }))).state;

const garden = commit(empty, [
  { op: "instantiate", ref: { kind: "assembly", id: "roof-module" }, anchor: [0, 0, 0], rotation: 0 },
  { op: "instantiate", ref: { kind: "foldon", id: "leaf" }, anchor: [3, 0, 0], rotation: 0 },
]).state;

test("commit", async ({ bench }) => {
  await bench.compare(
    bench("commit instantiate watchtower (27 entities) into an empty world", () => {
      commit(empty, [{ op: "instantiate", ref: { kind: "assembly", id: "watchtower" }, anchor: [0, 0, 0], rotation: 0 }]);
    }),
    bench("commit one detach in a 100-entity world", () => {
      commit(world100, [{ op: "detach", entity: first100 }]);
    }),
    bench("commit one detach in a 1,000-entity world", () => {
      commit(world1000, [{ op: "detach", entity: first1000 }]);
    }),
    bench("hashState of a 1,000-entity world", () => {
      hashState(world1000);
    }),
    OPTIONS,
  );
});

test("replay and planning", async ({ bench }) => {
  await bench.compare(
    bench("replay a 50-commit log", () => {
      replay(catalog, empty, log);
    }),
    bench("assemble a watchtower from inventory (27 patches)", () => {
      assemble(catalog, storedTower, { target: { id: "watchtower" }, anchor: [10, 0, 0], rotation: 0, from: bin });
    }),
    bench("runSystem windFold over a roof-module and a leaf", () => {
      runSystem(catalog, garden, windFold, { wind: [0.1, 0, 0] });
    }),
    OPTIONS,
  );
});
