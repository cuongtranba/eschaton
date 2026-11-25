import type { AssemblyRecipe } from "./assembly";
import { assemblyCatalog, moduleContracts } from "./assemblies";
import { primitiveCatalog } from "./catalog";
import { faceSockets, foldable, rectangularFootprint, renderable, windResponsive, type FoldonDefinition } from "./definition";
import { defineFoldon } from "./define";
import { foldedNet, makePanel } from "./geometry";
import { assemblyId, creaseId, foldonId, materialId, panelId, placementId } from "./ids";
import type { ValidationIssue } from "./issues";
import { createCatalog, type Catalog } from "./registry";
import { err, type Result } from "./result";
import { v3 } from "./vec";

const up = v3(0, 1, 0);

function leaf(): Result<FoldonDefinition, readonly ValidationIssue[] | string> {
  const geometry = foldedNet({
    panels: [
      makePanel(panelId("blade-west"), [v3(0.5, 0.05, 0.1), v3(0.5, 0.05, 0.9), v3(0.12, 0.3, 0.5)], up),
      makePanel(panelId("blade-east"), [v3(0.5, 0.05, 0.9), v3(0.5, 0.05, 0.1), v3(0.88, 0.3, 0.5)], up),
    ],
    root: panelId("blade-west"),
    hinges: [{ id: "midrib", parent: panelId("blade-west"), child: panelId("blade-east"), stiffness: 0.2 }],
  });
  if (!geometry.ok) return err(geometry.error);
  const footprint = rectangularFootprint(1, 1, 1);
  return defineFoldon({
    id: foldonId("leaf"),
    name: "Leaf (preset)",
    footprint,
    geometry: geometry.value,
    sockets: faceSockets(footprint, { default: "open", "+y": "empty", "-y": "base" }),
    components: [
      foldable({ creases: [creaseId("midrib")], stiffness: 0.2 }),
      windResponsive({ drag: 0.8 }),
      renderable({ material: materialId("ash-paper") }),
    ],
    tags: ["preset", "foliage"],
    weight: 0.2,
  });
}

const built = leaf();
if (!built.ok) throw new Error(`leaf preset is malformed: ${JSON.stringify(built.error)}`);

export const presetFoldons: readonly FoldonDefinition[] = [built.value];

const box = (id: string, x: number, y: number, z: number): AssemblyRecipe["parts"][number] => ({
  id: placementId(id),
  ref: { kind: "foldon", id: foldonId("P08"), version: 1 },
  anchor: [x, y, z],
  rotation: 0,
});

export const presetAssemblies: readonly AssemblyRecipe[] = [
  {
    id: assemblyId("column-3"),
    version: 1,
    name: "Column (1x3x1, preset)",
    level: 1,
    tags: ["preset", "column"],
    parts: [box("low", 0, 0, 0), box("mid", 0, 1, 0), box("high", 0, 2, 0)],
  },
  {
    id: assemblyId("l-block"),
    version: 1,
    name: "L block (irregular 2x1x2 mask, preset)",
    level: 1,
    tags: ["preset", "irregular"],
    parts: [box("corner", 0, 0, 0), box("east", 1, 0, 0), box("south", 0, 0, 1)],
  },
];

export const presetCatalog: Result<Catalog, readonly ValidationIssue[]> = createCatalog({
  foldons: [...primitiveCatalog, ...presetFoldons],
  assemblies: [...assemblyCatalog, ...presetAssemblies],
  contracts: moduleContracts,
});
