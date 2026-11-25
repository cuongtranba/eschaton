import {
  decayable,
  foldable,
  rectangularFootprint,
  renderable,
  structural,
  thermal,
  windResponsive,
  faceSockets,
  type ComponentSpec,
  type FaceProfiles,
  type FoldonDefinition,
} from "./definition";
import { defineFoldon } from "./define";
import {
  foldedNet,
  makePanel,
  poseGeometry,
  type GeometryRecipe,
  type HingeSpec,
  type NetInput,
  type Panel,
} from "./geometry";
import { foldonId, materialId, panelId, type FoldonId } from "./ids";
import type { Cell, Vec3 } from "./vec";
import { v3 } from "./vec";

const E = 0.02;
const FAR = 1 - E;

const pt = (x: number, y: number, z: number): Vec3 => v3(x, y, z);
const panel = (id: string, vertices: readonly Vec3[], facing: Vec3): Panel => makePanel(panelId(id), vertices, facing);
const hinge = (id: string, parent: string, child: string, extra: Partial<HingeSpec> = {}): HingeSpec => ({
  id,
  parent: panelId(parent),
  child: panelId(child),
  ...extra,
});

function recipe(net: NetInput): GeometryRecipe {
  const built = foldedNet(net);
  if (!built.ok) throw new Error(`primitive catalog net is malformed: ${built.error}`);
  return built.value;
}

const planarPanel = (): GeometryRecipe =>
  recipe({
    panels: [panel("deck", [pt(E, E, E), pt(E, E, FAR), pt(FAR, E, FAR), pt(FAR, E, E)], pt(0, 1, 0))],
    root: panelId("deck"),
    hinges: [],
  });

const triangularFacet = (): GeometryRecipe =>
  recipe({
    panels: [panel("facet", [pt(E, E, E), pt(FAR, E, E), pt(0.5, FAR, FAR)], pt(0, 1, -1))],
    root: panelId("facet"),
    hinges: [],
  });

function gable(width: number, ridgeHeight: number, hingeOptions: Partial<HingeSpec>): GeometryRecipe {
  const far = width - E;
  return recipe({
    panels: [
      panel("slope-near", [pt(E, E, E), pt(far, E, E), pt(far, ridgeHeight, 1), pt(E, ridgeHeight, 1)], pt(0, 1, 0)),
      panel("slope-far", [pt(E, ridgeHeight, 1), pt(far, ridgeHeight, 1), pt(far, E, 2 - E), pt(E, E, 2 - E)], pt(0, 1, 0)),
    ],
    root: panelId("slope-near"),
    hinges: [hinge("ridge", "slope-near", "slope-far", hingeOptions)],
  });
}

const valleyChannel = (): GeometryRecipe =>
  recipe({
    panels: [
      panel("bank-near", [pt(E, FAR, E), pt(2 - E, FAR, E), pt(2 - E, E, 1), pt(E, E, 1)], pt(0, 1, 0)),
      panel("bank-far", [pt(E, E, 1), pt(2 - E, E, 1), pt(2 - E, FAR, 2 - E), pt(E, FAR, 2 - E)], pt(0, 1, 0)),
    ],
    root: panelId("bank-near"),
    hinges: [hinge("trough", "bank-near", "bank-far", { stiffness: 0.5 })],
  });

const triangularPrism = (): GeometryRecipe =>
  recipe({
    panels: [
      panel("base", [pt(E, E, E), pt(FAR, E, E), pt(FAR, E, 2 - E), pt(E, E, 2 - E)], pt(0, -1, 0)),
      panel("side-left", [pt(E, E, E), pt(E, E, 2 - E), pt(0.5, FAR, 2 - E), pt(0.5, FAR, E)], pt(-1, 1, 0)),
      panel("side-right", [pt(FAR, E, E), pt(FAR, E, 2 - E), pt(0.5, FAR, 2 - E), pt(0.5, FAR, E)], pt(1, 1, 0)),
      panel("cap-front", [pt(E, E, E), pt(FAR, E, E), pt(0.5, FAR, E)], pt(0, 0, -1)),
      panel("cap-back", [pt(E, E, 2 - E), pt(FAR, E, 2 - E), pt(0.5, FAR, 2 - E)], pt(0, 0, 1)),
    ],
    root: panelId("base"),
    hinges: [
      hinge("left", "base", "side-left", { stiffness: 0.7 }),
      hinge("right", "base", "side-right", { stiffness: 0.7 }),
      hinge("front", "base", "cap-front", { stiffness: 0.7 }),
      hinge("back", "base", "cap-back", { stiffness: 0.7 }),
    ],
  });

