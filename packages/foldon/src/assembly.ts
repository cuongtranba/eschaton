import {
  allRotations,
  cellKey,
  faceNormal,
  oppositeFace,
  socketsCompatible,
  type Rotation,
  type SocketDefinition,
  type FoldonDefinition,
} from "./definition";
import { canonicalizeAndFreeze } from "./define";
import type { AssemblyId, FoldonId, PlacementId } from "./ids";
import { socketId } from "./ids";
import { issue, type ValidationIssue } from "./issues";
import { err, ok, type Result } from "./result";
import { placeFootprint, placeSockets } from "./transform";
import { add, type Cell } from "./vec";

export type PartRef =
  | Readonly<{ kind: "foldon"; id: FoldonId; version: number }>
  | Readonly<{ kind: "assembly"; id: AssemblyId; version: number }>;

export type AssemblyPart = Readonly<{
  id: PlacementId;
  ref: PartRef;
  anchor: Cell;
  rotation: Rotation;
}>;

export type AssemblyLevel = 1 | 2 | 3;

export type AssemblyRecipe = Readonly<{
  id: AssemblyId;
  version: number;
  name: string;
  level: AssemblyLevel;
  parts: readonly AssemblyPart[];
  tags: readonly string[];
}>;

export type AssemblyDefinition = Readonly<{
  recipe: AssemblyRecipe;
  hash: string;
  footprint: readonly Cell[];
  bounds: Readonly<{ min: Cell; max: Cell }>;
  sockets: readonly SocketDefinition[];
  semantics: Readonly<{ roles: readonly string[]; partCount: number; foldonCount: number }>;
  validation: "valid";
}>;

export type ResolvedPart =
  | Readonly<{ kind: "foldon"; definition: FoldonDefinition }>
  | Readonly<{ kind: "assembly"; definition: AssemblyDefinition }>;

export type RefResolver = (ref: PartRef) => Result<ResolvedPart, "ref-unknown" | "ref-version-unknown">;

const LEVELS: readonly number[] = [1, 2, 3];
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

function fnv1a64(text: string): string {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(text)) {
    hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}

const compareNumbers = (a: readonly number[], b: readonly number[]): number => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
};

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const refKey = (ref: PartRef): string => `${ref.kind}:${ref.id}@${ref.version}`;

export function recipeHash(recipe: AssemblyRecipe): string {
  const canonical = recipe.parts
    .map((part) => ({ part, key: refKey(part.ref) }))
    .sort(
      (a, b) =>
        compareNumbers([...a.part.anchor, a.part.rotation], [...b.part.anchor, b.part.rotation]) ||
        compareText(a.key, b.key),
    )
    .map(({ part, key }) => `${part.anchor.join(",")}|${part.rotation}|${key}`);
  return fnv1a64(canonical.join(";"));
}

type PlacedPart = Readonly<{
  index: number;
  cells: readonly Cell[];
  sockets: readonly SocketDefinition[];
}>;

function metaIssues(recipe: AssemblyRecipe): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (recipe.id.length === 0) issues.push(issue("id-invalid", "id", "id must not be empty"));
  if (!Number.isInteger(recipe.version) || recipe.version < 1) {
    issues.push(issue("version-invalid", "version", "version must be an integer >= 1"));
  }
  if (!LEVELS.includes(recipe.level)) issues.push(issue("level-invalid", "level", "level must be 1, 2 or 3"));
  if (recipe.parts.length === 0) issues.push(issue("recipe-empty", "parts", "an assembly needs at least one part"));
  const seen = new Set<string>();
  recipe.parts.forEach((part, i) => {
    if (seen.has(part.id)) issues.push(issue("part-duplicate-id", `parts[${i}].id`, `duplicate part id ${part.id}`));
    seen.add(part.id);
  });
  return issues;
}

function partShapeIssues(part: AssemblyPart, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!part.anchor.every(Number.isInteger)) {
    issues.push(issue("part-invalid", `${path}.anchor`, "anchor coordinates must be integers"));
  }
  if (!allRotations.includes(part.rotation)) {
    issues.push(issue("part-invalid", `${path}.rotation`, "rotation must be 0, 1, 2 or 3"));
  }
  return issues;
}

function placeParts(recipe: AssemblyRecipe, resolve: RefResolver, issues: ValidationIssue[]): readonly PlacedPart[] {
  return recipe.parts.flatMap((part, index): PlacedPart[] => {
    const path = `parts[${index}]`;
    const shape = partShapeIssues(part, path);
    issues.push(...shape);
    if (shape.length > 0) return [];
    const resolved = resolve(part.ref);
    if (!resolved.ok) {
      issues.push(issue(resolved.error, `${path}.ref`, `cannot resolve ${refKey(part.ref)}`));
      return [];
    }
    const target = resolved.value;
    if (target.kind === "foldon" && !target.definition.rotations.includes(part.rotation)) {
      issues.push(
        issue("part-rotation-not-allowed", `${path}.rotation`, `${part.ref.id} does not allow rotation ${part.rotation}`),
      );
      return [];
    }
    if (target.kind === "assembly" && target.definition.recipe.level >= recipe.level) {
      issues.push(
        issue(
          "level-not-above-children",
          `${path}.ref`,
          `level ${recipe.level} must exceed nested ${part.ref.id} at level ${target.definition.recipe.level}`,
        ),
      );
    }
    const pose = { anchor: part.anchor, rotation: part.rotation };
    return [
      {
        index,
        cells: placeFootprint(target.definition, pose),
        sockets: placeSockets(target.definition, pose),
      },
    ];
  });
}

