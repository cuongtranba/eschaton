const FNV_OFFSET_LIMBS = [0x2325, 0x8422, 0x9ce4, 0xcbf2] as const;
const FNV_PRIME_LOW = 0x1b3;

type Limbs = [number, number, number, number];

function mix(limbs: Limbs, byte: number): void {
  const h0 = limbs[0] ^ byte;
  const t0 = h0 * FNV_PRIME_LOW;
  const t1 = limbs[1] * FNV_PRIME_LOW;
  const t2 = limbs[2] * FNV_PRIME_LOW + (h0 << 8);
  const t3 = limbs[3] * FNV_PRIME_LOW + (limbs[1] << 8);
  limbs[0] = t0 & 0xffff;
  const c1 = t1 + (t0 >>> 16);
  limbs[1] = c1 & 0xffff;
  const c2 = t2 + (c1 >>> 16);
  limbs[2] = c2 & 0xffff;
  limbs[3] = (t3 + (c2 >>> 16)) & 0xffff;
}

const hex = (limbs: Limbs): string => [limbs[3], limbs[2], limbs[1], limbs[0]].map((limb) => limb.toString(16).padStart(4, "0")).join("");

/** FNV-1a 64 over the UTF-8 bytes of the text. ASCII text is hashed straight from its char codes (same bytes). */
export function fnv1a64(text: string): string {
  const limbs: Limbs = [...FNV_OFFSET_LIMBS];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x80) {
      const encoded: Limbs = [...FNV_OFFSET_LIMBS];
      for (const byte of new TextEncoder().encode(text)) mix(encoded, byte);
      return hex(encoded);
    }
    mix(limbs, code);
  }
  return hex(limbs);
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
