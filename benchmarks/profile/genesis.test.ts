import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import { presetCatalog } from "@eschaton/foldon";
import { continueFrom, generateDistrict, lastDistrict, settleDistrict, type DistrictOutcome, type DistrictRequest } from "@eschaton/genesis";
import { applyProposal, checkInvariants, createWorld, hashState, parseSnapshot, serializeSnapshot, type WorldState } from "@eschaton/world";
import { test } from "vitest";

/**
 * District workload for Phase 3 (owner W7): a fixed-seed corpus of single districts, and a chain of districts that
 * each continue the previous one to the east. Run through `pnpm --filter @eschaton/benchmarks profile:genesis`.
 * Everything runs on the main thread of Node; the Studio runs generation in a worker, which adds a snapshot transfer
 * (measured here as serialize + parse) and scheduling.
 */
if (!presetCatalog.ok) throw new Error("catalog failed to build");
const catalog = presetCatalog.value;
const seeds = Number(process.env.GENESIS_SEEDS ?? 12);
const chain = Number(process.env.GENESIS_CHAIN ?? 6);
const WORLD_SEED = 20_261_125;
const live = { cancelRequested: false } as const;

type Generated = Extract<DistrictOutcome, { kind: "generated" }>;
const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8" }).trim();
const round = (value: number): number => Math.round(value * 100) / 100;
const quantile = (values: readonly number[], q: number): number => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(q * values.length) - 1)] ?? 0;
const heapMiB = (): number => {
  globalThis.gc?.();
  return round(process.memoryUsage().heapUsed / 1024 ** 2);
};

function emptyWorld(): WorldState {
  const created = createWorld({ catalog, seed: WORLD_SEED });
  if (!created.ok) throw new Error("world failed to build");
  return created.value;
}

function timed<T>(work: () => T): readonly [T, number] {
  const start = performance.now();
  const value = work();
  return [value, performance.now() - start];
}

function district(state: WorldState, request: DistrictRequest) {
  const [outcome, generateMs] = timed(() => generateDistrict(catalog, state, request));
  if (outcome.kind !== "generated") throw new Error(`seed ${request.seed}: ${outcome.stage}: ${outcome.reason}`);
  const [, proposalMs] = timed(() => applyProposal(catalog, state, outcome.proposal));
  const [settled, settleMs] = timed(() => settleDistrict(catalog, state, outcome, live));
  if (settled.status !== "committed") throw new Error(`seed ${request.seed}: ${settled.detail}`);
  const after = settled.committed.state;
  return { outcome: outcome satisfies Generated, after, generateMs, proposalMs, settleMs };
}

