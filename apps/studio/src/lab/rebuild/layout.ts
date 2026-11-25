import type { Catalog, Cell, Rotation } from "@eschaton/foldon";
import {
  applyPatch,
  createWorld,
  storeId,
  type CommitRecord,
  type ContinuousTransform,
  type WorldOp,
  type WorldState,
} from "@eschaton/world";
import { makeCorridor } from "../composition/district";
import { createRandom, type Random } from "../composition/random";

export const REBUILD_CELL_SIZE = 4.4;

const STREAM = { corridor: 1, towers: 2, houses: 3, debris: 4 } as const;
const STAGING_Y = 60;
const DEBRIS = storeId("rebuild-debris");

export type RebuildCandidate = Readonly<{ group: string; ops: number; reason: string }>;
export type RebuildMove = Readonly<{ group: string; cells: number }>;

export type RebuildReport = Readonly<{
  cellSize: number;
  logical: number;
  fragments: number;
  commits: number;
  rejected: readonly RebuildCandidate[];
  moved: readonly RebuildMove[];
  notReproduced: readonly string[];
}>;

export type Rebuild = Readonly<{ initial: WorldState; state: WorldState; log: readonly CommitRecord[]; report: RebuildReport }>;

const toCell = (units: number): number => Math.round(units / REBUILD_CELL_SIZE);

const quarterTurn = (yaw: number): Rotation => {
  const turns = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  return turns === 1 ? 1 : turns === 2 ? 2 : turns === 3 ? 3 : 0;
};

const box = (cell: Cell): WorldOp => ({ op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: cell, rotation: 0 });

function column(x: number, z: number, width: number, height: number): readonly WorldOp[] {
  const ops: WorldOp[] = [];
  for (let y = 0; y < height; y++) for (let dz = 0; dz < width; dz++) for (let dx = 0; dx < width; dx++) ops.push(box([x + dx, y, z + dz]));
  return ops;
}

function yawTilt(random: Random, tilt: number): ContinuousTransform["rotation"] {
  const yaw = random.range(0, Math.PI * 2);
  const pitch = random.range(-tilt, tilt);
  const [cy, sy, cp, sp] = [Math.cos(yaw / 2), Math.sin(yaw / 2), Math.cos(pitch / 2), Math.sin(pitch / 2)];
  return [cy * sp, sy * cp, -sy * sp, cy * cp];
}

type Builder = { state: WorldState; log: CommitRecord[]; rejected: RebuildCandidate[]; moved: RebuildMove[]; commits: number };

function commit(catalog: Catalog, builder: Builder, group: string, ops: readonly WorldOp[]): boolean {
  if (ops.length === 0) return true;
  const result = applyPatch(catalog, builder.state, { baseRevision: builder.state.header.revision, ops, origin: { kind: "job", id: `rebuild:${group}` } });
  if (!result.ok) {
    const reason = result.error.kind === "invalid" ? (result.error.issues[0]?.code ?? "invalid") : "stale";
    builder.rejected.push({ group, ops: ops.length, reason });
    return false;
  }
  builder.state = result.value.state;
  builder.log.push(result.value.record);
  builder.commits += 1;
  return true;
}

const SEARCH_RADIUS = 4;

const ring = (radius: number): readonly (readonly [number, number])[] => {
  const offsets: (readonly [number, number])[] = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === radius) offsets.push([dx, dz]);
  }
  return offsets;
};

function tryOps(catalog: Catalog, builder: Builder, ops: readonly WorldOp[], group: string): boolean {
  const result = applyPatch(catalog, builder.state, { baseRevision: builder.state.header.revision, ops, origin: { kind: "job", id: `rebuild:${group}` } });
  if (!result.ok) return false;
  builder.state = result.value.state;
  builder.log.push(result.value.record);
  builder.commits += 1;
  return true;
}

function placeNear(catalog: Catalog, builder: Builder, group: string, opsAt: (dx: number, dz: number) => readonly WorldOp[]): void {
  for (let radius = 0; radius <= SEARCH_RADIUS; radius++) {
    for (const [dx, dz] of ring(radius)) {
      if (tryOps(catalog, builder, opsAt(dx, dz), group)) {
        if (radius > 0) builder.moved.push({ group, cells: radius });
        return;
      }
    }
  }
  commit(catalog, builder, group, opsAt(0, 0));
}

