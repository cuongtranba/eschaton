import { placeGeometry, panelId, type Pose, type PosedGeometry, type Vec3 } from "@eschaton/foldon";
import type { Basis } from "./viewModel";

const probe: PosedGeometry = {
  panels: [
    {
      id: panelId("probe"),
      vertices: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      normal: [0, 1, 0],
    },
  ],
  creases: [],
};

export const unitBasis: Basis = { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

export function basisOf(pose: Pose): Basis {
  const placed = placeGeometry(probe, pose).panels[0]?.vertices;
  const [origin, x, y, z] = placed ?? [];
  if (origin === undefined || x === undefined || y === undefined || z === undefined) return unitBasis;
  const axis = (end: Vec3): Vec3 => [end[0] - origin[0], end[1] - origin[1], end[2] - origin[2]];
  return { origin, x: axis(x), y: axis(y), z: axis(z) };
}
