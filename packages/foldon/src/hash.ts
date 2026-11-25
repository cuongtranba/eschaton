const FNV_OFFSET_LIMBS = [0x2325, 0x8422, 0x9ce4, 0xcbf2] as const;
const FNV_PRIME_LOW = 0x1b3;

export function fnv1a64(text: string): string {
  let [h0, h1, h2, h3] = FNV_OFFSET_LIMBS as readonly [number, number, number, number];
  for (const byte of new TextEncoder().encode(text)) {
    h0 ^= byte;
    const t0 = h0 * FNV_PRIME_LOW;
    const t1 = h1 * FNV_PRIME_LOW;
    const t2 = h2 * FNV_PRIME_LOW + (h0 << 8);
    const t3 = h3 * FNV_PRIME_LOW + (h1 << 8);
    h0 = t0 & 0xffff;
    const c1 = t1 + (t0 >>> 16);
    h1 = c1 & 0xffff;
    const c2 = t2 + (c1 >>> 16);
    h2 = c2 & 0xffff;
    h3 = (t3 + (c2 >>> 16)) & 0xffff;
  }
  return [h3, h2, h1, h0].map((limb) => limb.toString(16).padStart(4, "0")).join("");
}

const sortedKeys = (key: string, value: unknown): unknown => {
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`canonical form refuses the non-finite number at ${key}`);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const sorted: Record<string, unknown> = {};
  for (const name of Object.keys(value).sort()) sorted[name] = (value as Readonly<Record<string, unknown>>)[name];
  return sorted;
};

export const canonicalJson = (value: unknown): string => JSON.stringify(value, sortedKeys);

function deeplyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);
}

function freezeAll(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const item of Object.values(value)) freezeAll(item);
}

export function immutable<T>(value: T): T {
  if (deeplyFrozen(value)) return value;
  const copy = structuredClone(value);
  freezeAll(copy);
  return copy;
}