function pyramid(): GeometryRecipe {
  const corners = [pt(E, E, E), pt(FAR, E, E), pt(FAR, E, FAR), pt(E, E, FAR)];
  const apex = pt(0.5, FAR, 0.5);
  const faces = corners.map((corner, i) => {
    const next = corners[(i + 1) % corners.length] ?? corner;
    const outward = pt((corner[0] + next[0]) / 2 - 0.5, 0.5, (corner[2] + next[2]) / 2 - 0.5);
    return panel(`face-${i}`, [corner, next, apex], outward);
  });
  return recipe({
    panels: [panel("base", corners, pt(0, -1, 0)), ...faces],
    root: panelId("base"),
    hinges: faces.map((face, i) => hinge(`face-${i}`, "base", face.id, { stiffness: 0.5 })),
  });
}

const boxShell = (): GeometryRecipe =>
  recipe({
    panels: [
      panel("floor", [pt(E, E, E), pt(FAR, E, E), pt(FAR, E, FAR), pt(E, E, FAR)], pt(0, -1, 0)),
      panel("wall-west", [pt(E, E, E), pt(E, E, FAR), pt(E, FAR, FAR), pt(E, FAR, E)], pt(-1, 0, 0)),
      panel("wall-east", [pt(FAR, E, E), pt(FAR, E, FAR), pt(FAR, FAR, FAR), pt(FAR, FAR, E)], pt(1, 0, 0)),
      panel("wall-north", [pt(E, E, E), pt(FAR, E, E), pt(FAR, FAR, E), pt(E, FAR, E)], pt(0, 0, -1)),
      panel("wall-south", [pt(E, E, FAR), pt(FAR, E, FAR), pt(FAR, FAR, FAR), pt(E, FAR, FAR)], pt(0, 0, 1)),
      panel("lid", [pt(E, FAR, E), pt(FAR, FAR, E), pt(FAR, FAR, FAR), pt(E, FAR, FAR)], pt(0, 1, 0)),
    ],
    root: panelId("floor"),
    hinges: [
      hinge("west", "floor", "wall-west", { stiffness: 0.9 }),
      hinge("east", "floor", "wall-east", { stiffness: 0.9 }),
      hinge("north", "floor", "wall-north", { stiffness: 0.9 }),
      hinge("south", "floor", "wall-south", { stiffness: 0.9 }),
      hinge("lid", "wall-east", "lid", { stiffness: 0.9 }),
    ],
  });

function irregularFragment(): GeometryRecipe {
  const up = pt(0, 1, 0);
  const hinges: readonly HingeSpec[] = [
    hinge("shard-fold", "core", "shard", { stiffness: 0.3 }),
    hinge("flap-fold", "core", "flap", { stiffness: 0.2 }),
    hinge("splinter-fold", "shard", "splinter", { stiffness: 0.4 }),
  ];
  const flat = recipe({
    panels: [
      panel("core", [pt(0.2, 0.3, 0.25), pt(0.75, 0.3, 0.2), pt(0.8, 0.3, 0.65), pt(0.3, 0.3, 0.7)], up),
      panel("shard", [pt(0.75, 0.3, 0.2), pt(0.8, 0.3, 0.65), pt(0.97, 0.3, 0.38)], up),
      panel("flap", [pt(0.8, 0.3, 0.65), pt(0.3, 0.3, 0.7), pt(0.35, 0.3, 0.95), pt(0.78, 0.3, 0.93)], up),
      panel("splinter", [pt(0.75, 0.3, 0.2), pt(0.97, 0.3, 0.38), pt(0.85, 0.3, 0.05)], up),
    ],
    root: panelId("core"),
    hinges,
  });
  const crumple = [1.1, -0.7, 1.9];
  const posed = poseGeometry(flat, new Map(flat.creases.map((c, i) => [c.id, crumple[i] ?? 0])));
  if (!posed.ok) throw new Error(`irregular fragment could not be folded: ${posed.error.code}`);
  return recipe({
    panels: posed.value.panels.map((p) => ({ id: p.id, vertices: p.vertices })),
    root: flat.root,
    hinges,
  });
}

type Spec = Readonly<{
  id: string;
  name: string;
  size: readonly [number, number, number];
  geometry: GeometryRecipe;
  profiles: FaceProfiles;
  material: string;
  extra: readonly ComponentSpec[];
  foldStiffness?: number;
  weight: number;
  tags: readonly string[];
}>;

