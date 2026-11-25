import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { readLabFlags } from "./lab/flags";
import { loadLibrary, resolveItem, type Library } from "./lab/library";
import { buildViewModel } from "./lab/scene";
import { shortcutCommand } from "./lab/shortcuts";
import { initialLabState, labReducer, type LabCommand } from "./lab/state";
import { createWorldSession, worldReducer, type WorldCommand, type WorldSession } from "./lab/world/session";
import type { RendererStats } from "./renderer/labRenderer";
import { CatalogPanel } from "./ui/CatalogPanel";
import { Inspector } from "./ui/Inspector";
import { StatusBar } from "./ui/StatusBar";
import { Toolbar } from "./ui/Toolbar";
import { Viewport } from "./ui/Viewport";

const prefersReducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const isTextEntry = (target: EventTarget | null): boolean =>
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLInputElement && !["range", "checkbox", "radio", "button"].includes(target.type));

const sameStats = (a: RendererStats | undefined, b: RendererStats): boolean =>
  a?.frames === b.frames &&
  a.backend === b.backend &&
  a.gpu === b.gpu &&
  a.drawCalls === b.drawCalls &&
  a.triangles === b.triangles &&
  a.instances === b.instances &&
  a.geometries === b.geometries &&
  a.textures === b.textures;

function Lab({ library, initialWorld }: Readonly<{ library: Library; initialWorld: WorldSession }>) {
  const [state, dispatch] = useReducer(labReducer, undefined, () => initialLabState(prefersReducedMotion()));
  const [world, worldDispatch] = useReducer(worldReducer, initialWorld);
  const [stats, setStats] = useState<RendererStats | undefined>(undefined);
  const [flags] = useState(() => readLabFlags(window.location.search));

  const send = useCallback((command: LabCommand) => { dispatch(command); }, []);
  const sendWorld = useCallback((command: WorldCommand) => { worldDispatch(command); }, []);
  const onFrame = useCallback((next: RendererStats) => { setStats((previous) => (sameStats(previous, next) ? previous : next)); }, []);

  const item = useMemo(() => resolveItem(library, state.selected), [library, state.selected]);
  const viewModel = useMemo(
    () => (item === undefined ? undefined : buildViewModel(library, item, state, world, { stress: flags.stress })),
    [library, item, state, world, flags.stress],
  );

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTextEntry(event.target)) return;
      const command = shortcutCommand(event.key, stateRef.current, library.items);
      if (command === undefined) return;
      event.preventDefault();
      dispatch(command);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); };
  }, [library]);

  useEffect(() => {
    if (!state.playing) return undefined;
    let last: number | undefined;
    let frame = 0;
    const step = (now: number): void => {
      if (last !== undefined) dispatch({ type: "tick", elapsedMs: now - last });
      last = now;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(frame); };
  }, [state.playing]);

  if (item === undefined || viewModel === undefined) {
    return <p role="alert">Unknown catalog item {state.selected.id}</p>;
  }

  return (
    <div className="shell">
      <header className="shell__header">
        <h1>ESCHATON — Laboratory</h1>
        <Toolbar state={state} dispatch={send} />
      </header>
      <CatalogPanel library={library} selected={state.selected} dispatch={send} />
      <main className="shell__viewport" aria-label="Viewport" role="region">
        <Viewport viewModel={viewModel} forceWebGL={flags.forceWebGL} continuous={flags.continuous} onFrame={onFrame} />
      </main>
      <Inspector item={item} library={library} state={state} viewModel={viewModel} dispatch={send} world={world} worldDispatch={sendWorld} />
      <StatusBar stats={stats} />
    </div>
  );
}

function Fatal({ title, lines }: Readonly<{ title: string; lines: readonly string[] }>) {
  return (
    <div role="alert" className="fatal">
      <h1>{title}</h1>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function App() {
  const library = useMemo(() => loadLibrary(), []);
  const world = useMemo(() => createWorldSession(), []);
  if (!library.ok) {
    return <Fatal title="Catalog failed validation" lines={library.error.map((issue) => `${issue.code} at ${issue.path}: ${issue.message}`)} />;
  }
  if (!world.ok) return <Fatal title="World failed to build" lines={[world.error]} />;
  return <Lab library={library.value} initialWorld={world.value} />;
}
