import type { SocketProfile } from "@eschaton/foldon";

export const palette = {
  paper: "#E8D8B5",
  palePaper: "#F2E5C9",
  ink: "#222321",
  charcoal: "#454440",
  ash: "#858078",
  vermilion: "#A84335",
} as const;

export const socketProfileColor: Readonly<Record<SocketProfile, string>> = {
  ground: "#1b1b1a",
  base: "#2d2c2a",
  deck: "#3f3e3a",
  wall: "#55524c",
  beam: "#6b675f",
  eave: "#817c72",
  open: "#9a9488",
  empty: "#b2ab9c",
};
