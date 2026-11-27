import { canonicalJson, fnv1a64, type Vec3 } from "@eschaton/foldon";
import { add, centroid, cross, dist, dot, newell, normal, panelQuality, rotate, scale, sub, unit } from "../v2/geom";

/**
 * Origami lab V3 module kernel (docs/research/origami-lab-v3/construction-brief.md §2). A module is one flat sheet folded
 * rigidly by its own crease tree, defined independently of any object by a family and quantised parameters. Definitions
 * are plain serialisable data; the id hashes family, version and parameters.
 */

export type Side = "plug" | "socket" | "seam";

export type EdgePort = Readonly<{ name: string; type: "edge"; kind: string; side: Side; panel: number; a: number; b: number; length: number }>;
export type SectionPort = Readonly<{ name: string; type: "section"; kind: string; side: Side; verts: readonly number[] }>;
export type Port = EdgePort | SectionPort;

export type ModulePanel = Readonly<{ v: readonly number[]; part: string; thin?: true }>;

export type ModuleDef = Readonly<{
  id: string;
  family: string;
  version: number;
  params: Readonly<Record<string, number | string>>;
  mirrorOf?: string;
  vertices: readonly Vec3[];
  panels: readonly ModulePanel[];
  ports: readonly Port[];
}>;

export const MODULE_VERSION = 1;
const ORIGIN: Vec3 = [0, 0, 0];

/**
 * Connection contracts: the finite ladder of opening angles (degrees, orientation-free: 180 is flat continuation) a
 * plug of this kind may make with a socket of the same kind. Section ports mate rigidly by their vertex lists.
 */
export const CONTRACTS: Readonly<Record<string, Readonly<{ angles: readonly number[] }>>> = {
  "vane-root": { angles: ladder(150, 260, 0.5) },
  "fringe-root": { angles: ladder(4, 240, 0.5) },
  "ridge-hinge": { angles: ladder(60, 300, 0.5) },
  "wrist": { angles: ladder(150, 210, 0.5) },
  "fender-end": { angles: ladder(90, 270, 0.5) },
  "board-edge": { angles: ladder(60, 300, 0.5) },
  rim: { angles: ladder(60, 300, 0.5) },
  line: { angles: ladder(60, 300, 0.5) },
};

/** Sockets that accept plugs of another declared kind (a band rim edge can carry a vane or a hanger). */
export const ACCEPTS: Readonly<Record<string, readonly string[]>> = { rim: ["rim", "vane-root"] };

function ladder(lo: number, hi: number, step: number): readonly number[] {
  return Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => Math.round((lo + i * step) * 1000) / 1000);
}

export const q6 = (x: number): number => Math.round(x * 1e6) / 1e6 + 0;
const q3 = (x: number): number => Math.round(x * 1000) / 1000 + 0;

type Facing = (c: Vec3) => Vec3;

/** Low-level module builder shared by the families: oriented convex panels on indexed vertices, plus ports. */
function createSheet() {
  const vertices: Vec3[] = [];
  const panels: ModulePanel[] = [];
  const ports: Port[] = [];
  const point = (p: Vec3): number => {
    vertices.push([p[0] + 0, p[1] + 0, p[2] + 0]);
    return vertices.length - 1;
  };
  const at = (i: number): Vec3 => {
    const v = vertices[i];
    if (v === undefined) throw new Error(`vertex ${i} does not exist`);
    return v;
  };
  const panel = (part: string, v: readonly number[], facing: Facing, thin = false): number => {
    const ps = v.map(at);
    const oriented = dot(newell(ps), facing(centroid(ps))) < 0 ? v.toReversed() : v;
    panels.push({ v: oriented, part, ...(thin ? { thin: true as const } : {}) });
    return panels.length - 1;
  };
  const edgePort = (name: string, kind: string, side: Side, a: number, b: number): void => {
    const p = panels.findIndex((pp) => pp.v.some((x, k) => (x === a && pp.v[(k + 1) % pp.v.length] === b) || (x === b && pp.v[(k + 1) % pp.v.length] === a)));
    if (p < 0) throw new Error(`port ${name}: edge ${a}-${b} is not a panel edge`);
    ports.push({ name, type: "edge", kind, side, panel: p, a, b, length: q6(dist(at(a), at(b))) });
  };
  const sectionPort = (name: string, kind: string, side: Side, verts: readonly number[]): void => {
    ports.push({ name, type: "section", kind, side, verts });
  };
  return { point, at, panel, edgePort, sectionPort, vertices, panels, ports };
}

