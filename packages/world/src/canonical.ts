const sortedKeys = (key: string, value: unknown): unknown => {
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`canonical form refuses the non-finite number at ${key}`);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const sorted: Record<string, unknown> = {};
  for (const name of Object.keys(value).sort()) sorted[name] = (value as Readonly<Record<string, unknown>>)[name];
  return sorted;
};

export const canonicalJson = (value: unknown): string => JSON.stringify(value, sortedKeys);

export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
