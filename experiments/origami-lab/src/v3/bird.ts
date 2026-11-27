import { err, ok, type Result, type Vec3 } from "@eschaton/foldon";
import { createRng } from "../prng";
import { add, cross, dist, dot, normal, panelDistance, scale, sub, unit } from "../v2/geom";
import { assemblyContacts, clearance, compileAssembly, placeAssembly, type Assembly, type Attachment, type Built, type Instance, type Seam } from "./assembly";
import { geo1Verdict, verifyCompiled } from "../v2/verify";
import { band, cap, fringe, mirrorDef, moduleIssues, plate, vane, type ModuleDef } from "./module";
import { nearest, solve, type Assignment, type Constraint, type SolveError, type SolveLog, type Variable } from "./solve";

/** Bird V3 (docs/research/origami-lab-v3/bird-design-brief.md). Lengths in L (beak tip to tail tip) unless "cells". */
export const L = 4;

/** Targets drawn by the seed inside anatomical windows: a bounded sampler, named as such. */
export type BirdTargets = Readonly<{
  span: number;
  tail: number;
  beak: number;
  head: number;
  breast: number;
  primaries: 4 | 5;
  tailShape: "square" | "rounded" | "wedge" | "forked";
  dihedralArm: number;
  dihedralHand: number;
  headPitch: number;
  tailFan: number;
}>;

export const CROW_TARGETS: BirdTargets = { span: 2.0, tail: 0.365, beak: 0.1, head: 1, breast: 1, primaries: 5, tailShape: "rounded", dihedralArm: 8, dihedralHand: 2, headPitch: 0, tailFan: 7 };

export const TARGET_WINDOWS = { span: [1.55, 2.45], tail: [0.26, 0.42], beak: [0.07, 0.13], head: [0.85, 1.2], breast: [0.85, 1.2], dihedralArm: [-4, 12], dihedralHand: [-10, 6], headPitch: [-8, 10], tailFan: [5, 9] } as const;

const r3 = (x: number): number => Math.round(x * 1000) / 1000 + 0;

/** Seeded targets (bounded random sampler; not a solver). Extremes 0/1 are both corners of the windows. */
export function birdTargets(seed: number | "crow" | "min" | "max"): BirdTargets {
  if (seed === "crow") return CROW_TARGETS;
  if (seed === "min" || seed === "max") {
    const side = seed === "min" ? 0 : 1;
    const w = TARGET_WINDOWS;
    return { span: w.span[side], tail: w.tail[side], beak: w.beak[side], head: w.head[side], breast: w.breast[side], primaries: side === 0 ? 4 : 5, tailShape: side === 0 ? "forked" : "wedge", dihedralArm: w.dihedralArm[side], dihedralHand: w.dihedralHand[side], headPitch: w.headPitch[side], tailFan: w.tailFan[side] };
  }
  const rng = createRng(seed, 0xb3d);
  const within = (k: keyof typeof TARGET_WINDOWS): number => {
    const [lo, hi] = TARGET_WINDOWS[k];
    return r3(lo + (hi - lo) * rng.next());
  };
  return {
    span: within("span"),
    tail: within("tail"),
    beak: within("beak"),
    head: within("head"),
    breast: within("breast"),
    primaries: rng.pick([4, 5, 5] as const),
    tailShape: rng.pick(["square", "rounded", "wedge", "forked"] as const),
    dihedralArm: within("dihedralArm"),
    dihedralHand: within("dihedralHand"),
    headPitch: within("headPitch"),
    tailFan: within("tailFan"),
  };
}

/* ------------------------------------------------------------------ ladders (finite catalog choices) */

export const RADII = [0.028, 0.034, 0.04, 0.046, 0.048, 0.056, 0.064, 0.074, 0.08, 0.088, 0.096] as const;
export const ARM_SPANS = [0.18, 0.22, 0.26, 0.3, 0.34, 0.38, 0.42, 0.46, 0.5, 0.54] as const;
export const WRIST_CHORDS = [0.12, 0.14, 0.16, 0.18] as const;
export const HAND_OFFSETS = [0.02, 0.04, 0.06, 0.08, 0.1] as const;
export const FAN_STEPS = [4, 5, 6] as const;
/** Ladders are finite; each half-step is below the tolerance of the landmark it serves (beak ±5 %, tail ±3 %). */
export const BEAKS = Array.from({ length: 20 }, (_, i) => r3(0.055 + 0.005 * i));
export const VANE_LENGTHS = [0.96, 1.2, 1.44, 1.68, 1.92, 2.16, 2.4, 2.64] as const;
export const TAIL_LENGTHS = Array.from({ length: 31 }, (_, i) => r3(0.64 + 0.04 * i));
export const LAYERS = [2, 3, 4] as const;
export const COVERT_LIFTS = [4, 6, 8, 10, 12] as const;
export const SECONDARIES = [0.09, 0.11, 0.13] as const;
export const DIHEDRALS = [-4, -2, 0, 2, 4, 6, 8, 10, 12] as const;
export const HAND_DIHEDRALS = [-10, -8, -6, -4, -2, 0, 2, 4, 6] as const;
export const PRIMARY_WIDTH = 0.26;
/** The short vane shared with the vehicle grille (same definition id): 0.26 × 0.119 cells, blunt (0.119 = the tub crown rim at nose scale 0.85). */
export const ALULA = { len: 0.26, w: 0.119 } as const;
export const TAIL_VANE_WIDTH = 0.22;

