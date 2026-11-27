import { err, ok, type Result, type Vec3 } from "@eschaton/foldon";
import { createRng } from "../prng";
import { add, dot, normal, panelDistance, scale, sub, unit } from "../v2/geom";
import { assemblyContacts, clearance, compileAssembly, placeAssembly, type Assembly, type Attachment, type Built, type Instance, type Seam } from "./assembly";
import { geo1Verdict, verifyCompiled } from "../v2/verify";
import { arch, band, cap, mirrorDef, moduleIssues, plate, stitch, TUB_CROWN, vane, type ModuleDef, type Side } from "./module";
import { nearest, solve, type Assignment, type Constraint, type SolveError, type SolveLog, type Variable } from "./solve";

/** Vehicle V3 (docs/research/origami-lab-v3/vehicle-design-brief.md). Cells ≈ metres; x forward, nose at x = 2.2. */
export const LV = 4.4;
const NOSE = 2.2;
const X = (f: number): number => NOSE - f;

export type VehicleTargets = Readonly<{ wheelbase: number; frontAxle: number; tyre: number; roof: number; hood: number; cabin: "sedan" | "coupe"; fenderSegments: 4 | 5 }>;
export const HERO: VehicleTargets = { wheelbase: 2.6, frontAxle: 0.78, tyre: 0.33, roof: 1.48, hood: 1.55, cabin: "sedan", fenderSegments: 5 };
const WINDOWS = { wheelbase: [2.4, 2.8], frontAxle: [0.7, 0.86], tyre: [0.3, 0.36], roof: [1.4, 1.56], hood: [1.35, 1.75] } as const;

/** Seeded targets inside the brief's windows (a bounded sampler, not a solver). */
export function vehicleTargets(seed: number | "hero" | "min" | "max"): VehicleTargets {
  if (seed === "hero") return HERO;
  if (seed === "min" || seed === "max") {
    const s = seed === "min" ? 0 : 1;
    return { wheelbase: WINDOWS.wheelbase[s], frontAxle: WINDOWS.frontAxle[s], tyre: WINDOWS.tyre[s], roof: WINDOWS.roof[s], hood: WINDOWS.hood[s], cabin: s === 0 ? "coupe" : "sedan", fenderSegments: s === 0 ? 4 : 5 };
  }
  const rng = createRng(seed, 0xca7);
  const within = (k: keyof typeof WINDOWS): number => {
    const [lo, hi] = WINDOWS[k];
    return Math.round((lo + (hi - lo) * rng.next()) * 1000) / 1000;
  };
  return { wheelbase: within("wheelbase"), frontAxle: within("frontAxle"), tyre: within("tyre"), roof: within("roof"), hood: within("hood"), cabin: rng.pick(["sedan", "coupe"] as const), fenderSegments: rng.pick([4, 5] as const) };
}

export const WHEELBASES = [2.4, 2.5, 2.6, 2.7, 2.8] as const;
export const FRONT_AXLES = [0.7, 0.74, 0.78, 0.82, 0.86] as const;
export const TYRES = [0.3, 0.33, 0.36] as const;
export const FENDER_GAPS = [0.04, 0.06, 0.08, 0.1] as const;
export const ROOFS = [1.4, 1.44, 1.48, 1.52, 1.56] as const;
export const HOODS = [1.35, 1.45, 1.55, 1.65, 1.75] as const;
/** The shared short vane (bird alula): 0.26 × 0.119 cells; 0.119 is the crown rim edge at the nose scale. */
export const SLAT = { len: 0.26, w: 0.119 } as const;
const NOSE_SCALE = 0.85;
const DECK = 0.8;
const FLOOR_DROP = 0.38;
/** Floor height is constant (the hangers hang exactly vertical, so tyres sit exactly on the ground); the deck follows the station scale. */
const FLOOR = DECK - FLOOR_DROP;
const deckAt = (s: number): number => FLOOR + FLOOR_DROP * s;
const AXLE_R = 0.04;
const TYRE_W = 0.2;
const HALF_TRACK = 0.74;
/** Running board width; the fender (0.30 wide) starts on a chamfered board end 0.06 outboard of the body side. */
const BOARD_W = 0.36;
const CHAMFER = 0.06;
const FENDER_W = BOARD_W - CHAMFER;
const AXLE_SCALE = 1;
const O3: Vec3 = [0, 0, 0];

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
const quantHalf = (d: number): number => Math.round(d * 2) / 2;