function finish(family: string, params: Readonly<Record<string, number | string>>, sheet: ReturnType<typeof createSheet>): ModuleDef {
  return { id: fnv1a64(canonicalJson({ family, version: MODULE_VERSION, params })), family, version: MODULE_VERSION, params, vertices: sheet.vertices, panels: sheet.panels, ports: sheet.ports };
}

/** Mirror image across z = 0 (a different, chiral definition; records what it mirrors). */
export function mirrorDef(def: ModuleDef): ModuleDef {
  const params = { ...def.params, mirror: 1 };
  return {
    ...def,
    id: fnv1a64(canonicalJson({ family: def.family, version: def.version, params })),
    params,
    mirrorOf: def.id,
    vertices: def.vertices.map((v): Vec3 => [v[0], v[1], -v[2] + 0]),
    panels: def.panels.map((p) => ({ ...p, v: p.v.toReversed() })),
  };
}

/* ------------------------------------------------------------------ flat nets folded by their crease tree */

type Pt2 = readonly [number, number];
export type Net = Readonly<{
  points: readonly Pt2[];
  panels: readonly Readonly<{ v: readonly number[]; part: string; thin?: true }>[];
  /** Tree over panels (root = panel 0). `angle` in degrees: positive lifts the child toward +z (the flat net's front). */
  creases: readonly Readonly<{ parent: number; child: number; angle: number }>[];
}>;

/** Folds a flat crease pattern (z = 0, panels CCW from +z) by its crease tree into the rest pose. */
export function foldNet(net: Net): readonly Vec3[] {
  const flat = net.points.map((p): Vec3 => [p[0], p[1], 0]);
  const transform = new Map<number, (p: Vec3) => Vec3>([[0, (p) => p]]);
  const pending = [...net.creases];
  while (pending.length > 0) {
    const k = pending.findIndex((c) => transform.has(c.parent));
    const crease = pending[k];
    if (k < 0 || crease === undefined) throw new Error("crease graph is not a tree rooted at panel 0");
    pending.splice(k, 1);
    const [pv, cv] = [net.panels[crease.parent]?.v ?? [], net.panels[crease.child]?.v ?? []];
    const shared = pv.filter((x) => cv.includes(x));
    if (shared.length !== 2) throw new Error(`crease ${crease.parent}>${crease.child} does not share exactly one edge`);
    const [e0, e1] = [flat[shared[0] ?? 0] ?? ORIGIN, flat[shared[1] ?? 0] ?? ORIGIN];
    const toward = sub(centroid(cv.map((i) => flat[i] ?? ORIGIN)), e0);
    const along = unit(sub(e1, e0));
    const d = unit(sub(toward, scale(along, dot(toward, along))));
    const axis = unit(cross(d, [0, 0, 1]));
    const parentT = transform.get(crease.parent) ?? ((p: Vec3): Vec3 => p);
    const angle = (crease.angle * Math.PI) / 180;
    transform.set(crease.child, (p) => parentT(rotate(p, e0, axis, angle)));
  }
  const out: (Vec3 | undefined)[] = flat.map(() => undefined);
  net.panels.forEach((panel, i) => {
    const t = transform.get(i);
    if (t === undefined) throw new Error(`panel ${i} is not reached by the crease tree`);
    for (const v of panel.v) {
      const p = t(flat[v] ?? ORIGIN);
      const prior = out[v];
      if (prior === undefined) out[v] = p;
      else if (dist(prior, p) > 1e-9) throw new Error(`vertex ${v} is not on the hinges between the panels that share it`);
    }
  });
  return out.map((p) => p ?? ORIGIN);
}

function fromNet(sheet: ReturnType<typeof createSheet>, raw: Net): readonly number[] {
  const area2 = (v: readonly number[]): number =>
    v.reduce((acc, i, k) => {
      const [p, q] = [raw.points[i] ?? [0, 0], raw.points[v[(k + 1) % v.length] ?? 0] ?? [0, 0]];
      return acc + p[0] * q[1] - q[0] * p[1];
    }, 0);
  const net: Net = { ...raw, panels: raw.panels.map((p) => (area2(p.v) < 0 ? { ...p, v: p.v.toReversed() } : p)) };
  const folded = foldNet(net);
  const ids = folded.map((p) => sheet.point(p));
  for (const p of net.panels) {
    const n = normal(p.v.map((i) => folded[i] ?? ORIGIN));
    sheet.panel(p.part, p.v.map((i) => ids[i] ?? 0), () => n, p.thin === true);
  }
  return ids;
}

