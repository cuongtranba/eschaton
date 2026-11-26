import type { Vec3 } from "@eschaton/foldon";
import { createRng } from "../prng";
import { createBuilder, type Design, type Facing } from "./design";

/** Bird V2 parameters (docs/research/origami-lab-v2/bird-design-brief.md §9). Lengths are fractions of L. */
export type BirdParams = Readonly<{
  span: number;
  chord: number;
  sweep: number;
  fingers: 0 | 4 | 5;
  dihedralArm: number;
  dihedralHand: number;
  curl: number;
  tail: number;
  tailShape: "square" | "rounded" | "wedge" | "forked";
  tailSpread: number;
  beak: number;
  head: number;
  breast: number;
}>;

export const BIRD_VERSION = 2;
export const BIRD_LENGTH_CELLS = 4;

export const CROW: BirdParams = {
  span: 2.0,
  chord: 1.0,
  sweep: 15,
  fingers: 5,
  dihedralArm: 8,
  dihedralHand: 2,
  curl: 10,
  tail: 0.365,
  tailShape: "rounded",
  tailSpread: 0.1,
  beak: 0.095,
  head: 1,
  breast: 1,
};

export const BIRD_BOUNDS = {
  span: [1.55, 2.45],
  chord: [0.75, 1.25],
  sweep: [5, 28],
  dihedralArm: [-4, 12],
  dihedralHand: [-10, 6],
  curl: [0, 20],
  tail: [0.24, 0.42],
  tailSpread: [0.08, 0.13],
  beak: [0.07, 0.13],
  head: [0.88, 1.15],
  breast: [0.88, 1.2],
} as const satisfies Readonly<Record<string, readonly [number, number]>>;

const q = (v: number): number => Math.round(v * 1000) / 1000 + 0;

export function quantizeBird(p: BirdParams): BirdParams {
  return {
    ...p,
    span: q(p.span),
    chord: q(p.chord),
    sweep: q(p.sweep),
    dihedralArm: q(p.dihedralArm),
    dihedralHand: q(p.dihedralHand),
    curl: q(p.curl),
    tail: q(p.tail),
    tailSpread: q(p.tailSpread),
    beak: q(p.beak),
    head: q(p.head),
    breast: q(p.breast),
  };
}

/** Both corners of the parameter box (bird-design-brief.md §9): every bound at its minimum (0) or maximum (1). */
export function birdExtreme(side: 0 | 1): BirdParams {
  const pickBound = (key: keyof typeof BIRD_BOUNDS): number => BIRD_BOUNDS[key][side];
  return quantizeBird({
    span: pickBound("span"),
    chord: pickBound("chord"),
    sweep: pickBound("sweep"),
    fingers: side === 0 ? 0 : 5,
    dihedralArm: pickBound("dihedralArm"),
    dihedralHand: pickBound("dihedralHand"),
    curl: pickBound("curl"),
    tail: pickBound("tail"),
    tailShape: side === 0 ? "forked" : "wedge",
    tailSpread: pickBound("tailSpread"),
    beak: pickBound("beak"),
    head: pickBound("head"),
    breast: pickBound("breast"),
  });
}

/** Seeded parameters: every slot drawn inside its anatomical bound (bird-design-brief.md §9). */
export function birdParams(seed: number): BirdParams {
  const rng = createRng(seed, 0x0b12d);
  const within = (key: keyof typeof BIRD_BOUNDS): number => {
    const [lo, hi] = BIRD_BOUNDS[key];
    return lo + (hi - lo) * rng.next();
  };
  return quantizeBird({
    span: within("span"),
    chord: within("chord"),
    sweep: within("sweep"),
    fingers: rng.pick([0, 4, 5, 5] as const),
    dihedralArm: within("dihedralArm"),
    dihedralHand: within("dihedralHand"),
    curl: within("curl"),
    tail: within("tail"),
    tailShape: rng.pick(["square", "rounded", "wedge", "forked"] as const),
    tailSpread: within("tailSpread"),
    beak: within("beak"),
    head: within("head"),
    breast: within("breast"),
  });
}

type Station = Readonly<{ name: string; s: number; y: number; w: number; t: number; b: number }>;

const rad = (d: number): number => (d * Math.PI) / 180;

