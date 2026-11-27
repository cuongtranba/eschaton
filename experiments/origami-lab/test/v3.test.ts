import { expect, test } from "vitest";
import {
  attach,
  band,
  compileAssembly,
  designBird,
  designVehicle,
  detach,
  fringe,
  geo1Verdict,
  moduleIssues,
  placeAssembly,
  plate,
  provenance,
  reuseTable,
  solve,
  vane,
  verifyCompiled,
  type Assembly,
  type BirdDesign,
  type ModuleDef,
  type VehicleDesign,
} from "@eschaton/exp-origami-lab";

const vehicle = (seed: Parameters<typeof designVehicle>[0]): VehicleDesign => {
  const d = designVehicle(seed);
  if (!d.ok) throw new Error(`${String(seed)}: ${d.error.code} ${d.error.message}`);
  return d.value;
};

const bird = (seed: Parameters<typeof designBird>[0]): BirdDesign => {
  const d = designBird(seed);
  if (!d.ok) throw new Error(`${String(seed)}: ${d.error.code} ${d.error.message}`);
  return d.value;
};

/** A one-panel socket plate with a vane socket of the given width and a free edge. */
const socketPlate = (width: number): ModuleDef =>
  plate("socket-fixture", { points: [[0, 0], [0, -width], [1, -width], [1, 0]], panels: [{ v: [0, 1, 2, 3], part: "plate" }], creases: [] }, [{ name: "socket", kind: "vane-root", side: "socket", a: 0, b: 1 }]);

const pair = (child: ModuleDef, angle = 180): Assembly => ({
  name: "fixture",
  root: "host",
  instances: [{ id: "host", slot: "host", def: socketPlate(0.14) }, { id: "blade", slot: "blade", def: child }],
  attachments: [{ child: "blade", childPort: "root", parent: "host", parentPort: "socket", angle }],
  seams: [],
  decisions: [],
});

const panelsTouch = (def: ModuleDef): boolean => {
  const edges = new Set(def.panels.flatMap((p) => p.v.map((v, k) => [v, p.v[(k + 1) % p.v.length] ?? v].sort((a, b) => a - b).join(":"))));
  const adjacency = def.panels.map((p, i) => def.panels.flatMap((q, j) => (i !== j && p.v.some((v, k) => edges.has([v, p.v[(k + 1) % p.v.length] ?? v].sort((a, b) => a - b).join(":")) && q.v.includes(v) && q.v.includes(p.v[(k + 1) % p.v.length] ?? v)) ? [j] : [])));
  const edgeCount = adjacency.reduce((s, a) => s + a.length, 0) / 2;
  return edgeCount !== def.panels.length - 1;
};

test("every module of the crow is a tree of valid panels, so no seam can close inside a sheet", () => {
  const defs = new Map(bird("crow").assembly.instances.map((i) => [i.def.id, i.def] as const));
  expect([...defs.values()].flatMap((d) => [...moduleIssues(d), ...(panelsTouch(d) ? [`${d.family} panel graph is not a tree`] : [])])).toEqual([]);
}, 120_000);

test("the crow compiles to one Foldon sheet per module instance and its automated GEO-1 is PASS: no collision and no sampled-only pair", () => {
  const d = bird("crow");
  const compiled = compileAssembly(d.assembly, "bird", {});
  if (!compiled.ok) throw new Error(compiled.error.message);
  const report = verifyCompiled(compiled.value.compiled);
  const all = [...report.sweeps, report.rest];
  expect({ sheets: compiled.value.compiled.pieces.length, instances: d.assembly.instances.length, verdict: geo1Verdict(report).verdict, sampled: all.reduce((s, w) => s + w.counts.sampled, 0) }).toEqual({ sheets: d.assembly.instances.length, instances: d.assembly.instances.length, verdict: "PASS", sampled: 0 });
}, 120_000);

test("landmarks measured on the built geometry meet the targets for the crow, seeds 1–8, out-of-sample seeds and both window corners", () => {
  const variants = ["crow", 1, 2, 3, 4, 5, 6, 7, 8, 101, 202, 303, "min", "max"] as const;
  const misses = variants.flatMap((v) => {
    const { measures: m, targets: t } = bird(v);
    const off = (value: number, target: number, tol: number): boolean => Math.abs(value / target - 1) > tol;
    return [off(m.spanRatio, t.span, 0.03) ? `${String(v)} span` : "", off(m.tailRatio, t.tail, 0.03) ? `${String(v)} tail` : "", off(m.beakRatio, t.beak, 0.05) ? `${String(v)} beak` : ""].filter((x) => x !== "");
  });
  expect(misses).toEqual([]);
}, 120_000);