/* ------------------------------------------------------------------ families */

/** Half-section shapes (z ≥ 0), unit scale, listed from the top midline to the bottom midline. */
function crown(step: number, drops: readonly number[]): readonly (readonly [number, number])[] {
  const out: (readonly [number, number])[] = [[0, 0]];
  for (const d of drops) {
    const [x, y] = out[out.length - 1] ?? [0, 0];
    out.push([x + Math.sqrt(step * step - d * d), y - d]);
  }
  return out;
}

/** Tub top: three crown facets with rim edges of exactly 0.14 cells at scale 1 (grille sockets), then shoulder, side, flat floor. */
export const TUB_CROWN = crown(0.14, [0.006, 0.008, 0.014]);

export const SHAPES: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  keel: [[0, 0.8], [1, 0.22], [0.74, -0.72], [0, -1.24]],
  tub: [...TUB_CROWN, [0.56, -0.06], [0.56, -0.38], [0, -0.38]],
  cabin: [[0, 0], [0.36, -0.04], [0.42, -0.68]],
  tyre: [[0, 1], [0.7071, 0.7071], [1, 0], [0.7071, -0.7071], [0, -1]],
};

const outwardFrom = (axisY: (x: number) => number): Facing => (c) => [0, c[1] - axisY(c[0]), c[2]];

/**
 * `band`: half of a homothetic frustum. Front section (scale r0) at x = 0, back section (scale r1) at x = −len shifted by
 * dy. Corresponding section edges are parallel, so every facet is a planar trapezoid. `open` lists facets left out
 * (window bays). Ports: `front`/`back` sections, `midline` (the two midline edges; mates only with the mirror half),
 * `ridge.<j>` longitudinal edges.
 */
export function band(shape: string, r0: number, r1: number, len: number, dy = 0, open: readonly number[] = [], points?: readonly (readonly [number, number])[]): ModuleDef {
  const unitShape = points ?? SHAPES[shape];
  if (unitShape === undefined) throw new Error(`unknown shape ${shape}`);
  const params = { shape, r0: q6(r0), r1: q6(r1), len: q6(len), dy: q6(dy), open: open.join(","), ...(points === undefined ? {} : { points: points.map(([z, y]) => `${q6(z)},${q6(y)}`).join(";") }) };
  const s = createSheet();
  const front = unitShape.map(([z, y]) => s.point([0, y * r0, z * r0]));
  const back = unitShape.map(([z, y]) => s.point([-len, dy + y * r1, z * r1]));
  const ys = unitShape.map(([, y]) => y);
  const mid = (Math.max(...ys) + Math.min(...ys)) / 2;
  const facing = outwardFrom((x) => {
    const u = x / -len;
    return u * dy + mid * (r0 + (r1 - r0) * u);
  });
  for (let k = 0; k + 1 < unitShape.length; k++) {
    if (open.includes(k)) continue;
    s.panel(`facet${k}`, [front[k] ?? 0, front[k + 1] ?? 0, back[k + 1] ?? 0, back[k] ?? 0], facing);
  }
  const tag = shape === "custom" || points !== undefined ? `${shape}:${params.points ?? ""}` : shape;
  s.sectionPort("front", `section:${tag}:${params.r0}`, "plug", front);
  s.sectionPort("back", `section:${tag}:${params.r1}`, "socket", back);
  if (shape === "tub") {
    s.sectionPort("crown.front", `crown:${params.r0}`, "plug", front.slice(0, TUB_CROWN.length));
    s.sectionPort("crown.back", `crown:${params.r1}`, "socket", back.slice(0, TUB_CROWN.length));
  }
  const onMid = (j: number): boolean => Math.abs(unitShape[j]?.[0] ?? 1) < 1e-12;
  const last = unitShape.length - 1;
  const midline = [...(onMid(0) ? [front[0] ?? 0, back[0] ?? 0] : []), ...(onMid(last) ? [front[last] ?? 0, back[last] ?? 0] : [])];
  s.sectionPort("midline", `midline:band:${canonicalJson(params)}`, "seam", midline);
  const facet = (k: number): boolean => k >= 0 && k < last && !open.includes(k);
  for (let j = 0; j <= last; j++) {
    if (!facet(j - 1) && !facet(j)) continue;
    const [a, b] = [front[j] ?? 0, back[j] ?? 0];
    if (onMid(j)) s.edgePort(j === 0 ? "line.top" : "line.bottom", "line", "plug", a, b);
    else {
      s.edgePort(`ridge.${j}`, "ridge-hinge", "socket", a, b);
      s.edgePort(`edge.${j}`, "ridge-hinge", "plug", a, b);
    }
  }
  for (let k = 0; k < last; k++) {
    if (open.includes(k)) continue;
    s.edgePort(`rim.front.${k}`, "rim", "socket", front[k] ?? 0, front[k + 1] ?? 0);
    s.edgePort(`rim.back.${k}`, "rim", "socket", back[k] ?? 0, back[k + 1] ?? 0);
  }
  return finish("band", params, s);
}

