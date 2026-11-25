import { mulberry32 } from "../scatter";

export type Random = Readonly<{
  next: () => number;
  range: (low: number, high: number) => number;
  int: (low: number, high: number) => number;
  chance: (probability: number) => boolean;
  sign: () => 1 | -1;
}>;

export function createRandom(seed: number, salt: number): Random {
  const next = mulberry32((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0);
  return {
    next,
    range: (low, high) => low + next() * (high - low),
    int: (low, high) => low + Math.floor(next() * (high - low + 1)),
    chance: (probability) => next() < probability,
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}
