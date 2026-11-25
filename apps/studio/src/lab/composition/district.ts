import type { Vec3 } from "@eschaton/foldon";
import type { Basis, BatchMotion, Ink } from "../viewModel";
import { add, beamBasis, centredBasis, normalize, placeBasis, scaleVec, sub, type Placement3 } from "./affine";
import type { Random } from "./random";

export type LeafPlacement = Readonly<{ definitionId: string; basis: Basis }>;
export type AssemblyLeaves = (assemblyId: string) => readonly LeafPlacement[];
export type PlacedFoldon = Readonly<{ definitionId: string; basis: Basis; ink: Ink; motion?: BatchMotion }>;

export type Corridor = Readonly<{ centre: (t: number) => Vec3; tangent: (t: number) => Vec3; width: (t: number) => number }>;

const Z_NEAR = 70;
const Z_FAR = -130;
const SEGMENTS = 46;
const TREE_DEPTH = 4;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function makeCorridor(random: Random): Corridor {
  const phase = random.range(-0.25, 0.25);
  const amplitude = random.range(16, 22);
  const centre = (t: number): Vec3 => [
    2 + amplitude * Math.sin(t * 8.2 + phase) * (0.45 + 0.55 * t) - 18 * (1 - t),
    0,
    lerp(Z_NEAR, Z_FAR, t),
  ];
  return {
    centre,
    tangent: (t) => {
      const a = centre(Math.max(0, t - 0.01));
      const b = centre(Math.min(1, t + 0.01));
      return normalize(sub(b, a));
    },
    width: (t) => lerp(48, 9, Math.pow(t, 0.7)),
  };
}

const yawOf = (direction: Vec3): number => Math.atan2(direction[0], direction[2]);

export function corridorPanels(corridor: Corridor): readonly PlacedFoldon[] {
  const slabs: readonly (readonly [number, number, number])[] = [
    [-520, -118, 0.1],
    [-120, -8, 0.3],
    [-10, 160, 0.64],
  ];
  const ground = slabs.map(([far, near, tone], i): PlacedFoldon => ({
    definitionId: "P01",
    basis: centredBasis([0, -0.3 + i * 0.03, (far + near) / 2], [620, 1, near - far], {}),
    ink: { tone },
  }));
  const strips = Array.from({ length: SEGMENTS }, (_, i): PlacedFoldon => {
    const t = (i + 0.5) / SEGMENTS;
    const length = (Math.abs(Z_NEAR - Z_FAR) / SEGMENTS) * 1.5;
    const centre = corridor.centre(t);
    return {
      definitionId: "P01",
      basis: centredBasis([centre[0], 0.12 + i * 0.004, centre[2]], [corridor.width(t), 1, length], { yaw: yawOf(corridor.tangent(t)) }),
      ink: { tone: -0.35 },
    };
  });
  return [...ground, ...strips];
}

const leafTone = (definitionId: string, body: number, roof: number): number => {
  if (definitionId === "P03" || definitionId === "P04") return roof;
  if (definitionId === "P07" || definitionId === "P06") return body - 0.15;
  return body;
};

function placeAssembly(
  leaves: readonly LeafPlacement[],
  centre: Vec3,
  placement: Placement3,
  tone: (definitionId: string) => number,
): readonly PlacedFoldon[] {
  return leaves.map((leaf) => ({
    definitionId: leaf.definitionId,
    basis: placeBasis(placement, { ...leaf.basis, origin: sub(leaf.basis.origin, centre) }),
    ink: { tone: tone(leaf.definitionId) },
  }));
}

