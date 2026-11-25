import { createCatalog, type CatalogInput } from "@eschaton/foldon";
import { compileTiles, type TileSpec } from "./solver/compile";
import { createSolve, type WaveOutcome, type WaveProblem, type WaveProgress, type WaveStats } from "./solver/solve";

export type JobOutcome =
  | WaveOutcome
  | Readonly<{ kind: "cancelled"; stats: WaveStats }>
  | Readonly<{ kind: "failed"; reason: string }>;

export type HostRequest =
  | Readonly<{ type: "solve"; job: string; source: CatalogInput; fingerprint: string; tiles: readonly TileSpec[]; problem: WaveProblem; sliceNodes: number }>
  | Readonly<{ type: "cancel"; job: string }>;

export type HostResponse =
  | Readonly<{ type: "progress"; job: string; progress: WaveProgress }>
  | Readonly<{ type: "done"; job: string; outcome: JobOutcome }>;

export type HostOptions = Readonly<{
  post: (message: HostResponse) => void;
  /** Runs the task later, after pending messages have been delivered. This is what makes cancellation possible. */
  schedule: (task: () => void) => void;
}>;

export type WaveHost = Readonly<{ receive: (message: HostRequest) => void }>;

/**
 * Runs solve jobs in slices. Between slices control returns to the scheduler, so a `cancel` message can arrive.
 * Progress messages are previews only; the single authoritative result of a job is its `done` message.
 */
export function createWaveHost(options: HostOptions): WaveHost {
  const cancelled = new Set<string>();
  const running = new Set<string>();

  const start = (message: Extract<HostRequest, { type: "solve" }>): JobOutcome | undefined => {
    const { job } = message;
    const failed = (reason: string): JobOutcome => ({ kind: "failed", reason });
    if (running.has(job)) return failed(`job ${job} is already running`);
    if (!Number.isSafeInteger(message.sliceNodes) || message.sliceNodes < 1) return failed("sliceNodes must be an integer >= 1");
    const catalog = createCatalog(message.source);
    if (!catalog.ok) return failed(`the catalog source is invalid: ${catalog.error.map((issue) => issue.code).join(", ")}`);
    if (catalog.value.fingerprint !== message.fingerprint) return failed("the catalog source does not match the expected fingerprint");
    const tiles = compileTiles(catalog.value, message.tiles);
    if (!tiles.ok) return failed(tiles.error.join("; "));
    const solve = createSolve(tiles.value, message.problem);
    running.add(job);
    const slice = (): void => {
      const outcome: JobOutcome | undefined = cancelled.has(job) ? { kind: "cancelled", stats: solve.progress().stats } : solve.step(message.sliceNodes);
      if (outcome === undefined) {
        options.post({ type: "progress", job, progress: solve.progress() });
        options.schedule(slice);
        return;
      }
      running.delete(job);
      cancelled.delete(job);
      options.post({ type: "done", job, outcome });
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
      const refused = start(message);
      if (refused !== undefined) options.post({ type: "done", job: message.job, outcome: refused });
    },
  };
}