test("the same seed builds the same definitions and geometry; different seeds build different silhouettes", () => {
  const [a, b] = [bird(3), bird(3)];
  expect(a.assembly.instances.map((i) => i.def.id)).toEqual(b.assembly.instances.map((i) => i.def.id));
  expect(a.built.vertices).toEqual(b.built.vertices);
  const spans = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => bird(s).measures.spanRatio);
  expect(Math.max(...spans) - Math.min(...spans)).toBeGreaterThan(0.4);
}, 120_000);

test("constraints eliminate candidates during the search: a covert lift that leaves less than the designed clearance over the secondaries is rejected", () => {
  const eliminated = bird("crow").log.decisions.flatMap((d) => d.eliminated.map((e) => `${d.variable}=${e.value}: ${e.by}`));
  expect(eliminated.some((e) => e.startsWith("primary.base=") && e.includes("measured span"))).toBe(true);
  const covert = bird(1).log.decisions.find((d) => d.variable === "covert.lift");
  expect(covert?.eliminated.some((e) => e.by.startsWith("covert layer clearance"))).toBe(true);
}, 120_000);

test("the search proves unsatisfiability and reports it instead of returning the nearest assignment", () => {
  const r = solve(
    [{ name: "a", domain: [1, 2, 3] }, { name: "b", domain: [1, 2, 3] }],
    [{ name: "sum is 7", scope: ["a", "b"], check: (x) => (Number(x.a) + Number(x.b) === 7 ? true : `sum ${Number(x.a) + Number(x.b)}`) }],
  );
  expect(r.ok ? "solved" : [r.error.code, r.error.log.eliminations > 0]).toEqual(["unsatisfiable", true]);
});

test("port contracts refuse a wrong kind, a 0.001-cell length mismatch, an angle off the ladder and a port used twice", () => {
  const blade = vane(0.48, 0.14, 25, "pointed");
  const codes = [
    placeAssembly({ ...pair(fringe(0.14, 0.04, 2, 0.2, 1, [0, 0])) }),
    placeAssembly(pair(vane(0.48, 0.141, 25, "pointed"))),
    placeAssembly(pair(blade, 180.25)),
    placeAssembly({ ...pair(blade), instances: [...pair(blade).instances, { id: "twin", slot: "blade", def: blade }], attachments: [...pair(blade).attachments, { child: "twin", childPort: "root", parent: "host", parentPort: "socket", angle: 180 }] }),
  ].map((r) => (r.ok ? "accepted" : r.error.code));
  expect(codes).toEqual(["kind-mismatch", "length-mismatch", "angle-not-allowed", "port-in-use"]);
});

test("a declared seam that does not close is refused (ports-apart) rather than welded", () => {
  const left = band("keel", 0.2, 0.2, 0.4);
  const other = band("keel", 0.2, 0.2, 0.4, 0.05);
  const r = placeAssembly({ name: "fixture", root: "a", instances: [{ id: "a", slot: "a", def: left }, { id: "b", slot: "b", def: other }, { id: "c", slot: "c", def: left }], attachments: [{ child: "b", childPort: "front", parent: "a", parentPort: "back" }, { child: "c", childPort: "front", parent: "a", parentPort: "front" }], seams: [{ a: "c", aPort: "back", b: "b", bPort: "back" }], decisions: [] });
  expect(r.ok ? "accepted" : r.error.code).toBe("side-mismatch");
  const open = placeAssembly({ name: "fixture", root: "a", instances: [{ id: "a", slot: "a", def: left }, { id: "b", slot: "b", def: other }], attachments: [{ child: "b", childPort: "front", parent: "a", parentPort: "back" }], seams: [{ a: "a", aPort: "midline", b: "b", bPort: "midline" }], decisions: [] });
  expect(open.ok ? "accepted" : open.error.code).toBe("ports-apart");
});

test("a primary detached from the crow keeps its instance and definition ids and re-attaches to another socket of the same contract", () => {
  const d = bird("crow");
  const split = detach(d.assembly, "wingL/primary.2");
  if (!split.ok) throw new Error(split.error.message);
  const part = split.value.part;
  expect(part.instances.map((i) => [i.id, i.def.id])).toEqual(d.assembly.instances.filter((i) => i.id === "wingL/primary.2").map((i) => [i.id, i.def.id]));
  const moved = attach(split.value.rest, part, { childPort: "root", parent: "wingL/hand", parentPort: "socket.2", angle: 181 });
  expect(moved.ok ? moved.value.instances.find((i) => i.id === "wingL/primary.2")?.def.id : moved.error.code).toBe(part.instances[0]?.def.id);
  const wrong = attach(split.value.rest, part, { childPort: "root", parent: "body/torso.L", parentPort: "ridge.2", angle: 180 });
  expect(wrong.ok ? "accepted" : wrong.error.code).toBe("kind-mismatch");
}, 120_000);

