import { err, ok, type Result } from "@eschaton/foldon";

/** FOLD-aligned vocabulary: M mountain, V valley, F flat crease, J join, B boundary, S seam. */
export type EdgeKind = "M" | "V" | "F" | "J" | "B" | "S";

/** `winding` is the loop sense of the owning panel seen from the sheet's reference side. */
export type EdgeDescriptor = Readonly<{
  squaredLength: number;
  kind: EdgeKind;
  winding: "ccw" | "cw";
}>;

export type IncompatibleReason = "length-mismatch" | "orientation" | "kind-mismatch";
export type Incompatibility = Readonly<{ code: IncompatibleReason; message: string }>;

const free = (kind: EdgeKind): boolean => kind === "B" || kind === "S";

/**
 * Two edges glue iff their exact integer squared lengths match, both are still free (boundary or seam) and both loops
 * run the same way round their panels, which makes the shared edge be traversed in opposite directions.
 */
export function compatible(a: EdgeDescriptor, b: EdgeDescriptor): Result<true, Incompatibility> {
  if (a.squaredLength !== b.squaredLength) {
    return err({ code: "length-mismatch", message: `squared lengths ${a.squaredLength} and ${b.squaredLength} differ` });
  }
  if (a.winding !== b.winding) {
    return err({ code: "orientation", message: "panel loops run opposite ways: the edges would be traversed in the same direction" });
  }
  if (!free(a.kind) || !free(b.kind)) {
    return err({ code: "kind-mismatch", message: `edge kinds ${a.kind} and ${b.kind} cannot be glued: only boundary or seam edges are free` });
  }
  return ok(true);
}

export const EDGE_COLORS: Readonly<Record<EdgeKind, string>> = {
  M: "#ff0000",
  V: "#0000ff",
  F: "#808080",
  J: "#ffd400",
  B: "#000000",
  S: "#00a000",
};
