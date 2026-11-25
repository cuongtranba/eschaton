import { assemblyCatalog, moduleContracts } from "./assemblies";
import { primitiveCatalog } from "./catalog";
import { faceSockets, foldable, rectangularFootprint, renderable, windResponsive, type FoldonDefinition } from "./definition";
import { defineFoldon } from "./define";
import { foldedNet, makePanel } from "./geometry";
import { creaseId, foldonId, materialId, panelId } from "./ids";
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

export const presetCatalog: Result<Catalog, readonly ValidationIssue[]> = createCatalog({
  foldons: [...primitiveCatalog, ...presetFoldons],
  assemblies: assemblyCatalog,
  contracts: moduleContracts,
});
