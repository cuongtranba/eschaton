export { err, ok, type Result } from "./result";
export { canonicalJson, fnv1a64 } from "./hash";
export {
  assemblyId,
  contractId,
  creaseId,
  foldonId,
  materialId,
  panelId,
  placementId,
  socketId,
  type AssemblyId,
  type ContractId,
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
  structural,
  thermal,
  turnOf,
  windResponsive,
  type ComponentSpec,
  type Face,
  type FaceProfiles,
  type FaceSocketSpec,
  type FoldonDefinition,
  type FoldonInput,
  type Hand,
  type Rotation,
  type SocketDefinition,
  type SocketProfile,
  type SocketRole,
  type Turn,
} from "./definition";
export {
  defaultSocketTable,
  socketMismatches,
  socketsCompatible,
  validateSocketTable,
  type MateSpec,
  type ProfileSpec,
  type SocketMismatch,
  type SocketTable,
} from "./sockets";
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
export { type ContractRef, type ModuleContract, type ModuleSpan } from "./contract";
export { createCatalog, type Catalog, type CatalogInput, type FlatInstance } from "./registry";
export { assemblyCatalog, defaultCatalog, moduleContracts } from "./assemblies";
export { presetCatalog, presetFoldons } from "./presets";
