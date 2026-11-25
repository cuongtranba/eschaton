import { execFileSync } from "node:child_process";
import { relative } from "node:path";
import { exitWith, openRun, repositoryRoot } from "./harness.ts";

try {
  const run = openRun();
  const { mode, dirty, shortCommit } = run.provenance;
  console.log(`Benchmark run (${mode}${dirty ? ", dirty tree" : ""}) at ${shortCommit} -> ${relative(repositoryRoot(), run.directory)}`);
  execFileSync("pnpm", ["-r", "--workspace-concurrency=1", "--if-present", "bench"], {
    cwd: repositoryRoot(),
    stdio: "inherit",
    env: { ...process.env, BENCH_RUN_DIR: run.directory },
  });
} catch (error) {
  exitWith(error);
}
