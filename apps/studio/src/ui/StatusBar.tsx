import type { RendererStats } from "../renderer/labRenderer";

type StatusBarProps = Readonly<{ stats: RendererStats | undefined }>;

type Entry = Readonly<{ id: string; label: string; value: string; title?: string }>;

export function StatusBar({ stats }: StatusBarProps) {
  const entries: readonly Entry[] =
    stats === undefined
      ? [{ id: "backend", label: "Backend", value: "starting…" }]
      : [
          { id: "backend", label: "Backend", value: stats.backend },
          { id: "gpu", label: "GPU", value: stats.gpu.label, title: `${stats.gpu.detail} source=${stats.gpu.source}` },
          { id: "gpu-class", label: "GPU class", value: stats.gpu.gpuClass },
          { id: "force-webgl", label: "forceWebGL", value: stats.gpu.forceWebGL ? "on" : "off" },
          { id: "draw-calls", label: "Draw calls", value: String(stats.drawCalls) },
          { id: "triangles", label: "Triangles", value: String(stats.triangles) },
          { id: "instances", label: "Instances", value: String(stats.instances) },
          { id: "geometries", label: "Geometries", value: String(stats.geometries) },
          { id: "textures", label: "Textures", value: String(stats.textures) },
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
        {entries.map(({ id, label, value, title }) => (
          <div key={id} className="statusbar__entry">
            <dt>{label}</dt>
            <dd data-testid={`stat-${id}`} title={title}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </footer>
  );
}
