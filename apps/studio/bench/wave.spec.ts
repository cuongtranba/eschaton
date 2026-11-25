import os from "node:os";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { captureMachine, exitWith, openRun, writeJson } from "@eschaton/benchmarks";
import { expect, test, type Page } from "@playwright/test";
import type { ProblemSample, RegionSample, WaveBench } from "../src/bench/waveBench";

const WARMUP = 10;
const SAMPLES = 120;
const STRESS_SAMPLES = 40;
const HARD_SAMPLES = 100;
const TARGET_P95_MS = 250;

const quantile = (values: readonly number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] ?? 0;
};
const round = (value: number): number => Math.round(value * 100) / 100;
const summary = (values: readonly number[]) => ({ n: values.length, p50: round(quantile(values, 0.5)), p95: round(quantile(values, 0.95)), p99: round(quantile(values, 0.99)), max: round(Math.max(...values)) });

const region = (page: Page, size: readonly [number, number, number], seed: number, pins: boolean): Promise<RegionSample> =>
  page.evaluate(([s, n, p]) => (Reflect.get(window, "eschatonWaveBench") as WaveBench).region(s, n, p), [size, seed, pins] as const);

const hard = (page: Page, kind: "packing" | "unsat-search" | "unsat-propagation", seed: number): Promise<ProblemSample> =>
  page.evaluate(([k, n]) => (Reflect.get(window, "eschatonWaveBench") as WaveBench).problem(k, n), [kind, seed] as const);

async function series(page: Page, size: readonly [number, number, number], pins: boolean, count: number): Promise<RegionSample[]> {
  const samples: RegionSample[] = [];
  for (let seed = 1; seed <= count; seed++) samples.push(await region(page, size, seed, pins));
  return samples;
}

const breakdown = (samples: readonly RegionSample[]) => ({
  outcomes: Object.fromEntries([...new Set(samples.map((s) => s.outcome))].map((kind) => [kind, samples.filter((s) => s.outcome === kind).length])),
  committed: samples.filter((s) => s.committed).length,
  backtrackingRuns: samples.filter((s) => s.backtracks > 0).length,
  prepareMs: summary(samples.map((s) => s.prepareMs)),
  compileMs: summary(samples.map((s) => s.compileMs)),
  solveMs: summary(samples.map((s) => s.solveMs)),
  transportMs: summary(samples.map((s) => s.transportMs)),
  workerRoundTripMs: summary(samples.map((s) => s.roundTripMs)),
  commitMs: summary(samples.map((s) => s.commitMs)),
  endToEndMs: summary(samples.map((s) => s.endToEndMs)),
});

