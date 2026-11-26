import { presetCatalog, type Catalog } from "@eschaton/foldon";
import { createGenesisHost, generateDistrict, lastDistrict, settleDistrict, type DistrictRequest, type GenesisRequest, type GenesisResponse } from "@eschaton/genesis";
import { createWorld, hashState, serializeSnapshot, type WorldState } from "@eschaton/world";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!presetCatalog.ok) throw new Error("the preset catalog must build");
  return presetCatalog.value;
})();

const world: WorldState = (() => {
  const created = createWorld({ catalog, seed: 20_261_125 });
  if (!created.ok) throw new Error("world must build");
  return created.value;
})();

const district: DistrictRequest = { preset: lastDistrict, seed: 6, at: [0, 0, 0] };

function harness() {
  const posted: GenesisResponse[] = [];
  const tasks: (() => void)[] = [];
  const host = createGenesisHost({ post: (message) => posted.push(message), schedule: (task) => tasks.push(task) });
  const runOne = (): boolean => {
    const task = tasks.shift();
    task?.();
    return task !== undefined;
  };
  const request = (job: string, change: Partial<Extract<GenesisRequest, { type: "generate" }>> = {}): GenesisRequest => ({
    type: "generate",
    job,
    source: catalog.source(),
    fingerprint: catalog.fingerprint,
    snapshot: serializeSnapshot(world),
    request: district,
    ...change,
  });
  const outcome = (): unknown => {
    const done = posted.at(-1);
    return done?.type === "done" ? done.outcome : undefined;
  };
  return { host, posted, runOne, request, outcome };
}

test("a hosted job that crossed a structured clone commits to the same state hash as direct generation", () => {
  const { host, posted, runOne, request, outcome } = harness();
  host.receive(structuredClone(request("a")));
  while (runOne());
  const hosted = settleDistrict(catalog, world, structuredClone(outcome()), { cancelRequested: false, request: district });
  const direct = settleDistrict(catalog, world, generateDistrict(catalog, world, district), { cancelRequested: false, request: district });
  if (hosted.status !== "committed" || direct.status !== "committed") throw new Error(`${hosted.detail} / ${direct.detail}`);
  expect(hashState(hosted.committed.state)).toBe(hashState(direct.committed.state));
  expect(posted.filter((message) => message.type === "progress").length).toBeGreaterThan(10);
});

test("progress reports the plan and a lot count that never decreases before the result", () => {
  const { host, posted, runOne, request } = harness();
  host.receive(request("b"));
  while (runOne());
  const lots = posted.flatMap((message) => (message.type === "progress" && message.progress.plan !== undefined ? [message.progress.lotsDone] : []));
  expect([lots.length > 10, lots.every((count, index) => index === 0 || count >= (lots[index - 1] ?? 0))]).toEqual([true, true]);
});

test("a cancelled job posts one cancelled result without a proposal and stops working", () => {
  const { host, posted, runOne, request, outcome } = harness();
  host.receive(request("c"));
  runOne();
  runOne();
  host.receive({ type: "cancel", job: "c" });
  while (runOne());
  expect([outcome(), posted.filter((message) => message.type === "done").length]).toEqual([{ kind: "cancelled" }, 1]);
});

test("a wrong fingerprint and a broken snapshot each fail the job instead of hanging", () => {
  const kinds = [{ fingerprint: "0000000000000000" }, { snapshot: "{not a snapshot" }].map((change) => {
    const { host, runOne, request, outcome } = harness();
    host.receive(request("d", change));
    while (runOne());
    return outcome();
  });
  expect(kinds.map((result) => (typeof result === "object" && result !== null && "stage" in result ? result.stage : result))).toEqual(["host", "host"]);
});