/**
 * `stitch`: a triangle strip between two open polylines given in the module frame (greedy shorter-diagonal stitch; a
 * chain of triangles, so a tree). Used where a surface spans two different sections (windshield, rear window). Ports:
 * `base` and `top` sections with the given kinds and sides.
 */
export function stitch(name: string, bottom: readonly Vec3[], top: readonly Vec3[], base: Readonly<{ kind: string; side: Side }>, upper: Readonly<{ kind: string; side: Side }>, outward: Vec3, advance?: readonly ("bottom" | "top")[]): ModuleDef {
  const params = { name, bottom: bottom.map((p) => p.map(q6).join(",")).join(";"), top: top.map((p) => p.map(q6).join(",")).join(";"), base: `${base.kind}/${base.side}`, upper: `${upper.kind}/${upper.side}`, advance: (advance ?? []).join(",") };
  const s = createSheet();
  const a = bottom.map((p) => s.point(p));
  const b = top.map((p) => s.point(p));
  let [i, j, step] = [0, 0, 0];
  while (i < a.length - 1 || j < b.length - 1) {
    const [ai, an, bj, bn] = [a[i] ?? 0, a[i + 1], b[j] ?? 0, b[j + 1]];
    const planned = advance?.[step];
    const advanceA = planned === undefined ? an !== undefined && (bn === undefined || dist(s.at(an), s.at(bj)) <= dist(s.at(ai), s.at(bn))) : planned === "bottom" && an !== undefined;
    step += 1;
    if (advanceA && an !== undefined) {
      s.panel("glass", [ai, an, bj], () => outward);
      i++;
    } else if (bn !== undefined) {
      s.panel("glass", [ai, bn, bj], () => outward);
      j++;
    }
  }
  s.sectionPort("base", base.kind, base.side, a);
  s.sectionPort("top", upper.kind, upper.side, b);
  return finish("stitch", params, s);
}

/**
 * `cap`: half of a pyramid closing a section (scale r, at x = 0) to an apex (dx, dy). `face` is +1 when the cap closes
 * the front of a chain (its outside is toward +x) and −1 when it closes the back. Ports: `base`, `midline` (mates only
 * with the mirror half), `ridge.<j>` apex edges.
 */
export function cap(shape: string, r: number, dx: number, dy: number, face: 1 | -1): ModuleDef {
  const params = { shape, r: q6(r), dx: q6(dx), dy: q6(dy), face };
  const unitShape = SHAPES[shape];
  if (unitShape === undefined) throw new Error(`unknown shape ${shape}`);
  const s = createSheet();
  const base = unitShape.map(([z, y]) => s.point([0, y * params.r, z * params.r]));
  const apex = s.point([params.dx, params.dy, 0]);
  const inside: Vec3 = [-face * 2 * params.r, 0, 0];
  for (let k = 0; k + 1 < unitShape.length; k++) s.panel(`tri${k}`, [base[k] ?? 0, base[k + 1] ?? 0, apex], (c) => sub(c, inside));
  s.sectionPort("base", `section:${shape}:${params.r}`, face === 1 ? "socket" : "plug", base);
  s.sectionPort("midline", `midline:cap:${canonicalJson(params)}`, "seam", [base[0] ?? 0, apex, base.at(-1) ?? 0]);
  for (let j = 1; j + 1 < unitShape.length; j++) s.edgePort(`ridge.${j}`, "ridge-hinge", "socket", base[j] ?? 0, apex);
  return finish("cap", params, s);
}

export type VaneShape = "pointed" | "emarginate" | "spatulate" | "blunt";

