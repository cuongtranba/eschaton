import {
  creaseId,
  defineFoldon,
  err,
  faceSockets,
  foldable,
  foldedNet,
  foldonId,
  makePanel,
  materialId,
  ok,
  panelId,
  poseGeometry,
  rectangularFootprint,
  renderable,
  type FoldonDefinition,
  type HingeSpec,
  type NetInput,
  type Result,
  type ValidationIssue,
  type Vec3,
} from "@eschaton/foldon";
import { Q, type Pt } from "./lattice";
import type { Sheet, SheetCrease } from "./sheet";

export type FoldonError = Readonly<{
  code: "disconnected" | "net" | "pose" | "define";
  message: string;
  issues?: readonly ValidationIssue[];
}>;

const WIDE: readonly [number, number] = [-Math.PI, Math.PI];
const STEPS = 1e9;
const rad = (degrees: number): number => (degrees * Math.PI) / 180;
const rounded = (value: number): number => Math.round(value * STEPS) / STEPS + 0;
const lift = (p: Pt): Vec3 => [p[0] / Q + 0, 0, -p[1] / Q + 0];

/** Crease kind to Foldon: M and V follow the sign of the angle; F and J become rest-0 hinges pinned to the range [0, 0]. */
function finalRange(crease: SheetCrease): readonly [number, number] | undefined {
  if (crease.kind === "F" || crease.kind === "J") return [0, 0];
  return crease.articulation === undefined ? undefined : [rad(crease.articulation.lo), rad(crease.articulation.hi)];
}

function hingesFrom(sheet: Sheet): Result<readonly (readonly [SheetCrease, string, string])[], FoldonError> {
  const reached = new Set<string>([sheet.root]);
  const ordered: (readonly [SheetCrease, string, string])[] = [];
  const queue = [sheet.root];
  for (const current of queue) {
    for (const crease of sheet.creases) {
      const other = crease.a === current ? crease.b : crease.b === current ? crease.a : undefined;
      if (other === undefined || reached.has(other)) continue;
      reached.add(other);
      ordered.push([crease, current, other]);
      queue.push(other);
    }
  }
  if (reached.size !== sheet.panels.length) return err({ code: "disconnected", message: "some panels are not connected to the root by hinges" });
  return ok(ordered);
}

/** Same idiom as the primitive catalog's irregular fragment: author a flat net, pose it, re-record the posed panels. */
export function sheetToDefinition(sheet: Sheet, id: string, name: string): Result<FoldonDefinition, FoldonError> {
  const tree = hingesFrom(sheet);
  if (!tree.ok) return tree;
  const hinge = (range: (c: SheetCrease) => readonly [number, number] | undefined) =>
    tree.value.map(([crease, parent, child]): HingeSpec => {
      const chosen = range(crease);
      return { id: crease.id, parent: panelId(parent), child: panelId(child), ...(chosen === undefined ? {} : { range: chosen }) };
    });
  const facing: Vec3 = [0, 1, 0];
  const flat: NetInput = {
    panels: sheet.panels.map((p) => makePanel(panelId(p.id), p.vertices.map(lift), facing)),
    root: panelId(sheet.root),
    hinges: hinge(() => WIDE),
  };
  const flatRecipe = foldedNet(flat);
  if (!flatRecipe.ok) return err({ code: "net", message: flatRecipe.error });
  const targets = new Map(sheet.creases.map((c) => [creaseId(c.id), rad(c.angle)] as const));
  const posed = poseGeometry(flatRecipe.value, targets);
  if (!posed.ok) return err({ code: "pose", message: posed.error.message });

  const all = posed.value.panels.flatMap((p) => p.vertices.map((v) => v.map(rounded)));
  const min = [0, 1, 2].map((axis) => Math.min(...all.map((v) => v[axis] ?? 0)));
  const shift = (v: Vec3): Vec3 => [rounded(v[0] - (min[0] ?? 0)), rounded(v[1] - (min[1] ?? 0)), rounded(v[2] - (min[2] ?? 0))];
  const shifted = posed.value.panels.map((p) => ({ id: p.id, vertices: p.vertices.map(shift) }));
  const extent = [0, 1, 2].map((axis) => Math.max(1, Math.ceil(Math.max(...shifted.flatMap((p) => p.vertices.map((v) => v[axis] ?? 0))))));
  const recipe = foldedNet({ panels: shifted, root: panelId(sheet.root), hinges: hinge(finalRange) });
  if (!recipe.ok) return err({ code: "net", message: recipe.error });

  const footprint = rectangularFootprint(extent[0] ?? 1, extent[1] ?? 1, extent[2] ?? 1);
  const creases = recipe.value.creases.map((c) => c.id);
  const defined = defineFoldon({
    id: foldonId(id),
    name,
    footprint,
    geometry: recipe.value,
    sockets: faceSockets(footprint, { default: "open" }),
    components: [...(creases.length > 0 ? [foldable({ creases, stiffness: 0.5 })] : []), renderable({ material: materialId("paper") })],
    tags: ["origami-lab"],
  });
  if (!defined.ok) {
    return err({ code: "define", message: defined.error.map((i) => `${i.code} at ${i.path}`).join("; "), issues: defined.error });
  }
  return ok(defined.value);
}
