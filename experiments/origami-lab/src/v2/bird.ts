import type { Vec3 } from "@eschaton/foldon";
import { createRng } from "../prng";
import { createBuilder, type Design, type Facing } from "./design";

/** Bird V2 parameters (docs/research/origami-lab-v2/bird-design-brief.md §9). Lengths are fractions of L. */
export type BirdParams = Readonly<{
  span: number;
  chord: number;
  sweep: number;
  /** 3 = closed, stepped pointed tip (falcon/swift-like); 4 or 5 = slotted "fingered" primaries (corvid/raptor-like). */
  fingers: 3 | 4 | 5;
  dihedralArm: number;
  dihedralHand: number;
  curl: number;
  tail: number;
  tailShape: "square" | "rounded" | "wedge" | "forked";
  tailSpread: number;
  beak: number;
  head: number;
  headPitch: number;
  breast: number;
}>;

export const BIRD_VERSION = 3;
export const BIRD_LENGTH_CELLS = 4;

export const CROW: BirdParams = {
  span: 2.0,
  chord: 1.0,
  sweep: 15,
  fingers: 5,
  dihedralArm: 8,
  dihedralHand: 2,
  curl: 4,
  tail: 0.365,
  tailShape: "rounded",
  tailSpread: 0.1,
  beak: 0.095,
  head: 1,
  headPitch: 0,
  breast: 1,
};

export const BIRD_BOUNDS = {
  span: [1.55, 2.45],
  chord: [0.75, 1.25],
  sweep: [5, 28],
  dihedralArm: [-4, 12],
  dihedralHand: [-10, 6],
  curl: [-4, 8],
  tail: [0.24, 0.42],
  tailSpread: [0.08, 0.13],
  beak: [0.07, 0.13],
  head: [0.82, 1.22],
  headPitch: [-8, 10],
  breast: [0.85, 1.25],
} as const satisfies Readonly<Record<string, readonly [number, number]>>;

type Bounded = keyof typeof BIRD_BOUNDS;
const BOUNDED: readonly Bounded[] = ["span", "chord", "sweep", "dihedralArm", "dihedralHand", "curl", "tail", "tailSpread", "beak", "head", "headPitch", "breast"];

const q = (v: number): number => Math.round(v * 1000) / 1000 + 0;

export function quantizeBird(p: BirdParams): BirdParams {
  return { ...p, ...Object.fromEntries(BOUNDED.map((k) => [k, q(p[k])])) };
}

/** Both corners of the parameter box (bird-design-brief.md §9): every bound at its minimum (0) or maximum (1). */
export function birdExtreme(side: 0 | 1): BirdParams {
  return quantizeBird({
    ...CROW,
    ...Object.fromEntries(BOUNDED.map((k) => [k, BIRD_BOUNDS[k][side]])),
    fingers: side === 0 ? 3 : 5,
    tailShape: side === 0 ? "forked" : "wedge",
  });
}

/** Seeded parameters: every slot drawn inside its anatomical bound (bird-design-brief.md §9). A bounded random sampler, not a solver. */
export function birdParams(seed: number): BirdParams {
  const rng = createRng(seed, 0x0b12d);
  const within = (key: Bounded): number => {
    const [lo, hi] = BIRD_BOUNDS[key];
    return lo + (hi - lo) * rng.next();
  };
  return quantizeBird({
    span: within("span"),
    chord: within("chord"),
    sweep: within("sweep"),
    fingers: rng.pick([3, 4, 5, 5] as const),
    dihedralArm: within("dihedralArm"),
    dihedralHand: within("dihedralHand"),
    curl: within("curl"),
    tail: within("tail"),
    tailShape: rng.pick(["square", "rounded", "wedge", "forked"] as const),
    tailSpread: within("tailSpread"),
    beak: within("beak"),
    head: within("head"),
    headPitch: within("headPitch"),
    breast: within("breast"),
  });
}

type Station = Readonly<{ s: number; y: number; w: number; t: number; b: number; brow?: true }>;

const rad = (d: number): number => (d * Math.PI) / 180;
const UP: Vec3 = [0, 1, 0];

