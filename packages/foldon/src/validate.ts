import {
  allRotations,
  cellKey,
  externalFaces,
  faceCentre,
  faceNormal,
  faceTangent,
  type FoldonDefinition,
} from "./definition";
import {
  analyzeTree,
  creaseAngle,
  isConsecutiveEdge,
  newellNormal,
  type CreaseDefinition,
  type Panel,
} from "./geometry";
import type { PanelId } from "./ids";
import { issue, type ValidationIssue } from "./issues";
import { err, ok, type Result } from "./result";
import { cross, distance, dot, length, sub, v3, centroid, type Cell, type Vec3 } from "./vec";

const PLANAR_TOLERANCE = 1e-6;
const CONVEX_TOLERANCE = 1e-9;
const SIGN_TOLERANCE = 1e-9;
const EDGE_TOLERANCE = 1e-6;
const ANGLE_TOLERANCE = 1e-6;
const BOX_TOLERANCE = 1e-9;
const MIN_AREA = 1e-9;

const finite3 = (v: Vec3): boolean => v.every(Number.isFinite);
const isNonNegative = (n: number): boolean => Number.isFinite(n) && n >= 0;

function metaIssues(def: FoldonDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (def.id.length === 0) issues.push(issue("id-invalid", "id", "id must not be empty"));
  if (!Number.isInteger(def.version) || def.version < 1) {
    issues.push(issue("version-invalid", "version", "version must be an integer >= 1"));
  }
  if (!Number.isFinite(def.weight) || def.weight <= 0) {
    issues.push(issue("weight-invalid", "weight", "weight must be a finite number > 0"));
  }
  if (def.rotations.length === 0) {
    issues.push(issue("rotations-empty", "rotations", "at least one rotation is required"));
  }
  if (def.rotations.some((r) => !allRotations.includes(r))) {
    issues.push(issue("rotations-invalid", "rotations", "rotations must be 0, 1, 2 or 3"));
  }
  if (new Set(def.rotations).size !== def.rotations.length) {
    issues.push(issue("rotations-duplicate", "rotations", "rotations must be unique"));
  }
  return issues;
}

function footprintIssues(def: FoldonDefinition): ValidationIssue[] {
  if (def.footprint.length === 0) return [issue("footprint-empty", "footprint", "footprint must not be empty")];
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  def.footprint.forEach((cell, i) => {
    if (!cell.every(Number.isInteger)) {
      issues.push(issue("footprint-cell-invalid", `footprint[${i}]`, "cell coordinates must be integers"));
    } else if (seen.has(cellKey(cell))) {
      issues.push(issue("footprint-duplicate-cell", `footprint[${i}]`, `duplicate cell ${cellKey(cell)}`));
    }
    seen.add(cellKey(cell));
  });
  return issues;
}

function footprintBox(footprint: readonly Cell[]): Readonly<{ min: Vec3; max: Vec3 }> {
  const axis = (i: 0 | 1 | 2): readonly [number, number] => [
    Math.min(...footprint.map((c) => c[i])),
    Math.max(...footprint.map((c) => c[i])) + 1,
  ];
  const [x, y, z] = [axis(0), axis(1), axis(2)];
  return { min: v3(x[0], y[0], z[0]), max: v3(x[1], y[1], z[1]) };
}

function panelIssues(panel: Panel, path: string): ValidationIssue[] {
  const bad = panel.vertices.flatMap((v, i) =>
    finite3(v) ? [] : [issue("vertex-not-finite", `${path}.vertices[${i}]`, "vertex has a non-finite coordinate")],
  );
  if (bad.length > 0) return bad;
  const vs = panel.vertices;
  if (vs.length < 3) return [issue("panel-too-small", `${path}.vertices`, "a panel needs at least 3 vertices")];
  const origin = vs[0] ?? v3(0, 0, 0);
  let areaVector = v3(0, 0, 0);
  for (let i = 1; i + 1 < vs.length; i++) {
    const [a, b] = [vs[i], vs[i + 1]];
    if (a === undefined || b === undefined) continue;
    const c = cross(sub(a, origin), sub(b, origin));
    areaVector = v3(areaVector[0] + c[0], areaVector[1] + c[1], areaVector[2] + c[2]);
  }
  if (length(areaVector) / 2 < MIN_AREA) {
    return [issue("panel-degenerate", path, "panel has no area")];
  }
  const normal = newellNormal(vs);
  const centre = centroid(vs);
  const issues: ValidationIssue[] = [];
  if (vs.some((v) => Math.abs(dot(sub(v, centre), normal)) > PLANAR_TOLERANCE)) {
    issues.push(issue("panel-not-planar", path, "vertices do not lie in one plane"));
  }
  const nonConvex = vs.some((v, i) => {
    const [next, after] = [vs[(i + 1) % vs.length], vs[(i + 2) % vs.length]];
    if (next === undefined || after === undefined) return false;
    return dot(cross(sub(next, v), sub(after, next)), normal) < -CONVEX_TOLERANCE;
  });
  if (nonConvex) issues.push(issue("panel-not-convex", path, "panel is not convex"));
  return issues;
}

