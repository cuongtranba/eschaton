import { useEffect, useRef, useState } from "react";
import { socketProfileColor } from "../lab/palette";
import type { ViewModel } from "../lab/viewModel";
import { createLabRenderer, type LabRenderer, type RendererStats } from "../renderer/labRenderer";

type ViewportProps = Readonly<{
  viewModel: ViewModel;
  forceWebGL: boolean;
  continuous: boolean;
  onFrame: (stats: RendererStats) => void;
}>;

export function Viewport({ viewModel, forceWebGL, continuous, onFrame }: ViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<LabRenderer | undefined>(undefined);
  const [failure, setFailure] = useState<string | undefined>(undefined);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return undefined;
    const canvas = document.createElement("canvas");
    canvas.className = "viewport__canvas";
    canvas.setAttribute("aria-label", "Laboratory 3D view. Arrow keys pan, mouse drag orbits.");
    host.append(canvas);
    let cancelled = false;
    let created: LabRenderer | undefined;
    createLabRenderer(canvas, { forceWebGL, continuous, onFrame }).then(
      (lab) => {
        if (cancelled) {
          lab.dispose();
          return;
        }
        created = lab;
        setRenderer(lab);
      },
      (reason: unknown) => {
        if (!cancelled) setFailure(reason instanceof Error ? reason.message : "Renderer failed to start");
      },
    );
    const observer = new ResizeObserver(() => created?.resize());
    observer.observe(host);
    return () => {
      cancelled = true;
      observer.disconnect();
      created?.dispose();
      setRenderer(undefined);
      canvas.remove();
    };
  }, [forceWebGL, continuous, onFrame]);

  useEffect(() => {
    renderer?.apply(viewModel);
  }, [renderer, viewModel]);

  const profiles = [...new Set(viewModel.sockets.map((socket) => socket.profile))].sort();
  const preview = viewModel.batches.some((batch) => batch.key.startsWith("preview|"));
  const backdrop = viewModel.batches.some((batch) => batch.authority === "none" && !batch.key.startsWith("preview|"));

  return (
    <div className="viewport" ref={hostRef}>
      {failure !== undefined && (
        <p className="viewport__failure" role="alert">
          Renderer unavailable: {failure}
        </p>
      )}
      {backdrop && (
        <p className="backdrop-label" data-testid="world-backdrop-label">
          Backdrop — not part of the world
        </p>
      )}
      {preview && (
        <p className="backdrop-label" data-testid="wave-preview-label">
          Solver preview — not part of the world
        </p>
      )}
      {viewModel.look.compare && (
        <div className="compare-labels" data-testid="compare-labels" aria-hidden="true">
          <span>Flat (no ink)</span>
          <div className="compare-labels__divider" />
          <span>Ink look</span>
        </div>
      )}
      {viewModel.overlays.sockets && (
        <aside className="legend" aria-label="Socket legend" data-testid="socket-legend">
          <h3>Socket profiles</h3>
          <ul>
            {profiles.map((profile) => (
              <li key={profile}>
                <span className="legend__swatch" style={{ background: socketProfileColor(profile) }} />
                {profile}
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