/** Primary length shapes, inner → outer, as index offsets added to the `primary.base` index into VANE_LENGTHS. */
export const PRIMARY_PATTERNS: Readonly<Record<4 | 5, readonly (readonly number[])[]>> = {
  5: [[0, 1, 2, 2, 1], [0, 1, 2, 3, 3], [1, 2, 2, 1, 0], [0, 1, 1, 1, 0], [0, 1, 2, 2, 2]],
  4: [[0, 1, 2, 1], [0, 1, 2, 2], [1, 2, 1, 0], [0, 1, 1, 0], [0, 1, 2, 3]],
};

/** Tail shape → length multipliers of the base length (inner → outer); vane lengths snap to the 0.04-cell ladder. */
export const TAIL_SHAPES: Readonly<Record<BirdTargets["tailShape"], readonly number[]>> = {
  square: [1, 1, 1],
  rounded: [1, 0.96, 0.86],
  wedge: [1, 0.86, 0.72],
  forked: [0.84, 0.94, 1.08],
};

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;
const quantHalf = (d: number): number => Math.round(d * 2) / 2;

type Pt2 = readonly [number, number];

/* ------------------------------------------------------------------ build from an assignment */

const at = <T>(xs: readonly T[], i: number): T => {
  const v = xs[i];
  if (v === undefined) throw new Error(`index ${i} out of range`);
  return v;
};
const num = (a: Assignment, k: string): number => {
  const v = a[k];
  if (typeof v !== "number") throw new Error(`variable ${k} is not a number`);
  return v;
};

/** Opening angle (degrees, 0.5° ladder) that turns a socket panel's half-plane into the desired child direction. */
function openingFor(parentWorld: readonly Vec3[], def: ModuleDef, portName: string, desired: Vec3): number {
  const port = def.ports.find((p) => p.name === portName);
  if (port?.type !== "edge") throw new Error(`no edge port ${portName}`);
  const panelWorld = (def.panels[port.panel]?.v ?? []).map((v) => parentWorld[v] ?? ([0, 0, 0] as Vec3));
  const [p0, p1] = [parentWorld[port.a] ?? ([0, 0, 0] as Vec3), parentWorld[port.b] ?? ([0, 0, 0] as Vec3)];
  const along = unit(sub(p1, p0));
  const c = sub(panelWorld.reduce<Vec3>((s, v) => add(s, scale(v, 1 / panelWorld.length)), [0, 0, 0]), p0);
  const wp = unit(sub(c, scale(along, dot(c, along))));
  const np = normal(panelWorld);
  const d = unit(sub(desired, scale(along, dot(desired, along))));
  let a = deg(Math.atan2(dot(d, np), dot(d, wp)));
  if (a < 0) a += 360;
  return quantHalf(a);
}

export type BirdPlan = Readonly<{ targets: BirdTargets; assignment: Assignment; assembly: Assembly }>;

/**
 * The bird's part graph for one assignment of the solver variables. The torso half-band is the root; the body chain grows
 * forward and backward through section ports; right halves hang from their left mirrors through the midline port;
 * wings, feathers and tail hang from edge ports with opening angles from the contract ladders.
 */
