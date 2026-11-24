import type { Bounds, LeafBatch, ViewPreset } from "../viewModel";
import { corridorPanels, debris, dust, houses, makeCorridor, skyline, towers, tree, type AssemblyLeaves, type PlacedFoldon } from "./district";
import { createRandom } from "./random";
import { ridgeBatch } from "./ridges";
import { cloudBatch, skyBatch } from "./sky";
import { compositionView, frameOf } from "./view";

export type Composition = Readonly<{
  foldons: readonly PlacedFoldon[];
  panels: readonly LeafBatch[];
  view: ViewPreset;
  bounds: Bounds;
}>;

const STREAM = { corridor: 1, towers: 2, houses: 3, debris: 4, tree: 5, skyline: 6, dust: 7, sky: 8, clouds: 9, ridges: 10 } as const;

export function composeReferenceScene(seed: number, leaves: AssemblyLeaves): Composition {
  const rng = (stream: number) => createRandom(seed, stream);
  const frame = frameOf(compositionView);
  const corridor = makeCorridor(rng(STREAM.corridor));
  const foldons: readonly PlacedFoldon[] = [
    ...corridorPanels(corridor),
    ...towers(rng(STREAM.towers), leaves),
    ...houses(rng(STREAM.houses), corridor, leaves),
    ...debris(rng(STREAM.debris), leaves),
    ...tree(rng(STREAM.tree)),
    ...skyline(rng(STREAM.skyline)),
    ...dust(rng(STREAM.dust)),
  ];
  return {
    foldons,
    panels: [
      skyBatch(frame, rng(STREAM.sky)),
      cloudBatch(frame, rng(STREAM.clouds)),
      ridgeBatch(frame, rng(STREAM.ridges)),
    ],
    view: compositionView,
    bounds: { min: [-110, 0, -200], max: [110, 70, 70] },
  };
}
