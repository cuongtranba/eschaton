export { createRng, type Rng } from "./prng";
export {
  MAX_ASPECT,
  MAX_UNITS,
  MIN_ANGLE_DEG,
  Q,
  classifyTriangle,
  quad,
  quadVertices,
  rect,
  shapeClass,
  shapeEdges,
  shapeFingerprint,
  shapeVertices,
  squaredSides,
  tri,
  triangleFromSides,
  triangleTraits,
  triangleVertices,
  validateQuad,
  validateShape,
  validateTriangle,
  variantId,
  type Pt,
  type QuadSpec,
  type Shape,
  type ShapeError,
  type ShapeErrorCode,
  type TriangleClass,
  type TriangleSpec,
  type TriangleTraits,
} from "./lattice";
export { EDGE_COLORS, compatible, type EdgeDescriptor, type EdgeKind, type Incompatibility, type IncompatibleReason } from "./edges";
export {
  ANGLE_STEP,
  buildSheet,
  type Articulation,
  type Attach,
  type CreaseKind,
  type Sheet,
  type SheetCrease,
  type SheetError,
  type SheetPanel,
  type SheetPlan,
} from "./sheet";
export {
  buildObject,
  objectFingerprint,
  type Component,
  type Connection,
  type EdgeRef,
  type LabObject,
  type Mount,
  type MountPlacement,
  type ObjectError,
  type ObjectRecipe,
  type PanelRef,
  type PartPlan,
  type Seam,
} from "./object";
export { poseObject, type PosedEdge, type PosedObject, type PosedPanel } from "./pose";
export {
  SAMPLE_TIMES,
  foldedOverlaps,
  invalidPanels,
  posedOverlaps,
  reuseReport,
  seamChecks,
  type Overlap,
  type ReuseReport,
  type SeamCheck,
} from "./checks";
export { objectInspection, type CreaseInfo, type FoldonInfo, type ObjectInspection, type PanelInfo } from "./inspect";
export { generate, objectNames, recipeFor, type GenerateError, type ObjectName } from "./generate";
export { BIRD_BOUNDS, BIRD_LENGTH_CELLS, BIRD_VERSION, CROW, birdDesign, birdParams, quantizeBird, type BirdParams } from "./v2/bird";
export { createBuilder, type ArticulatedEdge, type Articulation as JointArticulation, type Builder, type Design, type DesignFace, type Facing, type ModuleJoint } from "./v2/design";
export {
  compileDesign,
  edgeKey,
  poseCompiled,
  posePieces,
  seamGap,
  type CompileError,
  type Compiled,
  type CompiledEdge,
  type EdgeRole,
  type Link,
  type Piece,
  type Pose,
  type PosedFace,
} from "./v2/compile";
export { panelContact, panelDistance, panelQuality, type Contact, type PanelQuality } from "./v2/geom";
export { LIMITS, geo1Verdict, posedContacts, verifyCompiled, type PosedPanelLike, type Collision, type GeoReport, type PairStatus, type PanelIssue, type SweepReport, type Verdict } from "./v2/verify";
export { birdMetrics, iou, silhouette, type BirdMetrics, type Silhouette } from "./v2/metrics";
