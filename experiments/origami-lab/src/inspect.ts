import { canonicalJson, fnv1a64, validateFoldon } from "@eschaton/foldon";
import type { Articulation, CreaseKind } from "./sheet";
import { shapeClass, squaredSides, variantId, type TriangleClass } from "./lattice";
import type { Connection, LabObject } from "./object";

export type PanelInfo = Readonly<{
  id: string;
  part: string;
  family: "tri" | "quad";
  variant: string;
  triangleClass: TriangleClass | "quad";
  squaredSides: readonly number[];
}>;

export type CreaseInfo = Readonly<{
  id: string;
  kind: CreaseKind;
  targetDeg: number;
  articulation: Articulation | null;
  panels: readonly [string, string];
}>;

export type FoldonInfo = Readonly<{
  id: string;
  fingerprint: string;
  valid: boolean;
  footprint: readonly [number, number, number];
  panels: number;
  creases: number;
}>;

export type ObjectInspection = Readonly<{
  name: string;
  seed: number;
  fingerprint: string;
  parts: readonly Readonly<{ name: string; module: string; panels: readonly string[] }>[];
  panels: readonly PanelInfo[];
  creases: readonly CreaseInfo[];
  joins: readonly string[];
  connections: readonly Connection[];
  foldons: readonly FoldonInfo[];
  counts: Readonly<{
    triangleClasses: Readonly<Record<TriangleClass, number>>;
    quads: number;
    distinctVariantIds: number;
  }>;
}>;

export function objectInspection(object: LabObject): ObjectInspection {
  const panels = object.components.flatMap((component) =>
    component.sheet.panels.map(
      (panel): PanelInfo => ({
        id: panel.id,
        part: component.partOf[panel.id] ?? "",
        family: panel.shape.family,
        variant: variantId(panel.shape),
        triangleClass: shapeClass(panel.shape),
        squaredSides: squaredSides(panel.shape),
      }),
    ),
  );
  const creases = object.components.flatMap((component) =>
    component.sheet.creases.map(
      (c): CreaseInfo => ({ id: c.id, kind: c.kind, targetDeg: c.angle, articulation: c.articulation ?? null, panels: [c.a, c.b] }),
    ),
  );
  const classes: Record<TriangleClass, number> = { acute: 0, right: 0, obtuse: 0 };
  for (const panel of panels) if (panel.triangleClass !== "quad") classes[panel.triangleClass] += 1;
  return {
    name: object.name,
    seed: object.seed,
    fingerprint: object.fingerprint,
    parts: object.recipe.parts.map((part) => ({
      name: part.name,
      module: `${part.name}#${fnv1a64(canonicalJson(part.plan)).slice(0, 8)}`,
      panels: panels.filter((p) => p.part === part.name).map((p) => p.id),
    })),
    panels,
    creases,
    joins: creases.filter((c) => c.kind === "J").map((c) => c.id),
    connections: object.recipe.connections,
    foldons: object.components.map((component) => {
      const cells = component.definition.footprint;
      const extent = (axis: 0 | 1 | 2): number => Math.max(...cells.map((c) => c[axis])) + 1;
      return {
        id: component.definition.id,
        fingerprint: fnv1a64(canonicalJson(component.definition)),
        valid: validateFoldon(component.definition).ok,
        footprint: [extent(0), extent(1), extent(2)],
        panels: component.definition.geometry.panels.length,
        creases: component.definition.geometry.creases.length,
      };
    }),
    counts: {
      triangleClasses: classes,
      quads: panels.filter((p) => p.family === "quad").length,
      distinctVariantIds: new Set(panels.map((p) => p.variant)).size,
    },
  };
}
