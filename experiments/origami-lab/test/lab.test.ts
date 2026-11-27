import { validateFoldon } from "@eschaton/foldon";
import { expect, test } from "vitest";
import {
  buildObject,
  buildSheet,
  compatible,
  foldedOverlaps,
  generate,
  invalidPanels,
  objectInspection,
  objectNames,
  poseObject,
  rect,
  reuseReport,
  seamChecks,
  shapeClass,
  tri,
  triangleFromSides,
  validateShape,
  type LabObject,
  type ObjectName,
} from "@eschaton/exp-origami-lab";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function make(name: ObjectName, seed: number): LabObject {
  const built = generate(name, seed);
  if (!built.ok) throw new Error(`${name} seed ${seed}: ${built.error.message}`);
  return built.value;
}

const everyObject = (): readonly LabObject[] => objectNames.flatMap((name) => SEEDS.map((seed) => make(name, seed)));

test("classifies right, obtuse and acute triangles from exact integer tests", () => {
  const table = [
    { shape: tri(8, 0, 6), expected: "right" },
    { shape: tri(8, 8, 6), expected: "right" },
    { shape: tri(12, 6, 6), expected: "right" },
    { shape: tri(8, -2, 6), expected: "obtuse" },
    { shape: tri(8, 11, 4), expected: "obtuse" },
    { shape: tri(12, 6, 3), expected: "obtuse" },
    { shape: tri(8, 4, 6), expected: "acute" },
  ] as const;
  expect(table.map((row) => shapeClass(row.shape))).toEqual(table.map((row) => row.expected));
});

test("rejects degenerate, sliver and triangle-inequality-violating triangles with their codes", () => {
  const code = (result: { ok: boolean; error?: { code: string } }): string | undefined => (result.ok ? undefined : result.error?.code);
  expect(code(validateShape(tri(8, 2, 0)))).toBe("degenerate");
  expect(code(validateShape(tri(40, 20, 3)))).toBe("sliver");
  expect(code(validateShape(tri(70, 10, 20)))).toBe("too-large");
  expect(code(triangleFromSides(3, 4, 8))).toBe("triangle-inequality");
  expect(code(triangleFromSides(5, 5, 5))).toBe("off-lattice");
  const exact = triangleFromSides(8, 10, 6);
  expect(exact.ok && exact.value).toEqual({ base: 8, offset: 0, height: 6 });
});

test("glues edges of equal squared length with consistent winding and rejects the rest", () => {
  const edge = (squaredLength: number, winding: "ccw" | "cw" = "ccw") => ({ squaredLength, kind: "B", winding }) as const;
  expect(compatible(edge(100), edge(100)).ok).toBe(true);
  const unequal = compatible(edge(100), edge(81));
  expect(unequal.ok ? undefined : unequal.error.code).toBe("length-mismatch");
  const flipped = compatible(edge(100), edge(100, "cw"));
  expect(flipped.ok ? undefined : flipped.error.code).toBe("orientation");
});

test("refuses a seam between edges of unequal squared length", () => {
  const built = buildObject({
    name: "seam-test",
    seed: 0,
    parts: [
      { name: "a", plan: { id: "a", root: { id: "r", shape: rect(10, 6) }, attach: [] } },
      { name: "b", plan: { id: "b", root: { id: "r", shape: rect(9, 6) }, attach: [] } },
    ],
    connections: [{ kind: "seam", a: { part: "a", panel: "r", edge: 0 }, b: { part: "b", panel: "r", edge: 0 }, angle: 45 }],
  });
  expect(!built.ok && built.error.code === "seam" && built.error.reason).toBe("length-mismatch");
});

test("rejects a module whose flat net overlaps itself", () => {
  const spoke = tri(10, 5, 10);
  const fan = buildSheet({
    id: "overfull-fan",
    root: { id: "t0", shape: spoke },
    attach: Array.from({ length: 7 }, (_, i) => ({
      id: `t${i + 1}`,
      parent: `t${i}`,
      parentEdge: 2,
      shape: spoke,
      edge: 1,
      kind: "J" as const,
      angle: 0,
    })),
  });
  expect(!fan.ok && fan.error.code).toBe("flat-overlap");
});

test("builds every recipe for seeds 1 to 8 with panels that pass validation and Foldon definitions that pass defineFoldon", () => {
  for (const object of everyObject()) {
    expect(invalidPanels(object)).toEqual([]);
    for (const component of object.components) expect(validateFoldon(component.definition).ok).toBe(true);
    expect(objectInspection(object).foldons.every((f) => f.valid)).toBe(true);
  }
});

test("every seam of every object is edge compatible", () => {
  const checks = everyObject().flatMap((object) => seamChecks(object));
  expect(checks.length).toBeGreaterThan(50);
  expect(checks.filter((c) => !c.ok)).toEqual([]);
});

test("no two non-adjacent panels intersect at fold progress 0, 0.25, 0.5, 0.75 and 1", () => {
  for (const object of everyObject()) expect(foldedOverlaps(object)).toEqual([]);
});