/** Builds the bird surface. x points forward (beak), y up, z to the bird's left; units are cells. */
export function birdDesign(raw: BirdParams): Design {
  const p = quantizeBird(raw);
  const L = BIRD_LENGTH_CELLS;
  const B = createBuilder();
  const head = p.head;
  const br = p.breast;
  const stations: readonly Station[] = [
    { name: "gape", s: p.beak, y: 0, w: 0.03 * head, t: 0.027 * head, b: 0.025 * head },
    { name: "eye", s: p.beak + 0.04, y: 0.008, w: 0.056 * head, t: 0.05 * head, b: 0.04 * head },
    { name: "crown", s: p.beak + 0.1, y: 0.006, w: 0.062 * head, t: 0.05 * head, b: 0.048 * head },
    { name: "nape", s: 0.25, y: -0.004, w: 0.058 * head, t: 0.044 * head, b: 0.06 * head },
    { name: "shoulder", s: 0.33, y: 0, w: 0.088 * br, t: 0.07 * br, b: 0.105 * br },
    { name: "rump", s: 0.53, y: 0.006, w: 0.075 * br, t: 0.058 * br, b: 0.078 * br },
    { name: "vent", s: 0.6, y: 0.012, w: 0.048, t: 0.036, b: 0.04 },
  ];
  const X = (s: number): number => (0.5 - s) * L;
  const P = (s: number, y: number, z: number): Vec3 => [X(s), y * L, z * L];
  const spineY = (x: number): number => {
    const s = 0.5 - x / L;
    const list = stations;
    for (let i = 0; i + 1 < list.length; i++) {
      const [a, b] = [list[i], list[i + 1]];
      if (a !== undefined && b !== undefined && s >= a.s && s <= b.s) return (a.y + ((s - a.s) / (b.s - a.s)) * (b.y - a.y)) * L;
    }
    return 0;
  };
  const outward: Facing = (c) => [0, c[1] - spineY(c[0]), c[2]];
  const up: Facing = () => [0, 1, 0];

  const ring = (st: Station): readonly number[] =>
    (
      [
        [0, st.t],
        [0.72 * st.w, 0.62 * st.t],
        [st.w, -0.05 * st.b],
        [0.62 * st.w, -0.62 * st.b],
        [0, -st.b],
        [-0.62 * st.w, -0.62 * st.b],
        [-st.w, -0.05 * st.b],
        [-0.72 * st.w, 0.62 * st.t],
      ] as const
    ).map(([z, dy]) => B.point(P(st.s, st.y + dy, z)));

  const rings = stations.map(ring);
  const ringAt = (i: number): readonly number[] => rings[i] ?? [];
  const tip = B.point(P(0, -0.012, 0));
  B.fan("body", "beak", tip, ringAt(0), true, (c) => [0, c[1] - spineY(c[0]), c[2]]);
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

  const shoulder = rings[4] ?? [];
  const rump = rings[5] ?? [];
  const wingTips: Vec3[] = [];
  const wrists: Vec3[] = [];
  const articulated: { id: string; edge: readonly [number, number]; articulation: { lo: number; hi: number } }[] = [];
  const joints: Design["joints"][number][] = [];
  for (const side of [1, -1] as const) {
    const mod = side === 1 ? "wingL" : "wingR";
    const corner = side === 1 ? 1 : 7;
    const le0 = shoulder[corner] ?? 0;
    const te0 = rump[corner] ?? 0;
    const root = B.pos(le0);
    const z0 = root[2] / L / side;
    const y0 = root[1] / L;
    const H = p.span / 2;
    const fingerLen = p.fingers > 0 ? 0.22 : 0;
    const zw = z0 + 0.4 * (H - z0);
    const z4 = p.fingers > 0 ? H - 0.85 * fingerLen : H;
    const z3 = (zw + z4) / 2;
    const c = 0.3 * p.chord;
    const tanSweep = Math.tan(rad(p.sweep));
    const yArm = (z: number): number => y0 + (z - z0) * Math.tan(rad(p.dihedralArm));
    const yw = yArm(zw);
    const yHand = (z: number): number => yw + (z - zw) * Math.tan(rad(p.dihedralHand));
    const W = (s: number, y: number, z: number): number => B.point(P(s, y, side * z));
    const armSection = (z: number, le: number, chord: number): readonly number[] => [
      W(le, yArm(z), z),
      W(le + 0.22 * chord, yArm(z) + 0.16 * chord, z),
      W(le + 0.42 * chord, yArm(z) + 0.04 * chord, z),
      W(le + chord, yArm(z), z),
    ];
    const a1 = armSection(z0 + (zw - z0) / 3, 0.31, c);
    const a2 = armSection(z0 + (2 * (zw - z0)) / 3, 0.295, c);
    const wrist = [W(0.285, yw, zw), W(0.285 + 0.97 * c, yw, zw)];
    const le3 = 0.285 + (z3 - zw) * tanSweep;
    const ch = 0.8 * c;
    const sec3 = [W(le3, yHand(z3), z3), W(le3 + 0.3 * ch, yHand(z3) + 0.07 * ch, z3), W(le3 + ch, yHand(z3), z3)];
    const le4 = 0.285 + (z4 - zw) * tanSweep;
    const n = p.fingers;
    const step = 0.25 * fingerLen;
    const sec4 =
      n > 0
        ? Array.from({ length: n + 1 }, (_, k) => W(le4 + (0.6 * c * k) / n, yHand(z4 - (step * k) / n), z4 - (step * k) / n))
        : [W(le4 + 0.3 * c, yHand(z4), z4)];
    B.stitch(mod, "arm", [le0, te0], a1, up);
    B.stitch(mod, "arm", a1, a2, up);
    B.stitch(mod, "arm", a2, wrist, up);
    B.stitch(mod, "hand", wrist, sec3, up);
    B.stitch(mod, "hand", sec3, sec4, up, n === 0);
    const trailing = [te0, a1.at(-1) ?? 0, a2.at(-1) ?? 0, wrist[1] ?? 0, sec3.at(-1) ?? 0];
    for (let k = 0; k + 1 < trailing.length; k++) {
      const [pa, pb] = [B.pos(trailing[k] ?? 0), B.pos(trailing[k + 1] ?? 0)];
      const segment = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
      const depth = Math.min((k < 3 ? 0.09 : 0.07) * c * L, 0.16 * segment);
      const tipPoint = B.point([(pa[0] + pb[0]) / 2 - depth, (pa[1] + pb[1]) / 2 - 0.004 * L, (pa[2] + pb[2]) / 2]);
      B.face(mod, "secondary", [trailing[k] ?? 0, trailing[k + 1] ?? 0, tipPoint], up);
    }
    if (n > 0) {
      const lengths = n === 5 ? [0.95, 1, 0.9, 0.75, 0.6] : [0.95, 1, 0.85, 0.65];
      for (let k = 0; k < n; k++) {
        const [a, b] = [sec4[k] ?? 0, sec4[k + 1] ?? 0];
        const [pa, pb] = [B.pos(a), B.pos(b)];
        const mid: Vec3 = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
        const alpha = rad(-8 + (36 * k) / (n - 1));
        const len = fingerLen * (lengths[k] ?? 1) * L;
        const tipPoint = B.point([mid[0] - len * Math.sin(alpha), mid[1] + len * Math.tan(rad(p.curl)), mid[2] + side * len * Math.cos(alpha)]);
        B.face(mod, "primary", [a, b, tipPoint], up, true);
        wingTips.push(B.pos(tipPoint));
      }
    } else wingTips.push(B.pos(sec4[0] ?? 0));
    wrists.push(B.pos(wrist[0] ?? 0));
    joints.push({ module: mod, parent: "body", edge: [le0, te0], articulation: { lo: -30, hi: 35 } });
    articulated.push({ id: `${mod}.wrist`, edge: [wrist[0] ?? 0, wrist[1] ?? 0], articulation: { lo: -20, hi: 25 } });
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

  const tailTipCentre = B.pos(tipLine[K / 2] ?? 0);
  return {
    kind: "bird",
    version: BIRD_VERSION,
    params: { ...p },
    vertices: B.vertices(),
    faces: B.faces(),
    rootModule: "body",
    rootPart: "torso",
    sheets: { body: "part", wingL: "module", wingR: "module", tail: "module" },
    joints: [...joints, { module: "tail", parent: "body", edge: [tl, tr] }],
    articulated,
    landmarks: {
      beakTip: B.pos(tip),
      crown: B.pos(ringAt(2)[0] ?? 0),
      keel: B.pos(ringAt(4)[4] ?? 0),
      tailTip: tailTipCentre,
      wingTipL: wingTips.slice(0, Math.max(1, p.fingers)).reduce((best, w) => (w[2] > best[2] ? w : best)),
      wingTipR: wingTips.slice(Math.max(1, p.fingers)).reduce((best, w) => (w[2] < best[2] ? w : best)),
      wristL: wrists[0] ?? [0, 0, 0],
      wristR: wrists[1] ?? [0, 0, 0],
    },
  };
}
