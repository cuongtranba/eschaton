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

/** A flat single-cell ground piece at the given height: paving, water or a bridge deck. Not a building mesh. */
function groundPiece(id: string, name: string, height: number, inset: number, material: string, tags: readonly string[]): Result<FoldonDefinition, readonly ValidationIssue[] | string> {
  const [low, high] = [inset, 1 - inset];
  const geometry = foldedNet({
    panels: [makePanel(panelId("surface"), [v3(low, height, low), v3(low, height, high), v3(high, height, high), v3(high, height, low)], up)],
    root: panelId("surface"),
    hinges: [],
  });
  if (!geometry.ok) return err(geometry.error);
  const footprint = rectangularFootprint(1, 1, 1);
  return defineFoldon({
    id: foldonId(id),
    name,
    footprint,
    geometry: geometry.value,
    sockets: faceSockets(footprint, { default: "open", "+y": "empty", "-y": "base" }),
    components: [renderable({ material: materialId(material) })],
    tags: ["preset", "ground", ...tags],
    weight: 1,
  });
}

const authored = [
  leaf(),
  groundPiece("paving", "Paving (preset)", 0.06, 0.02, "ash-paper", ["road"]),
  groundPiece("water", "Water (preset)", 0.02, 0.02, "ink-paper", ["water"]),
  groundPiece("bridge", "Bridge deck (preset)", 0.34, 0.02, "paper", ["road", "bridge"]),
];

export const presetFoldons: readonly FoldonDefinition[] = authored.map((built) => {
  if (!built.ok) throw new Error(`a preset foldon is malformed: ${JSON.stringify(built.error)}`);
  return built.value;
});

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