function creaseNumericIssues(crease: CreaseDefinition, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isNonNegative(crease.stiffness)) {
    issues.push(issue("crease-stiffness-invalid", `${path}.stiffness`, "stiffness must be finite and >= 0"));
  }
  const [low, high] = crease.range;
  const rangeOk =
    Number.isFinite(low) && Number.isFinite(high) && low <= high && low >= -Math.PI - 1e-12 && high <= Math.PI + 1e-12;
  const contains = crease.restAngle >= low - SIGN_TOLERANCE && crease.restAngle <= high + SIGN_TOLERANCE;
  if (!rangeOk || !contains) {
    issues.push(issue("crease-range-invalid", `${path}.range`, "range must lie in [-PI, PI] and contain the rest angle"));
  }
  const wrongSign =
    (crease.restAngle > SIGN_TOLERANCE && crease.assignment !== "valley") ||
    (crease.restAngle < -SIGN_TOLERANCE && crease.assignment !== "mountain");
  if (wrongSign) {
    issues.push(
      issue("crease-assignment-mismatch", `${path}.assignment`, "assignment must agree with the sign of the rest angle"),
    );
  }
  return issues;
}

function creaseGeometryIssues(crease: CreaseDefinition, parent: Panel, child: Panel, path: string): ValidationIssue[] {
  const [pa, pb] = [parent.vertices[crease.parentEdge[0]], parent.vertices[crease.parentEdge[1]]];
  const [ca, cb] = [child.vertices[crease.childEdge[0]], child.vertices[crease.childEdge[1]]];
  if (pa === undefined || pb === undefined || ca === undefined || cb === undefined) return [];
  const gap = Math.min(
    Math.max(distance(pa, ca), distance(pb, cb)),
    Math.max(distance(pa, cb), distance(pb, ca)),
  );
  if (gap > EDGE_TOLERANCE) {
    return [issue("crease-edge-mismatch", path, "parent and child hinge edges do not coincide in the rest pose")];
  }
  const measured = creaseAngle(parent.vertices, crease.parentEdge, child.vertices);
  const difference = measured - crease.restAngle;
  if (Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))) > ANGLE_TOLERANCE) {
    return [
      issue(
        "crease-angle-mismatch",
        `${path}.restAngle`,
        `declared rest angle ${crease.restAngle} but geometry measures ${measured}`,
      ),
    ];
  }
  return [];
}

function geometryIssues(def: FoldonDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const usable = new Map<PanelId, Panel>();
  def.geometry.panels.forEach((panel, i) => {
    const found = panelIssues(panel, `geometry.panels[${i}]`);
    issues.push(...found);
    if (found.length === 0) usable.set(panel.id, panel);
  });

  const footprintValid = def.footprint.length > 0 && def.footprint.every((c) => c.every(Number.isInteger));
  if (footprintValid) {
    const { min, max } = footprintBox(def.footprint);
    def.geometry.panels.forEach((panel, i) => {
      panel.vertices.forEach((v, k) => {
        const outside = v.some((c, axis) => c < (min[axis] ?? 0) - BOX_TOLERANCE || c > (max[axis] ?? 0) + BOX_TOLERANCE);
        if (finite3(v) && outside) {
          issues.push(
            issue("vertex-outside-footprint", `geometry.panels[${i}].vertices[${k}]`, "vertex lies outside the footprint bounds"),
          );
        }
      });
    });
  }

  issues.push(...analyzeTree(def.geometry).issues);
  def.geometry.creases.forEach((crease, i) => {
    const path = `geometry.creases[${i}]`;
    issues.push(...creaseNumericIssues(crease, path));
    const parent = usable.get(crease.parent);
    const child = usable.get(crease.child);
    const edgesValid =
      parent !== undefined &&
      child !== undefined &&
      isConsecutiveEdge(parent.vertices.length, crease.parentEdge) &&
      isConsecutiveEdge(child.vertices.length, crease.childEdge);
    if (edgesValid) issues.push(...creaseGeometryIssues(crease, parent, child, path));
  });
  return issues;
}