export function towers(random: Random, leaves: AssemblyLeaves): readonly PlacedFoldon[] {
  const watchtower = leaves("watchtower");
  const centre: Vec3 = [1, 0, 1];
  const placed: PlacedFoldon[] = [];
  const hero: Placement3 = { position: [-34 + random.range(-4, 4), 0, -42], yaw: random.range(-0.15, 0.15), scale: [4.4, 7.4, 4.4] };
  placed.push(...placeAssembly(watchtower, centre, hero, (id) => leafTone(id, 0.93, 0.5)));

  const ruined = [
    { x: -20, z: -70, sx: 3.4, sy: 6.4, tone: 0.88 },
    { x: -64, z: -78, sx: 3.8, sy: 5.2, tone: 0.84 },
    { x: -34, z: -105, sx: 3.0, sy: 5.8, tone: 0.78 },
  ];
  for (const tower of ruined) {
    const cut = random.range(3.4, 6.6);
    const remaining = watchtower.filter((leaf) => leaf.basis.origin[1] < cut && !(leaf.basis.origin[1] > cut - 1.5 && random.chance(0.3)));
    const placement: Placement3 = { position: [tower.x + random.range(-3, 3), 0, tower.z], yaw: random.range(-0.4, 0.4), scale: [tower.sx, tower.sy, tower.sx] };
    placed.push(...placeAssembly(remaining, centre, placement, (id) => leafTone(id, tower.tone, 0.5)));
  }

  const blocks = [
    [-16, -52, 9, 38], [-30, -62, 12, 56], [-58, -56, 10, 44], [-76, -66, 14, 62],
    [-42, -84, 12, 50], [-8, -88, 8, 34], [-88, -92, 14, 48], [-24, -118, 14, 40],
  ] as const;
  for (const [x, z, width, height] of blocks) {
    const h = height * random.range(0.8, 1.15);
    placed.push({
      definitionId: "P08",
      basis: centredBasis([x + random.range(-3, 3), 0, z], [width * random.range(0.8, 1.1), h, width * random.range(0.8, 1.1)], { yaw: random.range(-0.3, 0.3) }),
      ink: { tone: Math.min(0.95, 0.78 + random.range(0, 0.17)) },
    });
  }
  return placed;
}

export function houses(random: Random, corridor: Corridor, leaves: AssemblyLeaves): readonly PlacedFoldon[] {
  const roofHouse = leaves("roof-house");
  const centre: Vec3 = [2, 0, 2];
  const placed: PlacedFoldon[] = [];
  const stops = [
    { t: 0.36, side: 1 },
    { t: 0.46, side: -1 },
    { t: 0.55, side: 1 },
    { t: 0.64, side: -1 },
    { t: 0.74, side: 1 },
    { t: 0.82, side: -1 },
  ] as const;
  for (const stop of stops) {
    const t = stop.t + random.range(-0.02, 0.02);
    const tangent = corridor.tangent(t);
    const normal: Vec3 = [tangent[2] * stop.side, 0, -tangent[0] * stop.side];
    const offset = corridor.width(t) / 2 + random.range(12, 20);
    const position = add(corridor.centre(t), scaleVec(normal, offset));
    const size = lerp(5.4, 3.4, t) * random.range(0.9, 1.15);
    const placement: Placement3 = { position, yaw: yawOf(normal) + random.range(-0.25, 0.25), scale: [size, size, size] };
    placed.push(...placeAssembly(roofHouse, centre, placement, (id) => leafTone(id, 0.82, 0.38)));
  }
  return placed;
}

