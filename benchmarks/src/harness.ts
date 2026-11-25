import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join, resolve } from "node:path";

export type Mode = "scratch" | "record";

export type Provenance = Readonly<{
  commit: string;
  shortCommit: string;
  commitDate: string;
  dirty: boolean;
  mode: Mode;
  generatedAt: string;
}>;

export type Machine = Readonly<{
  os: string;
  cpu: string;
  logicalCores: number;
  totalMemoryGiB: number;
  node: string;
}>;

export type Run = Readonly<{ directory: string; provenance: Provenance }>;

const EVIDENCE_ROOT = "benchmarks";
const EVIDENCE_PHASE = "phase-3";
const EVIDENCE_DIRECTORY = `${EVIDENCE_ROOT}/${EVIDENCE_PHASE}`;
const SCRATCH_DIRECTORY = "benchmarks/runs";

export const repositoryRoot = (): string => resolve(import.meta.dirname, "..", "..");

const git = (root: string, ...args: string[]): string => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

const flag = (name: string): boolean => process.env[name] === "1";

function captureProvenance(root: string, now: Date): Provenance {
  const commit = git(root, "rev-parse", "HEAD");
  const dirtyEntries = git(root, "status", "--porcelain", "--untracked-files=all", "--", ".", `:(exclude,glob)${EVIDENCE_ROOT}/phase-*/**`);
  return {
    commit,
    shortCommit: commit.slice(0, 9),
    commitDate: git(root, "show", "-s", "--format=%cs", "HEAD"),
    dirty: dirtyEntries.length > 0,
    mode: flag("BENCH_RECORD") ? "record" : "scratch",
    generatedAt: now.toISOString(),
  };
}

function refuseDirtyRecording(provenance: Provenance): void {
  if (provenance.mode === "record" && provenance.dirty && !flag("BENCH_ALLOW_DIRTY")) {
    throw new Error(
      "Refusing to record benchmark evidence from a dirty working tree: the numbers would not match any commit. " +
        "Commit or discard the changes, or set BENCH_ALLOW_DIRTY=1 to record anyway (the output is marked dirty).",
    );
  }
}

const stamp = (iso: string): string => iso.replaceAll(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

function scratchName(provenance: Provenance): string {
  return `${stamp(provenance.generatedAt)}-${provenance.shortCommit}${provenance.dirty ? "-dirty" : ""}`;
}

function newestScratchRun(directory: string, provenance: Provenance): string | undefined {
  const suffix = `-${provenance.shortCommit}${provenance.dirty ? "-dirty" : ""}`;
  try {
    return readdirSync(directory)
      .filter((name) => name.endsWith(suffix))
      .sort()
      .at(-1);
  } catch {
    return undefined;
  }
}

/**
 * Resolves where this invocation writes. `BENCH_RUN_DIR` (set by `pnpm bench` so every workspace shares one
 * directory) wins; recording writes to the tracked evidence directory named by commit date and SHA; anything else
 * goes to the gitignored scratch directory. With `join`, a scratch run for the same SHA and dirty state is reused.
 */
export function openRun(options: Readonly<{ join?: boolean }> = {}): Run {
  const root = repositoryRoot();
  const provenance = captureProvenance(root, new Date());
  refuseDirtyRecording(provenance);
  const fromEnvironment = process.env.BENCH_RUN_DIR;
  let directory: string;
  if (fromEnvironment !== undefined && fromEnvironment !== "") {
    directory = resolve(root, fromEnvironment);
  } else if (provenance.mode === "record") {
    directory = join(root, EVIDENCE_DIRECTORY, `${provenance.commitDate}-${provenance.shortCommit}`);
  } else {
    const scratchRoot = join(root, SCRATCH_DIRECTORY);
    const reused = options.join === true ? newestScratchRun(scratchRoot, provenance) : undefined;
    directory = join(scratchRoot, reused ?? scratchName(provenance));
  }
  mkdirSync(directory, { recursive: true });
  return { directory, provenance };
}

export function writeJson(run: Run, name: string, value: unknown): string {
  const path = join(run.directory, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

export function captureMachine(): Machine {
  const cpus = os.cpus();
  return {
    os: `${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
    cpu: cpus[0]?.model ?? "unknown",
    logicalCores: cpus.length,
    totalMemoryGiB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    node: process.version,
  };
}

export function exitWith(error: unknown): never {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
