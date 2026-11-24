import type { RendererStats } from "../renderer/labRenderer";

type StatusBarProps = Readonly<{ stats: RendererStats | undefined }>;

export function StatusBar({ stats }: StatusBarProps) {
  const entries: readonly (readonly [string, string, string])[] =
    stats === undefined
      ? [["backend", "Backend", "starting…"]]
      : [
          ["backend", "Backend", stats.backend],
          ["draw-calls", "Draw calls", String(stats.drawCalls)],
          ["triangles", "Triangles", String(stats.triangles)],
          ["instances", "Instances", String(stats.instances)],
          ["geometries", "Geometries", String(stats.geometries)],
          ["textures", "Textures", String(stats.textures)],
        ];
  return (
    <footer
      className="statusbar"
      role="status"
      aria-label="Renderer statistics"
      data-testid="stats"
      data-frames={stats?.frames ?? 0}
    >
      <dl>
        {entries.map(([id, label, value]) => (
          <div key={id} className="statusbar__entry">
            <dt>{label}</dt>
            <dd data-testid={`stat-${id}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </footer>
  );
}
