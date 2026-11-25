import type { Catalog } from "@eschaton/foldon";
import type { HostRequest, HostResponse, JobOutcome, JobTiming, TileSpec, WaveProblem, WaveProgress } from "@eschaton/wave";

export type WaveHandlers = Readonly<{ onProgress: (progress: WaveProgress) => void; onDone: (outcome: JobOutcome, timing: JobTiming) => void }>;

export type WaveClient = Readonly<{
  solve: (job: string, catalog: Catalog, tiles: readonly TileSpec[], problem: WaveProblem, handlers: WaveHandlers) => void;
  cancel: (job: string) => void;
  dispose: () => void;
}>;

const SLICE_NODES = 32;
const SLICE_MS = 12;
const NO_TIMING: JobTiming = { compileMs: 0, solveMs: 0, slices: 0, tilesCached: false };
const PREVIEW_INTERVAL_MS = 150;
const FAILED = (reason: string): JobOutcome => ({ kind: "failed", reason });

/** Owns the solver worker. Results come back as messages; nothing here touches world state. */
export function createWaveClient(): WaveClient {
  const worker = new Worker(new URL("./wave.worker.ts", import.meta.url), { type: "module" });
  const jobs = new Map<string, WaveHandlers>();
  const send = (message: HostRequest): void => { worker.postMessage(message); };
  worker.onmessage = (event: MessageEvent<HostResponse>) => {
    const message = event.data;
    const handlers = jobs.get(message.job);
    if (handlers === undefined) return;
    if (message.type === "progress") {
      handlers.onProgress(message.progress);
      return;
    }
    jobs.delete(message.job);
    handlers.onDone(message.outcome, message.timing);
  };
  const failAll = (reason: string): void => {
    for (const [job, handlers] of jobs) {
      jobs.delete(job);
      handlers.onDone(FAILED(reason), NO_TIMING);
    }
  };
  worker.onerror = (event) => { failAll(event.message === "" ? "the solver worker failed" : event.message); };
  worker.onmessageerror = () => { failAll("a message from the solver worker could not be read"); };
  return {
    solve: (job, catalog, tiles, problem, handlers) => {
      jobs.set(job, handlers);
      send({ type: "solve", job, source: catalog.source(), fingerprint: catalog.fingerprint, tiles, problem, sliceNodes: SLICE_NODES, sliceMs: SLICE_MS, progressMs: PREVIEW_INTERVAL_MS });
    },
    cancel: (job) => { send({ type: "cancel", job }); },
    dispose: () => { worker.terminate(); },
  };
}
