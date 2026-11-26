import { lastDistrict, planDistrict, planIssues, scopedSeed, type DistrictPlan, type PlanRequest } from "@eschaton/genesis";
import { expect, test } from "vitest";

const request = (seed: number, extra: Partial<PlanRequest> = {}): PlanRequest => ({
  rules: lastDistrict.rules,
  worldSeed: 20_261_125,
  seed,
  size: lastDistrict.size,
  gates: lastDistrict.gates,
  ...(lastDistrict.river === undefined ? {} : { river: lastDistrict.river }),
  ...extra,
});

function planned(seed: number): DistrictPlan {
  const result = planDistrict(request(seed));
  if (!result.ok) throw new Error(`${result.error.stage}: ${result.error.reason}`);
  return result.value;
}

test("the same request gives the same plan", () => {
  expect(planned(4)).toEqual(planned(4));
});

test("twelve seeds give twelve different plans that satisfy every global constraint", () => {
  const plans = Array.from({ length: 12 }, (_, i) => planned(i + 1));
  expect(plans.map(planIssues)).toEqual(plans.map(() => []));
  expect(new Set(plans.map((plan) => plan.kinds.join(""))).size).toBe(12);
});

test("a plan has a river, connected roads, a plaza and lots of several roles", () => {
  const plan = planned(2);
  const count = (kind: string): number => plan.kinds.filter((cell) => cell === kind).length;
  const roles = new Set(plan.lots.map((lot) => lot.role));
  expect([count("water") > 40, count("road") > 40, count("bridge") > 0, count("plaza"), plan.lots.length > 15, roles.size >= 3]).toEqual([true, true, true, 16, true, true]);
});

test("a scope seed does not depend on the order in which scopes are used", () => {
  const first = [scopedSeed(1, 2, "last-district", "river", 0), scopedSeed(1, 2, "last-district", "lots", 0)];
  const second = [scopedSeed(1, 2, "last-district", "lots", 0), scopedSeed(1, 2, "last-district", "river", 0)];
  expect(first).toEqual([second[1], second[0]]);
});

test("a road contract that needs a bridge fails explicitly when the rules allow none", () => {
  const result = planDistrict(request(1, { rules: { ...lastDistrict.rules, maxBridges: 0 } }));
  expect(result.ok ? "planned" : [result.error.stage, result.error.attempts > 0]).toEqual(["roads", true]);
});

test("a gate placed in the river fails explicitly", () => {
  const result = planDistrict(request(1, { gates: [{ edge: "north", at: 27 }] }));
  expect(result.ok ? "planned" : result.error.stage).toBe("roads");
});

test("a malformed request is refused before planning", () => {
  const results = [planDistrict(request(1, { size: [4, 4] })), planDistrict(request(1, { gates: [] })), planDistrict(request(1, { gates: [{ edge: "west", at: 400 }] }))];
  expect(results.map((result) => (result.ok ? "planned" : result.error.stage))).toEqual(["request", "request", "request"]);
});

test("the validators catch a road that was cut and a lot placed on the river", () => {
  const plan = planned(3);
  const [width] = plan.size;
  const gate = plan.gates[0];
  const route = plan.routes[0];
  const cut = route?.[Math.floor(route.length / 2)];
  const waterCell = plan.kinds.indexOf("water");
  if (gate === undefined || cut === undefined) throw new Error("the plan must have a gate route");
  const severed: DistrictPlan = { ...plan, kinds: plan.kinds.map((kind, index) => (index === cut[1] * width + cut[0] ? "open" : kind)) };
  const flooded: DistrictPlan = { ...plan, kinds: plan.kinds.map((kind, index) => (index === waterCell ? "lot" : kind)) };
  expect([planIssues(severed).length > 0, planIssues(flooded).length > 0]).toEqual([true, true]);
});
