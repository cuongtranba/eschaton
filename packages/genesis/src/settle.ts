import { canonicalJson, type Catalog } from "@eschaton/foldon";
import { applyProposal, type Committed, type WorldState } from "@eschaton/world";
import { auditDistrict } from "./audit";
import { districtRegion, planRequestOf, type DistrictOutcome, type DistrictRequest } from "./district";
import { plannedTerminals } from "./plan";
import { planIssues } from "./validate";

export type DistrictSettlement =
  | Readonly<{ status: "committed"; detail: string; committed: Committed; district: Extract<DistrictOutcome, { kind: "generated" }> }>
  | Readonly<{ status: "cancelled" | "conflict" | "failed"; detail: string }>;

const isOutcome = (value: unknown): value is DistrictOutcome =>
  typeof value === "object" && value !== null && "kind" in value && (value.kind === "generated" || value.kind === "failed");

const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;

const isRegion = (value: unknown): boolean =>
  isObject(value) && "min" in value && "max" in value && Array.isArray(value.min) && Array.isArray(value.max);

const isDependency = (value: unknown): boolean => isObject(value) && "region" in value && isRegion(value.region) && "digest" in value && typeof value.digest === "string";

const wellFormed = (value: DistrictOutcome): value is Extract<DistrictOutcome, { kind: "generated" }> =>
  value.kind === "generated" &&
  isObject(value.plan) &&
  Array.isArray(value.plan.kinds) &&
  Array.isArray(value.plan.lots) &&
  Array.isArray(value.plan.gates) &&
  Array.isArray(value.at) &&
  isObject(value.proposal) &&
  isRegion(value.proposal.region) &&
  Array.isArray(value.proposal.ops) &&
  (value.proposal.depends === undefined || (Array.isArray(value.proposal.depends) && value.proposal.depends.every(isDependency))) &&
  isObject(value.metrics) &&
  isObject(value.metrics.lots) &&
  Array.isArray(value.diagnostics);

const sortedCanonical = (values: readonly unknown[]): string => canonicalJson(values.map((value) => canonicalJson(value)).sort());

function requestMismatch(outcome: Extract<DistrictOutcome, { kind: "generated" }>, request: DistrictRequest, worldSeed: number): string | undefined {
  const same = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);
  if (!same(outcome.at, request.at) || !same(outcome.plan.size, request.preset.size) || !same(outcome.proposal.region, districtRegion(request.preset, request.at))) {
    return "the result is not for the requested district box";
  }
  const { gates, river } = plannedTerminals(planRequestOf(request, worldSeed));
  if (!same(outcome.plan.gates, gates) || !same(outcome.plan.river, river)) return "the result is not planned for the requested road gates and river";
  const declared = (outcome.proposal.depends ?? []).map((dependency) => dependency.region);
  return sortedCanonical(declared) === sortedCanonical(request.depends ?? []) ? undefined : "the result does not declare exactly the dependencies the request relied on";
}

/**
 * The only way a generated district reaches the world. The result may come from another thread and is not trusted:
 * its shape is checked, its box, road gates, river and declared dependencies must be exactly those of the request it
 * answers, its plan is re-validated, the proposal is applied to get a candidate state, and that candidate is audited
 * against the plan from scratch. Only a clean candidate is returned as committed; nothing else changes.
 */
export function settleDistrict(
  catalog: Catalog,
  state: WorldState,
  outcome: unknown,
  options: Readonly<{ cancelRequested: boolean; request: DistrictRequest }>,
): DistrictSettlement {
  if (options.cancelRequested) return { status: "cancelled", detail: "cancelled; nothing was committed" };
  if (!isOutcome(outcome)) return { status: "failed", detail: "the generator returned a malformed result" };
  if (outcome.kind === "failed") return { status: "failed", detail: `${outcome.stage}: ${outcome.reason}` };
  if (!wellFormed(outcome)) return { status: "failed", detail: "the generator returned a malformed result" };
  const mismatch = requestMismatch(outcome, options.request, state.header.seed);
  if (mismatch !== undefined) return { status: "failed", detail: mismatch };
  const planned = planIssues(outcome.plan);
  if (planned.length > 0) return { status: "failed", detail: `the plan failed validation: ${planned.slice(0, 3).join("; ")}` };
  const applied = applyProposal(catalog, state, outcome.proposal);
  if (!applied.ok) {
    if (applied.error.kind === "conflict") return { status: "conflict", detail: "the district box or a network it depends on changed during generation; nothing was committed" };
    const detail = applied.error.kind === "invalid" ? applied.error.issues.map((issue) => `${issue.code}: ${issue.message}`).slice(0, 3).join("; ") : "the proposal was stale";
    return { status: "failed", detail };
  }
  const audit = auditDistrict(catalog, applied.value.state, outcome.plan, outcome.at);
  if (audit.length > 0) return { status: "failed", detail: `the result failed its audit: ${audit.slice(0, 3).join("; ")}` };
  const { metrics } = outcome;
  return {
    status: "committed",
    detail: `${metrics.placements} placements; ${metrics.roadCells} road, ${metrics.waterCells} water, ${metrics.bridgeCells} bridge cells; lots ${metrics.lots.tower} tower, ${metrics.lots.house} house, ${metrics.lots.ruin} ruin, ${metrics.lots.garden} garden`,
    committed: applied.value,
    district: outcome,
  };
}
