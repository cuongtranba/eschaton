import type { Cell, Rotation } from "@eschaton/foldon";

export type ScatterSpot = Readonly<{ anchor: Cell; rotation: Rotation }>;

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];
const RING = 2;
const MAX_ATTEMPTS = 64;

export function scatterSpots(
  seed: number,
  occupied: readonly Cell[],
  bounds: Readonly<{ min: Cell; max: Cell }>,
  count: number,
): readonly ScatterSpot[] {
  const random = mulberry32(seed);
  const taken = new Set(occupied.filter((cell) => cell[1] === 0).map((cell) => `${cell[0]},${cell[2]}`));
  const spots: ScatterSpot[] = [];
  const pick = (low: number, high: number): number => low + Math.floor(random() * (high - low + 1));
  for (let attempt = 0; attempt < MAX_ATTEMPTS && spots.length < count; attempt++) {
    const x = pick(bounds.min[0] - RING, bounds.max[0] + RING);
    const z = pick(bounds.min[2] - RING, bounds.max[2] + RING);
    const rotation = ROTATIONS[pick(0, ROTATIONS.length - 1)] ?? 0;
    const key = `${x},${z}`;
    if (taken.has(key)) continue;
    taken.add(key);
    spots.push({ anchor: [x, 0, z], rotation });
  }
  return spots;
}

export type StressSpot = Readonly<{ anchor: Cell; rotation: Rotation; index: number }>;

const STRESS_PITCH = 3;

export function stressSpots(
  seed: number,
  count: number,
  avoid: Readonly<{ min: Cell; max: Cell }>,
  choices: number,
): readonly StressSpot[] {
  if (count <= 0 || choices <= 0) return [];
  const random = mulberry32(seed ^ 0x5eed);
  const side = Math.ceil(Math.sqrt(count)) + 3;
  const centre = Math.floor(side / 2);
  const free = (value: number, low: number, high: number): boolean => value < low - 1 || value > high + 2;
  const spots: StressSpot[] = [];
  for (let cell = 0; cell < side * side && spots.length < count; cell++) {
    const x = ((cell % side) - centre) * STRESS_PITCH;
    const z = (Math.floor(cell / side) - centre) * STRESS_PITCH;
    if (!free(x, avoid.min[0], avoid.max[0]) && !free(z, avoid.min[2], avoid.max[2])) continue;
    const rotation = ROTATIONS[Math.floor(random() * ROTATIONS.length)] ?? 0;
    spots.push({ anchor: [x, 0, z], rotation, index: Math.floor(random() * choices) });
  }
  return spots;
}
