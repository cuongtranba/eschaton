import { defaultCatalog, getPrimitive, foldonId, placeSockets, type Catalog, type Vec3 } from "@eschaton/foldon";
import {
  applyPatch,
  cellOccupant,
  checkInvariants,
  createWorld,
  findEntity,
  type ContinuousTransform,
  type Entity,
  type WorldOp,
  type WorldState,
} from "@eschaton/world";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!defaultCatalog.ok) throw new Error("the default catalog must build");
  return defaultCatalog.value;
})();

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

const roofWorld = (): WorldState => {
  const created = createWorld({ catalog, seed: 5 });
  if (!created.ok) throw new Error("world must build");
  return commit(created.value, { op: "instantiate", ref: { kind: "assembly", id: "roof-module" }, anchor: [0, 0, 0], rotation: 1 });
};

const roofPiece = (state: WorldState): Entity => {
  const piece = state.entities.find((entity) => entity.definition.id === "P03");
  if (piece === undefined) throw new Error("roof-module must contain a P03 roof piece");
  return piece;
};

const touches = (state: WorldState, entity: Entity) => state.bonds.filter((b) => b.a.entity === entity.id || b.b.entity === entity.id);

function apply3(t: ContinuousTransform, p: Vec3): Vec3 {
  const [x, y, z, w] = t.rotation;
  const u: Vec3 = [y * p[2] - z * p[1], z * p[0] - x * p[2], x * p[1] - y * p[0]];
  const uu: Vec3 = [y * u[2] - z * u[1], z * u[0] - x * u[2], x * u[1] - y * u[0]];
  const r = [0, 1, 2].map((i) => (p[i] ?? 0) + 2 * (w * (u[i] ?? 0) + (uu[i] ?? 0)));
  return [(r[0] ?? 0) * t.scale + t.position[0], (r[1] ?? 0) * t.scale + t.position[1], (r[2] ?? 0) * t.scale + t.position[2]];
}

test("instantiating an assembly bonds its touching parts", () => {
  const world = roofWorld();
  expect(world.bonds.length).toBeGreaterThan(0);
  expect(world.entities.every((entity) => touches(world, entity).length > 0)).toBe(true);
});

test("detaching a placed roof frees its cells and keeps its entity id", () => {
  const world = roofWorld();
  const roof = roofPiece(world);
  if (roof.owner.kind !== "placed") throw new Error("roof starts placed");
  const anchor = roof.owner.anchor;
  const detached = commit(world, { op: "detach", entity: roof.id });
  expect(findEntity(detached, roof.id)?.owner.kind).toBe("detached");
  expect(cellOccupant(catalog, detached, anchor)).toBeUndefined();
});

test("attach creates a bond for each mated socket pair and detach removes exactly those", () => {
  const world = roofWorld();
  const roof = roofPiece(world);
  if (roof.owner.kind !== "placed") throw new Error("roof starts placed");
  const detached = commit(world, { op: "detach", entity: roof.id });
  expect(touches(detached, roof)).toEqual([]);
  expect(detached.bonds).toEqual(world.bonds.filter((b) => !touches(world, roof).includes(b)));
  const reattached = commit(detached, { op: "attach", entity: roof.id, anchor: roof.owner.anchor, rotation: roof.owner.rotation });
  expect(reattached.bonds).toEqual(world.bonds);
  expect(findEntity(reattached, roof.id)?.owner).toEqual(roof.owner);
});

test("re-attaching a fragment where its sockets do not mate is rejected and the fragment stays detached", () => {
  const world = commit(roofWorld(), { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [8, 0, 0], rotation: 0 });
  const roof = roofPiece(world);
  const detached = commit(world, { op: "detach", entity: roof.id });
  const result = apply(detached, { op: "attach", entity: roof.id, anchor: [9, 0, 0], rotation: 0 });
  expect(result.ok ? [] : result.error.kind === "invalid" ? result.error.issues.map((i) => i.code) : []).toEqual(["socket-incompatible"]);
  expect(findEntity(detached, roof.id)?.owner.kind).toBe("detached");
});

test("a fragment detached from a placed entity starts at that entity's logical transform", () => {
  const roofLike = getPrimitive(foldonId("P03"));
  if (roofLike === undefined) throw new Error("P03 must exist");
  const world = commit(roofWorld(), { op: "instantiate", ref: { kind: "foldon", id: "P03" }, anchor: [8, 0, 3], rotation: 3 });
  const piece = world.entities.at(-1);
  if (piece === undefined) throw new Error("the new piece must exist");
  const fragment = findEntity(commit(world, { op: "detach", entity: piece.id }), piece.id);
  if (fragment?.owner.kind !== "detached") throw new Error("the piece must be detached");
  const { transform } = fragment.owner;
  const round = (v: Vec3) => v.map((n) => Math.round(n * 1e9) / 1e9);
  const moved = roofLike.sockets.map((socket) => round(apply3(transform, socket.position)));
  const placed = placeSockets(roofLike, { anchor: [8, 0, 3], rotation: 3 }).map((socket) => round(socket.position));
  expect(moved).toEqual(placed);
});

test("attaching an entity that is already placed is rejected", () => {
  const world = roofWorld();
  const roof = roofPiece(world);
  const result = apply(world, { op: "attach", entity: roof.id, anchor: [20, 0, 20], rotation: 0 });
  expect(result.ok ? [] : result.error.kind === "invalid" ? result.error.issues.map((i) => i.code) : []).toEqual(["owner-invalid"]);
});