export function birdAssembly(t: BirdTargets, a: Assignment): Result<Assembly, string> {
  const beak = num(a, "beak");
  const [r2, r3v, r4, r5] = [num(a, "r.brow"), num(a, "r.nape"), num(a, "r.breast"), num(a, "r.belly")];
  const s1 = beak;
  const stations = [
    { s: s1, r: 0.032, y: 0.01 },
    { s: s1 + 0.04, r: r2, y: 0.03 },
    { s: s1 + 0.13, r: r3v, y: 0.022 },
    { s: 0.33, r: r4, y: 0 },
    { s: 0.5, r: r5, y: -0.002 },
    { s: 0.6, r: 0.04, y: 0.01 },
  ];
  const pitch = Math.tan(rad(t.headPitch));
  const nape = at(stations, 2).s;
  const lift = (s: number): number => (s < nape ? (nape - s) * pitch : 0);
  const st = stations.map((x) => ({ ...x, y: x.y + lift(x.s) }));
  const X = (s: number): number => (0.5 - s) * L;
  const instances: Instance[] = [];
  const attachments: Attachment[] = [];
  const seams: Seam[] = [];
  const add2 = (id: string, slot: string, def: ModuleDef, decidedBy: readonly string[]): void => {
    instances.push({ id, slot, def, decidedBy });
  };
  const bands = [0, 1, 2, 3, 4].map((i) => {
    const [f, b] = [at(st, i), at(st, i + 1)];
    return band("keel", f.r * L, b.r * L, (b.s - f.s) * L, (b.y - f.y) * L);
  });
  const bandNames = ["forehead", "crown", "neck", "torso", "belly"];
  const decide = ["beak", "r.brow", "r.nape", "r.breast", "r.belly"];
  bandNames.forEach((n, i) => { add2(`body/${n}.L`, `body.${n}`, at(bands, i), [decide[i] ?? "", decide[i + 1] ?? ""].filter((x) => x !== "")); });
  const beakCap = cap("keel", 0.032 * L, beak * L, (-0.004 + lift(0) - at(st, 0).y) * L, 1);
  const rumpCap = cap("keel", 0.04 * L, -0.04 * L, (0.02 - at(st, 5).y) * L, -1);
  add2("body/beak.L", "body.beak", beakCap, ["beak"]);
  add2("body/rump.L", "body.rump", rumpCap, []);
  attachments.push({ child: "body/neck.L", childPort: "back", parent: "body/torso.L", parentPort: "front" });
  attachments.push({ child: "body/crown.L", childPort: "back", parent: "body/neck.L", parentPort: "front" });
  attachments.push({ child: "body/forehead.L", childPort: "back", parent: "body/crown.L", parentPort: "front" });
  attachments.push({ child: "body/beak.L", childPort: "base", parent: "body/forehead.L", parentPort: "front" });
  attachments.push({ child: "body/belly.L", childPort: "front", parent: "body/torso.L", parentPort: "back" });
  attachments.push({ child: "body/rump.L", childPort: "base", parent: "body/belly.L", parentPort: "back" });
  for (const n of [...bandNames, "beak", "rump"]) {
    const left = instances.find((i) => i.id === `body/${n}.L`);
    if (left === undefined) continue;
    add2(`body/${n}.R`, left.slot, mirrorDef(left.def), left.decidedBy ?? []);
    attachments.push({ child: `body/${n}.R`, childPort: "midline", parent: `body/${n}.L`, parentPort: "midline" });
  }
  seams.push(
    { a: "body/neck.R", aPort: "back", b: "body/torso.R", bPort: "front" },
    { a: "body/crown.R", aPort: "back", b: "body/neck.R", bPort: "front" },
    { a: "body/forehead.R", aPort: "back", b: "body/crown.R", bPort: "front" },
    { a: "body/beak.R", aPort: "base", b: "body/forehead.R", bPort: "front" },
    { a: "body/belly.R", aPort: "front", b: "body/torso.R", bPort: "back" },
    { a: "body/rump.R", aPort: "base", b: "body/belly.R", bPort: "back" },
  );
  const origin: Vec3 = [X(at(st, 3).s), at(st, 3).y * L, 0];
  const bodyOnly: Assembly = { name: "bird", root: "body/torso.L", origin, instances: [...instances], attachments: [...attachments], seams: [...seams], decisions: [] };
  const placedBody = placeAssembly(bodyOnly);
  if (!placedBody.ok) return err(`body: ${placedBody.error.code} ${placedBody.error.message}`);
  const bw = placedBody.value.world;

  /* wing (left; the right wing is the mirror) */
  const torso = at(bands, 3);
  const shoulder = torso.ports.find((p) => p.name === "ridge.1");
  if (shoulder?.type !== "edge") return err("torso has no shoulder ridge");
  const exact = (d: ModuleDef, x: number, y: number): number => dist(d.vertices[x] ?? [0, 0, 0], d.vertices[y] ?? [0, 0, 0]);
  const ls = exact(torso, shoulder.a, shoulder.b) / L;
  const [span, chord, hand0, fan] = [num(a, "arm.span"), num(a, "wrist.chord"), num(a, "hand.offset"), num(a, "fan.step")];
  const arm2: Pt2[] = [[0, 0], [0, -ls], [span, 0.08 - chord], [span, 0.08]];
  const armDef = plate(
    "arm",
    { points: arm2.map(([x, y]): Pt2 => [x * L, y * L]), panels: [{ v: [0, 2, 3], part: "leading" }, { v: [0, 1, 2], part: "trailing" }], creases: [{ parent: 0, child: 1, angle: -10 }] },
    [
      { name: "root", kind: "ridge-hinge", side: "plug", a: 0, b: 1 },
      { name: "wrist", kind: "wrist", side: "socket", a: 3, b: 2 },
      { name: "trailing", kind: "fringe-root", side: "socket", a: 1, b: 2 },
      { name: "crease", kind: "fringe-root", side: "socket", a: 0, b: 2 },
    ],
  );
  const torsoWorld = bw.get("body/torso.L") ?? [];
  const dArm: Vec3 = [0, Math.sin(rad(num(a, "dihedral.arm"))), Math.cos(rad(num(a, "dihedral.arm")))];
  const armAngle = openingFor(torsoWorld, torso, "ridge.1", dArm);
  const k = t.primaries;
  const step = rad(fan);
  const w = PRIMARY_WIDTH / L;
  const rho = w / (2 * Math.sin(step / 2));
  const phiOut = rad(6);
  const psi = Array.from({ length: k + 1 }, (_, j) => phiOut - (k - 1) * step - step / 2 + j * step);
  const s0: Pt2 = [hand0, -chord];
  const centre: Pt2 = [s0[0] - rho * Math.cos(at(psi, 0)), s0[1] - rho * Math.sin(at(psi, 0))];
  const arc: Pt2[] = psi.map((p): Pt2 => [centre[0] + rho * Math.cos(p), centre[1] + rho * Math.sin(p)]);
  const tipPt = at(arc, arc.length - 1);
  const alulaDir = Math.atan2(tipPt[1], tipPt[0]) + rad(5);
  const alula: Pt2 = [(ALULA.w / L) * Math.cos(alulaDir), (ALULA.w / L) * Math.sin(alulaDir)];
  const hand2: Pt2[] = [[0, 0], [0, -chord], ...arc, alula];
  const handDef = plate(
    "hand",
    { points: hand2.map(([x, y]): Pt2 => [x * L, y * L]), panels: [{ v: hand2.map((_, i) => i), part: "hand" }], creases: [] },
    [
      { name: "root", kind: "wrist", side: "plug", a: 0, b: 1 },
      { name: "alula", kind: "vane-root", side: "socket", a: 0, b: hand2.length - 1 },
      ...arc.slice(0, -1).map((_, i) => ({ name: `socket.${i}`, kind: "vane-root", side: "socket" as const, a: 2 + i, b: 3 + i })),
    ],
  );
  const handAngle = quantHalf(180 - (num(a, "dihedral.hand") - num(a, "dihedral.arm")));
  const pattern = at(PRIMARY_PATTERNS[k], num(a, "primaries")).map((o) => o + num(a, "primary.base"));
  const layer = num(a, "layer");
  const secLen = num(a, "secondaries");
  const armWorld = (() => {
    const tmp: Assembly = { ...bodyOnly, instances: [...bodyOnly.instances, { id: "wingL/arm", slot: "wing.arm", def: armDef }], attachments: [...bodyOnly.attachments, { child: "wingL/arm", childPort: "root", parent: "body/torso.L", parentPort: "ridge.1", angle: armAngle, flip: true }] };
    const placed = placeAssembly(tmp);
    return placed.ok ? (placed.value.world.get("wingL/arm") ?? []) : `${placed.error.code}: ${placed.error.message}`;
  })();
  if (typeof armWorld === "string") return err(`arm placement failed: ${armWorld}`);
  const trailingLen = armDef.ports.find((p) => p.name === "trailing");
  const creaseLen = armDef.ports.find((p) => p.name === "crease");
  if (trailingLen?.type !== "edge" || creaseLen?.type !== "edge") return err("arm ports");
  const secondaries = fringe(exact(armDef, trailingLen.a, trailingLen.b), 0.012 * L, 6, secLen * L, 1.0, [1, -1, 1, -1, 1, -1].map((x) => x - 2), 0.012, [0, 0.16]);
  const covertLift = num(a, "covert.lift");
  const coverts = fringe(exact(armDef, creaseLen.a, creaseLen.b), 0.01 * L, 5, 0.45 * ls * L, 1.0, [-1, 1, -1, 1, -1].map((x) => x - covertLift / 3), 0.01, [0.3, 0.34]);
  const primaryDefs = pattern.map((li, i) => vane(at(VANE_LENGTHS, li), PRIMARY_WIDTH, 35, i >= pattern.length - 3 ? "emarginate" : "blunt"));
  const alulaDef = vane(ALULA.len, ALULA.w, 25, "blunt");

  const wing = (side: "L" | "R"): void => {
    const m = (d: ModuleDef): ModuleDef => (side === "L" ? d : mirrorDef(d));
    const id = (n: string): string => `wing${side}/${n}`;
    const parentTorso = `body/torso.${side}`;
    add2(id("arm"), "wing.arm", m(armDef), ["arm.span", "wrist.chord", "dihedral.arm"]);
    attachments.push({ child: id("arm"), childPort: "root", parent: parentTorso, parentPort: "ridge.1", angle: armAngle, flip: true, articulation: { lo: -30, hi: 35, toward: [0, 1, 0] } });
    add2(id("hand"), "wing.hand", m(handDef), ["hand.offset", "fan.step", "dihedral.hand"]);
    attachments.push({ child: id("hand"), childPort: "root", parent: id("arm"), parentPort: "wrist", angle: handAngle, flip: true, articulation: { lo: -20, hi: 25, toward: [0, 1, 0] } });
    pattern.forEach((_, i) => {
      add2(id(`primary.${i}`), "wing.primary", m(at(primaryDefs, i)), ["primaries", "primary.base", "layer"]);
      attachments.push({ child: id(`primary.${i}`), childPort: "root", parent: id("hand"), parentPort: `socket.${i}`, angle: 180 + (i % 2 === 0 ? layer : -layer) - 2 });
    });
    add2(id("alula"), "wing.alula", m(alulaDef), []);
    attachments.push({ child: id("alula"), childPort: "root", parent: id("hand"), parentPort: "alula", angle: 168 });
    add2(id("secondaries"), "wing.secondaries", m(secondaries), ["secondaries"]);
    attachments.push({ child: id("secondaries"), childPort: "root", parent: id("arm"), parentPort: "trailing", angle: 184 });
    add2(id("coverts"), "wing.coverts", m(coverts), ["covert.lift"]);
    attachments.push({ child: id("coverts"), childPort: "root", parent: id("arm"), parentPort: "crease", angle: 190 - covertLift });
  };
  wing("L");
  wing("R");

  /* tail: two half-plates on the rump cap's shoulder ridges whose inner edges lie on the midplane, 3 vanes each */
  const rumpWorld = bw.get("body/rump.L") ?? [];
  const ridge = rumpCap.ports.find((p) => p.name === "ridge.1");
  if (ridge?.type !== "edge") return err("rump ridge");
  const P = rumpWorld[ridge.b] ?? ([0, 0, 0] as Vec3);
  const U = rumpWorld[ridge.a] ?? ([0, 0, 0] as Vec3);
  const backOut = unit(cross(sub(P, U), [0, 1, 0]));
  const desiredTail: Vec3 = unit(add(backOut[0] < 0 ? backOut : scale(backOut, -1), [0, Math.tan(rad(4)), 0]));
  const tailAngle = openingFor(rumpWorld, rumpCap, "ridge.1", desiredTail);
  const xt = unit(sub(U, P));
  const wt = (() => {
    const panelWorld = (rumpCap.panels[ridge.panel]?.v ?? []).map((v) => rumpWorld[v] ?? ([0, 0, 0] as Vec3));
    const c = sub(panelWorld.reduce<Vec3>((s, v) => add(s, scale(v, 1 / panelWorld.length)), [0, 0, 0]), P);
    const along = unit(sub(U, P));
    const wp = unit(sub(c, scale(along, dot(c, along))));
    const np = normal(panelWorld);
    return add(scale(wp, Math.cos(rad(tailAngle))), scale(np, Math.sin(rad(tailAngle))));
  })();
  const lr = dist(P, U);
  const worldOf = (v: Pt2): Vec3 => add(scale(wt, v[0]), scale(xt, -v[1]));
  const inPlane: Pt2 = (() => {
    const len = Math.hypot(xt[2], wt[2]);
    const cand: Pt2 = [xt[2] / len, wt[2] / len];
    return worldOf(cand)[0] < 0 ? cand : [-cand[0], -cand[1]];
  })();
  const lin = 0.05 * L;
  const tm: Pt2 = [inPlane[0] * lin, inPlane[1] * lin];
  const tw = TAIL_VANE_WIDTH;
  const tfan = rad(num(a, "tail.fan"));
  const backDir = Math.atan2(inPlane[1], inPlane[0]);
  const toRoot: Pt2 = [0 - tm[0], -lr - tm[1]];
  const sigma = Math.sin(-backDir) * toRoot[0] + Math.cos(-backDir) * toRoot[1] >= 0 ? 1 : -1;
  const sockets: Pt2[] = [tm];
  for (let i = 0; i < 3; i++) {
    const beta = backDir + sigma * (i + 0.5) * tfan;
    const e: Pt2 = [Math.cos(beta + (sigma * Math.PI) / 2), Math.sin(beta + (sigma * Math.PI) / 2)];
    const last = at(sockets, sockets.length - 1);
    sockets.push([last[0] + tw * e[0], last[1] + tw * e[1]]);
  }
  const tail2: Pt2[] = [[0, 0], [0, -lr], ...sockets.toReversed()];
  const tailDef = plate(
    "tail",
    { points: tail2, panels: [{ v: tail2.map((_, i) => i), part: "tail" }], creases: [] },
    [
      { name: "root", kind: "ridge-hinge", side: "plug", a: 0, b: 1 },
      { name: "inner", kind: "tail-midline", side: "seam", a: 0, b: tail2.length - 1 },
      ...[0, 1, 2].map((i) => ({ name: `socket.${i}`, kind: "vane-root", side: "socket" as const, a: tail2.length - 1 - i, b: tail2.length - 2 - i })),
    ],
  );
  const base = num(a, "tail.len");
  const tailLayer = num(a, "tail.layer");
  const tpat = TAIL_SHAPES[t.tailShape].map((f) => Math.round((base * f) / 0.04) * 0.04);
  const tailVanes = tpat.map((len) => vane(r3(len), TAIL_VANE_WIDTH, 20, "spatulate"));
  seams.push({ a: "tail/plate.R", aPort: "inner", b: "tail/plate.L", bPort: "inner" });
  for (const side of ["L", "R"] as const) {
    const m = (d: ModuleDef): ModuleDef => (side === "L" ? d : mirrorDef(d));
    add2(`tail/plate.${side}`, "tail.plate", m(tailDef), ["tail.fan"]);
    attachments.push({ child: `tail/plate.${side}`, childPort: "root", parent: `body/rump.${side}`, parentPort: "ridge.1", angle: tailAngle });
    tpat.forEach((_, i) => {
      add2(`tail/vane.${side}${i}`, "tail.vane", m(at(tailVanes, i)), ["tail.len", "tail.layer"]);
      const bias = side === "L" ? 1.5 : -1.5;
      attachments.push({ child: `tail/vane.${side}${i}`, childPort: "root", parent: `tail/plate.${side}`, parentPort: `socket.${i}`, angle: 180 + bias + (i - 1) * tailLayer });
    });
  }
  return ok({ name: "bird", root: "body/torso.L", origin, instances, attachments, seams, decisions: [] });
}

