import type { ObjectRecipe } from "../object";
import { quad, rect } from "../lattice";
import { createRng } from "../prng";
import { attach, edgeOf, mount, part, seam } from "../plan";
import { FANS, fanPart } from "./fan";

type Slope = Readonly<{ run: number; length: number; angle: number }>;
const STEEP: Slope = { run: 9, length: 15, angle: 52.5 };
const GENTLE: Slope = { run: 16, length: 20, angle: 37.5 };
const DROP = 12;

export function vehicleRecipe(seed: number): ObjectRecipe {
  const rng = createRng(seed, 2);
  const width = rng.pick([20, 24]);
  const belt = rng.pick([12, 14, 16]);
  const trunk = rng.pick([6, 8]);
  const hood = rng.pick([10, 14]);
  const roof = rng.pick([12, 16, 20]);
  const wind = rng.pick([STEEP, GENTLE]);
  const rear = rng.pick([STEEP, GENTLE]);
  const base = wind.run + roof + rear.run;
  const roomy = [FANS.hexagon, FANS.pentagon, FANS.octagon].filter((kind) => base >= 2 * Math.round(Math.sqrt(kind.radiusSquared)) + 2);
  const wheel = rng.pick(roomy.length > 0 ? roomy : [FANS.hexagon]);
  const radius = Math.round(Math.sqrt(wheel.radiusSquared));
  const twist = rng.pick([0, 15, 30, 45]);
  const sideRight = part("sideR", quad(base, roof, rear.run, DROP), [
    attach("mid", "root", 0, rect(base, belt), 2, "J", 0),
    attach("rear", "mid", 3, rect(trunk, belt), 1, "J", 0),
    attach("front", "mid", 1, rect(hood, belt), 3, "J", 0),
  ]);
  const sideLeft = part("sideL", quad(base, roof, wind.run, DROP), [
    attach("mid", "root", 0, rect(base, belt), 2, "J", 0),
    attach("front", "mid", 3, rect(hood, belt), 1, "J", 0),
    attach("rear", "mid", 1, rect(trunk, belt), 3, "J", 0),
  ]);
  const band = part("band", rect(roof, width), [
    attach("windshield", "root", 1, rect(wind.length, width), 3, "M", -wind.angle),
    attach("hood", "windshield", 1, rect(hood, width), 3, "V", wind.angle),
    attach("front", "hood", 1, rect(belt, width), 3, "M", -90),
    attach("rearWindow", "root", 3, rect(rear.length, width), 1, "M", -rear.angle),
    attach("trunk", "rearWindow", 3, rect(trunk, width), 1, "V", rear.angle),
    attach("back", "trunk", 3, rect(belt, width), 1, "M", -90),
  ]);
  const wheels = ["wheelRR", "wheelRF", "wheelLR", "wheelLF"] as const;
  const inset = Math.max(2, Math.min(radius + 1, Math.floor((base - 2 * radius - 2) / 2)));
  const place = (side: "sideR" | "sideL", end: "rear" | "front", child: (typeof wheels)[number]) =>
    mount({ part: side, panel: "mid" }, child, {
      at: [(side === "sideR") === (end === "rear") ? inset : base - inset, radius],
      turn: twist,
      lift: 1,
      anchor: 2,
      side: 1,
    });
  return {
    name: "vehicle",
    seed,
    parts: [band, sideRight, sideLeft, ...wheels.map((name) => fanPart(name, wheel))],
    connections: [
      seam(edgeOf("band", "root", 0), edgeOf("sideR", "root", 2), -90),
      seam(edgeOf("band", "root", 2), edgeOf("sideL", "root", 2), -90),
      place("sideR", "rear", "wheelRR"),
      place("sideR", "front", "wheelRF"),
      place("sideL", "rear", "wheelLR"),
      place("sideL", "front", "wheelLF"),
    ],
  };
}