function overlapIssues(placed: readonly PlacedPart[]): { owners: Map<string, number>; issues: ValidationIssue[] } {
  const owners = new Map<string, number>();
  const issues: ValidationIssue[] = [];
  const reported = new Set<string>();
  for (const part of placed) {
    for (const cell of part.cells) {
      const key = cellKey(cell);
      const owner = owners.get(key);
      if (owner === undefined) {
        owners.set(key, part.index);
        continue;
      }
      const pair = `${owner}:${part.index}`;
      if (owner !== part.index && !reported.has(pair)) {
        reported.add(pair);
        issues.push(issue("part-overlap", `parts[${part.index}]`, `occupies cell ${key} already held by parts[${owner}]`));
      }
    }
  }
  return { owners, issues };
}

const socketSlot = (cell: Cell, face: SocketDefinition["face"]): string => `${cellKey(cell)}${face}`;

function facingIssues(placed: readonly PlacedPart[], owners: ReadonlyMap<string, number>): ValidationIssue[] {
  const slots = new Map<string, SocketDefinition>();
  for (const part of placed) for (const socket of part.sockets) slots.set(socketSlot(socket.cell, socket.face), socket);
  const issues: ValidationIssue[] = [];
  for (const part of placed) {
    for (const socket of part.sockets) {
      const across = add(socket.cell, faceNormal[socket.face]);
      const otherIndex = owners.get(cellKey(across));
      if (otherIndex === undefined || otherIndex <= part.index) continue;
      const mate = slots.get(socketSlot(across, oppositeFace[socket.face]));
      if (mate !== undefined && !socketsCompatible(socket, mate)) {
        issues.push(
          issue(
            "socket-incompatible",
            `parts[${part.index}]`,
            `${socket.profile} face ${socket.face} at ${cellKey(socket.cell)} does not mate with ${mate.profile} of parts[${otherIndex}]`,
          ),
        );
      }
    }
  }
  return issues;
}

function boundsOf(cells: readonly Cell[]): Readonly<{ min: Cell; max: Cell }> {
  const axis = (i: 0 | 1 | 2): readonly [number, number] => [
    Math.min(...cells.map((c) => c[i])),
    Math.max(...cells.map((c) => c[i])),
  ];
  const [x, y, z] = [axis(0), axis(1), axis(2)];
  return { min: [x[0], y[0], z[0]], max: [x[1], y[1], z[1]] };
}

function summarize(recipe: AssemblyRecipe, resolve: RefResolver): AssemblyDefinition["semantics"] {
  const roles = new Set(recipe.tags);
  let foldonCount = 0;
  for (const part of recipe.parts) {
    const resolved = resolve(part.ref);
    if (!resolved.ok) continue;
    if (resolved.value.kind === "foldon") {
      foldonCount += 1;
      resolved.value.definition.tags.forEach((tag) => roles.add(tag));
    } else {
      foldonCount += resolved.value.definition.semantics.foldonCount;
      resolved.value.definition.semantics.roles.forEach((role) => roles.add(role));
    }
  }
  return { roles: [...roles].sort(compareText), partCount: recipe.parts.length, foldonCount };
}

export function compileAssembly(
  recipe: AssemblyRecipe,
  resolve: RefResolver,
): Result<AssemblyDefinition, readonly ValidationIssue[]> {
  const issues = metaIssues(recipe);
  const placed = placeParts(recipe, resolve, issues);
  const overlap = overlapIssues(placed);
  issues.push(...overlap.issues, ...facingIssues(placed, overlap.owners));
  if (issues.length > 0) return err(issues);

  const footprint = placed
    .flatMap((part) => part.cells)
    .sort((a, b) => compareNumbers([a[0], a[1], a[2]], [b[0], b[1], b[2]]));
  const sockets = placed
    .flatMap((part) => part.sockets)
    .filter((socket) => !overlap.owners.has(cellKey(add(socket.cell, faceNormal[socket.face]))))
    .map((socket) => ({ ...socket, id: socketId(socketSlot(socket.cell, socket.face)) }))
    .sort((a, b) => compareText(a.id, b.id));

  const definition: AssemblyDefinition = structuredClone({
    recipe,
    hash: recipeHash(recipe),
    footprint,
    bounds: boundsOf(footprint),
    sockets,
    semantics: summarize(recipe, resolve),
    validation: "valid",
  });
  canonicalizeAndFreeze(definition);
  return ok(definition);
}
