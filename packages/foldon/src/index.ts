export { err, ok, type Result } from "./result";
export {
  creaseId,
  foldonId,
  materialId,
  panelId,
  placementId,
  socketId,
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
export { placeFootprint, placeGeometry, placeSockets, type Placement } from "./transform";
export { getPrimitive, primitiveCatalog } from "./catalog";
