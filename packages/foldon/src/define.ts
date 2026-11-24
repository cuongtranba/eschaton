import { allRotations, type FoldonDefinition, type FoldonInput } from "./definition";
import type { ValidationIssue } from "./issues";
import { err, type Result } from "./result";
import { validateFoldon } from "./validate";

function canonicalizeAndFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item: unknown, i) => {
      if (typeof item === "number" && Object.is(item, -0)) value[i] = 0;
      canonicalizeAndFreeze(item);
    });
  } else {
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "number" && Object.is(item, -0)) Reflect.set(value, key, 0);
      canonicalizeAndFreeze(item);
    }
  }
  Object.freeze(value);
}

export function defineFoldon(input: FoldonInput): Result<FoldonDefinition, readonly ValidationIssue[]> {
  const definition: FoldonDefinition = structuredClone({
    id: input.id,
    version: input.version ?? 1,
    name: input.name,
    footprint: input.footprint,
    geometry: input.geometry,
    sockets: input.sockets,
    rotations: input.rotations ?? allRotations,
    components: input.components,
    tags: input.tags ?? [],
    weight: input.weight ?? 1,
  });
  const validated = validateFoldon(definition);
  if (!validated.ok) return err(validated.error);
  canonicalizeAndFreeze(definition);
  return validated;
}
