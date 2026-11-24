import {
  abs,
  attribute,
  clamp,
  color,
  dot,
  float,
  floor,
  fract,
  frontFacing,
  fwidth,
  max,
  mix,
  mx_noise_float,
  normalWorld,
  positionView,
  positionWorld,
  select,
  smoothstep,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import { DoubleSide, LineBasicNodeMaterial, MeshBasicNodeMaterial, Vector3, type Node } from "three/webgpu";
import type { ResolvedLook } from "../lab/look";
import { palette } from "../lab/palette";
import type { InkScale } from "../lab/viewModel";

export type LabMaterials = Readonly<{
  paper: MeshBasicNodeMaterial;
  panelEdges: LineBasicNodeMaterial;
  creaseEdges: LineBasicNodeMaterial;
  creaseAxes: LineBasicNodeMaterial;
  grid: LineBasicNodeMaterial;
  footprint: LineBasicNodeMaterial;
  sockets: LineBasicNodeMaterial;
  setLook: (look: ResolvedLook, scale: InkScale) => void;
  dispose: () => void;
}>;

type Scalar = Node<"float">;
type Colour = Node<"vec3">;

const QUANTIZE_LEVELS = 5;
const BOUNDARY_BIAS = 0.003;
const TONE_WEIGHT = 0.55;
const BACK_FACE_SHADE = 0.6;
const GRAIN_AMPLITUDE = 0.035;

const inkColor = color(palette.ink);
const charcoalColor = color(palette.charcoal);
const ashColor = color(palette.ash);
const paperColor = color(palette.paper);
const paleColor = color(palette.palePaper);

function createUniforms() {
  return {
    sun: uniform(new Vector3(0, 1, 0)),
    quantize: uniform(1),
    hatch: uniform(0),
    haze: uniform(0),
    grain: uniform(0),
    hazeStart: uniform(100),
    hazeEnd: uniform(500),
    hatchFrequency: uniform(6),
    grainFrequency: uniform(4),
  };
}

type Uniforms = ReturnType<typeof createUniforms>;

function ramp(value: Scalar): Colour {
  const stop = clamp(value, 0, 1).mul(QUANTIZE_LEVELS - 1);
  const toCharcoal = mix(inkColor, charcoalColor, clamp(stop, 0, 1));
  const toAsh = mix(toCharcoal, ashColor, clamp(stop.sub(1), 0, 1));
  const toPaper = mix(toAsh, paperColor, clamp(stop.sub(2), 0, 1));
  return mix(toPaper, paleColor, clamp(stop.sub(3), 0, 1));
}

function stripe(coordinate: Scalar, halfWidth: Scalar): Scalar {
  const aa = fwidth(coordinate).max(0.0001);
  const distance = abs(fract(coordinate).sub(0.5));
  const edge = float(1).sub(smoothstep(halfWidth.sub(aa), halfWidth.add(aa), distance));
  const mask = edge.mul(smoothstep(0, aa, halfWidth));
  return mix(mask, halfWidth.mul(2), smoothstep(0.3, 0.65, aa));
}

function distanceHaze(u: Uniforms): Scalar {
  return smoothstep(u.hazeStart, u.hazeEnd, positionView.length()).mul(u.haze);
}

function inkSurface(u: Uniforms): Colour {
  const vertexInk = attribute("ink", "vec2");
  const instanceInk = attribute("instanceInk", "vec2");
  const tone = vertexInk.x.add(instanceInk.x);
  const unlit = max(vertexInk.y, instanceInk.y);

  const normal = normalWorld.normalize();
  const lambert = normal.dot(u.sun).mul(0.5).add(0.5);
  const lit = clamp(lambert.sub(tone.mul(TONE_WEIGHT)), 0, 1);
  const flatValue = clamp(float(1).sub(tone), 0, 1);
  const shade = frontFacing.select(float(1), float(BACK_FACE_SHADE));
  const value = mix(lit.mul(shade), flatValue, unlit);

  const levels = floor(clamp(value, 0, 0.9999).mul(QUANTIZE_LEVELS).add(BOUNDARY_BIAS)).div(QUANTIZE_LEVELS - 1);
  const base = ramp(mix(value, levels, u.quantize));

  const darkness = float(1).sub(value);
  const absNormal = abs(normal);
  const faceUp = absNormal.y.greaterThan(max(absNormal.x, absNormal.z));
  const faceX = absNormal.x.greaterThan(absNormal.z);
  const plane = select(
    faceUp,
    vec2(positionWorld.x, positionWorld.z),
    select(faceX, vec2(positionWorld.z, positionWorld.y), vec2(positionWorld.x, positionWorld.y)),
  );
  const directionA = select(
    faceUp,
    vec2(0.83, 0.56),
    select(unlit.greaterThan(0.5), vec2(0.12, 0.99), vec2(1, 0.04)),
  ).normalize();
  const directionB = vec2(directionA.y.negate(), directionA.x);
  const distant = select(unlit.greaterThan(0.5), float(0.16), float(1));
  const frequency = u.hatchFrequency.mul(distant);
  const fine = dot(plane, directionA).mul(frequency);
  const cross = dot(plane, directionB).mul(frequency).mul(0.8);
  const coarse = dot(plane, directionA).mul(frequency).mul(0.5).add(0.37);
  const coarseCross = dot(plane, directionB).mul(frequency).mul(0.21);

  const lineA = stripe(fine, smoothstep(0.15, 0.8, darkness).mul(0.25));
  const lineB = stripe(cross, smoothstep(0.5, 0.72, darkness).mul(0.2)).mul(float(1).sub(unlit));
  const inkLines = max(lineA, lineB).mul(float(1).sub(smoothstep(0.74, 0.84, darkness)));
  const carved = max(stripe(coarse, float(0.075)), stripe(coarseCross, float(0.022)).mul(0.7).mul(float(1).sub(unlit))).mul(smoothstep(0.78, 0.9, darkness));

  const haze = distanceHaze(u).mul(float(1).sub(unlit));
  const strength = u.hatch.mul(float(1).sub(haze));
  const hatched = mix(mix(base, inkColor, inkLines.mul(strength)), ashColor, carved.mul(strength).mul(0.85));

  const grain = mx_noise_float(positionWorld.mul(u.grainFrequency).mul(distant))
    .mul(0.35)
    .add(mx_noise_float(positionWorld.mul(u.grainFrequency).mul(distant).mul(5.7)).mul(0.65))
    .mul(GRAIN_AMPLITUDE)
    .mul(u.grain);
  const grained = hatched.add(vec3(grain));

  return mix(grained, paperColor, haze.mul(0.95));
}

function createPaperMaterial(u: Uniforms): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  material.side = DoubleSide;
  material.polygonOffset = true;
  material.polygonOffsetFactor = 1;
  material.polygonOffsetUnits = 1;
  material.colorNode = inkSurface(u);
  return material;
}

