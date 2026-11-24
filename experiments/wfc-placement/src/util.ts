export function at<T>(array: ArrayLike<T>, index: number): T {
  const value = array[index];
  if (value === undefined) throw new RangeError(`index ${index} out of range`);
  return value;
}

export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickMinimum(entropy: Float64Array, eligible: Uint8Array, rng: () => number): number {
  let best = Infinity;
  for (let i = 0; i < entropy.length; i++) {
    if (at(eligible, i) === 1 && at(entropy, i) < best) best = at(entropy, i);
  }
  if (best === Infinity) return -1;
  const ties: number[] = [];
  for (let i = 0; i < entropy.length; i++) {
    if (at(eligible, i) === 1 && at(entropy, i) <= best + 1e-9) ties.push(i);
  }
  return at(ties, Math.floor(rng() * ties.length));
}

export function weightedEntropy(sumWeight: number, sumWeightLogWeight: number): number {
  return Math.log(sumWeight) - sumWeightLogWeight / sumWeight;
}
