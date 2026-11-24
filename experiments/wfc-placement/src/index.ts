export { solvePlacement } from "./placement-solver.ts";
export { solveOffsetState } from "./offset-solver.ts";
export { hashGrid, verifySolution } from "./verify.ts";
export { constrainedTileSet, createConstrainedProblem, createDemoProblem, demoTileSet } from "./tiles.ts";
export { DEFAULT_MAX_BACKTRACKS, DEFAULT_MAX_NODES, EMPTY_TILE } from "./types.ts";
export type {
  CellState,
  Faces,
  Grid,
  Offset,
  Pin,
  Problem,
  Rotation,
  SolveOptions,
  SolveResult,
  SolveStats,
  Socket,
  TileCell,
  TileDef,
  TileSet,
  TraceEvent,
  Verification,
  Violation,
} from "./types.ts";
