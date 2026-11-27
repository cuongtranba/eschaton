import { err, ok, type Result } from "@eschaton/foldon";
import type { Decision, Elimination } from "./assembly";

export type Value = number | string;
export type Assignment = Readonly<Record<string, Value>>;

/** A finite-domain variable. Values are tried in the given order (the caller orders by distance to its target). */
export type Variable = Readonly<{ name: string; domain: readonly Value[] }>;

/**
 * A constraint over `scope`. `check` sees an assignment that contains every variable of the scope and returns true or the
 * reason it is violated. Constraints are local (ports, sequences) or global (measured geometry); the solver treats both
 * the same way, the object plan owns them.
 */
export type Constraint = Readonly<{ name: string; scope: readonly string[]; check: (a: Assignment) => true | string; /** Expensive: checked only on complete assignments of its scope, never during forward pruning. */ lazy?: boolean }>;

export type SolveLog = Readonly<{ decisions: readonly Decision[]; nodes: number; backtracks: number; eliminations: number }>;
export type SolveError = Readonly<{ code: "unsatisfiable" | "budget"; message: string; log: SolveLog }>;

/**
 * Backtracking search with forward checking and either minimum-remaining-values or the plan's static variable order
 * (an object plan lists coupled variables first so a dead end backtracks to the variables that cause it). After each assignment every constraint
 * left with exactly one unassigned variable prunes that variable's domain; a wiped-out domain backtracks. Every pruned
 * value is logged with the constraint that eliminated it, so the decision record shows which choices the constraints
 * removed. Deterministic: no randomness inside; value order is the caller's.
 */
export function solve(variables: readonly Variable[], constraints: readonly Constraint[], budget = 20_000, order: "static" | "mrv" = "mrv"): Result<Readonly<{ assignment: Assignment; log: SolveLog }>, SolveError> {
  const names = new Set(variables.map((v) => v.name));
  for (const c of constraints) for (const s of c.scope) if (!names.has(s)) throw new Error(`constraint ${c.name} names unknown variable ${s}`);
  let nodes = 0;
  let backtracks = 0;
  let eliminations = 0;
  const eliminated = new Map<string, Elimination[]>();
  const chosen = new Map<string, Value>();

  type Domains = ReadonlyMap<string, readonly Value[]>;
  const initial: Domains = new Map(variables.map((v) => [v.name, v.domain] as const));

  const prune = (assignment: Record<string, Value>, domains: Domains): Domains | undefined => {
    const next = new Map(domains);
    for (const c of constraints) {
      if (c.lazy === true) continue;
      const open = c.scope.filter((s) => !(s in assignment));
      if (open.length === 0) continue;
      if (open.length > 1) continue;
      const target = open[0] ?? "";
      const keep: Value[] = [];
      for (const value of next.get(target) ?? []) {
        const verdict = c.check({ ...assignment, [target]: value });
        if (verdict === true) keep.push(value);
        else {
          eliminations += 1;
          const list = eliminated.get(target) ?? [];
          if (list.length < 40) list.push({ value: String(value), by: `${c.name}: ${verdict}` });
          eliminated.set(target, list);
        }
      }
      if (keep.length === 0) return undefined;
      next.set(target, keep);
    }
    return next;
  };

  const consistent = (assignment: Record<string, Value>): string | true => {
    for (const c of constraints) {
      if (!c.scope.every((s) => s in assignment)) continue;
      const verdict = c.check(assignment);
      if (verdict !== true) return `${c.name}: ${verdict}`;
    }
    return true;
  };

  const search = (assignment: Record<string, Value>, domains: Domains): Record<string, Value> | undefined | "budget" => {
    const open = variables.filter((v) => !(v.name in assignment));
    if (open.length === 0) return assignment;
    const first = open[0];
    if (first === undefined) return assignment;
    const pick = order === "static" ? first : open.reduce((best, v) => ((domains.get(v.name)?.length ?? 0) < (domains.get(best.name)?.length ?? 0) ? v : best));
    for (const value of domains.get(pick.name) ?? []) {
      nodes += 1;
      if (nodes > budget) return "budget";
      const trial = { ...assignment, [pick.name]: value };
      const verdict = consistent(trial);
      if (verdict !== true) {
        eliminations += 1;
        const list = eliminated.get(pick.name) ?? [];
        if (list.length < 40) list.push({ value: String(value), by: verdict });
        eliminated.set(pick.name, list);
        continue;
      }
      const pruned = prune(trial, new Map(domains).set(pick.name, [value]));
      if (pruned === undefined) {
        backtracks += 1;
        continue;
      }
      chosen.set(pick.name, value);
      const found = search(trial, pruned);
      if (found !== undefined) return found;
      backtracks += 1;
    }
    return undefined;
  };

  const start = prune({}, initial);
  const result = start === undefined ? undefined : search({}, start);
  const log = (): SolveLog => ({
    decisions: variables.map((v) => ({ variable: v.name, value: String(result !== undefined && result !== "budget" ? result[v.name] : chosen.get(v.name) ?? ""), eliminated: eliminated.get(v.name) ?? [] })),
    nodes,
    backtracks,
    eliminations,
  });
  if (result === "budget") return err({ code: "budget", message: `search exceeded ${budget} nodes`, log: log() });
  if (result === undefined) return err({ code: "unsatisfiable", message: "no assignment satisfies the constraints", log: log() });
  return ok({ assignment: result, log: log() });
}

/** Orders a numeric ladder by distance to a target, nearest first (ties keep ladder order). */
export function nearest(ladder: readonly number[], target: number): readonly number[] {
  return ladder.map((v, i) => [v, i] as const).sort((a, b) => Math.abs(a[0] - target) - Math.abs(b[0] - target) || a[1] - b[1]).map(([v]) => v);
}
