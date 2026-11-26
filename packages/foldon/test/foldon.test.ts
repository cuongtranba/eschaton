import { expect, test } from "vitest";
import {
  creaseId,
  defineFoldon,
  foldProgress,
  foldonId,
  getPrimitive,
  placeFootprint,
  placeGeometry,
  placeSockets,
  placementId,
  poseGeometry,
  primitiveCatalog,
  socketsCompatible,
  validateFoldon,
  type Cell,
  type CreaseDefinition,
  type FoldonDefinition,
  type PosedGeometry,
  type PosedPanel,
  type Rotation,
  type SocketDefinition,
  type ValidationCode,
  type Vec3,
  presetCatalog,
} from "@eschaton/foldon";

const rotations: readonly Rotation[] = [0, 1, 2, 3];
const EPS = 1e-9;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const centroid = (vs: readonly Vec3[]): Vec3 => [
  vs.reduce((s, v) => s + v[0], 0) / vs.length,
  vs.reduce((s, v) => s + v[1], 0) / vs.length,
  vs.reduce((s, v) => s + v[2], 0) / vs.length,
];

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function primitive(id: string): FoldonDefinition {
  const found = getPrimitive(foldonId(id));
  if (found === undefined) throw new Error(`missing primitive ${id}`);
  return found;
}

function restPose(def: FoldonDefinition): PosedGeometry {
  const posed = poseGeometry(def.geometry, new Map());
  if (!posed.ok) throw new Error(`rest pose failed for ${def.id}: ${posed.error.code}`);
  return posed.value;
}

function panelOf(posed: PosedGeometry, id: string): PosedPanel {
  const found = posed.panels.find((p) => p.id === id);
  if (found === undefined) throw new Error(`missing panel ${id}`);
  return found;
}

function randomTargets(
  creases: readonly CreaseDefinition[],
  random: () => number,
): Map<CreaseDefinition["id"], number> {
  return new Map(
    creases.map((c) => [c.id, c.range[0] + 0.2 + random() * (c.range[1] - c.range[0] - 0.4)]),
  );
}

function issueCodes(result: ReturnType<typeof validateFoldon>): readonly ValidationCode[] {
  return result.ok ? [] : result.error.map((issue) => issue.code);
}

function hingeGap(def: FoldonDefinition, posed: PosedGeometry): number {
  let worst = 0;
  for (const crease of def.geometry.creases) {
    const parent = panelOf(posed, crease.parent);
    const child = panelOf(posed, crease.child);
    const [pa, pb] = [parent.vertices[crease.parentEdge[0]], parent.vertices[crease.parentEdge[1]]];
    const [ca, cb] = [child.vertices[crease.childEdge[0]], child.vertices[crease.childEdge[1]]];
    if (pa === undefined || pb === undefined || ca === undefined || cb === undefined) {
      throw new Error("edge index out of range");
    }
    const direct = Math.max(dist(pa, ca), dist(pb, cb));
    const swapped = Math.max(dist(pa, cb), dist(pb, ca));
    worst = Math.max(worst, Math.min(direct, swapped));
  }
  return worst;
}

function unionBox(cells: readonly Cell[]): { min: Vec3; max: Vec3 } {
  const axis = (i: 0 | 1 | 2): [number, number] => [
    Math.min(...cells.map((c) => c[i])),
    Math.max(...cells.map((c) => c[i])) + 1,
  ];
  const [x, y, z] = [axis(0), axis(1), axis(2)];
  return { min: [x[0], y[0], z[0]], max: [x[1], y[1], z[1]] };
}

function facingPairs(
  a: readonly SocketDefinition[],
  b: readonly SocketDefinition[],
): readonly [SocketDefinition, SocketDefinition][] {
  return a.flatMap((sa) =>
    b.filter((sb) => dist(sa.position, sb.position) < EPS).map((sb): [SocketDefinition, SocketDefinition] => [sa, sb]),
  );
}

test("catalog exposes primitives P01 to P09 in order", () => {
  expect(primitiveCatalog.map((d) => d.id)).toEqual(
    ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09"].map(foldonId),
  );
});

test("every catalog primitive passes validation", () => {
  const failures = primitiveCatalog.flatMap((def) => {
    const result = validateFoldon(def);
    return result.ok ? [] : [`${def.id}: ${result.error.map((i) => i.code).join(", ")}`];
  });
  expect(failures).toEqual([]);
});

