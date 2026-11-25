import type { Vec3 } from "@eschaton/foldon";
import type { ViewPreset } from "../viewModel";
import { add, cross, normalize, scaleVec, sub } from "./affine";

export const COMPOSITION_ASPECT = 1.2;

export const compositionView: ViewPreset = {
  position: [20, 36, 110],
  target: [6, 20, -80],
  fov: 36,
};

export type Frame = Readonly<{ position: Vec3; forward: Vec3; right: Vec3; up: Vec3; halfHeight: number }>;

export function frameOf(view: ViewPreset): Frame {
  const forward = normalize(sub(view.target, view.position));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  return { position: view.position, forward, right, up, halfHeight: Math.tan((view.fov * Math.PI) / 360) };
}

export function pointAtNdc(frame: Frame, ndcX: number, ndcY: number, planeZ: number): Vec3 {
  const direction = add(
    add(frame.forward, scaleVec(frame.right, ndcX * frame.halfHeight * COMPOSITION_ASPECT)),
    scaleVec(frame.up, ndcY * frame.halfHeight),
  );
  const t = (planeZ - frame.position[2]) / direction[2];
  return add(frame.position, scaleVec(direction, t));
}

export const worldPerNdcY = (frame: Frame, planeZ: number): number =>
  Math.abs((planeZ - frame.position[2]) / frame.forward[2]) * frame.halfHeight;