test("the provenance DAG traces every instance to its parent port, definition and deciding variables, without cycles", () => {
  const nodes = provenance(bird("crow").assembly);
  const parent = new Map(nodes.map((n) => [n.instance, n.parent]));
  const depth = (id: string, seen: ReadonlySet<string> = new Set()): number => {
    if (seen.has(id)) return Infinity;
    const p = parent.get(id);
    return p === undefined ? 0 : 1 + depth(p, new Set([...seen, id]));
  };
  expect({ cyclic: nodes.some((n) => !Number.isFinite(depth(n.instance))), untraced: nodes.filter((n) => n.parent === undefined).map((n) => n.instance), primaries: nodes.find((n) => n.instance === "wingL/primary.0")?.decidedBy }).toEqual({ cyclic: false, untraced: ["body/torso.L"], primaries: ["primaries", "primary.base", "layer"] });
}, 120_000);

test("thresholds have counterexamples: a 0.0039-cell sliver is degenerate and a non-convex plate is refused", () => {
  const sliver = plate("sliver", { points: [[0, 0], [1, 0], [0.5, 0.0039]], panels: [{ v: [0, 1, 2], part: "s" }], creases: [] }, []);
  const dart = plate("dart", { points: [[0, 0], [1, 0], [0.5, 0.2], [0.5, 1]], panels: [{ v: [0, 1, 2, 3], part: "d" }], creases: [] }, []);
  expect([moduleIssues(sliver), moduleIssues(dart)].map((x) => x.join(";"))).toEqual(["plate#0 degenerate", "plate#0 non-convex"]);
});

test("the hero vehicle meets its function constraints on the built geometry and its automated GEO-1 is PASS", () => {
  const d = vehicle("hero");
  const compiled = compileAssembly(d.assembly, "vehicle", {});
  if (!compiled.ok) throw new Error(compiled.error.message);
  const m = d.measures;
  expect({
    verdict: geo1Verdict(verifyCompiled(compiled.value.compiled)).verdict,
    oneSheetPerInstance: compiled.value.compiled.pieces.length === d.assembly.instances.length,
    tyresOnGround: Math.abs(m.tyreGround) <= 1e-6,
    fenderClearance: m.fenderClearance >= 0.04,
    groundClearance: m.groundClearance >= 0.2,
    wheelbase: Math.round(m.wheelbase * 1000) / 1000,
  }).toEqual({ verdict: "PASS", oneSheetPerInstance: true, tyresOnGround: true, fenderClearance: true, groundClearance: true, wheelbase: 2.6 });
}, 120_000);

test("every vehicle variant (hero, seeds 1–8, both window corners) solves inside the brief's proportion windows", () => {
  const out = (["hero", 1, 2, 3, 4, 5, 6, 7, 8, "min", "max"] as const).flatMap((v) => {
    const m = vehicle(v).measures;
    return [m.wheelbaseRatio < 0.54 || m.wheelbaseRatio > 0.65 ? `${String(v)} wheelbase` : "", m.heightRatio < 0.3 || m.heightRatio > 0.38 ? `${String(v)} height` : "", m.hoodRatio < 0.28 ? `${String(v)} hood` : ""].filter((x) => x !== "");
  });
  expect(out).toEqual([]);
}, 120_000);

test("the bird's alula and the vehicle's grille slats are one concrete definition (cross-object reuse at the definition level)", () => {
  const shared = reuseTable([bird("crow").assembly, vehicle("hero").assembly]).filter((r) => Object.keys(r.uses).length > 1);
  expect(shared.map((r) => [r.family, Object.keys(r.uses).sort()])).toEqual([["vane", ["bird", "vehicle"]], ["vane", ["bird", "vehicle"]]]);
}, 120_000);

test("a grille slat detached from the vehicle keeps its identity and plugs into the bird's alula socket", () => {
  const car = detach(vehicle("hero").assembly, "grille/slat.1.L");
  const crow = detach(bird("crow").assembly, "wingL/alula");
  if (!car.ok || !crow.ok) throw new Error("detach failed");
  const slat = car.value.part;
  const moved = attach(crow.value.rest, slat, { childPort: "root", parent: "wingL/hand", parentPort: "alula", angle: 172 });
  expect(moved.ok ? moved.value.instances.find((i) => i.id === "grille/slat.1.L")?.def.id : moved.error.code).toBe(crow.value.part.instances[0]?.def.id);
}, 120_000);

test("regression: the innermost secondary swept into the belly and tail plate during the flap (seeds 5, 7, min corner); every bird variant is now GEO-1 PASS including the flap sweep", () => {
  const verdicts = (["crow", 1, 2, 3, 4, 5, 6, 7, 8, 101, 202, 303, "min", "max"] as const).map((v) => {
    const compiled = compileAssembly(bird(v).assembly, "bird", {});
    if (!compiled.ok) throw new Error(compiled.error.message);
    return geo1Verdict(verifyCompiled(compiled.value.compiled)).verdict;
  });
  expect(verdicts.filter((v) => v !== "PASS")).toEqual([]);
}, 300_000);
