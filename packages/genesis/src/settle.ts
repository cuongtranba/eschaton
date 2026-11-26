import type { Catalog } from "@eschaton/foldon";
import { applyProposal, type Committed, type WorldState } from "@eschaton/world";
import { auditDistrict } from "./audit";
import type { DistrictOutcome } from "./district";
import { planIssues } from "./validate";

export type DistrictSettlement =
  | Readonly<{ status: "committed"; detail: string; committed: Committed; district: Extract<DistrictOutcome, { kind: "generated" }> }>
  | Readonly<{ status: "cancelled" | "conflict" | "failed"; detail: string }>;

const isOutcome = (value: unknown): value is DistrictOutcome =>
  typeof value === "object" && value !== null && "kind" in value && (value.kind === "generated" || value.kind === "failed");

const wellFormed = (value: DistrictOutcome): value is Extract<DistrictOutcome, { kind: "generated" }> =>
  value.kind === "generated" &&
  typeof value.plan === "object" &&
  Array.isArray(value.plan.kinds) &&
  Array.isArray(value.plan.lots) &&
  Array.isArray(value.at) &&
  typeof value.proposal === "object" &&
  Array.isArray(value.proposal.ops) &&
  typeof value.metrics === "object" &&
  typeof value.metrics.lots === "object" &&
  Array.isArray(value.diagnostics);

/**
 * The only way a generated district reaches the world. The result may come from another thread and is not trusted:
 * its shape and its plan are re-validated, the proposal is applied to get a candidate state, and that candidate is
 * audited against the plan from scratch. Only a clean candidate is returned as committed; nothing else changes.
 */
export function settleDistrict(catalog: Catalog, state: WorldState, outcome: unknown, options: Readonly<{ cancelRequested: boolean }>): DistrictSettlement {
  if (options.cancelRequested) return { status: "cancelled", detail: "cancelled; nothing was committed" };
  if (!isOutcome(outcome)) return { status: "failed", detail: "the generator returned a malformed result" };
  if (outcome.kind === "failed") return { status: "failed", detail: `${outcome.stage}: ${outcome.reason}` };
  if (!wellFormed(outcome)) return { status: "failed", detail: "the generator returned a malformed result" };
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
