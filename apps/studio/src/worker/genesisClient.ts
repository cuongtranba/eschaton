import type { Catalog } from "@eschaton/foldon";
import type { DistrictProgress, DistrictRequest, GenesisOutcome, GenesisRequest, GenesisResponse, GenesisTiming } from "@eschaton/genesis";
import { serializeSnapshot, type WorldState } from "@eschaton/world";

export type GenesisHandlers = Readonly<{ onProgress: (progress: DistrictProgress) => void; onDone: (outcome: GenesisOutcome, timing: GenesisTiming) => void }>;

export type GenesisClient = Readonly<{
  generate: (job: string, catalog: Catalog, base: WorldState, request: DistrictRequest, handlers: GenesisHandlers) => void;
  cancel: (job: string) => void;
  dispose: () => void;
}>;

const SLICE_MS = 12;
const NO_TIMING: GenesisTiming = { setupMs: 0, generateMs: 0, slices: 0 };

/** Owns the generation worker. It receives a snapshot of the world and returns an inert result; nothing here commits. */
export function createGenesisClient(): GenesisClient {
  const worker = new Worker(new URL("./genesis.worker.ts", import.meta.url), { type: "module" });
  const jobs = new Map<string, GenesisHandlers>();
  const send = (message: GenesisRequest): void => { worker.postMessage(message); };
  worker.onmessage = (event: MessageEvent<GenesisResponse>) => {
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
      handlers.onDone({ kind: "failed", stage: "worker", reason }, NO_TIMING);
    }
  };
  worker.onerror = (event) => { failAll(event.message === "" ? "the generation worker failed" : event.message); };
  worker.onmessageerror = () => { failAll("a message from the generation worker could not be read"); };
  return {
    generate: (job, catalog, base, request, handlers) => {
      jobs.set(job, handlers);
      send({ type: "generate", job, source: catalog.source(), fingerprint: catalog.fingerprint, snapshot: serializeSnapshot(base), request, sliceMs: SLICE_MS });
    },
    cancel: (job) => { send({ type: "cancel", job }); },
    dispose: () => { worker.terminate(); },
  };
}