function openingFor(world: readonly Vec3[], def: ModuleDef, portName: string, desired: Vec3): number {
  const port = def.ports.find((p) => p.name === portName);
  if (port?.type !== "edge") throw new Error(`no edge port ${portName}`);
  const panel = (def.panels[port.panel]?.v ?? []).map((v) => world[v] ?? O3);
  const [p0, p1] = [world[port.a] ?? O3, world[port.b] ?? O3];
  const along = unit(sub(p1, p0));
  const c = sub(panel.reduce<Vec3>((s, v) => add(s, scale(v, 1 / panel.length)), O3), p0);
  const wp = unit(sub(c, scale(along, dot(c, along))));
  const d = unit(sub(desired, scale(along, dot(desired, along))));
  let a = (Math.atan2(dot(d, normal(panel)), dot(d, wp)) * 180) / Math.PI;
  if (a < 0) a += 360;
  return quantHalf(a);
}

type Station = Readonly<{ f: number; s: number; deck: number; tag: string }>;

/** The vehicle part graph for one assignment. Root: the tub band where the running board starts. */
export function vehicleAssembly(t: VehicleTargets, a: Assignment): Result<Assembly, string> {
  const [wb, fA1, R, gap, roof, hood] = [num(a, "wheelbase"), num(a, "front.axle"), num(a, "tyre"), num(a, "fender.gap"), num(a, "roof"), num(a, "hood")];
  const n = num(a, "fender.segments");
  const fA2 = fA1 + wb;
  const fR1 = hood + 0.3;
  const cabinLen = t.cabin === "sedan" ? 1.25 : 1.0;
  const fR2 = fR1 + cabinLen;
  /* The glass strips must each end on single tub edges: a wheel station under the rear window becomes the rear-window base. */
  const fW2 = fA2 > fR2 + 0.1 && fA2 < fR2 + 0.4 ? fA2 : fR2 + 0.4;
  if ([fA1, fA2].some((f) => f > hood && f < fR1)) return err("a wheel station falls under the windshield");
  const bays = t.cabin === "sedan" ? [0.1, 0.45, 0.08, cabinLen - 0.77, 0.14] : [0.12, cabinLen - 0.42, 0.3];
  const cabinStations = bays.reduce<number[]>((acc, len) => [...acc, (acc[acc.length - 1] ?? fR1) + len], [fR1]);
  const fixed: Station[] = [
    { f: 0.06, s: NOSE_SCALE, deck: deckAt(NOSE_SCALE), tag: "nose" },
    { f: fA1, s: AXLE_SCALE, deck: deckAt(AXLE_SCALE), tag: "axle1" },
    { f: hood, s: 1, deck: DECK, tag: "cowl" },
    ...cabinStations.map((f, i) => ({ f, s: 1, deck: DECK, tag: `cabin${i}` })),
    ...(fW2 === fA2 ? [] : [{ f: fW2, s: 1, deck: DECK, tag: "rearwindow" }]),
    { f: fA2, s: AXLE_SCALE, deck: deckAt(AXLE_SCALE), tag: "axle2" },
    { f: 4.3, s: 0.9, deck: deckAt(0.9), tag: "tail" },
  ];
  /* Running-board ends sit where a fender of radius R + gap meets the floor; an end within 0.06 of another station snaps onto it and that fender's radius follows the snapped end, so the arch stays concentric with its wheel. */
  const reach = Math.sqrt(Math.max(0, (R + gap) ** 2 - (FLOOR - R) ** 2)) + CHAMFER;
  const snap = (f: number): Readonly<{ f: number; merged?: string }> => {
    const near = fixed.filter((st) => st.s === 1).find((st) => Math.abs(st.f - f) < 0.06);
    return near === undefined ? { f } : { f: near.f, merged: near.tag };
  };
  const [b1, b2] = [snap(fA1 + reach), snap(fA2 - reach)];
  const fF1 = b1.f;
  const fF2 = b2.f;
  const Rf1 = Math.hypot(fF1 - CHAMFER - fA1, FLOOR - R);
  const Rf2 = Math.hypot(fA2 - fF2 - CHAMFER, FLOOR - R);
  if (Rf1 - R < 0.04 || Rf2 - R < 0.04) return err("a snapped running-board end leaves less than 0.04 over the tyre");
  const stationList: Station[] = [
    ...fixed,
    ...(b1.merged === undefined ? [{ f: fF1, s: 1, deck: DECK, tag: "board1" }] : []),
    ...(b2.merged === undefined ? [{ f: fF2, s: 1, deck: DECK, tag: "board2" }] : []),
  ].sort((p, q) => p.f - q.f);
  for (let i = 0; i + 1 < stationList.length; i++) {
    const [p, q] = [at(stationList, i), at(stationList, i + 1)];
    if (q.f - p.f < 0.02) return err(`stations ${p.tag} and ${q.tag} are closer than 0.02`);
  }
  const alias: Readonly<Record<string, string>> = { ...(b1.merged === undefined ? {} : { board1: b1.merged }), ...(b2.merged === undefined ? {} : { board2: b2.merged }), ...(fW2 === fA2 ? { rearwindow: "axle2" } : {}) };
  const index = (tag: string): number => stationList.findIndex((st) => st.tag === (alias[tag] ?? tag));
  if (index("axle1") >= index("board1") || index("axle2") <= index("board2")) return err("an axle station falls between the running-board ends");
  if (index("cowl") <= index("board1")) return err("the cowl lies ahead of the running board");
  const instances: Instance[] = [];
  const attachments: Attachment[] = [];
  const seams: Seam[] = [];
  const put = (id: string, slot: string, def: ModuleDef, decidedBy: readonly string[]): void => {
    instances.push({ id, slot, def, decidedBy });
  };
  const bands = stationList.slice(0, -1).map((p, i) => {
    const q = at(stationList, i + 1);
    return band("tub", p.s, q.s, q.f - p.f, q.deck - p.deck);
  });
  const root = index("board1");
  bands.forEach((b, i) => {
    put(`tub/${i}.L`, "body.tub", b, ["wheelbase", "front.axle", "hood", "fender.gap"]);
  });
  for (let i = root - 1; i >= 0; i--) attachments.push({ child: `tub/${i}.L`, childPort: "back", parent: `tub/${i + 1}.L`, parentPort: "front" });
  for (let i = root + 1; i < bands.length; i++) attachments.push({ child: `tub/${i}.L`, childPort: "front", parent: `tub/${i - 1}.L`, parentPort: "back" });
  const first = at(stationList, 0);
  const last = at(stationList, stationList.length - 1);
  put("tub/nose.L", "body.nose", cap("tub", first.s, -0.08, -0.19 * first.s, 1), []);
  attachments.push({ child: "tub/nose.L", childPort: "base", parent: "tub/0.L", parentPort: "front" });
  put("tub/tail.L", "body.tail", cap("tub", last.s, -0.1, -0.12, -1), []);
  attachments.push({ child: "tub/tail.L", childPort: "base", parent: `tub/${bands.length - 1}.L`, parentPort: "back" });

  /* cabin: windshield strip on the cowl crown → cabin bands (pillars and open window bays) → rear-window strip onto the rear crown */
  const M = at(TUB_CROWN, TUB_CROWN.length - 1);
  const cabinPoints: readonly (readonly [number, number])[] = [[0, 0], [0.36, -0.04], [M[0], DECK + M[1] - roof]];
  const cabinFrom = stationList.findIndex((st) => st.tag === "cabin0");
  const cabinTo = stationList.findIndex((st) => st.tag === `cabin${bays.length}`);
  const segments = stationList.slice(cabinFrom, cabinTo).map((st, i) => {
    const next = at(stationList, cabinFrom + i + 1);
    const mid = (st.f + next.f) / 2;
    const bay = cabinStations.findIndex((f, j) => mid >= f && mid < (cabinStations[j + 1] ?? Infinity));
    return { tub: cabinFrom + i, len: next.f - st.f, window: bay % 2 === 1 };
  });
  const cabinBands = segments.map((seg) => band("cabin", 1, 1, seg.len, 0, seg.window ? [1] : [], cabinPoints));
  const crownAt = (dx: number): readonly Vec3[] => TUB_CROWN.map(([z, y]): Vec3 => [dx, DECK + y, z]);
  const cabinSection = (dx: number): readonly Vec3[] => cabinPoints.map(([z, y]): Vec3 => [dx, roof + y, z]);
  const glassKind = at(cabinBands, 0).ports.find((p) => p.name === "front")?.kind ?? "";
  const rearKind = cabinBands.at(-1)?.ports.find((p) => p.name === "back")?.kind ?? "";
    const rising: readonly ("bottom" | "top")[] = ["bottom", "top", "bottom", "bottom", "top"];
  const windshield = stitch("windshield", crownAt(0), cabinSection(-(fR1 - hood)), { kind: "crown:1", side: "socket" }, { kind: glassKind, side: "socket" }, [1, 1, 0.2], rising);
  const rearWindow = stitch("rear-window", crownAt(-(fW2 - fR2)), cabinSection(0), { kind: "crown:1", side: "plug" }, { kind: rearKind, side: "plug" }, [-1, 1, 0.2], rising);
  const cowlBand = index("cowl");

  /* running board: one coplanar quad per tub band between the fenders, attached on the first band's floor corner */
  const boardStations = stationList.slice(index("board1"), index("board2") + 1).map((st) => st.f - fF1);
  const k = boardStations.length;
  const c = CHAMFER;
  const inner = boardStations.map((x): [number, number] => [x, 0]);
  const outer = boardStations.map((x, i): [number, number] => [i === 0 ? x - c : i === k - 1 ? x + c : x, BOARD_W]);
  const boardPts: [number, number][] = [...inner, [(boardStations[k - 1] ?? 0) + c, c], ...outer.toReversed(), [-c, c]];
  const outerIndex = (i: number): number => k + 1 + (k - 1 - i);
  const boardDef = plate(
    "board",
    {
      points: boardPts,
      panels: boardStations.slice(0, -1).map((_, i) => {
        const front = i === 0 ? [boardPts.length - 1] : [];
        const rear = i === k - 2 ? [k] : [];
        return { v: [i, i + 1, ...rear, outerIndex(i + 1), outerIndex(i), ...front], part: "board" };
      }),
      creases: boardStations.slice(1, -1).map((_, i) => ({ parent: i, child: i + 1, angle: 0 })),
    },
    [
      ...boardStations.slice(0, -1).map((_, i): Readonly<{ name: string; kind: string; side: Side; a: number; b: number }> => ({ name: `inner.${i}`, kind: "ridge-hinge", side: i === 0 ? "plug" : "seam", a: i, b: i + 1 })),
      { name: "front", kind: "fender-end", side: "socket", a: boardPts.length - 1, b: outerIndex(0) },
      { name: "rear", kind: "fender-end", side: "socket", a: k, b: outerIndex(k - 1) },
    ],
  );
  const phi = (rf: number): number => (Math.asin((FLOOR - R) / rf) * 180) / Math.PI;
  const fenderFront = arch(Rf1, FENDER_W, 180 - phi(Rf1), -10, n);
  const fenderRear = arch(Rf2, FENDER_W, 180 - phi(Rf2), -10, n);
  const slat = vane(SLAT.len, SLAT.w, 25, "blunt");

  /* hangers (leaf springs), axles and wheels */
  const wheelParts = (s: number): Readonly<Record<"hanger" | "axle" | "sidewall" | "tread" | "hub", ModuleDef>> => {
    const lw = 0.56 * s;
    const h = FLOOR - (R + AXLE_R);
    return {
      hanger: plate("hanger", { points: [[0, 0], [0, -lw], [h, -lw], [h, 0]], panels: [{ v: [0, 1, 2, 3], part: "spring" }], creases: [] }, [
        { name: "top", kind: "rim", side: "plug", a: 0, b: 1 },
        { name: "bottom", kind: "line", side: "socket", a: 3, b: 2 },
      ]),
      axle: band("tyre", AXLE_R, AXLE_R, lw),
      sidewall: band("tyre", AXLE_R, R, HALF_TRACK - TYRE_W / 2 - lw),
      tread: band("tyre", R, R, TYRE_W),
      hub: cap("tyre", R, 0.05, 0, -1),
    };
  };

  const side = (sd: "L" | "R"): void => {
    const m = (d: ModuleDef): ModuleDef => (sd === "L" ? d : mirrorDef(d));
    const id = (x: string): string => `${x}.${sd}`;
    if (sd === "R") {
      bands.forEach((b, i) => {
        put(`tub/${i}.R`, "body.tub", mirrorDef(b), ["wheelbase", "front.axle", "hood", "fender.gap"]);
        attachments.push({ child: `tub/${i}.R`, childPort: "midline", parent: `tub/${i}.L`, parentPort: "midline" });
      });
      for (const c of ["nose", "tail"] as const) {
        const left = instances.find((i) => i.id === `tub/${c}.L`);
        if (left === undefined) continue;
        put(`tub/${c}.R`, left.slot, mirrorDef(left.def), []);
        attachments.push({ child: `tub/${c}.R`, childPort: "midline", parent: `tub/${c}.L`, parentPort: "midline" });
      }
      for (const [i, j] of [[0, "nose"]] as const) seams.push({ a: `tub/${j}.R`, aPort: "base", b: `tub/${i}.R`, bPort: "front" });
      seams.push({ a: "tub/tail.R", aPort: "base", b: `tub/${bands.length - 1}.R`, bPort: "back" });
      for (let i = 0; i + 1 < bands.length; i++) seams.push({ a: `tub/${i}.R`, aPort: "back", b: `tub/${i + 1}.R`, bPort: "front" });
    }
    put(id("cabin/windshield"), "cabin.windshield", m(windshield), ["hood", "roof"]);
    attachments.push({ child: id("cabin/windshield"), childPort: "base", parent: id(`tub/${cowlBand}`), parentPort: "crown.front" });
    cabinBands.forEach((cb, i) => {
      const seg = at(segments, i);
      put(id(`cabin/${i}`), seg.window ? "cabin.window" : "cabin.pillar", m(cb), ["roof", "hood", "wheelbase"]);
      attachments.push(i === 0 ? { child: id("cabin/0"), childPort: "front", parent: id("cabin/windshield"), parentPort: "top" } : { child: id(`cabin/${i}`), childPort: "front", parent: id(`cabin/${i - 1}`), parentPort: "back" });
      if (!seg.window) seams.push({ a: id(`cabin/${i}`), aPort: "edge.2", b: id(`tub/${seg.tub}`), bPort: "ridge.3" });
      if (sd === "R") seams.push({ a: `cabin/${i}.R`, aPort: "midline", b: `cabin/${i}.L`, bPort: "midline" });
    });
    put(id("cabin/rear"), "cabin.rear-window", m(rearWindow), ["roof"]);
    attachments.push({ child: id("cabin/rear"), childPort: "top", parent: id(`cabin/${cabinBands.length - 1}`), parentPort: "back" });
    seams.push({ a: id("cabin/rear"), aPort: "base", b: id(`tub/${index("rearwindow") - 1}`), bPort: "crown.back" });
    for (let i = 1; i < 3; i++) {
      put(id(`grille/slat.${i}`), "grille.slat", m(slat), []);
      attachments.push({ child: id(`grille/slat.${i}`), childPort: "root", parent: id("tub/0"), parentPort: `rim.front.${i}`, angle: 260 });
    }
    put(id("chassis/board"), "chassis.board", m(boardDef), ["wheelbase", "front.axle", "fender.gap"]);
    attachments.push({ child: id("chassis/board"), childPort: "inner.0", parent: id(`tub/${root}`), parentPort: "ridge.5", angle: 90, flip: true });
    for (let i = 1; i < k - 1; i++) seams.push({ a: id("chassis/board"), aPort: `inner.${i}`, b: id(`tub/${root + i}`), bPort: "ridge.5" });
    put(id("fender/front"), "fender", m(fenderFront), ["tyre", "fender.gap", "fender.segments"]);
    put(id("fender/rear"), "fender", m(fenderRear), ["tyre", "fender.gap", "fender.segments"]);
    attachments.push({ child: id("fender/front"), childPort: "start", parent: id("chassis/board"), parentPort: "front", angle: Number.NaN, flip: true });
    attachments.push({ child: id("fender/rear"), childPort: "start", parent: id("chassis/board"), parentPort: "rear", angle: Number.NaN });
    for (const ax of [{ tag: "axle1", name: "front" }, { tag: "axle2", name: "rear" }] as const) {
      const parts = wheelParts(at(stationList, index(ax.tag)).s);
      const w = (x: string): string => id(`wheel/${ax.name}/${x}`);
      put(w("hanger"), "wheel.hanger", m(parts.hanger), ["front.axle", "wheelbase", "tyre"]);
      attachments.push({ child: w("hanger"), childPort: "top", parent: id(`tub/${index(ax.tag) - 1}`), parentPort: "rim.back.5", angle: 90 });
      for (const half of ["A", "B"] as const) {
        const md = (d: ModuleDef): ModuleDef => (half === "A" ? m(d) : mirrorDef(m(d)));
        for (const part of ["axle", "sidewall", "tread", "hub"] as const) put(w(`${part}${half}`), `wheel.${part}`, md(parts[part]), ["tyre"]);
      }
      attachments.push({ child: w("axleA"), childPort: "line.top", parent: w("hanger"), parentPort: "bottom", angle: Number.NaN, flip: true });
      attachments.push({ child: w("axleB"), childPort: "midline", parent: w("axleA"), parentPort: "midline" });
      for (const half of ["A", "B"] as const) {
        attachments.push({ child: w(`sidewall${half}`), childPort: "front", parent: w(`axle${half}`), parentPort: "back" });
        attachments.push({ child: w(`tread${half}`), childPort: "front", parent: w(`sidewall${half}`), parentPort: "back" });
        attachments.push({ child: w(`hub${half}`), childPort: "base", parent: w(`tread${half}`), parentPort: "back" });
      }
      for (const part of ["sidewall", "tread", "hub"] as const) seams.push({ a: w(`${part}B`), aPort: "midline", b: w(`${part}A`), bPort: "midline" });
      if (sd === "R") for (const half of ["A", "B"] as const) seams.push({ a: w(`axle${half}`), aPort: "front", b: `wheel/${ax.name}/axle${half}.L`, bPort: "front" });
    }
  };
  side("L");
  side("R");

  /* angles that depend on placed geometry: axles hang at 112.5° (the tyre octagon's 22.5° facet, exact on the ladder); fenders follow their arch chord */
  const origin: Vec3 = [X(at(stationList, root).f), at(stationList, root).deck, 0];
  const withAxles = attachments.map((x): Attachment => (Number.isNaN(x.angle ?? 0) && x.childPort === "line.top" ? { ...x, angle: 112.5 } : x));
  const pending = new Set(withAxles.filter((x) => Number.isNaN(x.angle ?? 0)).map((x) => x.child));
  const draft: Assembly = { name: "vehicle", root: `tub/${root}.L`, origin, instances: instances.filter((i) => !pending.has(i.id)), attachments: withAxles.filter((x) => !pending.has(x.child)), seams: [], decisions: [] };
  const placed = placeAssembly(draft);
  if (!placed.ok) return err(`draft: ${placed.error.code} ${placed.error.message}`);
  const resolved = withAxles.map((x): Attachment => {
    if (!Number.isNaN(x.angle ?? 0)) return x;
    const boardWorld = placed.value.world.get(x.parent) ?? [];
    const boardInst = instances.find((i) => i.id === x.parent);
    if (boardInst === undefined) return x;
    const rear = x.parentPort === "rear";
    const axleX = X(rear ? fA2 : fA1);
    const rf = rear ? Rf2 : Rf1;
    const a0 = rear ? phi(rf) : 180 - phi(rf);
    const a1 = rear ? 190 : -10;
    const pt = (deg: number): Vec3 => [axleX + rf * Math.cos((deg * Math.PI) / 180), R + rf * Math.sin((deg * Math.PI) / 180), 0];
    return { ...x, angle: openingFor(boardWorld, boardInst.def, x.parentPort, sub(pt(a0 + (a1 - a0) / n), pt(a0))) };
  });
  return ok({ name: "vehicle", root: `tub/${root}.L`, origin, instances, attachments: resolved, seams, decisions: [] });
}

