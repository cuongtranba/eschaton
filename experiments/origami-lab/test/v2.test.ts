import type { Vec3 } from "@eschaton/foldon";
import { expect, test } from "vitest";
import {
  BIRD_BOUNDS,
  CROW,
  birdDesign,
  birdMetrics,
  birdParams,
  buildObject,
  compileDesign,
  createBuilder,
  geo1Verdict,
  iou,
  panelQuality,
  poseCompiled,
  poseObject,
  posedContacts,
  rect,
  silhouette,
  triangleFromSides,
  verifyCompiled,
  type BirdParams,
  type Compiled,
  type Design,
} from "@eschaton/exp-origami-lab";

const compiled = (design: Design): Compiled => {
  const built = compileDesign(design);
  if (!built.ok) throw new Error(`${built.error.code}: ${built.error.message}`);
  return built.value;
};

const extreme = (side: 0 | 1): BirdParams => ({
  ...CROW,
  ...Object.fromEntries(Object.entries(BIRD_BOUNDS).map(([k, range]) => [k, range[side]])),
  fingers: side === 0 ? 0 : 5,
  tailShape: side === 0 ? "forked" : "wedge",
});

/** Base floor, a flap swinging 160° about the floor's x = 0 edge, and a static post whose top plate the flap passes through only for phase ≈ 0.39–0.48 or 0.52–0.61. */
function sweepFixture(): Design {
  const b = createBuilder();
  const up = (): Vec3 => [0, 1, 0];
  const p = (x: number, y: number, z: number): number => b.point([x, y, z]);
  const [b0, b1, b2, b3, b4, b5] = [p(0, 0, 0), p(1.2, 0, 0), p(1.2, 0, 0.4), p(0, 0, 0.4), p(1.2, 0, 1), p(0.05, 0, 1)];
  b.face("base", "floor", [b0, b1, b2, b3], up);
  b.face("base", "floor", [b3, b2, b4, b5], up);
  b.face("flap", "blade", [b0, b3, p(0, 1, 0.4), p(0, 1, 0)], () => [1, 0, 0]);
  const [t4, t5] = [p(1.2, 0.95, 1), p(0.05, 0.95, 1)];
  b.face("post", "wall", [b5, b4, t4, t5], () => [0, 0, -1]);
  b.face("post", "plate", [t5, t4, p(1.2, 0.95, 0.2), p(0.05, 0.95, 0.2)], up);
  return {
    kind: "fixture",
    version: 1,
    params: {},
    vertices: b.vertices(),
    faces: b.faces(),
    rootModule: "base",
    rootPart: "floor",
    joints: [
      { module: "flap", parent: "base", edge: [b0, b3], articulation: { lo: -80, hi: 80 } },
      { module: "post", parent: "base", edge: [b4, b5] },
    ],
    articulated: [],
    landmarks: {},
    sheets: {},
  };
}

test("an equilateral triangle that the V1 1/8 lattice rejects as off-lattice is a valid V2 panel", () => {
  expect(triangleFromSides(5, 5, 5).ok).toBe(false);
  const quality = panelQuality([[0, 0, 0], [5, 0, 0], [2.5, (5 * Math.sqrt(3)) / 2, 0]]);
  expect({ convex: quality.convex, minAngle: Math.round(quality.minAngleDeg) }).toEqual({ convex: true, minAngle: 60 });
});

test("panels that share only a vertex are not exempt: a fan neighbour folded through the other panel is reported", () => {
  const a: readonly Vec3[] = [[0, 0, 0], [2, 0, 0], [0, 2, 0]];
  const b: readonly Vec3[] = [[0, 0, 0], [1, 1, -1], [1, 1, 1]];
  expect(posedContacts([{ id: "a", vertices: a }, { id: "b", vertices: b }]).map((c) => c.contact.kind)).toEqual(["crossing"]);
});

test("coplanar panels that only share an edge pass; coplanar panels that overlap without sharing are reported", () => {
  const left: readonly Vec3[] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
  const right: readonly Vec3[] = [[1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]];
  const shifted: readonly Vec3[] = [[0.5, 0.5, 0], [1.5, 0.5, 0], [1.5, 1.5, 0], [0.5, 1.5, 0]];
  expect(posedContacts([{ id: "l", vertices: left }, { id: "r", vertices: right }])).toEqual([]);
  expect(posedContacts([{ id: "l", vertices: left }, { id: "s", vertices: shifted }]).map((c) => c.contact.kind)).toEqual(["coplanar-overlap"]);
});

test("regression: V1 posedOverlaps exempted hinged pairs, so a flap folded flat onto its parent passed; the contact test reports it", () => {
  const book = buildObject({
    name: "book",
    seed: 0,
    parts: [{ name: "book", plan: { id: "book", root: { id: "spine", shape: rect(16, 8) }, attach: [{ id: "left", parent: "spine", parentEdge: 3, shape: rect(16, 8), edge: 1, kind: "V", angle: 180 }] } }],
    connections: [],
  });
  if (!book.ok) throw new Error(book.error.message);
  const contacts = posedContacts(poseObject(book.value, 1).panels);
  expect(contacts.map((c) => [c.a, c.b, c.contact.kind])).toEqual([["book.spine", "book.left", "coplanar-overlap"]]);
});