/**
 * `vane`: a folded blade. Broad trailing vane A = (r0, r1, …, t) carries the straight root edge r0→r1 (width w); the
 * narrow leading vane B = (r0, t, b) is folded up by `phi` degrees on the rachis crease r0→t, which runs from the root's
 * leading corner to the tip (the rachis sits near the leading edge of a flight feather).
 */
export function vane(len: number, w: number, phi: number, shape: VaneShape): ModuleDef {
  const params = { len: q6(len), w: q6(w), phi: q3(phi), shape };
  const [L, W] = [params.len, params.w];
  const trailing: readonly Pt2[] =
    shape === "pointed"
      ? [[0.55 * L, -0.92 * W]]
      : shape === "emarginate"
        ? [[0.58 * L, -0.86 * W], [0.8 * L, -0.62 * W]]
        : shape === "blunt"
          ? [[0.62 * L, -1.02 * W], [0.9 * L, -0.86 * W]]
          : [[0.62 * L, -1.45 * W], [0.93 * L, -1.3 * W]];
  const tipY = shape === "blunt" ? -0.42 : shape === "spatulate" ? -0.62 : -0.16;
  const points: Pt2[] = [[0, 0], [0, -W], ...trailing, [L, tipY * W], [0.5 * L, (shape === "blunt" || shape === "spatulate" ? 0.2 : 0.17) * W]];
  const tip = points.length - 2;
  const b = points.length - 1;
  const A = [0, 1, ...trailing.map((_, i) => 2 + i), tip];
  const s = createSheet();
  const ids = fromNet(s, { points, panels: [{ v: A, part: "trailing", thin: true }, { v: [0, tip, b], part: "leading", thin: true }], creases: [{ parent: 0, child: 1, angle: params.phi }] });
  s.edgePort("root", "vane-root", "plug", ids[0] ?? 0, ids[1] ?? 0);
  return finish("vane", params, s);
}

/**
 * `fringe`: a root band (root edge 0→(0, −W), depth d, outer polyline of k edges bulging by `sag`) carrying k tongues, each
 * hinged on one outer edge and folded by its own angle (degrees, + lifts toward the front). Tongues widen to `spread`
 * times their root share and end in a blunt point. `inset` leaves the first and last fractions of the root without tongues.
 */
export function fringe(rootLen: number, depth: number, k: number, tongue: number, spread: number, angles: readonly number[], sag = 0.012, inset: readonly [number, number] = [0, 0]): ModuleDef {
  const params = { rootLen: q6(rootLen), depth: q6(depth), k, tongue: q6(tongue), spread: q3(spread), angles: angles.map(q3).join(","), sag: q6(sag), inset: inset.map(q3).join(",") };
  const [W, D, T] = [rootLen, params.depth, params.tongue];
  const outer: Pt2[] = Array.from({ length: k + 1 }, (_, i) => {
    const u = (2 * i) / k - 1;
    const [i0, i1] = [inset[0] * W, inset[1] * W];
    return [D + params.sag * (1 - u * u), -i0 - ((W - i0 - i1) * i) / k];
  });
  const points: Pt2[] = [[0, 0], [0, -W], ...outer];
  const tapered = inset[0] > 0 || inset[1] > 0;
  const panels: { v: number[]; part: string; thin?: true }[] = [{ v: [0, 1, ...outer.map((_, i) => 2 + i).toReversed()], part: "band", ...(tapered ? { thin: true as const } : {}) }];
  const creases: { parent: number; child: number; angle: number }[] = [];
  for (let i = 0; i < k; i++) {
    const [p, q] = [outer[i] ?? [0, 0], outer[i + 1] ?? [0, 0]];
    const e: Pt2 = [q[0] - p[0], q[1] - p[1]];
    const len = Math.hypot(e[0], e[1]);
    const eu: Pt2 = [e[0] / len, e[1] / len];
    const n: Pt2 = [-eu[1], eu[0]];
    const widen = (len * (params.spread - 1)) / 2;
    const a: Pt2 = [p[0] + n[0] * 0.86 * T - eu[0] * widen, p[1] + n[1] * 0.86 * T - eu[1] * widen];
    const bq: Pt2 = [q[0] + n[0] * 0.86 * T + eu[0] * widen, q[1] + n[1] * 0.86 * T + eu[1] * widen];
    const tip: Pt2 = [(p[0] + q[0]) / 2 + n[0] * T, (p[1] + q[1]) / 2 + n[1] * T];
    const base = points.length;
    points.push(a, bq, tip);
    panels.push({ v: [2 + i, base, base + 2, base + 1, 3 + i], part: "tongue", thin: true });
    creases.push({ parent: 0, child: panels.length - 1, angle: angles[i] ?? 0 });
  }
  const s = createSheet();
  const ids = fromNet(s, { points, panels, creases });
  s.edgePort("root", "fringe-root", "plug", ids[0] ?? 0, ids[1] ?? 0);
  return finish("fringe", params, s);
}

