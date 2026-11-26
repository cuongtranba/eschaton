export type Rng = Readonly<{
  next: () => number;
  int: (limit: number) => number;
  pick: <T>(items: readonly T[]) => T;
}>;

export function createRng(seed: number, salt = 0): Rng {
  let state = (Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(salt >>> 0, 0x85ebca6b) ^ 0x1234abcd) >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (limit: number): number => Math.floor(next() * limit);
  const pick = <T>(items: readonly T[]): T => {
    const item = items[int(items.length)];
    if (item === undefined) throw new Error("pick from an empty list");
    return item;
  };
  return { next, int, pick };
}

export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash;
}