test("hinge edges stay coincident under arbitrary in-range poses of a roof and a box", () => {
  const random = mulberry32(20261124);
  for (const def of [primitive("P03"), primitive("P08")]) {
    for (let i = 0; i < 50; i++) {
      const posed = poseGeometry(def.geometry, randomTargets(def.geometry.creases, random));
      if (!posed.ok) throw new Error(`${def.id} pose ${i} failed: ${posed.error.code}`);
      expect(hingeGap(def, posed.value)).toBeLessThan(EPS);
    }
  }
});

test("posing a prism to target angles yields exactly those measured dihedral angles", () => {
  const def = primitive("P06");
  const targets = randomTargets(def.geometry.creases, mulberry32(7));
  const posed = poseGeometry(def.geometry, targets);
  if (!posed.ok) throw new Error(posed.error.code);
  const measured = new Map(posed.value.creases.map((c) => [c.id, c.angle]));
  for (const [id, target] of targets) {
    expect(Math.abs((measured.get(id) ?? Number.NaN) - target)).toBeLessThan(EPS);
  }
});

test("a valley crease lifts its child toward the parent's front side", () => {
  const def = primitive("P05");
  const posed = restPose(def);
  const crease = def.geometry.creases[0];
  if (crease === undefined) throw new Error("P05 has no crease");
  const parent = panelOf(posed, crease.parent);
  const child = panelOf(posed, crease.child);
  expect(crease.assignment).toBe("valley");
  expect(dot(sub(centroid(child.vertices), centroid(parent.vertices)), parent.normal)).toBeGreaterThan(0);
});

test("a mountain crease drops its child behind the parent's front side", () => {
  const def = primitive("P04");
  const posed = restPose(def);
  const crease = def.geometry.creases[0];
  if (crease === undefined) throw new Error("P04 has no crease");
  const parent = panelOf(posed, crease.parent);
  const child = panelOf(posed, crease.child);
  expect(crease.assignment).toBe("mountain");
  expect(dot(sub(centroid(child.vertices), centroid(parent.vertices)), parent.normal)).toBeLessThan(0);
});

test("a target angle outside the crease range is refused and names the crease", () => {
  const def = primitive("P08");
  const crease = def.geometry.creases[2];
  if (crease === undefined) throw new Error("P08 has too few creases");
  const result = poseGeometry(def.geometry, new Map([[crease.id, crease.range[1] + 0.5]]));
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe("angle-out-of-range");
  expect("creaseId" in result.error && result.error.creaseId).toBe(crease.id);
});

test("a non-finite target angle is refused rather than clamped", () => {
  const def = primitive("P03");
  const crease = def.geometry.creases[0];
  if (crease === undefined) throw new Error("P03 has no crease");
  const result = poseGeometry(def.geometry, new Map([[crease.id, Number.NaN]]));
  expect(result.ok).toBe(false);
});

test("fold progress zero lays every panel flat in the root plane", () => {
  for (const def of [primitive("P08"), primitive("P07"), primitive("P09")]) {
    const posed = poseGeometry(def.geometry, foldProgress(def.geometry, 0));
    if (!posed.ok) throw new Error(posed.error.code);
    const root = panelOf(posed.value, def.geometry.root);
    const origin = root.vertices[0];
    if (origin === undefined) throw new Error("root has no vertices");
    const offPlane = posed.value.panels.flatMap((p) => p.vertices.map((v) => Math.abs(dot(sub(v, origin), root.normal))));
    expect(Math.max(...offPlane)).toBeLessThan(EPS);
  }
});

test("fold progress one reproduces the authored rest pose of every primitive", () => {
  for (const def of primitiveCatalog) {
    const posed = poseGeometry(def.geometry, foldProgress(def.geometry, 1));
    if (!posed.ok) throw new Error(posed.error.code);
    const gaps = def.geometry.panels.flatMap((panel) => {
      const placed = panelOf(posed.value, panel.id);
      return panel.vertices.map((v, i) => dist(v, placed.vertices[i] ?? [Infinity, 0, 0]));
    });
    expect(Math.max(...gaps)).toBeLessThan(EPS);
  }
});

test("a declared rest angle that disagrees with the geometry is rejected as a dihedral mismatch", () => {
  const roof = primitive("P03");
  const crease = roof.geometry.creases[0];
  if (crease === undefined) throw new Error("P03 has no crease");
  const result = defineFoldon({
    ...roof,
    geometry: { ...roof.geometry, creases: [{ ...crease, restAngle: crease.restAngle + 0.1 }] },
  });
  expect(issueCodes(result)).toContain("crease-angle-mismatch");
});