export function buildRebuild(catalog: Catalog, seed: number): Rebuild | string {
  const created = createWorld({ catalog, seed });
  if (!created.ok) return created.error.map((issue) => issue.message).join("; ");
  const builder: Builder = { state: created.value, log: [], rejected: [], moved: [], commits: 0 };
  const rng = (stream: number) => createRandom(seed, stream);

  const corridor = makeCorridor(rng(STREAM.corridor));
  const strip = new Map<string, Cell>();
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const centre = corridor.centre(t);
    const half = Math.max(1, Math.round(corridor.width(t) / REBUILD_CELL_SIZE / 2));
    const [cx, cz] = [toCell(centre[0]), toCell(centre[2])];
    for (let dx = -half; dx < half; dx++) strip.set(`${cx + dx},${cz}`, [cx + dx, 0, cz]);
  }
  commit(catalog, builder, "corridor", [...strip.values()].map((cell): WorldOp => ({ op: "instantiate", ref: { kind: "foldon", id: "P01" }, anchor: cell, rotation: 0 })));

  const towers = rng(STREAM.towers);
  const hero: Cell = [toCell(-34 + towers.range(-4, 4)), 0, toCell(-42)];
  const heroTurn = quarterTurn(towers.range(-0.15, 0.15));
  placeNear(catalog, builder, "hero-watchtower", (dx, dz) => [{ op: "instantiate", ref: { kind: "assembly", id: "watchtower" }, anchor: [hero[0] + dx, 0, hero[2] + dz], rotation: heroTurn }]);
  for (const ruin of [{ x: -20, z: -70 }, { x: -64, z: -78 }, { x: -34, z: -105 }]) {
    const height = Math.max(2, toCell(towers.range(3.4, 6.6) * 6.4));
    const [x, z] = [toCell(ruin.x + towers.range(-3, 3)), toCell(ruin.z)];
    placeNear(catalog, builder, "ruined-tower", (dx, dz) => column(x + dx, z + dz, 2, height));
  }
  const blocks = [[-16, -52, 9, 38], [-30, -62, 12, 56], [-58, -56, 10, 44], [-76, -66, 14, 62], [-42, -84, 12, 50], [-8, -88, 8, 34], [-88, -92, 14, 48], [-24, -118, 14, 40]] as const;
  for (const [x, z, width, height] of blocks) {
    const [cx, cz, w, h] = [toCell(x + towers.range(-3, 3)), toCell(z), Math.max(1, toCell(width)), Math.max(2, toCell(height * towers.range(0.8, 1.15)))];
    placeNear(catalog, builder, "slab-block", (dx, dz) => column(cx + dx, cz + dz, w, h));
  }

  const houses = rng(STREAM.houses);
  for (const stop of [{ t: 0.36, side: 1 }, { t: 0.46, side: -1 }, { t: 0.55, side: 1 }, { t: 0.64, side: -1 }, { t: 0.74, side: 1 }, { t: 0.82, side: -1 }]) {
    const t = stop.t + houses.range(-0.02, 0.02);
    const tangent = corridor.tangent(t);
    const normal = [tangent[2] * stop.side, -tangent[0] * stop.side] as const;
    const offset = corridor.width(t) / 2 + houses.range(12, 20);
    const centre = corridor.centre(t);
    const anchor: Cell = [toCell(centre[0] + normal[0] * offset) - 2, 0, toCell(centre[2] + normal[1] * offset) - 2];
    const turn = quarterTurn(Math.atan2(normal[0], normal[1]));
    placeNear(catalog, builder, "roof-house", (dx, dz) => [{ op: "instantiate", ref: { kind: "assembly", id: "roof-house" }, anchor: [anchor[0] + dx, 0, anchor[2] + dz], rotation: turn }]);
  }

  const debris = rng(STREAM.debris);
  const gateTurn = quarterTurn(-0.5 + debris.range(-0.2, 0.2));
  placeNear(catalog, builder, "ruined-gate", (dx, dz) => [{ op: "instantiate", ref: { kind: "assembly", id: "ruined-gate" }, anchor: [toCell(44) + dx, 0, toCell(20) + dz], rotation: gateTurn }]);
  for (const [x, z] of [[-12, 20], [-24, 8], [58, 24], [66, 8]] as const) {
    placeNear(catalog, builder, "mound", (dx, dz) => [{ op: "instantiate", ref: { kind: "foldon", id: "P04" }, anchor: [toCell(x) + dx, 0, toCell(z) + dz], rotation: 0 }]);
  }

  const pieces = [...Array.from({ length: 22 }, () => "P09"), ...Array.from({ length: 12 }, () => "P02")];
  const staged = commit(
    catalog,
    builder,
    "debris-staging",
    pieces.map((id, i): WorldOp => ({ op: "instantiate", ref: { kind: "foldon", id }, anchor: [i * 2, STAGING_Y, 0], rotation: 0 })),
  );
  if (staged) {
    const fragments = builder.state.entities.filter((entity) => entity.owner.kind === "placed" && entity.owner.anchor[1] === STAGING_Y).map((entity) => entity.id);
    commit(catalog, builder, "debris-store", fragments.map((entity): WorldOp => ({ op: "store", entity, store: DEBRIS })));
    commit(
      catalog,
      builder,
      "debris-scatter",
      fragments.map((entity): WorldOp => {
        const size = debris.range(2.5, 6.5) / REBUILD_CELL_SIZE;
        const position: Cell = [debris.range(-14, 54) / REBUILD_CELL_SIZE, 0, debris.range(0, 26) / REBUILD_CELL_SIZE];
        return { op: "retrieve", entity, transform: { position, rotation: yawTilt(debris, 0.45), scale: size } };
      }),
    );
  }

  const live = builder.state.entities.filter((entity) => entity.owner.kind !== "consumed");
  return {
    initial: created.value,
    state: builder.state,
    log: builder.log,
    report: {
      cellSize: REBUILD_CELL_SIZE,
      logical: live.filter((entity) => entity.owner.kind === "placed").length,
      fragments: live.filter((entity) => entity.owner.kind === "detached").length,
      commits: builder.commits,
      rejected: builder.rejected,
      moved: builder.moved,
      notReproduced: [
        "per-instance non-uniform stretch (towers 4.4x7.4, slab blocks, ground slabs): only one uniform cell size exists",
        "the barren tree and the 16 free-angle debris beams: beams need non-uniform scale, which neither placements nor fragments carry",
        "the 620-unit ground slabs and the distant skyline: backdrop candidates, not rebuilt",
        "free yaw on towers and houses: snapped to quarter turns",
      ],
    },
  };
}
