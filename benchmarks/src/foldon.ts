import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import { join, relative } from "node:path";
import { captureMachine, exitWith, openRun, repositoryRoot, writeJson } from "./harness.ts";

type Row = Readonly<{ name: string; opsPerSecond: number; p50Us: number; p99Us: number; samples: number }>;

type Dictionary = Readonly<Record<string, unknown>>;
const isDictionary = (value: unknown): value is Dictionary => typeof value === "object" && value !== null && !Array.isArray(value);
const items = (value: unknown): readonly unknown[] => (Array.isArray(value) ? (value as readonly unknown[]) : []);
const number = (value: unknown): number => (typeof value === "number" ? value : Number.NaN);
const string = (value: unknown): string => (typeof value === "string" ? value : "");

function rowsOf(root: unknown): { rows: Row[]; startedAt: string } {
  const rows: Row[] = [];
  if (!isDictionary(root)) throw new Error("vitest bench produced no JSON report");
  for (const file of items(root.testResults)) {
    for (const assertion of isDictionary(file) ? items(file.assertionResults) : []) {
      for (const benchmark of isDictionary(assertion) ? items(assertion.benchmarks) : []) {
        for (const task of isDictionary(benchmark) ? items(benchmark.tasks) : []) {
          if (!isDictionary(task) || !isDictionary(task.latency) || !isDictionary(task.throughput)) continue;
          rows.push({
            name: string(task.name),
            opsPerSecond: number(task.throughput.mean),
            p50Us: number(task.latency.p50) * 1000,
            p99Us: number(task.latency.p99) * 1000,
            samples: number(task.latency.samplesCount),
          });
        }
      }
    }
  }
  return { rows, startedAt: new Date(number(root.startTime)).toISOString() };
}

try {
  const run = openRun();
  const scratch = mkdtempSync(join(os.tmpdir(), "eschaton-foldon-bench-"));
  const raw = join(scratch, "vitest.json");
  try {
    execFileSync("pnpm", ["exec", "vitest", "bench", "--run", "--reporter=default", "--reporter=json", `--outputFile.json=${raw}`], {
      cwd: join(repositoryRoot(), "packages/foldon"),
      stdio: "inherit",
    });
    const { rows, startedAt } = rowsOf(JSON.parse(readFileSync(raw, "utf8")) as unknown);
    const written = writeJson(run, "foldon.json", { provenance: run.provenance, machine: captureMachine(), startedAt, rows });
    console.log(`Foldon benchmark -> ${relative(repositoryRoot(), written)}`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
} catch (error) {
  exitWith(error);
}