function build(spec: Spec): FoldonDefinition {
  const footprint: readonly Cell[] = rectangularFootprint(...spec.size);
  const components: ComponentSpec[] = [...spec.extra, renderable({ material: materialId(spec.material) })];
  if (spec.foldStiffness !== undefined && spec.geometry.creases.length > 0) {
    components.unshift(foldable({ creases: spec.geometry.creases.map((c) => c.id), stiffness: spec.foldStiffness }));
  }
  const result = defineFoldon({
    id: foldonId(spec.id),
    name: spec.name,
    footprint,
    geometry: spec.geometry,
    sockets: faceSockets(footprint, spec.profiles),
    components,
    tags: spec.tags,
    weight: spec.weight,
  });
  if (!result.ok) {
    throw new Error(`primitive ${spec.id} is invalid: ${result.error.map((i) => `${i.code} at ${i.path}`).join("; ")}`);
  }
  return result.value;
}

export const primitiveCatalog: readonly FoldonDefinition[] = [
  build({
    id: "P01", name: "Planar panel", size: [1, 1, 1], geometry: planarPanel(),
    profiles: { default: "open", "+y": "deck", "-y": "base" }, material: "paper",
    extra: [structural({ strength: 0.3 }), decayable({ resistance: 0.4 })],
    weight: 3, tags: ["floor", "wall", "water"],
  }),
  build({
    id: "P02", name: "Triangular facet", size: [1, 1, 1], geometry: triangularFacet(),
    profiles: { default: "open", "+y": "empty", "-y": "base" }, material: "ash-paper",
    extra: [windResponsive({ drag: 0.7 }), decayable({ resistance: 0.2 })],
    weight: 2, tags: ["slope", "foliage", "debris"],
  }),
  build({
    id: "P03", name: "Hinged two-panel crease", size: [1, 1, 2], geometry: gable(1, 0.55, { stiffness: 0.6, range: [-3, 0.5] }),
    profiles: { default: "eave", "+y": "empty", "-y": "base" }, material: "charcoal-paper",
    foldStiffness: 0.6,
    extra: [structural({ strength: 0.6 }), windResponsive({ drag: 0.3 }), decayable({ resistance: 0.5 })],
    weight: 2, tags: ["roof", "animated-surface"],
  }),
  build({
    id: "P04", name: "Mountain fold", size: [2, 1, 2], geometry: gable(2, 0.9, { stiffness: 0.8 }),
    profiles: { default: "eave", "+y": "empty", "-y": "base" }, material: "charcoal-paper",
    foldStiffness: 0.8,
    extra: [structural({ strength: 0.9 }), windResponsive({ drag: 0.2 }), decayable({ resistance: 0.6 })],
    weight: 1.5, tags: ["roof", "ridge", "terrain"],
  }),
  build({
    id: "P05", name: "Valley fold", size: [2, 1, 2], geometry: valleyChannel(),
    profiles: { default: "open", "+y": "empty", "-y": "base" }, material: "paper",
    foldStiffness: 0.5,
    extra: [structural({ strength: 0.4 }), windResponsive({ drag: 0.1 }), decayable({ resistance: 0.5 })],
    weight: 1, tags: ["channel", "valley", "wave"],
  }),
  build({
    id: "P06", name: "Triangular prism", size: [1, 1, 2], geometry: triangularPrism(),
    profiles: { default: "empty", "+z": "beam", "-z": "beam", "-y": "base" }, material: "ink-paper",
    foldStiffness: 0.7,
    extra: [structural({ strength: 1 }), decayable({ resistance: 0.6 })],
    weight: 1.5, tags: ["beam", "ridge", "edge-transition"],
  }),
  build({
    id: "P07", name: "Pyramid", size: [1, 1, 1], geometry: pyramid(),
    profiles: { default: "open", "+y": "empty", "-y": "base" }, material: "ink-paper",
    foldStiffness: 0.5,
    extra: [structural({ strength: 0.5 }), windResponsive({ drag: 0.2 })],
    weight: 0.5, tags: ["peak", "ornament"],
  }),
  build({
    id: "P08", name: "Box shell", size: [1, 1, 1], geometry: boxShell(),
    profiles: { default: "wall", "+y": "deck", "-y": "base" }, material: "ink-paper",
    foldStiffness: 0.95,
    extra: [structural({ strength: 0.8 }), decayable({ resistance: 0.7 }), thermal({ capacity: 0.5 })],
    weight: 2, tags: ["mass", "tower-segment"],
  }),
  build({
    id: "P09", name: "Irregular fragment", size: [1, 1, 1], geometry: irregularFragment(),
    profiles: { default: "open", "+y": "empty", "-y": "base" }, material: "ash-paper",
    foldStiffness: 0.3,
    extra: [windResponsive({ drag: 0.9 }), decayable({ resistance: 0.1 })],
    weight: 0.3, tags: ["rubble", "dust", "detached-paper"],
  }),
];

export function getPrimitive(id: FoldonId): FoldonDefinition | undefined {
  return primitiveCatalog.find((definition) => definition.id === id);
}
