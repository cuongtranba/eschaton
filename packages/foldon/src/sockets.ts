import { isVerticalFace, turnOf, type SocketDefinition, type SocketProfile, type Turn } from "./definition";
import { canonicalizeAndFreeze } from "./define";
import { issue, type ValidationIssue } from "./issues";
import { err, ok, type Result } from "./result";
import { distance, dot } from "./vec";

export type ProfileSpec = Readonly<{
  id: SocketProfile;
  symmetry: 1 | 2 | 4;
  handed: boolean;
  wildcard: boolean;
  structural: boolean;
  needsMate: boolean;
}>;

export type MateSpec = Readonly<{ a: SocketProfile; b: SocketProfile; relation: Turn; bond: boolean }>;

export type SocketTable = Readonly<{
  version: number;
  profiles: readonly ProfileSpec[];
  mates: readonly MateSpec[];
}>;

export type SocketMismatch = "position" | "normal" | "profile" | "turn" | "hand";

const plain = (id: SocketProfile): ProfileSpec => ({ id, symmetry: 4, handed: false, wildcard: false, structural: true, needsMate: false });

function frozen<T>(value: T): T {
  canonicalizeAndFreeze(value);
  return value;
}

export const defaultSocketTable: SocketTable = frozen({
  version: 3,
  profiles: [
    { id: "empty", symmetry: 4, handed: false, wildcard: false, structural: false, needsMate: false },
    plain("ground"),
    plain("deck"),
    { ...plain("base"), needsMate: true },
    plain("wall"),
    plain("eave"),
    plain("beam"),
    { id: "open", symmetry: 4, handed: false, wildcard: true, structural: true, needsMate: false },
  ],
  mates: [
    { a: "empty", b: "empty", relation: 0, bond: false },
    { a: "deck", b: "base", relation: 0, bond: true },
    { a: "ground", b: "base", relation: 0, bond: true },
    { a: "wall", b: "wall", relation: 0, bond: true },
    { a: "eave", b: "eave", relation: 0, bond: true },
    { a: "beam", b: "beam", relation: 0, bond: true },
    { a: "beam", b: "wall", relation: 0, bond: true },
  ],
});

const SYMMETRIES: readonly number[] = [1, 2, 4];
const TURNS: readonly number[] = [0, 1, 2, 3];

export const profileSpec = (table: SocketTable, id: SocketProfile): ProfileSpec | undefined =>
  table.profiles.find((profile) => profile.id === id);

const mod4 = (n: number): number => ((n % 4) + 4) % 4;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);

function relationFrom(table: SocketTable, lower: SocketProfile, upper: SocketProfile): number | undefined {
  for (const mate of table.mates) {
    if (mate.a === lower && mate.b === upper) return mate.relation;
    if (mate.a === upper && mate.b === lower) return mod4(-mate.relation);
  }
  return undefined;
}

function turnMatches(table: SocketTable, lower: SocketDefinition, upper: SocketDefinition, symmetry: number): boolean {
  if (symmetry === 4) return true;
  const relation = relationFrom(table, lower.profile, upper.profile);
  const [from, to] = [turnOf(lower.tangent), turnOf(upper.tangent)];
  if (relation === undefined || from === undefined || to === undefined) return false;
  return mod4(to - from - relation) % (4 / symmetry) === 0;
}

function handsMatch(a: SocketDefinition, b: SocketDefinition, handed: boolean): boolean {
  if (!handed) return a.hand === undefined && b.hand === undefined;
  return a.hand !== undefined && b.hand !== undefined && a.hand !== b.hand;
}

export function socketMismatches(table: SocketTable, a: SocketDefinition, b: SocketDefinition): readonly SocketMismatch[] {
  const tolerance = Math.max(a.tolerance, b.tolerance);
  const reasons: SocketMismatch[] = [];
  if (distance(a.position, b.position) > tolerance) reasons.push("position");
  const opposed = dot(a.normal, b.normal) <= -1 + tolerance;
  if (!opposed) reasons.push("normal");
  const [specA, specB] = [profileSpec(table, a.profile), profileSpec(table, b.profile)];
  if (specA?.wildcard === true || specB?.wildcard === true) return reasons;
  if (specA === undefined || specB === undefined || relationFrom(table, a.profile, b.profile) === undefined) {
    return [...reasons, "profile"];
  }
  if (!opposed) return reasons;
  if (a.normal[1] < -tolerance || b.normal[1] < -tolerance) {
    const [lower, upper] = a.normal[1] < 0 ? [b, a] : [a, b];
    return turnMatches(table, lower, upper, lcm(specA.symmetry, specB.symmetry)) ? reasons : [...reasons, "turn"];
  }
  return handsMatch(a, b, specA.handed || specB.handed) ? reasons : [...reasons, "hand"];
}

