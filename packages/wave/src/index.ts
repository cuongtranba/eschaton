export { compileTiles, type CompiledTiles, type TileRef, type TileSpec } from "./solver/compile";
export {
  createSolve,
  solve,
  type BoundaryFace,
  type WaveOutcome,
  type WavePlacement,
  type WaveProblem,
  type WaveProgress,
  type WaveSolve,
  type WaveStats,
} from "./solver/solve";
export { prepareRegion, proposalOf, type RegionJob, type RegionRequest } from "./region";
export { createWaveHost, type HostOptions, type HostRequest, type HostResponse, type JobOutcome, type WaveHost } from "./host";
export { goldenDigest, goldenPresetDigest, placementDigest } from "./golden";