/* ------------------------------------------------------------------ measures (on placed geometry) */

export type VehicleMeasures = Readonly<{ length: number; wheelbase: number; wheelbaseRatio: number; height: number; heightRatio: number; hoodRatio: number; tyreDiameter: number; track: number; groundClearance: number; tyreGround: number; fenderClearance: number; cabinOffset: number }>;

export function vehicleMeasures(b: Built): VehicleMeasures {
  const pts = (pred: (id: string) => boolean): Vec3[] => b.assembly.instances.filter((i) => pred(i.id)).flatMap((i) => [...(b.world.get(i.id) ?? [])]);
  const all = pts(() => true);
  const xs = all.map((p) => p[0]);
  const length = Math.max(...xs) - Math.min(...xs);
  const treads = (axle: string): Vec3[] => pts((id) => id.includes(`wheel/${axle}/tread`) && id.endsWith(".L"));
  const centre = (ps: readonly Vec3[]): Vec3 => [(Math.max(...ps.map((p) => p[0])) + Math.min(...ps.map((p) => p[0]))) / 2, (Math.max(...ps.map((p) => p[1])) + Math.min(...ps.map((p) => p[1]))) / 2, (Math.max(...ps.map((p) => p[2])) + Math.min(...ps.map((p) => p[2]))) / 2];
  const [front, rear] = [centre(treads("front")), centre(treads("rear"))];
  const wheelbase = front[0] - rear[0];
  const height = Math.max(...all.map((p) => p[1]));
  const cowl = Math.max(...pts((id) => id.startsWith("cabin/windshield")).map((p) => p[0]));
  const cabin = pts((id) => id.startsWith("cabin/"));
  const cabinMid = (Math.max(...cabin.map((p) => p[0])) + Math.min(...cabin.map((p) => p[0]))) / 2;
  const tyreY = pts((id) => id.includes("/tread")).map((p) => p[1]);
  const bodyY = pts((id) => !id.includes("/tread") && !id.includes("/hub") && !id.includes("/sidewall")).map((p) => p[1]);
  const wheelIds = b.assembly.instances.filter((i) => i.id.includes("/tread") || i.id.includes("/hub") || i.id.includes("/sidewall")).map((i) => i.id);
  const fenderIds = b.assembly.instances.filter((i) => i.id.startsWith("fender/")).map((i) => i.id);
  return {
    length,
    wheelbase,
    wheelbaseRatio: wheelbase / length,
    height,
    heightRatio: height / length,
    hoodRatio: (Math.max(...xs) - cowl) / length,
    tyreDiameter: Math.max(...treads("front").map((p) => p[1])) - Math.min(...treads("front").map((p) => p[1])),
    track: 2 * front[2],
    groundClearance: Math.min(...bodyY),
    tyreGround: Math.min(...tyreY),
    fenderClearance: clearance(b, fenderIds, wheelIds, panelDistance),
    cabinOffset: cabinMid - (front[0] + rear[0]) / 2,
  };
}

