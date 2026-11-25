import { createCatalog, defaultCatalog, primitiveCatalog, type Catalog } from "@eschaton/foldon";
import {
  applyPatch,
  applyProposal,
  checkInvariants,
  createWorld,
  hashState,
  readRegion,
  replay,
  type CommitRecord,
  type Proposal,
  type Region,
  type WorldOp,
  type WorldState,
} from "@eschaton/world";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!defaultCatalog.ok) throw new Error("the default catalog must build");
  return defaultCatalog.value;
})();

const origin = { kind: "job", id: "solve-1" } as const;
const region: Region = { min: [10, 0, 10], max: [13, 2, 13] };
const box = (x: number, y: number, z: number): WorldOp => ({ op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [x, y, z], rotation: 0 });

const log: CommitRecord[] = [];
function commit(state: WorldState, ...ops: WorldOp[]): WorldState {
  const result = applyPatch(catalog, state, { baseRevision: state.header.revision, ops, origin: { kind: "command", id: "test" } });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  log.push(result.value.record);
  return result.value.state;
}

function start(): WorldState {
  log.length = 0;
  const created = createWorld({ catalog, seed: 8 });
  if (!created.ok) throw new Error("world must build");
  return commit(created.value, box(0, 0, 0), box(12, 0, 12));
}

const proposalAt = (state: WorldState, ...ops: WorldOp[]): Proposal => {
  const read = readRegion(catalog, state, region);
  return { region, read: { revision: read.revision, digest: read.digest }, ops, origin };
};

const verdict = (result: ReturnType<typeof applyProposal>): string =>
  result.ok ? `committed@${result.value.state.header.revision}` : result.error.kind === "invalid" ? result.error.issues.map((i) => i.code).join(",") : result.error.kind;

test("a proposal survives an unrelated commit elsewhere and commits at the new revision", () => {
  const base = start();
  const proposal = proposalAt(base, box(10, 0, 10));
  const later = commit(base, box(40, 0, 40));
  const result = applyProposal(catalog, later, proposal);
  expect(verdict(result)).toBe("committed@3");
  expect(result.ok ? checkInvariants(catalog, result.value.state) : ["rejected"]).toEqual([]);
});

test("a proposal is a conflict when an entity appears inside its region", () => {
  const base = start();
  const proposal = proposalAt(base, box(10, 0, 10));
  expect(verdict(applyProposal(catalog, commit(base, box(13, 0, 13)), proposal))).toBe("conflict");
});

test("a proposal is a conflict when an entity appears in the one-cell shell around its region", () => {
  const base = start();
  const proposal = proposalAt(base, box(10, 0, 10));
  expect(verdict(applyProposal(catalog, commit(base, box(14, 0, 12)), proposal))).toBe("conflict");
});

test("an entity two cells outside the region does not conflict", () => {
  const base = start();
  const proposal = proposalAt(base, box(10, 0, 10));
  expect(verdict(applyProposal(catalog, commit(base, box(15, 0, 12)), proposal))).toBe("committed@3");
});

test("a region that changed and changed back to the same entities is not a conflict", () => {
  const base = start();
  const pinned = readRegion(catalog, base, region).entities[0];
  if (pinned === undefined) throw new Error("the region must contain the pinned box");
  const proposal = proposalAt(base, box(10, 0, 10));
  const away = commit(base, { op: "detach", entity: pinned.id });
  expect(verdict(applyProposal(catalog, away, proposal))).toBe("conflict");
  const back = commit(away, { op: "attach", entity: pinned.id, anchor: pinned.anchor, rotation: pinned.rotation });
  expect(verdict(applyProposal(catalog, back, proposal))).toBe("committed@4");
});

test("replacing a piece in the region by an identical new piece is a conflict", () => {
  const base = start();
  const pinned = readRegion(catalog, base, region).entities[0];
  if (pinned === undefined) throw new Error("the region must contain the pinned box");
  const proposal = proposalAt(base, box(10, 0, 10));
  const replaced = commit(commit(base, { op: "consume", entity: pinned.id }), box(12, 0, 12));
  expect(verdict(applyProposal(catalog, replaced, proposal))).toBe("conflict");
});

test("closing conservation after the read is a conflict", () => {
  const base = start();
  const proposal = proposalAt(base, box(10, 0, 10));
  expect(verdict(applyProposal(catalog, commit(base, { op: "conserve" }), proposal))).toBe("conflict");
});

test("a proposal that writes outside its region is refused", () => {
  const base = start();
  expect(verdict(applyProposal(catalog, base, proposalAt(base, box(10, 0, 10), box(14, 0, 10))))).toBe("write-outside-region");
  const far = base.entities[0];
  if (far === undefined) throw new Error("the far box must exist");
  expect(verdict(applyProposal(catalog, base, proposalAt(base, { op: "consume", entity: far.id })))).toBe("write-outside-region");
});

test("a proposal applied with another catalog is refused", () => {
  const base = start();
  const other = createCatalog({ foldons: primitiveCatalog, assemblies: [] });
  if (!other.ok) throw new Error("primitive catalog must build");
  expect(verdict(applyProposal(other.value, base, proposalAt(base, box(10, 0, 10))))).toBe("catalog-mismatch");
});

test("a rebased proposal is replayed from the commit log to the same state hash", () => {
  const created = createWorld({ catalog, seed: 8 });
  if (!created.ok) throw new Error("world must build");
  const base = start();
  const proposal = proposalAt(base, box(10, 0, 10), box(10, 1, 10));
  const later = commit(base, box(40, 0, 40));
  const result = applyProposal(catalog, later, proposal);
  if (!result.ok) throw new Error(verdict(result));
  const replayed = replay(catalog, created.value, [...log, result.value.record]);
  expect(replayed.ok ? hashState(replayed.value) : "diverged").toBe(hashState(result.value.state));
});

test("a proposal with malformed ops is rejected as invalid instead of throwing", () => {
  const base = start();
  const read = readRegion(catalog, base, region);
  const malformed = [
    [{ op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [10, 0, 10], rotation: 7 }],
    [{ op: "instantiate", ref: { kind: "foldon", id: "P08" }, rotation: 0 }],
    [{ op: "instantiate", anchor: [10, 0, 10], rotation: 0 }],
    [{ op: "bogus" }],
    "not a list",
  ].map((ops) => {
    const proposal = JSON.parse(JSON.stringify({ region, read: { revision: read.revision, digest: read.digest }, ops, origin })) as Proposal;
    const result = applyProposal(catalog, base, proposal);
    return result.ok ? "committed" : result.error.kind;
  });
  expect(malformed).toEqual(["invalid", "invalid", "invalid", "invalid", "invalid"]);
});

test("a patch with an unknown op is rejected instead of committing an empty revision", () => {
  const base = start();
  const patch = JSON.parse(JSON.stringify({ baseRevision: base.header.revision, ops: [{ op: "bogus" }], origin })) as Parameters<typeof applyPatch>[2];
  const result = applyPatch(catalog, base, patch);
  expect(result.ok ? "committed" : result.error.kind).toBe("invalid");
});
