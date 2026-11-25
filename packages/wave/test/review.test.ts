import {
  assemblyId,
  createCatalog,
  defineFoldon,
  foldonId,
  getPrimitive,
  placementId,
  presetCatalog,
  primitiveCatalog,
  type AssemblyRecipe,
  type Catalog,
} from "@eschaton/foldon";
import { compileTiles, createSolve, createWaveHost, prepareRegion, solve, type HostRequest, type HostResponse, type WaveProblem } from "@eschaton/wave";
import { applyPatch, createWorld, type WorldOp } from "@eschaton/world";
import { expect, test } from "vitest";

const preset: Catalog = (() => {
  if (!presetCatalog.ok) throw new Error("the preset catalog must build");
  return presetCatalog.value;
})();

const budget = { maxNodes: 20_000, maxBacktracks: 2_000 } as const;

test("an assembly whose leaf forbids a rotation is never proposed at a rotation the world rejects", () => {
  const box = getPrimitive(foldonId("P08"));
  if (box === undefined) throw new Error("P08 must exist");
  const fixed = defineFoldon({ ...box, id: foldonId("Q1"), version: 1, rotations: [0] });
  if (!fixed.ok) throw new Error("Q1 must be valid");
  const bar: AssemblyRecipe = {
    id: assemblyId("bar"),
    version: 1,
    name: "Bar of two fixed boxes",
    level: 1,
    tags: [],
    parts: [0, 1].map((x) => ({ id: placementId(`q${x}`), ref: { kind: "foldon", id: foldonId("Q1"), version: 1 }, anchor: [x, 0, 0], rotation: 0 })),
  };
  const built = createCatalog({ foldons: [...primitiveCatalog, fixed.value], assemblies: [bar] });
  if (!built.ok) throw new Error(JSON.stringify(built.error));
  const tiles = compileTiles(built.value, [{ ref: { kind: "assembly", id: "bar" }, weight: 1 }]);
  if (!tiles.ok) throw new Error(tiles.error.join("; "));
  const world = createWorld({ catalog: built.value, seed: 1 });
  if (!world.ok) throw new Error("world must build");
  const verdicts = [1, 2, 3, 4, 5, 6].map((seed) => {
    const outcome = solve(tiles.value, { size: [3, 1, 3], seed, airWeight: 1, ground: { profile: "ground" }, budget });
    if (outcome.kind !== "solved" || outcome.placements.length === 0) return outcome.kind;
    const ops = outcome.placements.map((p): WorldOp => ({ op: "instantiate", ref: p.ref, anchor: p.anchor, rotation: p.rotation }));
    const committed = applyPatch(built.value, world.value, { baseRevision: 0, ops, origin: { kind: "job", id: "t" } });
    return committed.ok ? "accepted" : "rejected by the world";
  });
  expect(verdicts.filter((verdict) => verdict === "rejected by the world")).toEqual([]);
  expect(verdicts).toContain("accepted");
});

test("weights too large for the 32-bit weighted draw are refused", () => {
  const tiles = compileTiles(preset, [{ ref: { kind: "foldon", id: "P07" }, weight: 2 ** 40 }]);
  const ok = compileTiles(preset, [{ ref: { kind: "foldon", id: "P07" }, weight: 1 }]);
  if (!ok.ok) throw new Error("tiles must compile");
  const air = solve(ok.value, { size: [4, 1, 4], seed: 1, airWeight: 2 ** 40, ground: { profile: "ground" }, budget });
  expect([tiles.ok, air.kind]).toEqual([false, "invalid"]);
});

test("a step count below one still makes progress", () => {
  const tiles = compileTiles(preset, [{ ref: { kind: "foldon", id: "P08" }, weight: 1 }]);
  if (!tiles.ok) throw new Error("tiles must compile");
  const job = createSolve(tiles.value, { size: [3, 1, 3], seed: 1, airWeight: 1, ground: { profile: "ground" }, budget });
  let outcome = job.step(0);
  for (let i = 0; i < 100 && outcome === undefined; i++) outcome = job.step(Number.NaN);
  expect(outcome?.kind).toBe("solved");
});

test("a malformed region request is refused before any solving", () => {
  const world = createWorld({ catalog: preset, seed: 1 });
  if (!world.ok) throw new Error("world must build");
  const request = { seed: 1, airWeight: 4, ground: { y: 0, profile: "ground" }, budget } as const;
  const refused = [
    prepareRegion(preset, world.value, { ...request, region: { min: [3, 0, 0], max: [0, 1, 3] } }),
    prepareRegion(preset, world.value, { ...request, region: { min: [0.5, 0, 0], max: [3.5, 1, 3] } }),
    prepareRegion(preset, world.value, { ...request, region: { min: [0, 0, 0], max: [3, 1, 3] }, seed: Number.NaN }),
    prepareRegion(preset, world.value, { ...request, region: { min: [0, 0, 0], max: [3, 1, 3] }, ground: { y: 0, profile: "no-such-profile" } }),
    prepareRegion(preset, world.value, { ...request, region: { min: [0, -2, 0], max: [3, 1, 3] } }),
  ];
  expect(refused.map((result) => result.ok)).toEqual([false, false, false, false, false]);
});

function hostHarness(post: (message: HostResponse) => void) {
  const tasks: (() => void)[] = [];
  const host = createWaveHost({ post, schedule: (task) => tasks.push(task) });
  const problem: WaveProblem = { size: [6, 3, 6], seed: 2, airWeight: 4, ground: { profile: "ground" }, budget };
  const request = (job: string): HostRequest => ({ type: "solve", job, source: preset.source(), fingerprint: preset.fingerprint, tiles: [{ ref: { kind: "foldon", id: "P08" }, weight: 1 }], problem, sliceNodes: 8 });
  const drain = (): void => {
    for (let task = tasks.shift(); task !== undefined; task = tasks.shift()) task();
  };
  return { host, request, drain };
}

test("a duplicate job id never produces a second done message", () => {
  const posted: HostResponse[] = [];
  const { host, request, drain } = hostHarness((message) => posted.push(message));
  host.receive(request("d"));
  host.receive(request("d"));
  drain();
  expect(posted.flatMap((message) => (message.type === "done" ? [message.outcome.kind] : []))).toEqual(["solved"]);
});

test("a job whose progress message cannot be posted still ends with one done and frees its id", () => {
  const posted: HostResponse[] = [];
  let failures = 1;
  const { host, request, drain } = hostHarness((message) => {
    if (message.type === "progress" && failures > 0) {
      failures -= 1;
      throw new Error("the port is gone");
    }
    posted.push(message);
  });
  host.receive(request("p"));
  drain();
  host.receive(request("p"));
  drain();
  expect(posted.flatMap((message) => (message.type === "done" ? [message.outcome.kind] : []))).toEqual(["failed", "solved"]);
});
