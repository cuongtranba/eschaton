import { presetCatalog } from "@eschaton/foldon";
import { lastDistrict, settleDistrict, type DistrictRequest } from "@eschaton/genesis";
import { createWorld, hashState } from "@eschaton/world";
import { createGenesisClient } from "../worker/genesisClient";

/** Drives the production generation worker from the bench page, for the cross-engine checks. It only measures. */
export type GenesisSample = Readonly<{ status: string; hash: string; detail: string; progressMessages: number; roundTripMs: number; settleMs: number }>;

export type GenesisBench = Readonly<{
  district: (seed: number) => Promise<GenesisSample>;
  /** Starts a district and cancels it at once; resolves with the outcome kind the worker reports. */
  cancelled: () => Promise<string>;
}>;

if (!presetCatalog.ok) throw new Error("the preset catalog failed to build");
const catalog = presetCatalog.value;
const created = createWorld({ catalog, seed: 20_261_125 });
if (!created.ok) throw new Error("world failed to build");
const world = created.value;
const client = createGenesisClient();
let job = 0;

const bench: GenesisBench = {
  district: (seed) =>
    new Promise((resolve) => {
      job += 1;
      let progressMessages = 0;
      const start = performance.now();
      const request: DistrictRequest = { preset: lastDistrict, seed, at: [0, 0, 0] };
      client.generate(`bench-${job}`, catalog, world, request, {
        onProgress: () => { progressMessages += 1; },
        onDone: (outcome) => {
          const returned = performance.now();
          const settled = settleDistrict(catalog, world, outcome, { cancelRequested: false, request });
          const hash = settled.status === "committed" ? hashState(settled.committed.state) : "";
          resolve({ status: settled.status, hash, detail: settled.detail, progressMessages, roundTripMs: returned - start, settleMs: performance.now() - returned });
        },
      });
    }),
  cancelled: () =>
    new Promise((resolve) => {
      job += 1;
      const id = `bench-${job}`;
      client.generate(id, catalog, world, { preset: lastDistrict, seed: 1, at: [0, 0, 0] }, { onProgress: () => undefined, onDone: (outcome) => { resolve(outcome.kind); } });
      client.cancel(id);
    }),
};
Reflect.set(window, "eschatonGenesisBench", bench);