test("district workload", { timeout: 1_800_000 }, () => {
  const loadBefore = os.loadavg();
  for (const seed of [1000, 1001, 1002]) district(emptyWorld(), { preset: lastDistrict, seed, at: [0, 0, 0] });

  const corpus = Array.from({ length: seeds }, (_, index) => {
    const seed = index + 1;
    const start = emptyWorld();
    const { outcome, after, generateMs, proposalMs, settleMs } = district(start, { preset: lastDistrict, seed, at: [0, 0, 0] });
    return {
      seed,
      hash: hashState(after),
      entities: after.entities.length,
      bonds: after.bonds.length,
      invariantIssues: checkInvariants(catalog, after).length,
      diagnostics: outcome.diagnostics.length,
      generateMs: round(generateMs),
      commitMs: round(proposalMs),
      settleMs: round(settleMs),
      ...outcome.metrics,
    };
  });

  let state = emptyWorld();
  const heapStart = heapMiB();
  let previous: Generated | undefined;
  const chained = Array.from({ length: chain }, (_, index) => {
    const seed = 21 + index;
    const link = previous === undefined ? undefined : continueFrom(previous.plan, previous.at, "east");
    const request: DistrictRequest =
      link === undefined
        ? { preset: lastDistrict, seed, at: [0, 0, 0] }
        : { preset: lastDistrict, seed, at: link.at, gates: [...link.gates, ...lastDistrict.gates.filter((gate) => gate.edge !== "west")], depends: link.depends };
    const [snapshot, serializeMs] = timed(() => serializeSnapshot(state));
    const [, parseMs] = timed(() => parseSnapshot(catalog, snapshot));
    const { outcome, after, generateMs, proposalMs, settleMs } = district(state, request);
    const [hash, hashMs] = timed(() => hashState(after));
    state = after;
    previous = outcome;
    return {
      district: index + 1,
      seed,
      hash,
      worldEntities: after.entities.length,
      worldBonds: after.bonds.length,
      generateMs: round(generateMs),
      commitMs: round(proposalMs),
      settleMs: round(settleMs),
      hashMs: round(hashMs),
      snapshotKiB: Math.round(snapshot.length / 1024),
      serializeMs: round(serializeMs),
      parseMs: round(parseMs),
      heapMiB: heapMiB(),
    };
  });

  const column = (name: "generateMs" | "commitMs" | "settleMs"): string => {
    const values = corpus.map((row) => row[name]);
    return `p50 ${quantile(values, 0.5).toFixed(1)} / p95 ${quantile(values, 0.95).toFixed(1)} / max ${Math.max(...values).toFixed(1)} ms`;
  };
  const provenance = { commit: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain", "--", ".", ":(exclude)benchmarks").length > 0, generatedAt: new Date().toISOString() };
  const machine = { os: `${os.type()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model ?? "unknown", logicalCores: os.cpus().length, node: process.version, loadBefore, loadAfter: os.loadavg() };
  const report = [
    `# Genesis district workload`,
    ``,
    `- Commit: \`${provenance.commit}\`${provenance.dirty ? " (dirty tree)" : ""}; generated ${provenance.generatedAt}`,
    `- Machine: ${machine.cpu}, ${machine.logicalCores} logical cores, ${machine.os}, Node ${machine.node}`,
    `- Load average before: ${loadBefore.map((value) => value.toFixed(1)).join(" / ")}; after: ${machine.loadAfter.map((value) => value.toFixed(1)).join(" / ")}`,
    `- Preset: \`${lastDistrict.rules.id}\` ${lastDistrict.size.join("×")}, world seed ${WORLD_SEED}; main thread of Node, 3 unrecorded warm-up districts`,
    ``,
    `## Corpus: one district per seed into an empty world (${corpus.length} seeds)`,
    ``,
    `- Distinct state hashes: ${new Set(corpus.map((row) => row.hash)).size} of ${corpus.length}; invariant issues: ${corpus.reduce((sum, row) => sum + row.invariantIssues, 0)}`,
    `- Generate: ${column("generateMs")}`,
    `- World commit alone (\`applyProposal\`): ${column("commitMs")}`,
    `- Settle (re-validate plan, commit, audit): ${column("settleMs")}`,
    ``,
    `| Seed | State hash | Entities | Placements | Road | Water | Bridge | Lots T/H/R/G | Empty lots | Decisions | Backtracks | Plan attempts | Lot retries | Generate ms | Commit ms | Settle ms |`,
    `|---:|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|`,
    ...corpus.map(
      (row) =>
        `| ${row.seed} | \`${row.hash}\` | ${row.entities} | ${row.placements} | ${row.roadCells} | ${row.waterCells} | ${row.bridgeCells} | ${row.lots.tower}/${row.lots.house}/${row.lots.ruin}/${row.lots.garden} | ${row.emptyLots} | ${row.solverDecisions} | ${row.solverBacktracks} | ${row.planAttempts} | ${row.lotRetries} | ${row.generateMs} | ${row.commitMs} | ${row.settleMs} |`,
    ),
    ``,
    `## Chain: each district continues the previous one to the east (${chained.length} districts, one world)`,
    ``,
    `Heap is \`heapUsed\` after a forced collection; it started at ${heapStart} MiB with an empty world. Snapshot columns are the cost of handing the world to a worker.`,
    ``,
    `| District | Seed | World entities | World bonds | Generate ms | Commit ms | Settle ms | Hash ms | Snapshot KiB | Serialize ms | Parse ms | Heap MiB |`,
    `|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|`,
    ...chained.map(
      (row) =>
        `| ${row.district} | ${row.seed} | ${row.worldEntities} | ${row.worldBonds} | ${row.generateMs} | ${row.commitMs} | ${row.settleMs} | ${row.hashMs} | ${row.snapshotKiB} | ${row.serializeMs} | ${row.parseMs} | ${row.heapMiB} |`,
    ),
    ``,
  ].join("\n");
  mkdirSync("runs/profile", { recursive: true });
  writeFileSync("runs/profile/genesis-district.json", `${JSON.stringify({ provenance, machine, corpus, chain: chained }, null, 2)}\n`);
  writeFileSync("runs/profile/genesis-district.md", report);
});
