export function App() {
  return (
    <div className="shell">
      <header className="shell__header">
        <h1>ESCHATON — Laboratory</h1>
      </header>
      <aside className="shell__panel shell__panel--left" aria-label="Catalog">
        <h2>Catalog</h2>
        <p className="muted">Primitives P01–P09 appear here.</p>
      </aside>
      <main className="shell__viewport" aria-label="Viewport" role="region">
        <p className="muted">Viewport</p>
      </main>
      <aside className="shell__panel shell__panel--right" aria-label="Inspector">
        <h2>Inspector</h2>
        <p className="muted">Select a Foldon.</p>
      </aside>
    </div>
  );
}
