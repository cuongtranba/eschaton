import {
  lookLimits,
  palettePresetLabels,
  palettePresets,
  type LookSettings,
  type PalettePreset,
} from "../lab/look";
import type { LabCommand } from "../lab/state";

type LookPanelProps = Readonly<{ look: LookSettings; dispatch: (command: LabCommand) => void }>;

type SliderKey = "hatching" | "haze" | "sunElevation" | "sunAzimuth";
type ToggleKey = "quantize" | "grain" | "outlines" | "compare";

const sliders: readonly (readonly [SliderKey, string])[] = [
  ["hatching", "Hatching strength"],
  ["haze", "Haze"],
  ["sunElevation", "Sun elevation"],
  ["sunAzimuth", "Sun azimuth"],
];

const toggles: readonly (readonly [ToggleKey, string])[] = [
  ["quantize", "Quantized light"],
  ["grain", "Paper grain"],
  ["outlines", "Ink outlines"],
  ["compare", "Compare: flat | ink"],
];

const isPalettePreset = (value: string): value is PalettePreset => palettePresets.some((preset) => preset === value);

export function LookPanel({ look, dispatch }: LookPanelProps) {
  const inkOff = look.palette === "flat";
  return (
    <section aria-label="Look" className="look" data-testid="look-panel">
      <h2>Look</h2>
      <label className="look__row">
        <span>Palette</span>
        <select
          aria-label="Palette preset"
          value={look.palette}
          onChange={(event) => {
            if (isPalettePreset(event.target.value)) dispatch({ type: "setLook", patch: { palette: event.target.value } });
          }}
        >
          {palettePresets.map((preset) => (
            <option key={preset} value={preset}>
              {palettePresetLabels[preset]}
            </option>
          ))}
        </select>
      </label>
      {sliders.map(([key, label]) => (
        <label key={key} className="look__row">
          <span>{label}</span>
          <input
            type="range"
            aria-label={label}
            data-testid={`look-${key}`}
            disabled={inkOff && (key === "hatching" || key === "haze")}
            {...lookLimits[key]}
            value={look[key]}
            onChange={(event) => { dispatch({ type: "setLook", patch: { [key]: Number(event.target.value) } }); }}
          />
          <output>{Math.round(look[key] * (key === "hatching" || key === "haze" ? 100 : 1))}{key.startsWith("sun") ? "°" : "%"}</output>
        </label>
      ))}
      <div className="look__toggles">
        {toggles.map(([key, label]) => (
          <label key={key} className="look__check">
            <input
              type="checkbox"
              checked={look[key]}
              disabled={inkOff && key !== "compare"}
              onChange={(event) => { dispatch({ type: "setLook", patch: { [key]: event.target.checked } }); }}
            />
            {label}
          </label>
        ))}
      </div>
    </section>
  );
}