test("a crease set that closes a cycle is rejected", () => {
  const roof = primitive("P03");
  const crease = roof.geometry.creases[0];
  if (crease === undefined) throw new Error("P03 has no crease");
  const back: CreaseDefinition = {
    ...crease,
    id: creaseId("back"),
    parent: crease.child,
    child: crease.parent,
    parentEdge: crease.childEdge,
    childEdge: crease.parentEdge,
  };
  const result = defineFoldon({ ...roof, geometry: { ...roof.geometry, creases: [crease, back] } });
  expect(issueCodes(result)).toContain("crease-cycle");
});

test("a definition missing a socket on an external face is rejected", () => {
  const box = primitive("P08");
  const result = defineFoldon({ ...box, sockets: box.sockets.slice(1) });
  expect(issueCodes(result)).toContain("socket-missing");
});

test("every rotation keeps placed geometry inside the placed footprint", () => {
  const anchor: Cell = [3, -2, 5];
  for (const def of primitiveCatalog) {
    const posed = restPose(def);
    for (const rotation of rotations) {
      const placement = {
        id: placementId("p"),
        definitionId: def.id,
        definitionVersion: def.version,
        anchor,
        rotation,
      };
      const box = unionBox(placeFootprint(def, placement));
      const placed = placeGeometry(posed, placement);
      const outside = placed.panels.flatMap((p) => p.vertices).filter(
        (v) => v.some((c, i) => c < (box.min[i] ?? 0) - EPS || c > (box.max[i] ?? 0) + EPS),
      );
      expect(outside, `${def.id} rotation ${rotation}`).toEqual([]);
    }
  }
});

test("every rotation keeps placed sockets on external face centres of the placed footprint", () => {
  const anchor: Cell = [-4, 1, 2];
  for (const def of primitiveCatalog) {
    for (const rotation of rotations) {
      const placement = {
        id: placementId("p"),
        definitionId: def.id,
        definitionVersion: def.version,
        anchor,
        rotation,
      };
      const cells = placeFootprint(def, placement);
      const occupied = new Set(cells.map((c) => c.join(",")));
      const misplaced = placeSockets(def, placement).filter((s) => {
        const owner = cells.find(
          (c) => dist([c[0] + 0.5 + s.normal[0] / 2, c[1] + 0.5 + s.normal[1] / 2, c[2] + 0.5 + s.normal[2] / 2], s.position) < EPS,
        );
        if (owner === undefined) return true;
        const across = [owner[0] + s.normal[0], owner[1] + s.normal[1], owner[2] + s.normal[2]].join(",");
        return occupied.has(across);
      });
      expect(misplaced, `${def.id} rotation ${rotation}`).toEqual([]);
    }
  }
});

test("two box shells stacked vertically have compatible touching sockets", () => {
  const box = primitive("P08");
  const at = (anchor: Cell) => ({
    id: placementId(anchor.join(",")),
    definitionId: box.id,
    definitionVersion: box.version,
    anchor,
    rotation: 0 as Rotation,
  });
  const pairs = facingPairs(placeSockets(box, at([0, 0, 0])), placeSockets(box, at([0, 1, 0])));
  expect(pairs).toHaveLength(1);
  expect(pairs.every(([a, b]) => socketsCompatible(a, b))).toBe(true);
});

test("a box shell beside a roof's eave side is incompatible", () => {
  const box = primitive("P08");
  const roof = primitive("P03");
  const place = (def: FoldonDefinition, anchor: Cell) => ({
    id: placementId(def.id),
    definitionId: def.id,
    definitionVersion: def.version,
    anchor,
    rotation: 0 as Rotation,
  });
  const pairs = facingPairs(placeSockets(box, place(box, [0, 0, 0])), placeSockets(roof, place(roof, [1, 0, 0])));
  expect(pairs.length).toBeGreaterThan(0);
  expect(pairs.some(([a, b]) => socketsCompatible(a, b))).toBe(false);
});

test("definitions round-trip through JSON to deep-equal values", () => {
  for (const def of primitiveCatalog) {
    expect(JSON.parse(JSON.stringify(def))).toEqual(def);
  }
});

test("the ground presets are valid single-cell pieces that stand on the ground and carry nothing", () => {
  if (!presetCatalog.ok) throw new Error("the preset catalog must build");
  const catalog = presetCatalog.value;
  const ground = ["paving", "water", "bridge"].map((id) => catalog.foldon(foldonId(id)));
  expect(ground.map((piece) => [piece?.footprint.length, piece?.sockets.find((socket) => socket.face === "-y")?.profile, piece?.sockets.find((socket) => socket.face === "+y")?.profile])).toEqual([
    [1, "base", "empty"],
    [1, "base", "empty"],
    [1, "base", "empty"],
  ]);
});
