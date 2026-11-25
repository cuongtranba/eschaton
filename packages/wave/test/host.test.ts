import { presetCatalog, type Catalog } from "@eschaton/foldon";
import { compileTiles, createWaveHost, solve, type HostRequest, type HostResponse, type TileSpec, type WaveProblem } from "@eschaton/wave";
import { expect, test } from "vitest";

const catalog: Catalog = (() => {
  if (!presetCatalog.ok) throw new Error("the preset catalog must build");
  return presetCatalog.value;
})();

const tiles: readonly TileSpec[] = [
  { ref: { kind: "foldon", id: "P08" }, weight: 6 },
  { ref: { kind: "foldon", id: "P03" }, weight: 3 },
  { ref: { kind: "assembly", id: "l-block" }, weight: 2 },
];
const problem: WaveProblem = { size: [8, 4, 8], seed: 5, airWeight: 4, ground: { profile: "ground" }, budget: { maxNodes: 20_000, maxBacktracks: 2_000 } };

function harness() {
  const posted: HostResponse[] = [];
  const tasks: (() => void)[] = [];
  const host = createWaveHost({ post: (message) => posted.push(message), schedule: (task) => tasks.push(task) });
  const runOne = (): boolean => {
    const task = tasks.shift();
    task?.();
    return task !== undefined;
  };
  const request = (job: string, fingerprint = catalog.fingerprint): HostRequest => ({ type: "solve", job, source: catalog.source(), fingerprint, tiles, problem, sliceNodes: 20 });
  return { host, posted, runOne, request };
}

test("a job runs in slices, reports progress, and finishes with the same result as a direct solve", () => {
  const { host, posted, runOne, request } = harness();
  host.receive(request("a"));
  expect(posted).toEqual([]);
  while (runOne());
  const compiled = compileTiles(catalog, tiles);
  if (!compiled.ok) throw new Error("tiles must compile");
  const done = posted.at(-1);
  expect(posted.filter((message) => message.type === "progress").length).toBeGreaterThan(2);
  expect(done?.type === "done" ? done.outcome : undefined).toEqual(solve(compiled.value, problem));
});

test("a cancelled job ends as cancelled, returns no placements and stops working", () => {
  const { host, posted, runOne, request } = harness();
  host.receive(request("b"));
  runOne();
  host.receive({ type: "cancel", job: "b" });
  while (runOne());
  const done = posted.at(-1);
  expect(done?.type === "done" ? [done.outcome.kind, "placements" in done.outcome] : []).toEqual(["cancelled", false]);
  expect(posted.filter((message) => message.type === "done")).toHaveLength(1);
});

test("a catalog source that does not match the expected fingerprint fails the job", () => {
  const { host, posted, runOne, request } = harness();
  host.receive(request("c", "0000000000000000"));
  while (runOne());
  expect(posted.map((message) => (message.type === "done" ? message.outcome.kind : message.type))).toEqual(["failed"]);
});
