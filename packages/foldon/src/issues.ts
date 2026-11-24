export type ValidationCode =
  | "id-invalid"
  | "version-invalid"
  | "weight-invalid"
  | "rotations-empty"
  | "rotations-invalid"
  | "rotations-duplicate"
  | "footprint-empty"
  | "footprint-cell-invalid"
  | "footprint-duplicate-cell"
  | "vertex-not-finite"
  | "vertex-outside-footprint"
  | "panel-duplicate-id"
  | "panel-too-small"
  | "panel-degenerate"
  | "panel-not-planar"
  | "panel-not-convex"
  | "root-unknown"
  | "crease-duplicate-id"
  | "crease-unknown-panel"
  | "crease-edge-invalid"
  | "crease-edge-mismatch"
  | "crease-angle-mismatch"
  | "crease-assignment-mismatch"
  | "crease-range-invalid"
  | "crease-stiffness-invalid"
  | "crease-cycle"
  | "panel-disconnected"
  | "socket-duplicate"
  | "socket-missing"
  | "socket-unexpected"
  | "socket-geometry-mismatch"
  | "socket-tolerance-invalid"
  | "component-unknown-crease"
  | "component-invalid"
  | "duplicate-definition"
  | "level-invalid"
  | "recipe-empty"
  | "part-duplicate-id"
  | "part-invalid"
  | "part-rotation-not-allowed"
  | "ref-unknown"
  | "ref-version-unknown"
  | "assembly-cycle"
  | "level-not-above-children"
  | "depth-exceeded"
  | "part-overlap"
  | "socket-incompatible"
  | "duplicate-recipe"
  | "contract-invalid"
  | "contract-unknown"
  | "contract-footprint-mismatch"
  | "contract-boundary-incompatible";

export type ValidationIssue = Readonly<{
  code: ValidationCode;
  path: string;
  message: string;
}>;

export function issue(code: ValidationCode, path: string, message: string): ValidationIssue {
  return { code, path, message };
}