test("reports panels that cross each other when a recipe folds into itself", () => {
  const crossing = buildObject({
    name: "book",
    seed: 0,
    parts: [
      {
        name: "book",
        plan: {
          id: "book",
          root: { id: "spine", shape: rect(16, 8) },
          attach: [
            { id: "left", parent: "spine", parentEdge: 3, shape: rect(16, 8), edge: 1, kind: "V", angle: 150 },
            { id: "right", parent: "spine", parentEdge: 1, shape: rect(16, 8), edge: 3, kind: "V", angle: 150 },
          ],
        },
      },
    ],
    connections: [],
  });
  if (!crossing.ok) throw new Error(crossing.error.message);
  expect(foldedOverlaps(crossing.value, [1]).length).toBeGreaterThan(0);
});

test("the same seed gives the same object fingerprint and seeds 1 to 8 give at least three distinct fingerprints per object", () => {
  for (const name of objectNames) {
    expect(make(name, 3).fingerprint).toBe(make(name, 3).fingerprint);
    expect(new Set(SEEDS.map((seed) => make(name, seed).fingerprint)).size).toBeGreaterThanOrEqual(3);
  }
});

test("the house roof slope edge always equals the gable slanted edge", () => {
  for (const seed of SEEDS) {
    const panels = objectInspection(make("house", seed)).panels;
    const roof = panels.find((p) => p.id === "roof.root");
    const gable = panels.find((p) => p.id === "walls.gableF");
    expect(gable?.squaredSides[1]).toBe(gable?.squaredSides[2]);
    expect(roof?.squaredSides).toContain(gable?.squaredSides[1]);
  }
});

test("fold progress 0 flattens every panel of a component into one plane and progress 1 returns the stored rest pose", () => {
  for (const object of everyObject()) {
    const component = object.components[0];
    if (component === undefined) throw new Error("object has no component");
    const flat = poseObject(object, 0).panels.filter((p) => p.component === 0);
    const [origin, normal] = [flat[0]?.vertices[0], flat[0]?.normal];
    for (const panel of flat) {
      for (const v of panel.vertices) {
        const offset = (v[0] - (origin?.[0] ?? 0)) * (normal?.[0] ?? 0) + (v[1] - (origin?.[1] ?? 0)) * (normal?.[1] ?? 0) + (v[2] - (origin?.[2] ?? 0)) * (normal?.[2] ?? 0);
        expect(Math.abs(offset)).toBeLessThan(1e-6);
      }
    }
    const rest = poseObject(object, 1).panels.filter((p) => p.component === 0);
    for (const stored of component.definition.geometry.panels) {
      const posed = rest.find((p) => p.id === stored.id);
      for (const [i, v] of stored.vertices.entries()) {
        for (const [k, c] of v.entries()) expect(posed?.vertices[i]?.[k] ?? Number.NaN).toBeCloseTo(c, 6);
      }
    }
  }
});

test("maps join and flat creases to rest-0 Foldon hinges pinned to a zero range", () => {
  const house = make("house", 1);
  const joins = objectInspection(house).joins;
  expect(joins.length).toBeGreaterThan(0);
  const creases = house.components.flatMap((c) => c.definition.geometry.creases).filter((c) => joins.includes(c.id));
  expect(creases.length).toBe(joins.length);
  expect(creases.every((c) => c.restAngle === 0 && c.range[0] === 0 && c.range[1] === 0)).toBe(true);
});

test("the four objects use acute, right and obtuse triangles and quads, all from the triangle and quad family", () => {
  const inspections = objectNames.flatMap((name) => SEEDS.map((seed) => objectInspection(make(name, seed))));
  const classes = { acute: 0, right: 0, obtuse: 0 };
  for (const info of inspections) for (const key of ["acute", "right", "obtuse"] as const) classes[key] += info.counts.triangleClasses[key];
  expect(classes.acute).toBeGreaterThan(0);
  expect(classes.right).toBeGreaterThan(0);
  expect(classes.obtuse).toBeGreaterThan(0);
  expect(inspections.some((info) => info.counts.quads > 0)).toBe(true);
  expect(reuseReport(objectNames.map((name) => make(name, 1))).families).toEqual(["quad", "tri"]);
});

test("moving the articulation phase moves the wing tip while the body panels stay fixed", () => {
  const bird = make("bird", 1);
  const low = poseObject(bird, 1, 0);
  const high = poseObject(bird, 1, 1);
  const verticesOf = (posed: typeof low, id: string) => posed.panels.find((p) => p.id === id)?.vertices ?? [];
  expect(verticesOf(high, "body.B1")).toEqual(verticesOf(low, "body.B1"));
  expect(verticesOf(high, "body.B2")).toEqual(verticesOf(low, "body.B2"));
  const [a, b] = [verticesOf(low, "wingL.outer")[2], verticesOf(high, "wingL.outer")[2]];
  expect(Math.hypot((a?.[0] ?? 0) - (b?.[0] ?? 0), (a?.[1] ?? 0) - (b?.[1] ?? 0), (a?.[2] ?? 0) - (b?.[2] ?? 0))).toBeGreaterThan(0.2);
});

test("regression: the mounted chimney stands vertical on the sloped roof once folded", () => {
  for (const seed of SEEDS) {
    const posed = poseObject(make("house", seed), 1);
    const chimney = posed.panels.find((p) => p.id === "chimney.root");
    expect(chimney?.normal[1] ?? 0).toBeGreaterThan(0.99);
  }
});