function createEdgeMaterial(u: Uniforms, edge: Node<"color">): LineBasicNodeMaterial {
  const material = new LineBasicNodeMaterial();
  material.colorNode = mix(edge, paperColor, clamp(distanceHaze(u).mul(1.2), 0, 1));
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
  const u = createUniforms();
  const paper = createPaperMaterial(u);
  const panelEdges = createEdgeMaterial(u, charcoalColor);
  const creaseEdges = createEdgeMaterial(u, inkColor);
  const creaseAxes = createLineMaterial(palette.charcoal, { depthTest: false });
  const grid = createLineMaterial(palette.ash, { opacity: 0.45 });
  const footprint = createLineMaterial(palette.charcoal, { opacity: 0.7 });
  const sockets = createLineMaterial("#ffffff", { vertexColors: true });
  const all = [paper, panelEdges, creaseEdges, creaseAxes, grid, footprint, sockets];
  return {
    paper,
    panelEdges,
    creaseEdges,
    creaseAxes,
    grid,
    footprint,
    sockets,
    setLook: (look, scale) => {
      u.sun.value.set(look.sun[0], look.sun[1], look.sun[2]);
      u.quantize.value = look.quantize ? 1 : 0;
      u.hatch.value = look.hatching;
      u.haze.value = look.haze;
      u.grain.value = look.grain ? 1 : 0;
      u.hazeStart.value = scale.hazeStart;
      u.hazeEnd.value = scale.hazeEnd;
      u.hatchFrequency.value = scale.hatchFrequency;
      u.grainFrequency.value = scale.grainFrequency;
    },
    dispose: () => { all.forEach((m) => { m.dispose(); }); },
  };
}