/** Builds the bird surface. x points forward (beak), y up, z to the bird's left; units are cells. */
export function birdDesign(raw: BirdParams): Design {
  const p = quantizeBird(raw);
  const L = BIRD_LENGTH_CELLS;
  const B = createBuilder();
  const head = p.head;
  const br = p.breast;
  const nape = 0.25;
  const pitch = Math.tan(rad(p.headPitch));
  const lift = (s: number): number => (s < nape ? (nape - s) * pitch : 0);
  const stations: readonly Station[] = [
    { s: p.beak, y: lift(p.beak), w: 0.03 * head, t: 0.032 * head, b: 0.03 * head },
    { s: p.beak + 0.035, y: 0.01 + lift(p.beak + 0.035), w: 0.058 * head, t: 0.058 * head, b: 0.042 * head, brow: true },
    { s: p.beak + 0.1, y: 0.006 + lift(p.beak + 0.1), w: 0.062 * head, t: 0.052 * head, b: 0.048 * head },
    { s: nape, y: -0.008, w: 0.058 * head, t: 0.044 * head, b: 0.06 * head },
    { s: 0.33, y: 0.008, w: 0.088 * br, t: 0.08 * br, b: 0.105 * br },
    { s: 0.53, y: 0.008, w: 0.075 * br, t: 0.066 * br, b: 0.078 * br },
    { s: 0.6, y: 0.012, w: 0.048, t: 0.036, b: 0.04 },
  ];
  const X = (s: number): number => (0.5 - s) * L;
  const P = (s: number, y: number, z: number): Vec3 => [X(s), y * L, z * L];
  const tipY = -0.012 + lift(0);
  const spine: readonly Readonly<{ s: number; y: number }>[] = [{ s: 0, y: tipY }, ...stations, { s: 0.635, y: 0.018 }];
  const spineY = (x: number): number => {
    const s = 0.5 - x / L;
    for (let i = 0; i + 1 < spine.length; i++) {
      const [a, b] = [spine[i], spine[i + 1]];
      if (a !== undefined && b !== undefined && s >= a.s && s <= b.s) return (a.y + ((s - a.s) / (b.s - a.s)) * (b.y - a.y)) * L;
    }
    return 0;
  };
  const outward: Facing = (c) => [0, c[1] - spineY(c[0]), c[2]];
  const up: Facing = () => UP;

  /** 8-point section; the brow station pushes the upper-side vertex out and recesses the side vertex (eye socket under a brow ridge). */
  const ring = (st: Station): readonly number[] => {
    const upper = st.brow === true ? ([0.95 * st.w, 0.6 * st.t] as const) : ([0.72 * st.w, 0.62 * st.t] as const);
    const side = st.brow === true ? ([0.78 * st.w, 0] as const) : ([st.w, -0.05 * st.b] as const);
    return (
      [
        [0, st.t],
        upper,
        side,
        [0.62 * st.w, -0.62 * st.b],
        [0, -st.b],
        [-0.62 * st.w, -0.62 * st.b],
        [-side[0], side[1]],
        [-upper[0], upper[1]],
      ] as const
    ).map(([z, dy]) => B.point(P(st.s, st.y + dy, z)));
  };

  const rings = stations.map(ring);
  const ringAt = (i: number): readonly number[] => rings[i] ?? [];
  const tip = B.point(P(0, tipY, 0));
  B.fan("body", "beak", tip, ringAt(0), true, outward);
  const regions = ["face", "crown", "nape", "breast", "torso", "belly"];
  regions.forEach((part, i) => {
    B.ringLoft("body", part, ringAt(i), ringAt(i + 1), outward);
  });

  const rootS = 0.635;
  const rootY = 0.018;
  const rootW = 0.035;
  const tl = B.point(P(rootS, rootY, rootW));
  const tr = B.point(P(rootS, rootY, -rootW));
  const vent = ringAt(6);
  const v = (k: number): number => vent[k] ?? 0;
  for (let k = 0; k < 4; k++) B.face("body", "rump", [v(k), v(k + 1), tl], outward);
  for (let k = 4; k < 8; k++) B.face("body", "rump", [v(k), v((k + 1) % 8), tr], outward);
  B.face("body", "rump", [v(0), tl, tr], up);
  B.face("body", "rump", [v(4), tr, tl], () => [0, -1, 0]);

  const lengthNorm = rootS + p.tail;
  const shoulder = rings[4] ?? [];
  const rump = rings[5] ?? [];
  const wingTips: Vec3[] = [];
  const wrists: Vec3[] = [];
  const articulated: Design["articulated"][number][] = [];
  const joints: Design["joints"][number][] = [];
  for (const side of [1, -1] as const) {
    const mod = side === 1 ? "wingL" : "wingR";
    const corner = side === 1 ? 1 : 7;
    const le0 = shoulder[corner] ?? 0;
    const te0 = rump[corner] ?? 0;
    const root = B.pos(le0);
    const z0 = root[2] / L / side;
    const y0 = root[1] / L;
    const n = p.fingers;
    const closed = n === 3;
    const fingerLen = closed ? 0.18 : 0.17;
    const H = (p.span / 2) * lengthNorm;
    const zw = z0 + 0.4 * (H - z0);
    const z4 = H - 0.9 * fingerLen;
    const z3 = (zw + z4) / 2;
    const c = 0.3 * p.chord;
    const tanSweep = Math.tan(rad(p.sweep));
    const yArm = (z: number): number => y0 + (z - z0) * Math.tan(rad(p.dihedralArm));
    const yw = yArm(zw);
    const yHand = (z: number): number => yw + (z - zw) * Math.tan(rad(p.dihedralHand));
    const W = (s: number, y: number, z: number): number => B.point(P(s, y, side * z));
    const armSection = (u: number, le: number): readonly number[] => {
      const z = z0 + u * (zw - z0);
      return [W(le, yArm(z), z), W(le + 0.22 * c, yArm(z) + 0.16 * c, z), W(le + 0.42 * c, yArm(z) + 0.04 * c, z), W(le + c, yArm(z), z)];
    };
    const arm = [armSection(0.25, 0.312), armSection(0.5, 0.302), armSection(0.75, 0.292)];
    const [a1, a2, a3] = [arm[0] ?? [], arm[1] ?? [], arm[2] ?? []];
    const wrist = [W(0.285, yw, zw), W(0.285 + 0.97 * c, yw, zw)];
    const le3 = 0.285 + (z3 - zw) * tanSweep;
    const ch = 0.8 * c;
    const sec3 = [W(le3, yHand(z3), z3), W(le3 + 0.3 * ch, yHand(z3) + 0.07 * ch, z3), W(le3 + ch, yHand(z3), z3)];
    const le4 = 0.285 + (z4 - zw) * tanSweep;
    const tipChord = 0.65 * c;
    const step = 0.25 * fingerLen;
    const along = (f: number): number => W(le4 + tipChord * f, yHand(z4 - step * f), z4 - step * f);
    const slots = closed ? Array.from({ length: n }, (_, k) => [k / n, (k + 1) / n] as const) : Array.from({ length: n }, (_, k) => [k / n, (k + 0.76) / n] as const);
    const sec4 = closed ? Array.from({ length: n + 1 }, (_, k) => along(k / n)) : slots.flatMap(([f0, f1]) => [along(f0), along(f1)]);
    B.stitch(mod, "arm1", [le0, te0], a1, up);
    for (const [from, to, part] of [[a1, a2, "arm2"], [a2, a3, "arm3"]] as const) {
      for (let k = 0; k + 1 < from.length; k++) B.quad(mod, part, from[k] ?? 0, from[k + 1] ?? 0, to[k + 1] ?? 0, to[k] ?? 0, up);
    }
    B.stitch(mod, "wrist", a3, wrist, up);
    const z3b = z4 - step - 0.03;
    const le3b = 0.285 + (z3b - zw) * tanSweep;
    const sec3b = Array.from({ length: n + 1 }, (_, k) => W(le3b + (tipChord * 1.08 * k) / n, yHand(z3b), z3b));
    B.stitch(mod, "hand", wrist, sec3, up);
    B.stitch(mod, "hand2", sec3, sec3b, up);
    B.stitch(mod, "hand3", sec3b, sec4, up);

    const coverts = [
      [a1, a2, 0.56, 0.1],
      [a2, a3, 0.6, 0.085],
    ] as const;
    for (const [from, to, reach, height] of coverts) {
      const [r0, r1] = [from[1] ?? 0, to[1] ?? 0];
      const drop = (r: number): number => {
        const at = B.pos(r);
        return B.point([at[0] - (reach - 0.22) * c * L, at[1] - (0.16 - height) * c * L, at[2]]);
      };
      const [c0, c1] = [drop(r0), drop(r1)];
      B.quad(mod, "covert", r0, r1, c1, c0, up);
      const [q0, q1] = [B.pos(c0), B.pos(c1)];
      B.face(mod, "covert", [c0, c1, B.point([(q0[0] + q1[0]) / 2 - 0.07 * c * L, (q0[1] + q1[1]) / 2 - 0.004 * L, (q0[2] + q1[2]) / 2])], up);
    }

    const trailing = [te0, a1.at(-1) ?? 0, a2.at(-1) ?? 0, a3.at(-1) ?? 0, wrist[1] ?? 0, sec3.at(-1) ?? 0];
    for (let k = 0; k + 1 < trailing.length; k++) {
      const [pa, pb] = [B.pos(trailing[k] ?? 0), B.pos(trailing[k + 1] ?? 0)];
      const segment = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
      const depth = Math.min(0.08 * c * L, 0.18 * segment);
      const tipPoint = B.point([(pa[0] + pb[0]) / 2 - depth, (pa[1] + pb[1]) / 2 - 0.004 * L, (pa[2] + pb[2]) / 2]);
      B.face(mod, "secondary", [trailing[k] ?? 0, trailing[k + 1] ?? 0, tipPoint], up);
    }

    const lengths = closed ? [1, 0.82, 0.64] : n === 5 ? [0.86, 1, 0.92, 0.74, 0.55] : [0.95, 1, 0.8, 0.58];
    slots.forEach((_slot, k) => {
      const [a, b] = closed ? [sec4[k] ?? 0, sec4[k + 1] ?? 0] : [sec4[2 * k] ?? 0, sec4[2 * k + 1] ?? 0];
      const [pa, pb] = [B.pos(a), B.pos(b)];
      const mid: Vec3 = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
      const alpha = rad(closed ? -2 + 8 * k : -4 + (26 * k) / (n - 1));
      const len = fingerLen * (lengths[k] ?? 1) * L;
      const centre: Vec3 = [mid[0] - len * Math.sin(alpha), mid[1] + len * Math.tan(rad(p.curl)), mid[2] + side * len * Math.cos(alpha)];
      const half: Vec3 = [(pb[0] - pa[0]) * (closed ? 0.18 : 0.3), (pb[1] - pa[1]) * 0.25, (pb[2] - pa[2]) * (closed ? 0.18 : 0.3)];
      const ta = B.point([centre[0] - half[0], centre[1] - half[1], centre[2] - half[2]]);
      const tb = B.point([centre[0] + half[0], centre[1] + half[1], centre[2] + half[2]]);
      B.quad(mod, "primary", a, b, tb, ta, up, true);
      wingTips.push(B.pos(ta), B.pos(tb));
    });
    wrists.push(B.pos(wrist[0] ?? 0));
    joints.push({ module: mod, parent: "body", edge: [le0, te0], articulation: { lo: -30, hi: 35, toward: UP } });
    articulated.push({ id: `${mod}.wrist`, edge: [wrist[0] ?? 0, wrist[1] ?? 0], articulation: { lo: -20, hi: 25, toward: UP } });
  }

  const tailEnd = rootS + p.tail;
  const midS = rootS + 0.25 * p.tail;
  const midW = rootW + 0.35 * (p.tailSpread - rootW);
  const ml = B.point(P(midS, rootY + 0.002, midW));
  const mc = B.point(P(midS, rootY + 0.008, 0));
  const mr = B.point(P(midS, rootY + 0.002, -midW));
  B.face("tail", "root", [tl, tr, mc], up);
  B.face("tail", "root", [tl, mc, ml], up);
  B.face("tail", "root", [tr, mr, mc], up);
  const K = 6;
  const tipLine = Array.from({ length: K + 1 }, (_, k) => {
    const u = (2 * k) / K - 1;
    const shape =
      p.tailShape === "square" ? 0 : p.tailShape === "rounded" ? 0.12 * p.tail * u * u : p.tailShape === "wedge" ? 0.28 * p.tail * Math.abs(u) : -0.22 * p.tail * (1 - Math.abs(u));
    const pleat = k === 0 || k === K ? 0 : k % 2 === 0 ? 0.008 : -0.006;
    return B.point(P(tailEnd - shape, rootY + 0.004 + pleat, -u * p.tailSpread));
  });
  B.stitch("tail", "fan", [ml, mc, mr], tipLine, up, true);
  for (const [a, b] of [[ml, mc], [mc, mr]] as const) {
    const [pa, pb] = [B.pos(a), B.pos(b)];
    const reach = 0.32 * p.tail * L;
    const ca = B.point([pa[0] - reach, rootY * L + 0.024 * L, pa[2] * 1.25]);
    const cb = B.point([pb[0] - reach * 1.08, rootY * L + 0.026 * L, pb[2] * 1.25]);
    B.quad("tail", "covert", a, b, cb, ca, up);
  }

  const tailTipCentre = B.pos(tipLine[K / 2] ?? 0);
  const farthest = (sign: 1 | -1): Vec3 => wingTips.reduce((best, w) => (sign * w[2] > sign * best[2] ? w : best));
  return {
    kind: "bird",
    version: BIRD_VERSION,
    params: { ...p },
    vertices: B.vertices(),
    faces: B.faces(),
    rootModule: "body",
    rootPart: "torso",
    sheets: { body: "part", wingL: { wrist: "hand" }, wingR: { wrist: "hand" }, tail: "module" },
    joints: [...joints, { module: "tail", parent: "body", edge: [tl, tr] }],
    articulated,
    landmarks: {
      beakTip: B.pos(tip),
      crown: B.pos(ringAt(2)[0] ?? 0),
      keel: B.pos(ringAt(4)[4] ?? 0),
      tailTip: tailTipCentre,
      wingTipL: farthest(1),
      wingTipR: farthest(-1),
      wristL: wrists[0] ?? [0, 0, 0],
      wristR: wrists[1] ?? [0, 0, 0],
    },
  };
}
