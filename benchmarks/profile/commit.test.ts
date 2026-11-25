import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import { presetCatalog } from "@eschaton/foldon";
import { compileTiles, prepareRegion, proposalOf, solve } from "@eschaton/wave";
import { applyPatch, applyProposal, createWorld, hashState, type Proposal, type WorldOp, type WorldState } from "@eschaton/world";
import { test } from "vitest";

/**
 * Workload for the commit profile (W3). Run through `pnpm profile:commit`, which adds --cpu-prof; the profile is
 * summarised by benchmarks/src/profileSummary.ts. Sizes come from PROFILE_ENTITIES (default 10000).
 */
if (!presetCatalog.ok) throw new Error("catalog failed to build");
const catalog = presetCatalog.value;
const count = Number(process.env.PROFILE_ENTITIES ?? 10_000);
const rounds = Number(process.env.PROFILE_ROUNDS ?? 30);

function grid(entities: number): WorldState {
  const created = createWorld({ catalog, seed: 1 });
  if (!created.ok) throw new Error("world failed to build");
  const side = Math.ceil(Math.sqrt(entities));
  const ops: WorldOp[] = [];
  for (let i = 0; i < entities; i++) ops.push({ op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [100 + (i % side), 0, 100 + Math.floor(i / side)], rotation: 0 });
  const result = applyPatch(catalog, created.value, { baseRevision: 0, ops, origin: { kind: "command", id: "profile" } });
  if (!result.ok) throw new Error("grid failed to commit");
  return result.value.state;
}

function waveProposal(state: WorldState): Proposal {
  const tiles = compileTiles(catalog, [
    { ref: { kind: "foldon", id: "P08" }, weight: 6 },
    { ref: { kind: "foldon", id: "P03" }, weight: 3 },
    { ref: { kind: "assembly", id: "l-block" }, weight: 2 },
    { ref: { kind: "assembly", id: "column-3" }, weight: 2 },
  ]);
  const job = prepareRegion(catalog, state, { region: { min: [0, 0, 0], max: [7, 3, 7] }, seed: 1, airWeight: 8, ground: { y: 0, profile: "ground" }, budget: { maxNodes: 100_000, maxBacktracks: 10_000 } });
  if (!tiles.ok || !job.ok) throw new Error("wave setup failed");
  const outcome = solve(tiles.value, job.value.problem);
  if (outcome.kind !== "solved") throw new Error("wave solve failed");
  return proposalOf(job.value, outcome, { kind: "job", id: "profile" });
}

const quantile = (values: readonly number[], q: number): number => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(q * values.length) - 1)] ?? 0;
const line = (name: string, values: readonly number[]): string =>
  `${name}: n=${values.length} p50=${quantile(values, 0.5).toFixed(2)} p95=${quantile(values, 0.95).toFixed(2)} p99=${quantile(values, 0.99).toFixed(2)} ms`;

test("commit workload", { timeout: 900_000 }, () => {
  const state = grid(count);
  const proposal = waveProposal(state);
  const middle = state.entities[Math.floor(state.entities.length / 2)];
  if (middle === undefined) throw new Error("grid is empty");
  const timings: Record<string, number[]> = { detach: [], proposal: [], hash: [] };
  const heapBefore = process.memoryUsage().heapUsed;
  const kept: WorldState[] = [];
  for (let round = 0; round < rounds; round++) {
    let start = performance.now();
    const detached = applyPatch(catalog, state, { baseRevision: state.header.revision, ops: [{ op: "detach", entity: middle.id }], origin: { kind: "command", id: "profile" } });
    timings.detach?.push(performance.now() - start);
    start = performance.now();
    const waved = applyProposal(catalog, state, proposal);
    timings.proposal?.push(performance.now() - start);
    start = performance.now();
    hashState(state);
    timings.hash?.push(performance.now() - start);
    if (!detached.ok || !waved.ok) throw new Error("profile commit was rejected");
    if (round < 10) kept.push(detached.value.state);
  }
  const heapPerState = (process.memoryUsage().heapUsed - heapBefore) / Math.max(1, kept.length) / 1024 / 1024;
  const report = [
    `entities=${count} rounds=${rounds} load=${os.loadavg().map((value) => value.toFixed(1)).join("/")}`,
    line("one detach", timings.detach ?? []),
    line("apply 8x4x8 wave proposal", timings.proposal ?? []),
    line("hashState", timings.hash ?? []),
    `heap growth per retained state (10 kept, no forced GC): ${heapPerState.toFixed(2)} MiB`,
  ].join("\n");
  mkdirSync("runs/profile", { recursive: true });
  writeFileSync(`runs/profile/commit-${count}.txt`, `${report}\n`);
});