/* ------------------------------------------------------------------ measured landmarks */

export type BirdMeasures = Readonly<{ length: number; span: number; spanRatio: number; tailRatio: number; beakRatio: number; headBreast: number; beakTip: Vec3; tailTip: Vec3; wingTipL: Vec3; wingTipR: Vec3 }>;

/** Landmarks measured on the placed geometry (never read back from parameters). */
export function birdMeasures(b: Built): BirdMeasures {
  const pts = (prefix: string): Vec3[] => b.assembly.instances.filter((i) => i.id.startsWith(prefix)).flatMap((i) => [...(b.world.get(i.id) ?? [])]);
  const beakPts = pts("body/beak.");
  const beakTip = beakPts.reduce((m, p) => (p[0] > m[0] ? p : m));
  const gapeX = Math.min(...beakPts.map((p) => p[0]));
  const tailPts = pts("tail/vane.");
  const tailTip = tailPts.reduce((m, p) => (p[0] < m[0] ? p : m));
  const rumpApex = pts("body/rump.").reduce((m, p) => (p[0] < m[0] ? p : m));
  const wingL = pts("wingL/");
  const wingR = pts("wingR/");
  const wingTipL = wingL.reduce((m, p) => (p[2] > m[2] ? p : m));
  const wingTipR = wingR.reduce((m, p) => (p[2] < m[2] ? p : m));
  const length = beakTip[0] - tailTip[0];
  const span = wingTipL[2] - wingTipR[2];
  const width = (prefix: string): number => Math.max(...pts(prefix).map((p) => Math.abs(p[2]))) * 2;
  return { length, span, spanRatio: span / length, tailRatio: (rumpApex[0] - tailTip[0]) / length, beakRatio: (beakTip[0] - gapeX) / length, headBreast: width("body/crown.") / width("body/torso."), beakTip, tailTip, wingTipL, wingTipR };
}

