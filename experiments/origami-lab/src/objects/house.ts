import type { ObjectRecipe } from "../object";
import { quad, rect, tri } from "../lattice";
import { createRng } from "../prng";
import { attach, edgeOf, mount, part, seam, snap } from "../plan";

/** Half base and height of an isosceles gable whose slanted edge is an integer length (Pythagorean). */
const GABLES: readonly (readonly [number, number])[] = [
  [6, 8],
  [8, 6],
  [9, 12],
  [12, 9],
  [5, 12],
  [12, 5],
];

export function houseRecipe(seed: number): ObjectRecipe {
  const rng = createRng(seed, 3);
  const [half, rise] = rng.pick(GABLES);
  const slant = Math.round(Math.hypot(half, rise));
  const slope = snap((Math.atan2(rise, half) * 180) / Math.PI, 7.5);
  const width = 2 * half;
  const depth = rng.pick([24, 32]);
  const wall = rng.pick([14, 18]);
  const eave = rng.pick([4, 6]);
  const droop = rng.pick([-15, -22.5, -30]);
  const chimneyRidge = rng.pick([4, 6]);
  const chimneySlope = 2;
  const chimneyHeight = rng.pick([8, 10, 12]);
  const spot: readonly [number, number] = [Math.floor(slant / 2), Math.floor(depth / 3)];
  const gable = tri(width, half, rise);
  const walls = part("walls", rect(width, depth), [
    attach("front", "root", 0, rect(width, wall), 2, "V", 90),
    attach("back", "root", 2, rect(width, wall), 0, "V", 90),
    attach("left", "root", 3, rect(wall, depth), 1, "V", 90),
    attach("right", "root", 1, rect(wall, depth), 3, "V", 90),
    attach("gableF", "front", 0, gable, 0, "J", 0),
    attach("gableB", "back", 2, gable, 0, "J", 0),
  ]);
  const roof = part("roof", rect(slant, depth), [
    attach("ridge", "root", 3, rect(slant, depth), 1, "V", 2 * slope),
    attach("overhang", "ridge", 3, quad(depth, depth - 2 * eave, eave, 4), 0, "M", droop),
  ]);
  const box = part("chimney", rect(chimneyRidge, chimneySlope), [
    attach("n", "root", 0, rect(chimneyRidge, chimneyHeight), 2, "V", 90),
    attach("e", "root", 1, rect(chimneyHeight, chimneySlope), 3, "V", 90),
    attach("s", "root", 2, rect(chimneyRidge, chimneyHeight), 0, "V", 90),
    attach("w", "root", 3, rect(chimneyHeight, chimneySlope), 1, "V", 90),
  ]);
  return {
    name: "house",
    seed,
    parts: [walls, roof, box],
    connections: [
      seam(edgeOf("walls", "left", 3), edgeOf("roof", "root", 1), 90 - slope),
      seam(edgeOf("walls", "gableF", 2), edgeOf("roof", "root", 0), 0, { closing: true }),
      seam(edgeOf("walls", "gableB", 1), edgeOf("roof", "root", 2), 0, { closing: true }),
      mount({ part: "roof", panel: "root" }, "chimney", { at: spot, turn: 90, tilt: -slope, lift: 2, side: -1 }),
    ],
  };
}
