import { useEffect, useState } from "react";
import { overlayNames, type LabCommand, type LabState, type OverlayName } from "../lab/state";
import { HelpPopover } from "./HelpPopover";

type ToolbarProps = Readonly<{ state: LabState; dispatch: (command: LabCommand) => void }>;

const overlayLabels: Readonly<Record<OverlayName, string>> = {
  grid: "Grid (G)",
  footprint: "Footprint",
  sockets: "Sockets (S)",
  creases: "Crease axes (C)",
  edges: "Panel edges",
  scatter: "Scatter",
};

function SeedControl({ seed, dispatch }: Readonly<{ seed: number; dispatch: (command: LabCommand) => void }>) {
  const [draft, setDraft] = useState(String(seed));
  useEffect(() => { setDraft(String(seed)); }, [seed]);
  const commit = (): void => {
    const parsed = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(parsed)) setDraft(String(seed));
    else dispatch({ type: "setSeed", seed: parsed });
  };
  return (
    <div className="toolbar__group" role="group" aria-label="Seed">
      <label>
        Seed
        <input
          type="text"
          inputMode="numeric"
          aria-label="Seed"
          data-testid="seed-input"
          value={draft}
          onChange={(event) => { setDraft(event.target.value); }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
        />
      </label>
      <button type="button" onClick={() => { dispatch({ type: "rerollSeed" }); }}>
        Reroll
      </button>
    </div>
  );
}

export function Toolbar({ state, dispatch }: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Laboratory controls">
      <div className="toolbar__group" role="group" aria-label="Fold">
        <label>
          Fold
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            aria-label="Fold progress"
            data-testid="fold-slider"
            value={state.foldProgress}
            onChange={(event) => { dispatch({ type: "setFoldProgress", progress: Number(event.target.value) }); }}
          />
        </label>
        <output className="toolbar__value" aria-label="Fold percentage">
          {Math.round(state.foldProgress * 100)}%
        </output>
        <button type="button" aria-pressed={state.playing} onClick={() => { dispatch({ type: "togglePlay" }); }}>
          {state.playing ? "Stop fold (F)" : "Play fold (F)"}
        </button>
      </div>
      <div className="toolbar__group" role="group" aria-label="Overlays">
        {overlayNames.map((overlay) => (
          <label key={overlay} className="toolbar__check">
            <input
              type="checkbox"
              checked={state.overlays[overlay]}
              onChange={() => { dispatch({ type: "toggleOverlay", overlay }); }}
            />
            {overlayLabels[overlay]}
          </label>
        ))}
      </div>
      <div className="toolbar__group" role="group" aria-label="Camera">
        <button
          type="button"
          aria-pressed={state.cameraMode === "composition"}
          onClick={() => { dispatch({ type: "setCameraMode", mode: state.cameraMode === "orbit" ? "composition" : "orbit" }); }
          }
        >
          Camera: {state.cameraMode === "orbit" ? "Orbit" : "Composition"} (O)
        </button>
      </div>
      <SeedControl seed={state.seed} dispatch={dispatch} />
      <label className="toolbar__check">
        <input
          type="checkbox"
          checked={state.reducedMotion}
          onChange={(event) => { dispatch({ type: "setReducedMotion", enabled: event.target.checked }); }}
        />
        Reduced motion
      </label>
      <HelpPopover />
    </div>
  );
}