/* ------------------------------------------------------------------ the solver problem */

export const LAYER_CLEARANCE = 0.008;

export type BirdDesign = Readonly<{ targets: BirdTargets; assignment: Assignment; assembly: Assembly; built: Built; measures: BirdMeasures; log: SolveLog }>;

export type BirdStage = "body" | "wings";

/** All solver variables with domains ordered nearest to the targets first (value order is the only seed influence). */
export function birdVariables(t: BirdTargets): readonly (Variable & Readonly<{ stage: BirdStage }>)[] {
  const radii = [...RADII];
  return [
    { stage: "body", name: "tail.layer", domain: [-3.5, -2, -5, 2, 3.5, 5] },
    { stage: "body", name: "tail.fan", domain: nearest([3, 4, 5], t.tailFan - 3) },
    { stage: "body", name: "tail.len", domain: nearest(TAIL_LENGTHS, t.tail * L - 0.26) },
    { stage: "body", name: "beak", domain: nearest(BEAKS, t.beak) },
    { stage: "body", name: "r.brow", domain: nearest(radii, 0.056 * t.head) },
    { stage: "body", name: "r.nape", domain: nearest(radii, 0.046 * t.head) },
    { stage: "body", name: "r.breast", domain: nearest(radii, 0.088 * t.breast) },
    { stage: "body", name: "r.belly", domain: nearest(radii, 0.074 * t.breast) },
    { stage: "wings", name: "dihedral.arm", domain: nearest(DIHEDRALS, t.dihedralArm) },
    { stage: "wings", name: "dihedral.hand", domain: nearest(HAND_DIHEDRALS, t.dihedralHand) },
    { stage: "wings", name: "fan.step", domain: nearest(FAN_STEPS, 5) },
    { stage: "wings", name: "hand.offset", domain: nearest(HAND_OFFSETS, 0.04) },
    { stage: "wings", name: "wrist.chord", domain: nearest(WRIST_CHORDS, 0.14) },
    { stage: "wings", name: "primaries", domain: PRIMARY_PATTERNS[t.primaries].map((_, i) => i) },
    { stage: "wings", name: "arm.span", domain: nearest(ARM_SPANS, 0.19 * t.span) },
    { stage: "wings", name: "primary.base", domain: nearest([0, 1, 2, 3, 4], 1 + Math.round((t.span - 2) * 3)) },
    { stage: "wings", name: "secondaries", domain: nearest(SECONDARIES, 0.11) },
    { stage: "wings", name: "covert.lift", domain: [...COVERT_LIFTS] },
    { stage: "wings", name: "layer", domain: [3, 2, 4] },
  ];
}

