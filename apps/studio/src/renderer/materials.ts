import { color, frontFacing, mix, normalWorld, step, vec3 } from "three/tsl";
import { LineBasicNodeMaterial, MeshBasicNodeMaterial, DoubleSide } from "three/webgpu";
import { palette } from "../lab/palette";

export type LabMaterials = Readonly<{
  paper: MeshBasicNodeMaterial;
  panelEdges: LineBasicNodeMaterial;
  creaseAxes: LineBasicNodeMaterial;
  grid: LineBasicNodeMaterial;
  footprint: LineBasicNodeMaterial;
  sockets: LineBasicNodeMaterial;
  dispose: () => void;
}>;

const LIGHT_DIRECTION = vec3(0.75, 0.85, -0.25).normalize();
const SHADE_THRESHOLD = 0.2;

function createPaperMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  material.side = DoubleSide;
  material.polygonOffset = true;
  material.polygonOffsetFactor = 1;
  material.polygonOffsetUnits = 1;
  const lit = step(SHADE_THRESHOLD, normalWorld.dot(LIGHT_DIRECTION));
  const front = mix(color("#C9B88F"), color(palette.palePaper), lit);
  const back = mix(color("#8F8062"), color("#B3A27C"), lit);
  material.colorNode = frontFacing.select(front, back);
  return material;
}

function createLineMaterial(hex: string, options: { opacity?: number; depthTest?: boolean; vertexColors?: boolean } = {}): LineBasicNodeMaterial {
  const material = new LineBasicNodeMaterial({ color: hex });
  if (options.opacity !== undefined) {
    material.transparent = true;
    material.opacity = options.opacity;
  }
  if (options.depthTest === false) {
    material.depthTest = false;
    material.depthWrite = false;
  }
  if (options.vertexColors === true) material.vertexColors = true;
  return material;
}

export function createLabMaterials(): LabMaterials {
  const paper = createPaperMaterial();
  const panelEdges = createLineMaterial(palette.ink);
  const creaseAxes = createLineMaterial(palette.charcoal, { depthTest: false });
  const grid = createLineMaterial(palette.ash, { opacity: 0.45 });
  const footprint = createLineMaterial(palette.charcoal, { opacity: 0.7 });
  const sockets = createLineMaterial("#ffffff", { vertexColors: true });
  const all = [paper, panelEdges, creaseAxes, grid, footprint, sockets];
  return { paper, panelEdges, creaseAxes, grid, footprint, sockets, dispose: () => { all.forEach((m) => { m.dispose(); }); } };
}