export function debris(random: Random, leaves: AssemblyLeaves): readonly PlacedFoldon[] {
  const placed: PlacedFoldon[] = [];
  const gate = leaves("ruined-gate");
  const gatePlacement: Placement3 = { position: [44, 0, 20], yaw: -0.5 + random.range(-0.2, 0.2), scale: [3.6, 3.6, 3.6] };
  placed.push(...placeAssembly(gate, [2, 0, 1], gatePlacement, (id) => leafTone(id, 0.94, 0.5)));

  const spot = (): Vec3 => [random.range(-14, 54), 0, random.range(0, 26)];
  for (let i = 0; i < 22; i++) {
    const size = random.range(2.5, 6.5);
    placed.push({
      definitionId: "P09",
      basis: centredBasis(spot(), [size, size * random.range(0.6, 1.2), size], { yaw: random.range(0, Math.PI * 2) }),
      ink: { tone: random.range(0.88, 0.97) },
    });
  }
  for (let i = 0; i < 16; i++) {
    const start = spot();
    const yaw = random.range(0, Math.PI * 2);
    const rise = random.range(0.1, 0.55);
    const span = random.range(12, 26);
    const end: Vec3 = [start[0] + Math.sin(yaw) * span, Math.sin(rise) * span, start[2] + Math.cos(yaw) * span];
    placed.push({ definitionId: "P06", basis: beamBasis(start, end, random.range(1.2, 2.2)), ink: { tone: 0.95 } });
  }
  for (let i = 0; i < 12; i++) {
    const size = random.range(4, 8);
    placed.push({
      definitionId: "P02",
      basis: centredBasis(spot(), [size, size * 0.8, size], { yaw: random.range(0, Math.PI * 2), pitch: random.range(-0.4, 0.4), roll: random.range(-0.5, 0.5) }),
      ink: { tone: random.range(0.7, 0.9) },
    });
  }
  for (const [x, z, size] of [[-12, 20, 16], [-24, 8, 12], [58, 24, 18], [66, 8, 12]] as const) {
    placed.push({
      definitionId: "P04",
      basis: centredBasis([x, 0, z], [size, size * 0.7, size], { yaw: random.range(0, Math.PI * 2), extent: [2, 1, 2] }),
      ink: { tone: 0.9 },
    });
  }
  return placed;
}

export function tree(random: Random): readonly PlacedFoldon[] {
  const placed: PlacedFoldon[] = [];
  const grow = (from: Vec3, direction: Vec3, length: number, thickness: number, depth: number): void => {
    const to = add(from, scaleVec(direction, length));
    placed.push({ definitionId: "P06", basis: beamBasis(from, to, thickness), ink: { tone: 0.96 } });
    if (depth >= TREE_DEPTH) return;
    const children = depth === 0 ? 3 : random.int(2, 3);
    for (let i = 0; i < children; i++) {
      const yaw = random.range(0, Math.PI * 2);
      const lean = random.range(0.35, 0.8);
      const child = normalize([
        direction[0] * 0.7 + Math.sin(yaw) * lean,
        direction[1] * 0.9 + random.range(0.1, 0.5),
        direction[2] * 0.7 + Math.cos(yaw) * lean,
      ]);
      grow(to, child, length * random.range(0.62, 0.8), thickness * 0.62, depth + 1);
    }
  };
  grow([random.range(50, 56), 0, -14], normalize([-0.08, 1, 0.02]), 11, 2.1, 0);
  return placed;
}

export function skyline(random: Random): readonly PlacedFoldon[] {
  const placed: PlacedFoldon[] = [];
  let x = -20;
  while (x < 96) {
    const width = random.range(1.6, 4.5);
    const height = random.range(4, 22) * (random.chance(0.12) ? 2.2 : 1);
    placed.push({
      definitionId: "P08",
      basis: centredBasis([x, 0, random.range(-196, -184)], [width, height, width]),
      ink: { tone: random.range(0.5, 0.68) },
    });
    x += width * random.range(0.9, 1.6);
  }
  return placed;
}

export function dust(random: Random): readonly PlacedFoldon[] {
  return Array.from({ length: 26 }, (): PlacedFoldon => {
    const size = random.range(0.9, 2.2);
    return {
      definitionId: "P02",
      basis: centredBasis(
        [random.range(-60, 70), random.range(6, 60), random.range(-50, 56)],
        [size, size, size],
        { yaw: random.range(0, Math.PI * 2), pitch: random.range(-1, 1), roll: random.range(-1, 1) },
      ),
      ink: { tone: 0.7 },
      motion: "dust",
    };
  });
}
