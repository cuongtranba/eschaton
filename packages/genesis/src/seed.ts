import { fnv1a64 } from "@eschaton/foldon";

/** A stable 32-bit seed for one named scope of one generation. Scopes do not depend on the order they are used in. */
export function scopedSeed(...parts: readonly (string | number)[]): number {
  return Number.parseInt(fnv1a64(parts.join("|")).slice(8), 16);
}

export type Stream = Readonly<{ next: () => number; below: (bound: number) => number; chance: (numerator: number, denominator: number) => boolean }>;

export function stream(seed: number): Stream {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const below = (bound: number): number => (bound <= 1 ? 0 : next() % bound);
  return { next, below, chance: (numerator, denominator) => below(denominator) < numerator };
}