/**
 * One stage of the hierarchical search. Stage "body" chooses the body and tail (beak and tail ratios are measured on the
 * built bird); stage "wings" then chooses the wings against the fixed body, so the span ratio is measured against the
 * real length. Each geometric constraint is scoped to the variables that change it; the others are held at their first
 * (nearest-to-target) value while the constraint is evaluated, which is sound because they do not affect it.
 */
export function birdProblem(t: BirdTargets, stage: BirdStage, fixed: Assignment = {}): Readonly<{ variables: readonly Variable[]; constraints: readonly Constraint[] }> {
  const every = birdVariables(t);
  const variables = every.filter((v) => v.stage === stage);
  const defaults = Object.fromEntries(every.map((v) => [v.name, v.domain[0] ?? 0]));
  const cache = new Map<string, Result<Built, string>>();
  const build = (a: Assignment): Result<Built, string> => {
    const full = { ...defaults, ...fixed, ...a };
    const key = JSON.stringify(every.map((v) => full[v.name]));
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const asm = birdAssembly(t, full);
    const invalid = asm.ok ? asm.value.instances.flatMap((i) => moduleIssues(i.def).map((x) => `${i.id}: ${x}`)) : [];
    const placed: Result<Built, string> = !asm.ok ? asm : invalid.length > 0 ? err(`invalid module ${invalid[0] ?? ""}`) : (() => {
      const p = placeAssembly(asm.value);
      return p.ok ? ok(p.value) : err(`${p.error.code}: ${p.error.message}`);
    })();
    if (cache.size > 256) cache.clear();
    cache.set(key, placed);
    return placed;
  };
  const measured = (scope: readonly string[], name: string, f: (m: BirdMeasures) => true | string): Constraint => ({
    name,
    scope,
    check: (a) => {
      const b = build(a);
      return b.ok ? f(birdMeasures(b.value)) : b.error;
    },
  });
  const within = (value: number, target: number, tol: number): boolean => Math.abs(value / target - 1) <= tol;
  const names = variables.map((v) => v.name);
  const outsideWings = (x: string): boolean => !x.startsWith("wingL/") && !x.startsWith("wingR/");
  if (stage === "body") {
    return {
      variables,
      constraints: [
        { name: "forehead step", scope: ["r.brow"], check: (a) => (num(a, "r.brow") > 0.034 ? true : "brow not clearly larger than the gape") },
        { name: "nape waist", scope: ["r.brow", "r.nape"], check: (a) => (num(a, "r.nape") < num(a, "r.brow") ? true : "no waist between head and neck") },
        { name: "breast largest", scope: ["r.nape", "r.breast"], check: (a) => (num(a, "r.breast") > num(a, "r.nape") ? true : "breast not larger than nape") },
        { name: "belly taper", scope: ["r.breast", "r.belly"], check: (a) => (num(a, "r.belly") <= num(a, "r.breast") && num(a, "r.belly") > 0.04 ? true : "belly not between vent and breast") },
        { name: "head/breast width", scope: ["r.brow", "r.breast"], check: (a) => {
          const ratio = num(a, "r.brow") / num(a, "r.breast");
          return ratio >= 0.55 && ratio <= 0.72 ? true : `head/breast ${ratio.toFixed(3)} outside [0.55, 0.72]`;
        } },
        measured(["beak", "tail.len", "tail.fan"], "measured tail ±3 %", (m) => (within(m.tailRatio, t.tail, 0.03) ? true : `tail ${m.tailRatio.toFixed(3)} vs target ${t.tail}`)),
        measured(["beak", "tail.len"], "measured beak ±5 %", (m) => (within(m.beakRatio, t.beak, 0.05) ? true : `beak ${m.beakRatio.toFixed(3)} vs target ${t.beak}`)),
        { name: "tail feathers: no contact", scope: ["tail.len", "tail.fan", "tail.layer"], check: (a) => {
          const b = build(a);
          if (!b.ok) return b.error;
          const c = assemblyContacts(b.value).filter((x) => x.a.startsWith("tail/") && x.b.startsWith("tail/"));
          return c.length === 0 ? true : `${c.length} contacts, e.g. ${c[0]?.a} / ${c[0]?.b} (${c[0]?.contact.kind})`;
        } },
        { name: "body and tail: no contact outside declared ports", scope: names, check: (a) => {
          const b = build(a);
          if (!b.ok) return b.error;
          const c = assemblyContacts(b.value).filter((x) => outsideWings(x.a) && outsideWings(x.b));
          return c.length === 0 ? true : `${c.length} contacts, e.g. ${c[0]?.a} / ${c[0]?.b} (${c[0]?.contact.kind})`;
        } },
      ],
    };
  }
  return {
    variables,
    constraints: [
      { name: "primaries at most 1.3 × the arm (no needle hands)", scope: ["arm.span", "primaries", "primary.base"], check: (a) => {
        const longest = Math.max(...at(PRIMARY_PATTERNS[t.primaries], num(a, "primaries")).map((o) => at(VANE_LENGTHS, o + num(a, "primary.base"))));
        return longest / L <= 1.3 * num(a, "arm.span") ? true : `primary ${longest.toFixed(2)} cells vs arm ${(num(a, "arm.span") * L).toFixed(2)}`;
      } },
      { name: "hand and arm plates valid", scope: ["wrist.chord", "hand.offset", "fan.step", "arm.span"], check: (a) => {
        const b = build(a);
        return b.ok ? true : b.error;
      } },
      measured(["dihedral.arm", "dihedral.hand", "arm.span", "wrist.chord", "hand.offset", "fan.step", "primaries", "primary.base"], "measured span ±3 %", (m) => (within(m.spanRatio, t.span, 0.03) ? true : `span ${m.spanRatio.toFixed(3)} vs target ${t.span}`)),
      { name: "covert layer clearance (coverts over secondaries; sheets without a shared port)", scope: ["covert.lift", "secondaries", "arm.span", "wrist.chord"], check: (a) => {
        const b = build(a);
        if (!b.ok) return b.error;
        const gap = Math.min(...(["L", "R"] as const).map((s) => clearance(b.value, [`wing${s}/coverts`], [`wing${s}/secondaries`], panelDistance)));
        return gap >= LAYER_CLEARANCE ? true : `covert clearance ${gap.toFixed(4)} < ${LAYER_CLEARANCE}`;
      } },
      { name: "no contact outside declared ports", scope: names, check: (a) => {
        const b = build(a);
        if (!b.ok) return b.error;
        const c = assemblyContacts(b.value);
        return c.length === 0 ? true : `${c.length} contacts, e.g. ${c[0]?.a} / ${c[0]?.b} (${c[0]?.contact.kind})`;
      } },
      { name: "automated GEO-1 PASS (every sheet's fold, the flap sweep and the rest pose certified)", scope: names, lazy: true, check: (a) => {
        const asm = birdAssembly(t, { ...defaults, ...fixed, ...a });
        if (!asm.ok) return asm.error;
        const compiled = compileAssembly(asm.value, "bird", {});
        if (!compiled.ok) return compiled.error.message;
        const verdict = geo1Verdict(verifyCompiled(compiled.value.compiled));
        return verdict.verdict === "PASS" ? true : `${verdict.verdict}: ${verdict.reasons.join("; ").slice(0, 160)}`;
      } },
    ],
  };
}