test("wave solver in the production worker", async ({ page, browser }) => {
  try {
    const run = openRun({ join: true });
    const loadBefore = os.loadavg();
    await page.goto("/bench.html");
    await expect(page.locator("#status")).toHaveText("ready", { timeout: 120_000 });

    const cold: RegionSample[] = [];
    for (let i = 1; i <= 10; i++) {
      await page.evaluate(() => { (Reflect.get(window, "eschatonWaveBench") as WaveBench).restartWorker(); });
      cold.push(await region(page, [16, 8, 16], 1000 + i, true));
    }
    for (let i = 1; i <= WARMUP; i++) await region(page, [16, 8, 16], 5000 + i, true);

    const canonical = await series(page, [16, 8, 16], true, SAMPLES);
    const open = await series(page, [16, 8, 16], false, SAMPLES);
    const small = await series(page, [8, 4, 8], true, SAMPLES);
    const stress = await series(page, [28, 8, 28], true, STRESS_SAMPLES);
    const hardCases: Record<string, ProblemSample[]> = {};
    for (const kind of ["packing", "unsat-search", "unsat-propagation"] as const) {
      const samples: ProblemSample[] = [];
      for (let seed = 1; seed <= HARD_SAMPLES; seed++) samples.push(await hard(page, kind, seed));
      hardCases[kind] = samples;
    }
    const loadAfter = os.loadavg();

    const hardSummary = Object.fromEntries(
      Object.entries(hardCases).map(([kind, samples]) => [
        kind,
        {
          outcomes: Object.fromEntries([...new Set(samples.map((s) => s.outcome))].map((o) => [o, samples.filter((s) => s.outcome === o).length])),
          meanNodes: round(samples.reduce((sum, s) => sum + s.nodes, 0) / samples.length),
          meanBacktracks: round(samples.reduce((sum, s) => sum + s.backtracks, 0) / samples.length),
          solveMs: summary(samples.map((s) => s.solveMs)),
          workerRoundTripMs: summary(samples.map((s) => s.roundTripMs)),
        },
      ]),
    );
    const result = {
      provenance: run.provenance,
      machine: { ...captureMachine(), browser: `${browser.browserType().name()} ${browser.version()}`, channel: process.env.BENCH_CHANNEL ?? "playwright chromium (headless)", userAgent: await page.evaluate(() => navigator.userAgent), hardwareConcurrency: await page.evaluate(() => navigator.hardwareConcurrency) },
      load: { before: loadBefore, after: loadAfter },
      method: { warmupSolves: WARMUP, samplesPerSeries: SAMPLES, stressSamples: STRESS_SAMPLES, hardSamples: HARD_SAMPLES, seeds: "1..n per series, fixed", tiles: "Studio WAVE_TILES (7 tiles)", airWeight: 8 },
      gate: { name: "Local WFC 16x16x8 (2,048 cells), p95 in worker", targetP95Ms: TARGET_P95_MS },
      summary: {
        "16x8x16 with pins (canonical)": breakdown(canonical),
        "16x8x16 empty world": breakdown(open),
        "8x4x8 with pins": breakdown(small),
        "28x8x28 with pins (stress, separate)": breakdown(stress),
        "16x8x16 cold worker (tiles not cached)": breakdown(cold),
        hard: hardSummary,
      },
      raw: { canonical, open, small, stress, cold, hard: hardCases },
    };
    writeJson(run, "wave-worker.json", result);

    const row = (name: string, b: ReturnType<typeof breakdown>): string =>
      `| ${name} | ${b.solveMs.n} | ${b.solveMs.p50} / ${b.solveMs.p95} / ${b.solveMs.p99} | ${b.workerRoundTripMs.p50} / ${b.workerRoundTripMs.p95} / ${b.workerRoundTripMs.p99} | ${b.commitMs.p50} / ${b.commitMs.p95} / ${b.commitMs.p99} | ${b.endToEndMs.p50} / ${b.endToEndMs.p95} / ${b.endToEndMs.p99} | ${JSON.stringify(b.outcomes)} |`;
    const c = breakdown(canonical);
    const lines = [
      `# Wave solver in the production worker`,
      ``,
      `- Commit: ${run.provenance.commit} (dirty: ${run.provenance.dirty}); mode: ${run.provenance.mode}`,
      `- Machine: ${result.machine.cpu}, ${result.machine.logicalCores} cores, ${result.machine.totalMemoryGiB} GiB, ${result.machine.os}`,
      `- Browser: ${result.machine.browser} (${result.machine.channel}); production bundle (vite build + vite preview)`,
      `- Load average (1, 5, 15 min) before: ${loadBefore.map(round).join(", ")}; after: ${loadAfter.map(round).join(", ")}`,
      `- Method: ${WARMUP} unrecorded warm-up solves, then fixed seeds 1..n per series. Each sample starts from the same world. Times in ms, p50 / p95 / p99 by nearest rank.`,
      ``,
      `| Series | n | Solve in worker | Worker round trip (compile + solve + transport) | World commit | End to end | Outcomes |`,
      `|---|---:|---|---|---|---|---|`,
      row("16x8x16 with pins (canonical)", c),
      row("16x8x16 empty world", breakdown(open)),
      row("8x4x8 with pins", breakdown(small)),
      row("28x8x28 with pins (stress)", breakdown(stress)),
      row("16x8x16, cold worker", breakdown(cold)),
      ``,
      `Canonical breakdown (p50 / p95): prepare ${c.prepareMs.p50} / ${c.prepareMs.p95}; compile ${c.compileMs.p50} / ${c.compileMs.p95}; solve ${c.solveMs.p50} / ${c.solveMs.p95}; transport ${c.transportMs.p50} / ${c.transportMs.p95}; commit ${c.commitMs.p50} / ${c.commitMs.p95}.`,
      ``,
      `**Gate (Local WFC, 16x16x8, p95 <= ${TARGET_P95_MS} ms in worker):** solve p95 ${c.solveMs.p95} ms; worker round trip p95 ${c.workerRoundTripMs.p95} ms. ${c.workerRoundTripMs.p95 <= TARGET_P95_MS ? "Inside the target in this run." : "OUTSIDE the target in this run."}`,
      ``,
      `| Hard case | Outcomes | Mean decisions | Mean backtracks | Solve p50 / p95 / p99 | Round trip p50 / p95 / p99 |`,
      `|---|---|---:|---:|---|---|`,
      ...Object.entries(hardSummary).map(([kind, h]) => `| ${kind} | ${JSON.stringify(h.outcomes)} | ${h.meanNodes} | ${h.meanBacktracks} | ${h.solveMs.p50} / ${h.solveMs.p95} / ${h.solveMs.p99} | ${h.workerRoundTripMs.p50} / ${h.workerRoundTripMs.p95} / ${h.workerRoundTripMs.p99} |`),
      ``,
    ];
    writeFileSync(join(run.directory, "wave-worker.md"), lines.join("\n"));
    console.log(lines.join("\n"));
  } catch (error) {
    exitWith(error);
  }
});
