import type { PartPlan } from "../object";
import { tri, type Shape } from "../lattice";
import { attach, part } from "../plan";

/** Isosceles triangles sharing one apex and one leg length; they close a 360 degree fan exactly or leave a small gap. */
export type FanKind = Readonly<{ id: string; radiusSquared: number; triangles: readonly Shape[] }>;

const isosceles = (base: number, height: number): Shape => tri(base, base / 2, height);

const fat = isosceles(10, 10);
const skinny = isosceles(4, 11);

export const FANS: Readonly<Record<"octagon" | "hexagon" | "pentagon" | "small", FanKind>> = {
  octagon: { id: "fan8-r125", radiusSquared: 125, triangles: [fat, fat, fat, skinny, fat, fat, fat, skinny] },
  hexagon: { id: "fan6-r65", radiusSquared: 65, triangles: Array.from({ length: 6 }, () => isosceles(8, 7)) },
  pentagon: { id: "fan5-r74", radiusSquared: 74, triangles: Array.from({ length: 5 }, () => isosceles(10, 7)) },
  small: { id: "fan8-r29", radiusSquared: 29, triangles: Array.from({ length: 8 }, () => isosceles(4, 5)) },
};

export function fanPart(name: string, kind: FanKind, skirt?: Readonly<{ height: number; angle: number }>): PartPlan {
  const [first, ...rest] = kind.triangles;
  if (first === undefined) throw new Error("fan needs at least one triangle");
  const spokes = rest.map((shape, i) => attach(`t${i + 1}`, `t${i}`, 2, shape, 1, "J", 0));
  const skirts =
    skirt === undefined
      ? []
      : kind.triangles.flatMap((shape, i) =>
          shape.family === "tri" ? [attach(`s${i}`, `t${i}`, 0, isosceles(shape.spec.base, skirt.height), 0, "M", -skirt.angle)] : [],
        );
  return part(name, first, [...spokes, ...skirts], "t0");
}
