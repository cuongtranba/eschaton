import type { ObjectRecipe } from "../object";
import { quad, tri } from "../lattice";
import { createRng } from "../prng";
import { attach, edgeOf, part, seam } from "../plan";

type Body = readonly [spine: number, offset: number, height: number];

/** Keel triangles obtuse at the apex and scalene; the short front flank is an integer length so the neck can be a quad. */
const BODIES: readonly Body[] = [
  [30, 24, 8],
  [32, 26, 8],
  [28, 22, 8],
  [32, 24, 6],
  [34, 29, 12],
  [36, 31, 12],
];

export function birdRecipe(seed: number): ObjectRecipe {
  const rng = createRng(seed, 1);
  const [spine, offset, height] = rng.pick(BODIES);
  const flank = Math.round(Math.hypot(spine - offset, height));
  const keel = rng.pick([15, 22.5, 30]);
  const neckTop = rng.pick([4, 6]);
  const neckHeight = rng.pick([20, 24, 28]);
  const neckUp = rng.pick([67.5, 75, 82.5]);
  const headHeight = rng.pick([6, 8, 10]);
  const beak = rng.pick([-45, -60, -75]);
  const wingTop = rng.pick([6, 8, 10]);
  const wingHeight = rng.pick([10, 12, 14]);
  const wingUp = rng.pick([30, 37.5, 45]);
  const elbow = rng.pick([30, 37.5, 45]);
  const tailHeight = rng.pick([14, 18, 22]);
  const tailDown = rng.pick([-15, -22.5, -30]);
  const flap = { lo: 0, hi: 75 };
  const [near, far] = [height, offset];
  const outer = quad(far, wingTop, Math.floor((far - wingTop) / 2), wingHeight);
  const tail = tri(near, near / 2, tailHeight);
  return {
    name: "bird",
    seed,
    parts: [
      part("body", tri(spine, offset, height), [attach("B2", "B1", 0, tri(spine, spine - offset, height), 0, "V", keel)], "B1"),
      part("neck", quad(flank, neckTop, Math.floor((flank - neckTop) / 2), neckHeight), [
        attach("head", "root", 2, tri(neckTop, neckTop / 2, headHeight), 0, "M", beak),
      ]),
      part("wingL", tri(near, 0, far), [attach("outer", "root", 2, outer, 0, "V", elbow, flap)]),
      part("wingR", tri(near, near, far), [attach("outer", "root", 1, outer, 0, "V", elbow, flap)]),
      part("tailL", tail),
      part("tailR", tail),
    ],
    connections: [
      seam(edgeOf("body", "B1", 1), edgeOf("neck", "root", 0), neckUp),
      seam(edgeOf("body", "B1", 2), edgeOf("wingL", "root", 1), wingUp),
      seam(edgeOf("body", "B2", 1), edgeOf("wingR", "root", 2), wingUp),
      seam(edgeOf("wingL", "root", 0), edgeOf("tailL", "root", 0), tailDown),
      seam(edgeOf("wingR", "root", 0), edgeOf("tailR", "root", 0), tailDown),
    ],
  };
}