/** Targets → two-stage constraint search → the assembled bird with its decision log. Deterministic for a seed. */
export function designBird(seed: number | "crow" | "min" | "max"): Result<BirdDesign, SolveError | Readonly<{ code: "build"; message: string }>> {
  const targets = birdTargets(seed);
  const body = birdProblem(targets, "body");
  const first = solve(body.variables, body.constraints, 6000, "static");
  if (!first.ok) return first;
  const wings = birdProblem(targets, "wings", first.value.assignment);
  const second = solve(wings.variables, wings.constraints, 6000, "static");
  if (!second.ok) return second;
  const assignment = { ...first.value.assignment, ...second.value.assignment };
  const log: SolveLog = {
    decisions: [...first.value.log.decisions, ...second.value.log.decisions],
    nodes: first.value.log.nodes + second.value.log.nodes,
    backtracks: first.value.log.backtracks + second.value.log.backtracks,
    eliminations: first.value.log.eliminations + second.value.log.eliminations,
  };
  const asm = birdAssembly(targets, assignment);
  if (!asm.ok) return err({ code: "build", message: asm.error });
  const assembly: Assembly = { ...asm.value, decisions: log.decisions };
  const placed = placeAssembly(assembly);
  if (!placed.ok) return err({ code: "build", message: placed.error.message });
  return ok({ targets, assignment, assembly, built: placed.value, measures: birdMeasures(placed.value), log });
}

export function birdLandmarks(b: Built): Readonly<Record<string, Vec3>> {
  const m = birdMeasures(b);
  return { beakTip: m.beakTip, tailTip: m.tailTip, wingTipL: m.wingTipL, wingTipR: m.wingTipR };
}

