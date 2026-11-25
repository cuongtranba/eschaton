import { defaultCatalog, type Catalog } from "@eschaton/foldon";
import {
  applyPatch,
  checkInvariants,
  createWorld,
  findEntity,
  logicalTransform,
  storeId,
  type Entity,
  type EntityId,
  type Stamp,
  type WorldOp,
  type WorldState,
} from "@eschaton/world";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!defaultCatalog.ok) throw new Error("the default catalog must build");
  return defaultCatalog.value;
})();

const bin = storeId("bin");
const fragment = { id: "P09", version: 1 } as const;

function apply(state: WorldState, ...ops: WorldOp[]) {
  const result = applyPatch(catalog, state, { baseRevision: state.header.revision, ops, origin: { kind: "command", id: "test" } });
  if (result.ok) expect(checkInvariants(catalog, result.value.state)).toEqual([]);
  return result;
}

function commit(state: WorldState, ...ops: WorldOp[]): WorldState {
  const result = apply(state, ...ops);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value.state;
}

const issueCodes = (result: ReturnType<typeof apply>) => (result.ok ? [] : result.error.kind === "invalid" ? result.error.issues.map((i) => i.code) : []);

function fragmentsInBin(count: number): { state: WorldState; ids: readonly EntityId[] } {
  const created = createWorld({ catalog, seed: 9 });
  if (!created.ok) throw new Error("world must build");
  const placed = commit(
    created.value,
    ...Array.from({ length: count }, (_, i): WorldOp => ({ op: "instantiate", ref: { kind: "foldon", id: "P09" }, anchor: [i * 2, 0, 0], rotation: 0 })),
  );
  const ids = placed.entities.map((entity) => entity.id);
  return { state: commit(placed, ...ids.map((entity): WorldOp => ({ op: "store", entity, store: bin }))), ids };
}

const after = (a: Stamp, b: Stamp) => a.revision < b.revision || (a.revision === b.revision && a.ordinal < b.ordinal);

test("in closed mode a patch that creates material without a split is rejected", () => {
  const closed = commit(fragmentsInBin(2).state, { op: "conserve" });
  expect(issueCodes(apply(closed, { op: "instantiate", ref: { kind: "foldon", id: "P09" }, anchor: [9, 0, 9], rotation: 0 }))).toEqual(["conservation-violated"]);
});

test("closed conservation rejects destroying an entity", () => {
  const { state, ids } = fragmentsInBin(1);
  const [only] = ids;
  if (only === undefined) throw new Error("one fragment expected");
  expect(issueCodes(apply(commit(state, { op: "conserve" }), { op: "consume", entity: only }))).toEqual(["conservation-violated"]);
});

test("split children carry new ids and lineage to their parent; the parent becomes consumed", () => {
  const { state, ids } = fragmentsInBin(2);
  const merged = commit(commit(state, { op: "conserve" }), { op: "merge", entities: ids, into: fragment });
  const parent = merged.entities.at(-1);
  if (parent === undefined) throw new Error("merge must mint a result");
  const split = commit(merged, { op: "split", entity: parent.id, children: [{ definition: fragment, quantity: 1 }, { definition: fragment, quantity: 1 }] });
  const record = split.lineage.at(-1);
  expect(record?.kind === "split" ? [record.parent, record.children.length] : []).toEqual([parent.id, 2]);
  expect(findEntity(split, parent.id)?.owner).toEqual({ kind: "consumed", by: split.header.revision, reason: "split" });
});

test("a consumed entity cannot be attached", () => {
  const { state, ids } = fragmentsInBin(1);
  const [only] = ids;
  if (only === undefined) throw new Error("one fragment expected");
  const consumed = commit(state, { op: "consume", entity: only });
  expect(issueCodes(apply(consumed, { op: "attach", entity: only, anchor: [0, 0, 0], rotation: 0 }))).toEqual(["owner-invalid"]);
});

test("moving a fragment through inventory keeps its id and the material totals", () => {
  const { state, ids } = fragmentsInBin(1);
  const [only] = ids;
  if (only === undefined) throw new Error("one fragment expected");
  const closed = commit(state, { op: "conserve" });
  const back = commit(
    commit(closed, { op: "retrieve", entity: only, transform: logicalTransform([4, 2, 4], 1) }),
    { op: "attach", entity: only, anchor: [5, 0, 5], rotation: 2 },
  );
  expect(findEntity(back, only)?.owner).toEqual({ kind: "placed", anchor: [5, 0, 5], rotation: 2 });
  expect(back.conservation).toEqual(closed.conservation);
});

test("lineage stays acyclic and forward-only after a seeded sequence of random splits and merges", () => {
  let seed = 20261125;
  const random = (): number => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let state = commit(fragmentsInBin(4).state, { op: "conserve" });
  for (let step = 0; step < 30; step++) {
    const loose = state.entities.filter((entity: Entity) => entity.owner.kind === "inventory");
    const splittable = loose.filter((entity) => entity.quantity >= 2);
    const target = splittable[Math.floor(random() * splittable.length)];
    if (target !== undefined && (loose.length < 2 || random() < 0.5)) {
      const first = 1 + Math.floor(random() * (target.quantity - 1));
      state = commit(state, { op: "split", entity: target.id, children: [{ definition: fragment, quantity: first }, { definition: fragment, quantity: target.quantity - first }] });
    } else {
      const first = Math.floor(random() * loose.length);
      const second = (first + 1 + Math.floor(random() * (loose.length - 1))) % loose.length;
      const picked = [loose[first], loose[second]].flatMap((entity) => (entity === undefined ? [] : [entity.id]));
      state = commit(state, { op: "merge", entities: picked, into: fragment });
    }
  }
  const stamps = new Map(state.entities.map((entity) => [entity.id, entity.created]));
  const edges = state.lineage.flatMap((record) =>
    record.kind === "split"
      ? record.children.map((child): readonly [EntityId, EntityId] => [record.parent, child])
      : record.kind === "merged"
        ? record.parents.map((parent): readonly [EntityId, EntityId] => [parent, record.child])
        : [],
  );
  expect(edges.length).toBeGreaterThan(30);
  expect(edges.every(([from, to]) => {
    const [a, b] = [stamps.get(from), stamps.get(to)];
    return a !== undefined && b !== undefined && after(a, b);
  })).toBe(true);
  expect(state.conservation === "off" ? -1 : state.conservation.baseline["ash-paper"]).toBe(4);
});

test("an id is never minted again after its entity is consumed", () => {
  const { state, ids } = fragmentsInBin(1);
  const [only] = ids;
  if (only === undefined) throw new Error("one fragment expected");
  const later = commit(commit(state, { op: "consume", entity: only }), { op: "instantiate", ref: { kind: "foldon", id: "P09" }, anchor: [0, 0, 0], rotation: 0 });
  expect(later.entities.filter((entity) => entity.id === only)).toHaveLength(1);
  expect(later.entities.at(-1)?.id).not.toBe(only);
});