/**
 * Contact, legal adjacency and bond eligibility are three different facts. Two sockets are in contact when their
 * faces coincide; the adjacency is legal when `socketMismatches` is empty; the pair is bond-eligible only when it is
 * legal AND the table lists that profile pair explicitly with `bond: true`. A wildcard makes an adjacency legal but
 * never bonds by itself.
 */
export function bondEligible(table: SocketTable, a: SocketDefinition, b: SocketDefinition): boolean {
  const listed = table.mates.find((mate) => (mate.a === a.profile && mate.b === b.profile) || (mate.a === b.profile && mate.b === a.profile));
  return listed?.bond === true && socketMismatches(table, a, b).length === 0;
}

export function socketsCompatible(a: SocketDefinition, b: SocketDefinition): boolean {
  return socketMismatches(defaultSocketTable, a, b).length === 0;
}

function profileIssues(table: SocketTable): ValidationIssue[] {
  const seen = new Set<string>();
  return table.profiles.flatMap((profile, i) => {
    const found: ValidationIssue[] = [];
    if (profile.id.length === 0) found.push(issue("socket-table-invalid", `profiles[${i}].id`, "profile id must not be empty"));
    if (seen.has(profile.id)) {
      found.push(issue("socket-table-invalid", `profiles[${i}].id`, `profile ${profile.id} is listed more than once`));
    }
    seen.add(profile.id);
    if (profile.wildcard && profile.needsMate) {
      found.push(issue("socket-table-invalid", `profiles[${i}].needsMate`, "a wildcard profile cannot require a mate"));
    }
    if (!SYMMETRIES.includes(profile.symmetry)) {
      found.push(issue("socket-table-invalid", `profiles[${i}].symmetry`, "symmetry must be 1, 2 or 4"));
    }
    return found;
  });
}

function mateIssues(table: SocketTable): ValidationIssue[] {
  const known = new Set(table.profiles.map((profile) => profile.id));
  const seen = new Set<string>();
  return table.mates.flatMap((mate, i) => {
    const path = `mates[${i}]`;
    const found: ValidationIssue[] = [];
    for (const side of ["a", "b"] as const) {
      if (!known.has(mate[side])) {
        found.push(issue("socket-profile-unknown", `${path}.${side}`, `profile ${mate[side]} is not in the table`));
      }
    }
    const key = [mate.a, mate.b].sort().join("\u0000");
    if (seen.has(key)) found.push(issue("socket-table-invalid", path, `pair ${mate.a}-${mate.b} is listed more than once`));
    seen.add(key);
    if (!TURNS.includes(mate.relation)) {
      found.push(issue("socket-table-invalid", `${path}.relation`, "relation must be 0, 1, 2 or 3"));
    } else if (mate.a === mate.b && mate.relation % 2 !== 0) {
      found.push(issue("socket-table-invalid", `${path}.relation`, "a profile mating with itself needs relation 0 or 2"));
    }
    if (mate.bond && [mate.a, mate.b].some((id) => profileSpec(table, id)?.structural === false)) {
      found.push(issue("socket-table-invalid", `${path}.bond`, `pair ${mate.a}-${mate.b} names a non-structural profile and can never bond`));
    }
    return found;
  });
}

export function validateSocketTable(table: SocketTable): Result<SocketTable, readonly ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  if (!Number.isInteger(table.version) || table.version < 1) {
    issues.push(issue("socket-table-invalid", "version", "version must be an integer >= 1"));
  }
  issues.push(...profileIssues(table), ...mateIssues(table));
  return issues.length === 0 ? ok(table) : err(issues);
}

export function catalogSocketIssues(table: SocketTable, sockets: readonly SocketDefinition[]): ValidationIssue[] {
  return sockets.flatMap((socket, i) => {
    const spec = profileSpec(table, socket.profile);
    if (spec === undefined) {
      return [issue("socket-profile-unknown", `sockets[${i}].profile`, `profile ${socket.profile} is not in the socket table`)];
    }
    if (isVerticalFace(socket.face)) return [];
    const needsHand = spec.handed;
    const hasHand = socket.hand !== undefined;
    return needsHand === hasHand
      ? []
      : [
          issue(
            "socket-hand-invalid",
            `sockets[${i}].hand`,
            needsHand ? `side face of handed profile ${spec.id} needs a hand` : `profile ${spec.id} is not handed`,
          ),
        ];
  });
}