function socketIssues(def: FoldonDefinition): ValidationIssue[] {
  if (def.footprint.length === 0 || !def.footprint.every((c) => c.every(Number.isInteger))) return [];
  const issues: ValidationIssue[] = [];
  const expected = new Map(externalFaces(def.footprint).map((e) => [`${cellKey(e.cell)}|${e.face}`, e]));
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  def.sockets.forEach((socket, i) => {
    const path = `sockets[${i}]`;
    const key = `${cellKey(socket.cell)}|${socket.face}`;
    if (seenKeys.has(key) || seenIds.has(socket.id)) {
      issues.push(issue("socket-duplicate", path, `duplicate socket ${socket.id}`));
      return;
    }
    seenKeys.add(key);
    seenIds.add(socket.id);
    const target = expected.get(key);
    if (target === undefined) {
      issues.push(issue("socket-unexpected", path, `socket ${socket.id} is not on an external face of the footprint`));
      return;
    }
    if (!(Number.isFinite(socket.tolerance) && socket.tolerance > 0)) {
      issues.push(issue("socket-tolerance-invalid", `${path}.tolerance`, "tolerance must be finite and > 0"));
      return;
    }
    const aligned =
      distance(socket.position, faceCentre(target.cell, target.face)) <= socket.tolerance &&
      distance(socket.normal, faceNormal[target.face]) <= socket.tolerance &&
      distance(socket.tangent, faceTangent(target.face)) <= socket.tolerance;
    if (!aligned) {
      issues.push(
        issue("socket-geometry-mismatch", path, "socket frame must sit at the face centre with outward normal and the canonical tangent"),
      );
    }
  });
  for (const [key, entry] of expected) {
    if (!seenKeys.has(key)) {
      issues.push(issue("socket-missing", "sockets", `no socket on external face ${entry.face} of cell ${cellKey(entry.cell)}`));
    }
  }
  return issues;
}

function componentIssues(def: FoldonDefinition): ValidationIssue[] {
  const creases = new Set<string>(def.geometry.creases.map((c) => c.id));
  const issues: ValidationIssue[] = [];
  def.components.forEach((component, i) => {
    const path = `components[${i}]`;
    switch (component.kind) {
      case "foldable":
        component.creases.forEach((id, k) => {
          if (!creases.has(id)) {
            issues.push(issue("component-unknown-crease", `${path}.creases[${k}]`, `crease ${id} does not exist`));
          }
        });
        if (!isNonNegative(component.stiffness)) {
          issues.push(issue("component-invalid", `${path}.stiffness`, "stiffness must be finite and >= 0"));
        }
        break;
      case "structural":
        if (!isNonNegative(component.strength)) issues.push(issue("component-invalid", `${path}.strength`, "strength must be finite and >= 0"));
        break;
      case "wind-responsive":
        if (!isNonNegative(component.drag)) issues.push(issue("component-invalid", `${path}.drag`, "drag must be finite and >= 0"));
        break;
      case "decayable":
        if (!isNonNegative(component.resistance)) issues.push(issue("component-invalid", `${path}.resistance`, "resistance must be finite and >= 0"));
        break;
      case "thermal":
        if (!isNonNegative(component.capacity)) issues.push(issue("component-invalid", `${path}.capacity`, "capacity must be finite and >= 0"));
        break;
      case "renderable":
        if (component.material.length === 0) issues.push(issue("component-invalid", `${path}.material`, "material must not be empty"));
        break;
    }
  });
  return issues;
}

export function validateFoldon(def: FoldonDefinition): Result<FoldonDefinition, readonly ValidationIssue[]> {
  const issues = [
    ...metaIssues(def),
    ...footprintIssues(def),
    ...geometryIssues(def),
    ...socketIssues(def),
    ...componentIssues(def),
  ];
  return issues.length === 0 ? ok(def) : err(issues);
}