export function vehicleLandmarks(b: Built): Readonly<Record<string, Vec3>> {
  const mean = (ps: readonly Vec3[]): Vec3 => (ps.length === 0 ? O3 : [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length, ps.reduce((s, p) => s + p[2], 0) / ps.length]);
  const pts = (pred: (id: string) => boolean): Vec3[] => b.assembly.instances.filter((i) => pred(i.id)).flatMap((i) => [...(b.world.get(i.id) ?? [])]);
  return { nose: mean(pts((id) => id.startsWith("tub/nose"))), wheelFL: mean(pts((id) => id.startsWith("wheel/front/tread") && id.endsWith(".L"))) };
}

/* ------------------------------------------------------------------ search */

export type VehicleDesign = Readonly<{ targets: VehicleTargets; assignment: Assignment; assembly: Assembly; built: Built; measures: VehicleMeasures; log: SolveLog }>;

/** Variables (ordered coupled-first; domains nearest to the targets) and function constraints measured on placed geometry. */
export function vehicleProblem(t: VehicleTargets): Readonly<{ variables: readonly Variable[]; constraints: readonly Constraint[] }> {
  const variables: Variable[] = [
    { name: "tyre", domain: nearest(TYRES, t.tyre) },
    { name: "fender.gap", domain: [0.1, 0.08, 0.06, 0.04] },
    { name: "fender.segments", domain: [t.fenderSegments, t.fenderSegments === 5 ? 4 : 5] },
    { name: "front.axle", domain: nearest(FRONT_AXLES, t.frontAxle) },
    { name: "wheelbase", domain: nearest(WHEELBASES, t.wheelbase) },
    { name: "hood", domain: nearest(HOODS, t.hood) },
    { name: "roof", domain: nearest(ROOFS, t.roof) },
  ];
  const every = variables.map((v) => v.name);
  const defaults = Object.fromEntries(variables.map((v) => [v.name, v.domain[0] ?? 0]));
  const cache = new Map<string, Result<Built, string>>();
  const build = (a: Assignment): Result<Built, string> => {
    const full = { ...defaults, ...a };
    const key = JSON.stringify(every.map((v) => full[v]));
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const asm = vehicleAssembly(t, full);
    const invalid = asm.ok ? asm.value.instances.flatMap((i) => moduleIssues(i.def).map((x) => `${i.id}: ${x}`)) : [];
    const placed: Result<Built, string> = !asm.ok ? asm : invalid.length > 0 ? err(`invalid module ${invalid[0] ?? ""}`) : (() => {
      const p = placeAssembly(asm.value);
      return p.ok ? ok(p.value) : err(`${p.error.code}: ${p.error.message}`);
    })();
    if (cache.size > 128) cache.clear();
    cache.set(key, placed);
    return placed;
  };
  const measured = (name: string, scope: readonly string[], f: (m: VehicleMeasures) => true | string): Constraint => ({
    name,
    scope,
    check: (a) => {
      const b = build(a);
      return b.ok ? f(vehicleMeasures(b.value)) : b.error;
    },
  });
  return {
    variables,
    constraints: [
      { name: "assembles with valid modules", scope: ["tyre", "fender.gap", "front.axle", "wheelbase", "hood"], check: (a) => {
        const b = build(a);
        return b.ok ? true : b.error;
      } },
      measured("tyre inside its fender (clearance ≥ 0.04)", ["tyre", "fender.gap", "fender.segments"], (m) => (m.fenderClearance >= 0.04 - 1e-9 ? true : `fender clearance ${m.fenderClearance.toFixed(3)}`)),
      measured("tyres on the ground (|y| ≤ 1e-6)", ["tyre"], (m) => (Math.abs(m.tyreGround) <= 1e-6 ? true : `tyre bottom at ${m.tyreGround.toExponential(2)}`)),
      measured("ground clearance ≥ 0.20", ["tyre"], (m) => (m.groundClearance >= 0.2 ? true : `ground clearance ${m.groundClearance.toFixed(3)}`)),
      measured("wheelbase / length in [0.54, 0.65]", ["front.axle", "wheelbase"], (m) => (m.wheelbaseRatio >= 0.54 && m.wheelbaseRatio <= 0.65 ? true : `wheelbase ratio ${m.wheelbaseRatio.toFixed(3)}`)),
      measured("hood / length ≥ 0.28", ["hood"], (m) => (m.hoodRatio >= 0.28 ? true : `hood ratio ${m.hoodRatio.toFixed(3)}`)),
      measured("cabin over the wheelbase (centre from 0.50 behind to 0.30 ahead of the midpoint)", ["front.axle", "wheelbase", "hood"], (m) => (m.cabinOffset >= -0.5 && m.cabinOffset <= 0.3 ? true : `cabin offset ${m.cabinOffset.toFixed(3)}`)),
      measured("height / length in [0.30, 0.38]", ["roof"], (m) => (m.heightRatio >= 0.3 && m.heightRatio <= 0.38 ? true : `height ratio ${m.heightRatio.toFixed(3)}`)),
      { name: "no contact outside declared ports", scope: every, check: (a) => {
        const b = build(a);
        if (!b.ok) return b.error;
        const c = assemblyContacts(b.value);
        return c.length === 0 ? true : `${c.length} contacts, e.g. ${c[0]?.a} / ${c[0]?.b} (${c[0]?.contact.kind})`;
      } },
      { name: "automated GEO-1 PASS (every sheet's fold and the rest pose certified)", scope: every, lazy: true, check: (a) => {
        const asm = vehicleAssembly(t, { ...defaults, ...a });
        if (!asm.ok) return asm.error;
        const compiled = compileAssembly(asm.value, "vehicle", {});
        if (!compiled.ok) return compiled.error.message;
        const verdict = geo1Verdict(verifyCompiled(compiled.value.compiled));
        return verdict.verdict === "PASS" ? true : `${verdict.verdict}: ${verdict.reasons.join("; ").slice(0, 160)}`;
      } },
    ],
  };
}

/** Targets → constraint search → the assembled vehicle with its decision log. Deterministic for a seed. */
export function designVehicle(seed: number | "hero" | "min" | "max"): Result<VehicleDesign, SolveError | Readonly<{ code: "build"; message: string }>> {
  const targets = vehicleTargets(seed);
  const p = vehicleProblem(targets);
  const solved = solve(p.variables, p.constraints, 4000, "static");
  if (!solved.ok) return solved;
  const asm = vehicleAssembly(targets, solved.value.assignment);
  if (!asm.ok) return err({ code: "build", message: asm.error });
  const assembly: Assembly = { ...asm.value, decisions: solved.value.log.decisions };
  const placed = placeAssembly(assembly);
  if (!placed.ok) return err({ code: "build", message: placed.error.message });
  return ok({ targets, assignment: solved.value.assignment, assembly, built: placed.value, measures: vehicleMeasures(placed.value), log: solved.value.log });
}
