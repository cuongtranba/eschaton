import { neighbourItem, type ItemRef } from "./library";
import type { LabCommand, LabState } from "./state";

export type ShortcutDescription = Readonly<{ key: string; description: string }>;

export const shortcutDescriptions: readonly ShortcutDescription[] = [
  { key: "F", description: "Play / stop fold animation" },
  { key: "G", description: "Toggle grid" },
  { key: "S", description: "Toggle sockets" },
  { key: "C", description: "Toggle crease axes" },
  { key: "O", description: "Switch orbit / composition camera" },
  { key: "[", description: "Previous catalog item" },
  { key: "]", description: "Next catalog item" },
  { key: "Tab", description: "Move between controls" },
];

export function shortcutCommand(key: string, state: LabState, items: readonly ItemRef[]): LabCommand | undefined {
  switch (key) {
    case "f":
    case "F":
      return { type: "togglePlay" };
    case "g":
    case "G":
      return { type: "toggleOverlay", overlay: "grid" };
    case "s":
    case "S":
      return { type: "toggleOverlay", overlay: "sockets" };
    case "c":
    case "C":
      return { type: "toggleOverlay", overlay: "creases" };
    case "o":
    case "O":
      return { type: "setCameraMode", mode: state.cameraMode === "orbit" ? "composition" : "orbit" };
    case "[":
      return { type: "selectItem", item: neighbourItem(items, state.selected, -1) };
    case "]":
      return { type: "selectItem", item: neighbourItem(items, state.selected, 1) };
    default:
      return undefined;
  }
}
