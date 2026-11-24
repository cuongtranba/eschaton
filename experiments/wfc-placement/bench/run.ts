import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { createConstrainedProblem, createDemoProblem, hashGrid, solveOffsetState, solvePlacement } from "@eschaton/exp-wfc-placement";
import type { Problem, SolveResult } from "@eschaton/exp-wfc-placement";

type EncodingName = "placement" | "offset-state";
type ScenarioName = "open" | "constrained";

type Run = {
  readonly scenario: ScenarioName;
  readonly size: number;
  readonly encoding: EncodingName;
  readonly seed: number;
  readonly kind: SolveResult["kind"];
  readonly ms: number;
  readonly nodes: number;
  readonly backtracks: number;
  readonly propagationSteps: number;
  readonly hash: string | null;
};

type Summary = {
  readonly scenario: ScenarioName;
  readonly size: number;
  readonly encoding: EncodingName;
  readonly solved: number;
  readonly unsatisfiable: number;
  readonly budgetExceeded: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly meanNodes: number;
  readonly meanBacktracks: number;
  readonly meanPropagationSteps: number;
};

const SIZES = [8, 12, 16] as const;
const SCENARIOS: readonly ScenarioName[] = ["open", "constrained"];
const ENCODINGS: readonly { readonly name: EncodingName; readonly solve: typeof solvePlacement }[] = [
  { name: "placement", solve: solvePlacement },
  { name: "offset-state", solve: solveOffsetState },
];
const CORPUS_SIZE = 100;
const WARMUP_RUNS = 5;
const BUDGET = { maxNodes: 5_000, maxBacktracks: 500 } as const;

function problemFor(scenario: ScenarioName, size: number): Problem {
  return scenario === "open" ? createDemoProblem(size, size) : createConstrainedProblem(size, size);
}

function quantile(sorted: readonly number[], q: number): number {
  const index = Math.max(0, Math.ceil(q * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function summarize(runs: readonly Run[], scenario: ScenarioName, size: number, encoding: EncodingName): Summary {
  const own = runs.filter((r) => r.scenario === scenario && r.size === size && r.encoding === encoding);
  const times = own.map((r) => r.ms).sort((a, b) => a - b);
  return {
    scenario,
    size,
    encoding,
    solved: own.filter((r) => r.kind === "solved").length,
    unsatisfiable: own.filter((r) => r.kind === "unsatisfiable").length,
    budgetExceeded: own.filter((r) => r.kind === "budget-exceeded").length,
    p50Ms: quantile(times, 0.5),
    p95Ms: quantile(times, 0.95),
    meanNodes: mean(own.map((r) => r.nodes)),
    meanBacktracks: mean(own.map((r) => r.backtracks)),
    meanPropagationSteps: mean(own.map((r) => r.propagationSteps)),
  };
}

const runs: Run[] = [];
for (const scenario of SCENARIOS) {
  for (const size of SIZES) {
    const problem = problemFor(scenario, size);
    for (const { name, solve } of ENCODINGS) {
      for (let warm = 0; warm < WARMUP_RUNS; warm++) solve(problem, { seed: 100_000 + warm, ...BUDGET });
      for (let seed = 1; seed <= CORPUS_SIZE; seed++) {
        const start = performance.now();
        const result = solve(problem, { seed, ...BUDGET });
        const ms = performance.now() - start;
        runs.push({
          scenario,
          size,
          encoding: name,
          seed,
          kind: result.kind,
          ms,
          nodes: result.stats.nodes,
          backtracks: result.stats.backtracks,
          propagationSteps: result.stats.propagationSteps,
          hash: result.kind === "solved" ? hashGrid(result.grid) : null,
        });
      }
    }
  }
}

const summaries = SCENARIOS.flatMap((scenario) => SIZES.flatMap((size) => ENCODINGS.map(({ name }) => summarize(runs, scenario, size, name))));

const agreement = SCENARIOS.flatMap((scenario) =>
  SIZES.map((size) => {
    let bothSolved = 0;
    let sameHash = 0;
    for (let seed = 1; seed <= CORPUS_SIZE; seed++) {
      const a = runs.find((r) => r.scenario === scenario && r.size === size && r.encoding === "placement" && r.seed === seed);
      const b = runs.find((r) => r.scenario === scenario && r.size === size && r.encoding === "offset-state" && r.seed === seed);
      if (a?.hash != null && b?.hash != null) {
        bothSolved++;
        if (a.hash === b.hash) sameHash++;
      }
    }
    return { scenario, size, bothSolved, sameHash };
  }),
);

const date = new Date().toISOString().slice(0, 10);
const cpus = os.cpus();
const machine = {
  os: `${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
  cpu: cpus[0]?.model ?? "unknown",
  logicalCores: cpus.length,
  totalMemoryGiB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
  node: process.version,
};
const report = { date, machine, corpusSize: CORPUS_SIZE, warmupRuns: WARMUP_RUNS, budget: BUDGET, sizes: SIZES, summaries, agreement, runs };

const fmt = (value: number, digits = 2): string => value.toFixed(digits);
const lines: string[] = [
  `# WFC encoding benchmark ${date}`,
  "",
  `- OS: ${machine.os}`,
  `- CPU: ${machine.cpu} (${machine.logicalCores} logical cores)`,
  `- Memory: ${machine.totalMemoryGiB} GiB`,
  `- Node: ${machine.node}`,
  `- Corpus: seeds 1..${CORPUS_SIZE} per scenario × size × encoding (${runs.length} timed runs); ${WARMUP_RUNS} untimed warm-up runs per cell`,
  `- Budget: maxNodes ${BUDGET.maxNodes}, maxBacktracks ${BUDGET.maxBacktracks}`,
  "- Timing: performance.now() around one solve call, single thread, main thread (worker path is Phase 2). Times cover every run, solved or not.",
  "- Propagation step: one worklist item processed. Placement encoding processes placements (support re-check); offset-state processes cells (domain arc revision). The two counts are not comparable.",
  "",
];
for (const scenario of SCENARIOS) {
  lines.push(
    scenario === "open"
      ? "## Scenario `open`: demo tile set, no pins"
      : "## Scenario `constrained`: demo tile set without `road-end`, one house pinned at the centre",
    "",
    "| Size | Encoding | Solved | Unsat | Budget | p50 ms | p95 ms | Mean nodes | Mean backtracks | Mean prop. steps |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  );
  for (const s of summaries.filter((x) => x.scenario === scenario)) {
    lines.push(
      `| ${s.size}×${s.size} | ${s.encoding} | ${s.solved} | ${s.unsatisfiable} | ${s.budgetExceeded} | ${fmt(s.p50Ms)} | ${fmt(s.p95Ms)} | ${fmt(s.meanNodes, 1)} | ${fmt(s.meanBacktracks, 2)} | ${fmt(s.meanPropagationSteps, 0)} |`,
    );
  }
  lines.push("");
}
lines.push("## Agreement between encodings", "", "| Scenario | Size | Both solved | Identical grid hash |", "|---|---|---:|---:|");
for (const a of agreement) lines.push(`| ${a.scenario} | ${a.size}×${a.size} | ${a.bothSolved} | ${a.sameHash} |`);
lines.push("");

const directory = join(import.meta.dirname, "..", "results");
mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, `bench-${date}.json`), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(directory, `bench-${date}.md`), `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
