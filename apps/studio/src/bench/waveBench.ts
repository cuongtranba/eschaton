import { foldonId, presetCatalog, type Cell } from "@eschaton/foldon";
import { prepareRegion, proposalOf, type JobOutcome, type JobTiming, type TileSpec, type WaveProblem } from "@eschaton/wave";
import { applyPatch, applyProposal, createWorld, type WorldOp, type WorldState } from "@eschaton/world";
import { createWaveClient } from "../worker/client";
import { WAVE_TILES } from "../lab/world/session";

/**
 * Benchmark page for the production solver path: the same worker client, worker entry and bundle the Studio uses.
 * It only measures; the Playwright bench spec drives it and writes the evidence.
 */
export type RegionSample = Readonly<{
  seed: number;
  outcome: string;
  placements: number;
  nodes: number;
  backtracks: number;
  prepareMs: number;
  roundTripMs: number;
  compileMs: number;
  solveMs: number;
  transportMs: number;
  commitMs: number;
  endToEndMs: number;
  slices: number;
  tilesCached: boolean;
  committed: boolean;
}>;

export type ProblemSample = Readonly<{ seed: number; outcome: string; nodes: number; backtracks: number; roundTripMs: number; solveMs: number; compileMs: number }>;

export type WaveBench = Readonly<{
  region: (size: Cell, seed: number, pins: boolean) => Promise<RegionSample>;
  problem: (kind: "packing" | "unsat-search" | "unsat-propagation", seed: number) => Promise<ProblemSample>;
  restartWorker: () => void;
}>;

if (!presetCatalog.ok) throw new Error("the preset catalog failed to build");
const catalog = presetCatalog.value;

function world(pins: boolean): WorldState {
  const created = createWorld({ catalog, seed: 20_261_124 });
  if (!created.ok) throw new Error("world failed to build");
  if (!pins) return created.value;
  const ops: WorldOp[] = [
    { op: "instantiate", ref: { kind: "assembly", id: "roof-module" }, anchor: [2, 0, 3], rotation: 0 },
    { op: "instantiate", ref: { kind: "foldon", id: "leaf" }, anchor: [5, 0, 3], rotation: 0 },
    { op: "instantiate", ref: { kind: "foldon", id: "P08" }, anchor: [7, 0, 3], rotation: 0 },
    { op: "instantiate", ref: { kind: "assembly", id: "watchtower" }, anchor: [16, 0, 6], rotation: 0 },
  ];
  const committed = applyPatch(catalog, created.value, { baseRevision: 0, ops, origin: { kind: "command", id: "bench" } });
  if (!committed.ok) throw new Error("bench world failed to commit");
  return committed.value.state;
}

const worlds = { pinned: world(true), empty: world(false) };
let client = createWaveClient();
let job = 0;

const solveInWorker = (tiles: readonly TileSpec[], problem: WaveProblem): Promise<Readonly<{ outcome: JobOutcome; timing: JobTiming }>> =>
  new Promise((resolve) => {
    job += 1;
    client.solve(`bench-${job}`, catalog, tiles, problem, { onProgress: () => undefined, onDone: (outcome, timing) => { resolve({ outcome, timing }); } });
  });

const statsOf = (outcome: JobOutcome): Readonly<{ nodes: number; backtracks: number }> =>
  "stats" in outcome ? { nodes: outcome.stats.nodes, backtracks: outcome.stats.backtracks } : { nodes: 0, backtracks: 0 };

async function region(size: Cell, seed: number, pins: boolean): Promise<RegionSample> {
  const state = pins ? worlds.pinned : worlds.empty;
  const start = performance.now();
  const prepared = prepareRegion(catalog, state, {
    region: { min: [0, 0, 0], max: [size[0] - 1, size[1] - 1, size[2] - 1] },
    seed,
    airWeight: 8,
    ground: { y: 0, profile: "ground" },
    budget: { maxNodes: 200_000, maxBacktracks: 20_000 },
  });
  if (!prepared.ok) throw new Error(prepared.error.join("; "));
  const prepareEnd = performance.now();
  const { outcome, timing } = await solveInWorker(WAVE_TILES, prepared.value.problem);
  const solveEnd = performance.now();
  let committed = false;
  if (outcome.kind === "solved") committed = applyProposal(catalog, state, proposalOf(prepared.value, outcome, { kind: "job", id: "bench" })).ok;
  const end = performance.now();
  const roundTripMs = solveEnd - prepareEnd;
  return {
    seed,
    outcome: outcome.kind,
    placements: outcome.kind === "solved" ? outcome.placements.length : 0,
    ...statsOf(outcome),
    prepareMs: prepareEnd - start,
    roundTripMs,
    compileMs: timing.compileMs,
    solveMs: timing.solveMs,
    transportMs: roundTripMs - timing.compileMs - timing.solveMs,
    commitMs: end - solveEnd,
    endToEndMs: end - start,
    slices: timing.slices,
    tilesCached: timing.tilesCached,
    committed,
  };
}

const base = catalog.foldon(foldonId("P08"))?.sockets.find((socket) => socket.face === "-y");

function hardProblem(kind: "packing" | "unsat-search" | "unsat-propagation", seed: number): Readonly<{ tiles: readonly TileSpec[]; problem: WaveProblem }> {
  if (base === undefined) throw new Error("P08 bottom socket missing");
  const roofed = (size: Cell): WaveProblem => ({
    size,
    seed,
    airWeight: 1,
    ground: { profile: "ground" },
    boundary: Array.from({ length: size[0] * size[2] }, (_, i) => ({ cell: [i % size[0], size[1] - 1, Math.floor(i / size[0])] as const, face: "+y" as const, socket: base })),
    budget: { maxNodes: 200_000, maxBacktracks: 20_000 },
  });
  const packers: readonly TileSpec[] = [
    { ref: { kind: "assembly", id: "l-block" }, weight: 3 },
    { ref: { kind: "assembly", id: "column-3" }, weight: 1 },
  ];
  switch (kind) {
    case "packing":
      return { tiles: packers, problem: roofed([9, 3, 9]) };
    case "unsat-search":
      return { tiles: [{ ref: { kind: "assembly", id: "l-block" }, weight: 1 }], problem: roofed([4, 1, 4]) };
    case "unsat-propagation":
      return { tiles: [{ ref: { kind: "foldon", id: "P03" }, weight: 1 }], problem: roofed([8, 2, 8]) };
  }
}

async function problem(kind: "packing" | "unsat-search" | "unsat-propagation", seed: number): Promise<ProblemSample> {
  const { tiles, problem: input } = hardProblem(kind, seed);
  const start = performance.now();
  const { outcome, timing } = await solveInWorker(tiles, input);
  return { seed, outcome: outcome.kind, ...statsOf(outcome), roundTripMs: performance.now() - start, solveMs: timing.solveMs, compileMs: timing.compileMs };
}

const bench: WaveBench = {
  region,
  problem,
  restartWorker: () => {
    client.dispose();
    client = createWaveClient();
  },
};
Reflect.set(window, "eschatonWaveBench", bench);
const status = document.getElementById("status");
if (status !== null) status.textContent = "ready";
