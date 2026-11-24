export { err, ok, type Result } from "./result";
export {
  assemblyId,
  creaseId,
  foldonId,
  materialId,
  panelId,
  placementId,
  socketId,
  type AssemblyId,
  type CreaseId,
  type FoldonId,
  type MaterialId,
  type PanelId,
  type PlacementId,
  type SocketId,
} from "./ids";
export { type Cell, type Vec3 } from "./vec";
export { type ValidationCode, type ValidationIssue } from "./issues";
export {
  foldProgress,
  foldedNet,
  makePanel,
  poseGeometry,
  type CreaseAngles,
  type CreaseAssignment,
  type CreaseDefinition,
  type GeometryRecipe,
  type HingeSpec,
  type NetInput,
  type Panel,
  type PoseError,
  type PosedCrease,
  type PosedGeometry,
  type PosedPanel,
} from "./geometry";
export {
  allRotations,
  decayable,
  faceSockets,
  foldable,
  rectangularFootprint,
  renderable,
  socketProfiles,
  socketsCompatible,
  structural,
  thermal,
  windResponsive,
  type ComponentSpec,
  type Face,
  type FaceProfiles,
  type FoldonDefinition,
  type FoldonInput,
  type Rotation,
  type SocketDefinition,
  type SocketProfile,
  type SocketRole,
} from "./definition";
export { defineFoldon } from "./define";
export { validateFoldon } from "./validate";
export {
  composePose,
  identityPose,
  placeFootprint,
  placeGeometry,
  placeSockets,
  type Placement,
  type Pose,
} from "./transform";
export { getPrimitive, primitiveCatalog } from "./catalog";
export {
  recipeHash,
  type AssemblyDefinition,
  type AssemblyLevel,
  type AssemblyPart,
  type AssemblyRecipe,
  type PartRef,
} from "./assembly";
export { MAX_ASSEMBLY_DEPTH, createCatalog, type Catalog, type CatalogInput, type FlatInstance } from "./registry";
export { assemblyCatalog, defaultCatalog } from "./assemblies";
