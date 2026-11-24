import type { Vec3 } from "@eschaton/foldon";

export const palettePresets = ["last-world", "flat"] as const;
export type PalettePreset = (typeof palettePresets)[number];

export const palettePresetLabels: Readonly<Record<PalettePreset, string>> = {
  "last-world": "Last World",
  flat: "Flat (no ink)",
};

export type LookSettings = Readonly<{
  palette: PalettePreset;
  quantize: boolean;
  hatching: number;
  haze: number;
  sunElevation: number;
  sunAzimuth: number;
  grain: boolean;
  outlines: boolean;
  compare: boolean;
}>;

export const defaultLook: LookSettings = {
  palette: "last-world",
  quantize: true,
  hatching: 0.85,
  haze: 0.6,
  sunElevation: 42,
  sunAzimuth: 140,
  grain: true,
  outlines: true,
  compare: false,
};

export const lookLimits = {
  hatching: { min: 0, max: 1, step: 0.01 },
  haze: { min: 0, max: 1, step: 0.01 },
  sunElevation: { min: 5, max: 85, step: 1 },
  sunAzimuth: { min: -180, max: 180, step: 1 },
} as const;

export type ResolvedLook = Readonly<{
  ink: boolean;
  quantize: boolean;
  hatching: number;
  haze: number;
  grain: boolean;
  outlines: boolean;
  sun: Vec3;
}>;

const clamp = (value: number, low: number, high: number): number =>
  Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : low;

export function sunDirection(elevationDegrees: number, azimuthDegrees: number): Vec3 {
  const elevation = (clamp(elevationDegrees, lookLimits.sunElevation.min, lookLimits.sunElevation.max) * Math.PI) / 180;
  const azimuth = (azimuthDegrees * Math.PI) / 180;
  return [Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)];
}

export function mergeLook(look: LookSettings, patch: Partial<LookSettings>): LookSettings {
  const merged = { ...look, ...patch };
  return {
    ...merged,
    hatching: clamp(merged.hatching, lookLimits.hatching.min, lookLimits.hatching.max),
    haze: clamp(merged.haze, lookLimits.haze.min, lookLimits.haze.max),
    sunElevation: clamp(merged.sunElevation, lookLimits.sunElevation.min, lookLimits.sunElevation.max),
    sunAzimuth: clamp(merged.sunAzimuth, lookLimits.sunAzimuth.min, lookLimits.sunAzimuth.max),
  };
}

export function resolveLook(look: LookSettings): ResolvedLook {
  const sun = sunDirection(look.sunElevation, look.sunAzimuth);
  if (look.palette === "flat") {
    return { ink: false, quantize: false, hatching: 0, haze: 0, grain: false, outlines: false, sun };
  }
  return {
    ink: true,
    quantize: look.quantize,
    hatching: look.hatching,
    haze: look.haze,
    grain: look.grain,
    outlines: look.outlines,
    sun,
  };
}

export const flatLook = (look: LookSettings): ResolvedLook => resolveLook({ ...look, palette: "flat" });
