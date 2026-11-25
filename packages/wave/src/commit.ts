import type { Catalog } from "@eschaton/foldon";
import { applyProposal, type Committed, type Origin, type WorldState } from "@eschaton/world";
import type { JobOutcome } from "./host";
import { proposalOf, type RegionJob } from "./region";
import type { TileSpec } from "./solver/shape";
import type { WaveOutcome } from "./solver/solve";
import { verifyPlacements } from "./verify";

export type SettleStatus = "committed" | "cancelled" | "conflict" | "unsatisfiable" | "budget-exceeded" | "failed";

export type Settlement =
  | Readonly<{ status: "committed"; detail: string; committed: Committed }>
  | Readonly<{ status: Exclude<SettleStatus, "committed">; detail: string }>;

export type SettleOptions = Readonly<{ origin: Origin; cancelRequested: boolean }>;

const KINDS: readonly string[] = ["solved", "unsatisfiable", "budget-exceeded", "invalid", "cancelled", "failed"];

const isOutcome = (value: unknown): value is JobOutcome =>
  typeof value === "object" && value !== null && "kind" in value && typeof value.kind === "string" && KINDS.includes(value.kind);

const isSolved = (value: JobOutcome): value is Extract<WaveOutcome, { kind: "solved" }> =>
  value.kind === "solved" && "placements" in value && Array.isArray(value.placements) && "stats" in value && typeof value.stats === "object";

/**
 * The only way a job result reaches the world. The result is data from another thread and is not trusted: its shape
 * is checked, a requested cancel wins even over a finished solve, the placements are verified from the rules, and
 * only then is the proposal applied, once, under the world's own read-set and invariant checks.
 */
export function settleJob(catalog: Catalog, state: WorldState, job: RegionJob, tiles: readonly TileSpec[], outcome: unknown, options: SettleOptions): Settlement {
  if (options.cancelRequested) return { status: "cancelled", detail: "cancelled; nothing was committed" };
  if (!isOutcome(outcome)) return { status: "failed", detail: "the solver returned a malformed result" };
  switch (outcome.kind) {
    case "unsatisfiable":
      return { status: "unsatisfiable", detail: outcome.reason };
    case "budget-exceeded":
      return { status: "budget-exceeded", detail: `stopped after ${outcome.stats.nodes} decisions and ${outcome.stats.backtracks} backtracks` };
    case "cancelled":
      return { status: "cancelled", detail: "cancelled; nothing was committed" };
    case "invalid":
      return { status: "failed", detail: outcome.issues.join("; ") };
    case "failed":
      return { status: "failed", detail: outcome.reason };
    case "solved":
      break;
  }
  if (!isSolved(outcome)) return { status: "failed", detail: "the solver returned a malformed result" };
  const broken = verifyPlacements(catalog, tiles, job.problem, outcome.placements);
  if (broken.length > 0) return { status: "failed", detail: `the result failed verification: ${broken.slice(0, 3).join("; ")}` };
  const result = applyProposal(catalog, state, proposalOf(job, outcome, options.origin));
  if (!result.ok) {
    if (result.error.kind === "conflict") return { status: "conflict", detail: "the region changed while it was being solved; nothing was committed" };
    const detail = result.error.kind === "invalid" ? result.error.issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ") : "the proposal was stale";
    return { status: "failed", detail };
  }
  const airCells = typeof outcome.airCells === "number" ? outcome.airCells : 0;
  return {
    status: "committed",
    detail: `${outcome.placements.length} pieces, ${airCells} air cells, ${outcome.stats.nodes} decisions, ${outcome.stats.backtracks} backtracks`,
    committed: result.value,
  };
}
