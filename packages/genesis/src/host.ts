import { createCatalog, type CatalogInput } from "@eschaton/foldon";
import { parseSnapshot } from "@eschaton/world";
import { createDistrictJob, type DistrictJob, type DistrictOutcome, type DistrictProgress, type DistrictRequest } from "./district";

export type GenesisOutcome = DistrictOutcome | Readonly<{ kind: "cancelled" }>;

export type GenesisTiming = Readonly<{ setupMs: number; generateMs: number; slices: number }>;

export type GenesisRequest =
  | Readonly<{
      type: "generate";
      job: string;
      source: CatalogInput;
      fingerprint: string;
      /** The world the district is generated against, as `serializeSnapshot` wrote it. */
      snapshot: string;
      request: DistrictRequest;
      /** Time budget of one slice. A slice always runs at least one stage or lot. */
      sliceMs?: number;
    }>
  | Readonly<{ type: "cancel"; job: string }>;

export type GenesisResponse =
  | Readonly<{ type: "progress"; job: string; progress: DistrictProgress }>
  | Readonly<{ type: "done"; job: string; outcome: GenesisOutcome; timing: GenesisTiming }>;

export type GenesisHostOptions = Readonly<{
  post: (message: GenesisResponse) => void;
  /** Runs the task later, after pending messages have been delivered. This is what makes cancellation possible. */
  schedule: (task: () => void) => void;
  now?: () => number;
}>;

export type GenesisHost = Readonly<{ receive: (message: GenesisRequest) => void }>;

const NO_TIMING: GenesisTiming = { setupMs: 0, generateMs: 0, slices: 0 };
const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const failed = (reason: string): GenesisOutcome => ({ kind: "failed", stage: "host", reason });

/**
 * Runs district jobs off the thread that owns the world. The world arrives as a snapshot and is only read; the
 * result is the inert outcome of `createDistrictJob`. Progress messages are previews. Every accepted job posts
 * exactly one `done`, also when it is cancelled or throws.
 */
export function createGenesisHost(options: GenesisHostOptions): GenesisHost {
  const now = options.now ?? (() => 0);
  const cancelled = new Set<string>();
  const running = new Set<string>();

  const start = (message: Extract<GenesisRequest, { type: "generate" }>): GenesisOutcome | undefined => {
    const { job } = message;
    const budget = message.sliceMs ?? 0;
    if (!Number.isFinite(budget) || budget < 0) return failed("sliceMs must be a number >= 0");
    const setupStart = now();
    const catalog = createCatalog(message.source);
    if (!catalog.ok) return failed(`the catalog source is invalid: ${catalog.error.map((issue) => issue.code).join(", ")}`);
    if (catalog.value.fingerprint !== message.fingerprint) return failed("the catalog source does not match the expected fingerprint");
    const state = parseSnapshot(catalog.value, message.snapshot);
    if (!state.ok) return failed(`the world snapshot is invalid: ${state.error.map((issue) => issue.code).join(", ")}`);
    const district: DistrictJob = createDistrictJob(catalog.value, state.value, message.request);
    const setupMs = now() - setupStart;
    let generateMs = 0;
    let slices = 0;
    running.add(job);
    const slice = (): void => {
      let outcome: GenesisOutcome | undefined;
      const sliceStart = now();
      try {
        if (cancelled.has(job)) {
          outcome = { kind: "cancelled" };
        } else {
          slices += 1;
          do outcome = district.step();
          while (outcome === undefined && now() - sliceStart < budget);
          generateMs += now() - sliceStart;
          if (outcome === undefined) options.post({ type: "progress", job, progress: district.progress() });
        }
      } catch (error) {
        outcome = failed(`the job failed: ${describe(error)}`);
      }
      if (outcome === undefined) {
        options.schedule(slice);
        return;
      }
      running.delete(job);
      cancelled.delete(job);
      options.post({ type: "done", job, outcome, timing: { setupMs, generateMs, slices } });
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
      let refused: GenesisOutcome | undefined;
      try {
        refused = start(message);
      } catch (error) {
        refused = failed(`the job could not start: ${describe(error)}`);
      }
      if (refused !== undefined) options.post({ type: "done", job: message.job, outcome: refused, timing: NO_TIMING });
    },
  };
}