/**
 * `plate`: object-specific folded plates (wing arm and hand, tail plate, running board) from an explicit flat net with
 * named edge ports. The net and port names are the parameters, so the id still hashes the full definition. Lengths
 * derived from a parent port are used exactly for geometry (so ports weld to 1e-9) and quantised to 1e-6 in the hash.
 */
export function plate(name: string, net: Net, ports: readonly Readonly<{ name: string; kind: string; side: Side; a: number; b: number }>[]): ModuleDef {
  const params = { name, net: canonicalJson({ points: net.points.map(([x, y]) => [q6(x), q6(y)]), panels: net.panels, creases: net.creases.map((c) => ({ ...c, angle: q3(c.angle) })) }), ports: canonicalJson(ports) };
  const s = createSheet();
  const ids = fromNet(s, { ...net, creases: net.creases.map((c) => ({ ...c, angle: q3(c.angle) })) });
  for (const p of ports) s.edgePort(p.name, p.kind, p.side, ids[p.a] ?? 0, ids[p.b] ?? 0);
  return finish("plate", params, s);
}

/**
 * `arch`: a strip of `n` flat quads bent around the z axis at radius r from angle a0 to a1 (degrees, measured from +x
 * toward +y), width w along +z. Ports `start` and `end` (kind `fender-end`).
 */
export function arch(r: number, w: number, a0: number, a1: number, n: number): ModuleDef {
  const params = { r: q6(r), w: q6(w), a0: q3(a0), a1: q3(a1), n };
  const s = createSheet();
  const ring = Array.from({ length: n + 1 }, (_, i) => {
    const a = ((params.a0 + ((params.a1 - params.a0) * i) / n) * Math.PI) / 180;
    return [s.point([params.r * Math.cos(a), params.r * Math.sin(a), 0]), s.point([params.r * Math.cos(a), params.r * Math.sin(a), params.w])] as const;
  });
  for (let i = 0; i < n; i++) {
    const [[p0, p1], [q0, q1]] = [ring[i] ?? [0, 0], ring[i + 1] ?? [0, 0]];
    s.panel("segment", [p0, q0, q1, p1], (c) => [c[0], c[1], 0]);
  }
  const [first, last] = [ring[0] ?? [0, 0], ring.at(-1) ?? [0, 0]];
  s.edgePort("start", "fender-end", "plug", first[0], first[1]);
  s.edgePort("end", "fender-end", "socket", last[0], last[1]);
  return finish("arch", params, s);
}

/** Every panel's in-plane unit direction from edge (a, b) into the panel, and its front normal (module-local). */
export function edgeFrame(vertices: readonly Vec3[], panel: readonly number[], a: number, b: number): Readonly<{ p0: Vec3; p1: Vec3; inward: Vec3; normal: Vec3 }> {
  const [p0, p1] = [vertices[a] ?? ORIGIN, vertices[b] ?? ORIGIN];
  const along = unit(sub(p1, p0));
  const c = sub(centroid(panel.map((i) => vertices[i] ?? ORIGIN)), p0);
  return { p0, p1, inward: unit(sub(c, scale(along, dot(c, along)))), normal: normal(panel.map((i) => vertices[i] ?? ORIGIN)) };
}

export const midpoint = (a: Vec3, b: Vec3): Vec3 => scale(add(a, b), 0.5);

/** Panels of a definition that are not planar (1e-6), not strictly convex, or degenerate (altitude < 0.004 cells). */
export function moduleIssues(def: ModuleDef): readonly string[] {
  return def.panels.flatMap((p, k) => {
    const q = panelQuality(p.v.map((v) => def.vertices[v] ?? ORIGIN));
    const bad = [q.planarity > 1e-6 ? "non-planar" : "", q.convex ? "" : "non-convex", q.minAltitude < 0.004 ? "degenerate" : ""].filter((x) => x !== "");
    return bad.length === 0 ? [] : [`${def.family}#${k} ${bad.join(",")}`];
  });
}