test("regression: a V1 mount with lift 0 sits inside its host panel and is reported", () => {
  const mounted = buildObject({
    name: "slab",
    seed: 0,
    parts: [
      { name: "host", plan: { id: "host", root: { id: "root", shape: rect(16, 16) }, attach: [] } },
      { name: "tile", plan: { id: "tile", root: { id: "root", shape: rect(4, 4) }, attach: [] } },
    ],
    connections: [{ kind: "mount", host: { part: "host", panel: "root" }, child: "tile", at: [6, 6], turn: 0, tilt: 0, lift: 0, anchor: 0, side: 1 }],
  });
  if (!mounted.ok) throw new Error(mounted.error.message);
  expect(posedContacts(poseObject(mounted.value, 1).panels).map((c) => c.contact.kind)).toEqual(["coplanar-overlap"]);
});

test("a collision confined between the five V1 sample times is invisible to them and found by the swept check", () => {
  const fixture = compiled(sweepFixture());
  const sampled = [0, 0.25, 0.5, 0.75, 1].flatMap((u) => posedContacts(poseCompiled(fixture, 1, u).faces.map((f) => ({ id: f.id, vertices: f.vertices }))));
  expect(sampled).toEqual([]);
  const swept = verifyCompiled(fixture).sweeps.find((s) => s.name.startsWith("articulation"));
  expect(swept?.collisions.map((c) => [c.a, c.b].sort())).toContainEqual(["flap.blade.0", "post.plate.0"]);
});

test("an articulated edge that the unfolder would have to cut is refused at compile time instead of opening a seam", () => {
  const design = birdDesign(CROW);
  const split = compileDesign({ ...design, sheets: { ...design.sheets, wingL: "part" } });
  expect(split.ok ? undefined : split.error.code).toBe("articulation");
});

test("every bird variant (crow, seeds 1–8, both parameter extremes) compiles to valid Foldon pieces with no GEO-1 hard failure", () => {
  const variants = [CROW, ...[1, 2, 3, 4, 5, 6, 7, 8].map(birdParams), extreme(0), extreme(1)];
  const verdicts = variants.map((p) => {
    const report = verifyCompiled(compiled(birdDesign(p)));
    return { verdict: geo1Verdict(report).verdict, invalid: report.definitions.invalid };
  });
  expect(verdicts.filter((v) => v.verdict === "FAIL" || v.invalid.length > 0)).toEqual([]);
}, 120_000);

test("the same parameters build the same id and geometry, and different seeds build different ids", () => {
  const [a, b] = [compiled(birdDesign(birdParams(3))), compiled(birdDesign(birdParams(3)))];
  expect(a.id).toBe(b.id);
  expect(a.design.vertices).toEqual(b.design.vertices);
  expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => compiled(birdDesign(birdParams(s))).id)).size).toBe(8);
});

test("the crow baseline matches the design brief's landmark ratios within 5 %", () => {
  const m = birdMetrics(compiled(birdDesign(CROW)));
  const near = (value: number, target: number): boolean => Math.abs(value / target - 1) <= 0.05;
  expect({ span: near(m.spanRatio, 2.0), tail: near(m.tailRatio, 0.365), beak: near(m.beakRatio, 0.095) }).toEqual({ span: true, tail: true, beak: true });
});

test("seeds change the silhouette, not only the hash: span ratios spread by at least 0.4 and some top silhouettes overlap by less than 70 %", () => {
  const birds = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => compiled(birdDesign(birdParams(s))));
  const spans = birds.map((c) => birdMetrics(c).spanRatio);
  expect(Math.max(...spans) - Math.min(...spans)).toBeGreaterThanOrEqual(0.4);
  const tops = birds.map((c) => silhouette(poseCompiled(c, 1), "top"));
  const pairs = tops.flatMap((a, i) => tops.slice(i + 1).map((b) => iou(a, b)));
  expect(Math.min(...pairs)).toBeLessThan(0.7);
});

test("flap articulation moves the wing tip continuously while the shoulder hinge stays fixed", () => {
  const bird = compiled(birdDesign(CROW));
  const shoulder = bird.design.joints.find((j) => j.module === "wingL")?.edge ?? [0, 0];
  const at = (u: number, vertex: number): Vec3 => {
    const pose = poseCompiled(bird, 1, u);
    const face = pose.faces.find((f) => bird.design.faces[f.face]?.module === "wingL" && bird.design.faces[f.face]?.v.includes(vertex));
    const k = bird.design.faces[face?.face ?? 0]?.v.indexOf(vertex) ?? 0;
    return face?.vertices[k] ?? [0, 0, 0];
  };
  const tipVertex = bird.design.faces.filter((f) => f.module === "wingL").flatMap((f) => f.v).reduce((best, v) => ((bird.design.vertices[v]?.[2] ?? 0) > (bird.design.vertices[best]?.[2] ?? 0) ? v : best));
  const steps = Array.from({ length: 33 }, (_, i) => i / 32);
  const tips = steps.map((u) => at(u, tipVertex));
  const gaps = tips.slice(1).map((p, i) => Math.hypot(p[0] - (tips[i]?.[0] ?? 0), p[1] - (tips[i]?.[1] ?? 0), p[2] - (tips[i]?.[2] ?? 0)));
  const drift = steps.map((u) => Math.hypot(...at(u, shoulder[0]).map((x, k) => x - (bird.design.vertices[shoulder[0]]?.[k] ?? 0))));
  expect({ moves: (tips[32]?.[1] ?? 0) - (tips[0]?.[1] ?? 0) > 2, smooth: Math.max(...gaps) < 0.4, fixed: Math.max(...drift) < 1e-6 }).toEqual({ moves: true, smooth: true, fixed: true });
});
