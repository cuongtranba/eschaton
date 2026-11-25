import { canonicalJson, createCatalog, type CatalogInput } from "@eschaton/foldon";
import { compileTiles, type CompiledTiles, type TileSpec } from "./solver/compile";
import { createSolve, type WaveOutcome, type WaveProblem, type WaveProgress, type WaveStats } from "./solver/solve";

export type JobOutcome =
  | WaveOutcome
  | Readonly<{ kind: "cancelled"; stats: WaveStats }>
  | Readonly<{ kind: "failed"; reason: string }>;

export type JobTiming = Readonly<{ compileMs: number; solveMs: number; slices: number; tilesCached: boolean }>;

export type HostRequest =
  | Readonly<{
      type: "solve";
      job: string;
      source: CatalogInput;
      fingerprint: string;
      tiles: readonly TileSpec[];
      problem: WaveProblem;
      /** Decisions per solver step. A slice is one step, or as many steps as fit in `sliceMs`. */
      sliceNodes: number;
      sliceMs?: number;
      /** Minimum time between progress previews. Without it every unfinished slice posts one. */
      progressMs?: number;
    }>
  | Readonly<{ type: "cancel"; job: string }>;

export type HostResponse =
  | Readonly<{ type: "progress"; job: string; progress: WaveProgress }>
  | Readonly<{ type: "done"; job: string; outcome: JobOutcome; timing: JobTiming }>;

export type HostOptions = Readonly<{
  post: (message: HostResponse) => void;
  /** Runs the task later, after pending messages have been delivered. This is what makes cancellation possible. */
  schedule: (task: () => void) => void;
  /** A monotonic clock in milliseconds, for timings and time-based slices. Without it timings are zero. */
  now?: () => number;
}>;

export type WaveHost = Readonly<{ receive: (message: HostRequest) => void }>;

const NO_TIMING: JobTiming = { compileMs: 0, solveMs: 0, slices: 0, tilesCached: false };
const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Runs solve jobs in slices. Between slices control returns to the scheduler, so a `cancel` message can arrive.
 * Progress messages are previews only; the single authoritative result of a job is its `done` message, and every
 * accepted job gets exactly one, also when the solver throws.
 */
export function createWaveHost(options: HostOptions): WaveHost {
  const now = options.now ?? (() => 0);
  const cancelled = new Set<string>();
  const running = new Set<string>();
  let cache: Readonly<{ key: string; tiles: CompiledTiles }> | undefined;

  const compiledFor = (message: Extract<HostRequest, { type: "solve" }>): CompiledTiles | string => {
    const key = `${message.fingerprint}|${canonicalJson(message.tiles)}`;
    if (cache?.key === key) return cache.tiles;
    const catalog = createCatalog(message.source);
    if (!catalog.ok) return `the catalog source is invalid: ${catalog.error.map((issue) => issue.code).join(", ")}`;
    if (catalog.value.fingerprint !== message.fingerprint) return "the catalog source does not match the expected fingerprint";
    const tiles = compileTiles(catalog.value, message.tiles);
    if (!tiles.ok) return tiles.error.join("; ");
    cache = { key, tiles: tiles.value };
    return tiles.value;
  };

  const start = (message: Extract<HostRequest, { type: "solve" }>): JobOutcome | undefined => {
    const { job } = message;
    const failed = (reason: string): JobOutcome => ({ kind: "failed", reason });
    if (!Number.isSafeInteger(message.sliceNodes) || message.sliceNodes < 1) return failed("sliceNodes must be an integer >= 1");
    const budget = message.sliceMs ?? 0;
    if (!Number.isFinite(budget) || budget < 0) return failed("sliceMs must be a number >= 0");
    const compileStart = now();
    const tilesCached = cache?.key === `${message.fingerprint}|${canonicalJson(message.tiles)}`;
    const tiles = compiledFor(message);
    if (typeof tiles === "string") return failed(tiles);
    const solve = createSolve(tiles, message.problem);
    const compileMs = now() - compileStart;
    let solveMs = 0;
    let slices = 0;
    running.add(job);
    const finish = (outcome: JobOutcome): void => {
      running.delete(job);
      cancelled.delete(job);
      options.post({ type: "done", job, outcome, timing: { compileMs, solveMs, slices, tilesCached } });
    };
    const interval = message.progressMs ?? 0;
    let lastProgress = now();
    const slice = (): void => {
      let outcome: JobOutcome | undefined;
      const sliceStart = now();
      try {
        if (cancelled.has(job)) {
          outcome = { kind: "cancelled", stats: solve.progress().stats };
        } else {
          slices += 1;
          do outcome = solve.step(message.sliceNodes);
          while (outcome === undefined && now() - sliceStart < budget);
          solveMs += now() - sliceStart;
          if (outcome === undefined && now() - lastProgress >= interval) {
            lastProgress = now();
            options.post({ type: "progress", job, progress: solve.progress() });
          }
        }
      } catch (error) {
        outcome = failed(`the job failed: ${describe(error)}`);
      }
      if (outcome === undefined) {
        options.schedule(slice);
        return;
      }
      finish(outcome);
    };
    options.schedule(slice);
    return undefined;
  };

  return {
    receive: (message) => {
      if (message.type === "cancel") {
        if (running.has(message.job)) cancelled.add(message.job);
        return;
      }
      if (running.has(message.job)) return;
      let refused: JobOutcome | undefined;
      try {
        refused = start(message);
      } catch (error) {
        refused = { kind: "failed", reason: `the job could not start: ${describe(error)}` };
      }
      if (refused !== undefined) options.post({ type: "done", job: message.job, outcome: refused, timing: NO_TIMING });
    },
  };
}
