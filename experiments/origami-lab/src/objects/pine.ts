import type { ObjectRecipe } from "../object";
import { rect, tri } from "../lattice";
import { createRng } from "../prng";
import { attach, mount, part } from "../plan";
import { FANS, fanPart, type FanKind } from "./fan";

const apexOf = (kind: FanKind): readonly [number, number] => {
  const first = kind.triangles[0];
  if (first?.family !== "tri") throw new Error("fan needs a leading triangle");
  return [first.spec.offset, first.spec.height];
};

export function pineRecipe(seed: number): ObjectRecipe {
  const rng = createRng(seed, 4);
  const trunkHeight = rng.pick([16, 20, 24]);
  const tiers: readonly FanKind[] =
    rng.pick([3, 4]) === 4 ? [FANS.octagon, FANS.pentagon, FANS.hexagon, FANS.small] : [FANS.octagon, rng.pick([FANS.pentagon, FANS.hexagon]), FANS.small];
  const skirt = { height: rng.pick([8, 10, 12]), angle: rng.pick([30, 37.5, 45]) };
  const lift = rng.pick([5, 6, 7]);
  const floor = tri(6, 3, 4);
  const trunk = part("trunk", floor, [
    attach("a", "root", 0, rect(6, trunkHeight), 2, "V", 90),
    attach("b", "root", 1, rect(5, trunkHeight), 2, "V", 90),
    attach("c", "root", 2, rect(5, trunkHeight), 2, "V", 90),
    attach("cap", "a", 0, floor, 0, "V", 90),
  ]);
  return {
    name: "pine",
    seed,
    parts: [trunk, ...tiers.map((kind, i) => fanPart(`tier${i}`, kind, skirt))],
    connections: [
      mount({ part: "trunk", panel: "cap" }, "tier0", { at: [3, 1], turn: rng.pick([0, 15, 30]), lift: 1, anchor: 2, side: -1 }),
      ...tiers.slice(0, -1).map((kind, i) =>
        mount({ part: `tier${i}`, panel: "t0" }, `tier${i + 1}`, { at: apexOf(kind), turn: rng.pick([0, 15, 30, 45, 60]), lift, anchor: 2, side: 1 }),
      ),
    ],
  };
}
