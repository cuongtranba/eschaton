import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type SceneResult = Readonly<{
  id: string;
  label: string;
  backend: string;
  frameSamples: number;
  frameP50Ms: number;
  frameP95Ms: number;
  frameMaxMs: number;
  drawCalls: number;
  triangles: number;
  instances: number;
  geometries: number;
  textures: number;
}>;

export type ResourceSnapshot = Readonly<{ instances: number; geometries: number; textures: number; heapBytes: number | null }>;

export type StudioResult = Readonly<{
  generatedAt: string;
  commit: string;
  workingTreeDirty: boolean;
  seed: number;
  machine: Readonly<Record<string, string | number>>;
  method: Readonly<Record<string, string | number>>;
  timeToFirstFrameMs: Readonly<{ runs: readonly number[]; median: number; note: string }>;
  scenes: readonly SceneResult[];
  resourceLifetime: Readonly<{ cycles: number; baseline: ResourceSnapshot; afterCycles: ResourceSnapshot; perCycle: readonly ResourceSnapshot[] }>;
}>;

type FoldonRow = Readonly<{ name: string; opsPerSecond: number; p50Us: number; p99Us: number; samples: number }>;
type FoldonResult = Readonly<{ startedAt: string; rows: readonly FoldonRow[] }> | undefined;
type WfcRow = Readonly<{ scenario: string; size: number; encoding: string; solved: number; p50Ms: number; p95Ms: number }>;
type WfcReference = Readonly<{ file: string; rows: readonly WfcRow[]; rerun: readonly WfcRow[] }> | undefined;

type Record_ = Readonly<Record<string, unknown>>;
const isRecord = (value: unknown): value is Record_ => typeof value === "object" && value !== null && !Array.isArray(value);
const list = (value: unknown): readonly unknown[] => (Array.isArray(value) ? (value as readonly unknown[]) : []);
const num = (value: unknown): number => (typeof value === "number" ? value : Number.NaN);
const text = (value: unknown): string => (typeof value === "string" ? value : "");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function readFoldon(path: string): FoldonResult {
  if (!existsSync(path)) return undefined;
  const root = readJson(path);
  if (!isRecord(root)) return undefined;
  const rows: FoldonRow[] = [];
  for (const file of list(root.testResults)) {
    for (const assertion of isRecord(file) ? list(file.assertionResults) : []) {
      for (const benchmark of isRecord(assertion) ? list(assertion.benchmarks) : []) {
        for (const task of isRecord(benchmark) ? list(benchmark.tasks) : []) {
          if (!isRecord(task) || !isRecord(task.latency) || !isRecord(task.throughput)) continue;
          rows.push({
            name: text(task.name),
            opsPerSecond: num(task.throughput.mean),
            p50Us: num(task.latency.p50) * 1000,
            p99Us: num(task.latency.p99) * 1000,
            samples: num(task.latency.samplesCount),
          });
        }
      }
    }
  }
  return { startedAt: new Date(num(root.startTime)).toISOString(), rows };
}

function wfcRows(root: unknown): readonly WfcRow[] {
  if (!isRecord(root)) return [];
  return list(root.summaries).flatMap((entry): WfcRow[] =>
    isRecord(entry)
      ? [{ scenario: text(entry.scenario), size: num(entry.size), encoding: text(entry.encoding), solved: num(entry.solved), p50Ms: num(entry.p50Ms), p95Ms: num(entry.p95Ms) }]
      : [],
  );
}

function readWfc(directory: string, rerunPath: string): WfcReference {
  if (!existsSync(directory)) return undefined;
  const file = readdirSync(directory).filter((name) => name.endsWith(".json")).sort().at(-1);
  if (file === undefined) return undefined;
  return { file, rows: wfcRows(readJson(join(directory, file))), rerun: existsSync(rerunPath) ? wfcRows(readJson(rerunPath)) : [] };
}

const fixed = (value: number, digits: number): string => (Number.isFinite(value) ? value.toFixed(digits) : "n/a");
const grouped = (value: number): string => (Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "n/a");
const megabytes = (bytes: number | null): string => (bytes === null ? "n/a" : (bytes / 1e6).toFixed(1));

export type GateStatus = "not assessed" | "partially assessed";
export type Gate = Readonly<{ scene: string; target: string; status: GateStatus; measured: string; reason: string }>;

export function gatesFor(studio: StudioResult, wfc: WfcReference): readonly Gate[] {
  const stress = studio.scenes.find((scene) => scene.id === "lab-1000");
  const { baseline, afterCycles, cycles } = studio.resourceLifetime;
  const placement16 = wfc?.rows.filter((row) => row.encoding === "placement" && row.size === 16) ?? [];
  const worstP95 = Math.max(...placement16.map((row) => row.p95Ms));
  const heapGrowth =
    baseline.heapBytes === null || afterCycles.heapBytes === null ? "heap not available" : `JS heap ${megabytes(baseline.heapBytes)} → ${megabytes(afterCycles.heapBytes)} MB over ${cycles} cycles after forced GC`;
  return [
    {
      scene: "Lab",
      target: "100–1,000 pieces; smooth interaction; no persistent resource growth after reset",
      status: "partially assessed",
      measured: `${stress === undefined ? "stress scene missing" : `${grouped(stress.instances)} instances, ${stress.drawCalls} draws, p50 ${fixed(stress.frameP50Ms, 1)} ms / p95 ${fixed(stress.frameP95Ms, 1)} ms (software WebGL2)`}; GPU-side counters flat over ${cycles} cycles (geometries ${baseline.geometries}→${afterCycles.geometries}, textures ${baseline.textures}→${afterCycles.textures}); ${heapGrowth}`,
      reason: "Software rasteriser, not a target GPU, so \"smooth interaction\" is not judged. The JS heap kept growing across reset cycles and the cause is not identified, so the \"no persistent growth\" half is not claimed.",
    },
    {
      scene: "District",
      target: "10k visible logical instances; p95 frame ≤ 16.7 ms on a discrete GPU",
      status: "not assessed",
      measured: "none",
      reason: "No District scene exists. The largest Phase 0 scene is the reference composition (543 instances) and it was measured only on a software rasteriser.",
    },
    {
      scene: "Stress",
      target: "100k static logical instances",
      status: "not assessed",
      measured: "none",
      reason: "The largest measured scene has about 1,000 instances. No chunking or 100k placement exists.",
    },
    {
      scene: "Research",
      target: "1M logical pieces across streamed chunks",
      status: "not assessed",
      measured: "none",
      reason: "No streaming or chunk model in Phase 0.",
    },
    {
      scene: "Local WFC",
      target: "16×16×8 region, bounded catalog, p95 ≤ 250 ms worker solve",
      status: "partially assessed",
      measured: `2D 16×16 (height 1), placement encoding, main thread: worst p95 ${fixed(worstP95, 1)} ms over open and constrained corpora of 100 seeds`,
      reason: "No third dimension, no worker, an easy tile set, and a throwaway solver, so the gate is not claimed.",
    },
    {
      scene: "Interaction",
      target: "No solver-caused main-thread long tasks during worker solving; cancellation observable",
      status: "not assessed",
      measured: "none",
      reason: "There is no worker and no cancellation in Phase 0.",
    },
  ];
}

function foldonTable(foldon: FoldonResult): string {
  if (foldon === undefined) return "_Not measured in this run: `benchmarks/raw/foldon.json` was missing. Run `pnpm bench` first._\n";
  const lines = [
    `Source: \`benchmarks/raw/foldon.json\` (vitest bench run started ${foldon.startedAt}). Warm-up 200 iterations / 300 ms, then 800 ms of timed samples per case.`,
    "",
    "| Case | ops/s | p50 µs | p99 µs | samples |",
    "|---|---:|---:|---:|---:|",
    ...[...foldon.rows]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((row) => `| ${row.name} | ${grouped(row.opsPerSecond)} | ${fixed(row.p50Us, 2)} | ${fixed(row.p99Us, 2)} | ${grouped(row.samples)} |`),
  ];
  return `${lines.join("\n")}\n`;
}

function sceneTable(scenes: readonly SceneResult[]): string {
  const lines = [
    "| Scene | Backend | Frame p50 ms | Frame p95 ms | Frame max ms | Samples | Draw calls | Triangles | Instances | Geometries | Textures |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...scenes.map(
      (scene) =>
        `| ${scene.label} | ${scene.backend} | ${fixed(scene.frameP50Ms, 1)} | ${fixed(scene.frameP95Ms, 1)} | ${fixed(scene.frameMaxMs, 1)} | ${scene.frameSamples} | ${scene.drawCalls} | ${grouped(scene.triangles)} | ${grouped(scene.instances)} | ${scene.geometries} | ${scene.textures} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function lifetimeTable(studio: StudioResult): string {
  const { baseline, afterCycles, cycles, perCycle } = studio.resourceLifetime;
  const heaps = perCycle.flatMap((cycle) => (cycle.heapBytes === null ? [] : [cycle.heapBytes]));
  const slope = baseline.heapBytes === null || afterCycles.heapBytes === null ? Number.NaN : (afterCycles.heapBytes - baseline.heapBytes) / cycles;
  const rises = heaps.filter((value, index) => index > 0 && value > (heaps[index - 1] ?? Number.POSITIVE_INFINITY)).length;
  const lines = [
    "| | Instances | Geometries | Textures | JS heap after GC (MB) |",
    "|---|---:|---:|---:|---:|",
    `| Baseline (roof-house) | ${baseline.instances} | ${baseline.geometries} | ${baseline.textures} | ${megabytes(baseline.heapBytes)} |`,
    `| After ${cycles} reset cycles | ${afterCycles.instances} | ${afterCycles.geometries} | ${afterCycles.textures} | ${megabytes(afterCycles.heapBytes)} |`,
  ];
  return `${lines.join("\n")}\n\nMean JS heap change: ${Number.isFinite(slope) ? `${(slope / 1e6).toFixed(2)} MB per cycle` : "n/a"}; the heap rose in ${rises} of ${Math.max(0, heaps.length - 1)} consecutive cycle pairs. \`renderer.info\` counters (geometries, textures) and the instance count returned exactly to the baseline every cycle, so GPU-side resource counts did not leak. The JS heap did keep growing; the cause was not identified and it is a known open item, not a pass.\n`;
}

function wfcTable(wfc: WfcReference): string {
  if (wfc === undefined) return "_No WFC results file found._\n";
  const rerunOf = (row: WfcRow): WfcRow | undefined =>
    wfc.rerun.find((other) => other.scenario === row.scenario && other.size === row.size && other.encoding === row.encoding);
  const lines = [
    `Committed results are cited, not regenerated: \`experiments/wfc-placement/results/${wfc.file}\` (method in \`experiments/wfc-placement/README.md\`). 2D, height 1, main thread, 100 seeds per row. The last two columns come from a second \`pnpm bench\` run in the same session (\`benchmarks/raw/wfc-rerun.json\`); the workload is deterministic per seed, so differences are machine noise or load.`,
    "",
    "| Scenario | Size | Encoding | Solved / 100 | p50 ms | p95 ms | Rerun p50 ms | Rerun p95 ms |",
    "|---|---:|---|---:|---:|---:|---:|---:|",
    ...wfc.rows.map((row) => {
      const again = rerunOf(row);
      return `| ${row.scenario} | ${row.size}×${row.size} | ${row.encoding} | ${row.solved} | ${fixed(row.p50Ms, 2)} | ${fixed(row.p95Ms, 2)} | ${again === undefined ? "n/a" : fixed(again.p50Ms, 2)} | ${again === undefined ? "n/a" : fixed(again.p95Ms, 2)} |`;
    }),
  ];
  return `${lines.join("\n")}\n`;
}

function gateTable(gates: readonly Gate[]): string {
  const lines = [
    "| §9.1 scene | Target | Status | What was measured | Why not a pass |",
    "|---|---|---|---|---|",
    ...gates.map((gate) => `| ${gate.scene} | ${gate.target} | **${gate.status}** | ${gate.measured} | ${gate.reason} |`),
  ];
  return `${lines.join("\n")}\n`;
}

export function writeReport(studio: StudioResult, repositoryRoot: string): string {
  const foldon = readFoldon(join(repositoryRoot, "benchmarks/raw/foldon.json"));
  const wfc = readWfc(join(repositoryRoot, "experiments/wfc-placement/results"), join(repositoryRoot, "benchmarks/raw/wfc-rerun.json"));
  const gates = gatesFor(studio, wfc);
  const date = studio.generatedAt.slice(0, 10);
  const machine = studio.machine;
  const machineRows = Object.entries(machine).map(([key, value]) => `| ${key} | ${String(value)} |`);
  const markdown = [
    `# Phase 0 benchmarks — ${date}`,
    "",
    "> **These numbers are not representative of the master plan §9.1 targets.** The Studio was measured in headless Chromium on WSL2 with no GPU adapter: `WebGPURenderer` fell back to the **WebGL2 backend on the SwiftShader software rasteriser**, and the WebGPU backend was never exercised. No §9.1 gate is claimed as passed. Headless frame times are quantised to multiples of about 16.7 ms by the compositor's 60 Hz tick, so differences below one tick are not resolvable.",
    "",
    "## Environment",
    "",
    "| Item | Value |",
    "|---|---|",
    `| Commit | \`${studio.commit}\`${studio.workingTreeDirty ? " + uncommitted P0.8 changes (working tree was dirty when measured)" : ""} |`,
    `| Seed | ${studio.seed} (lab default; also seeds the 1,000-piece stress layout) |`,
    `| Generated | ${studio.generatedAt} |`,
    ...machineRows,
    "",
    "The Foldon benchmarks (section 1) ran on the same machine and Node version, outside a browser.",
    "",
    "## Method",
    "",
    ...Object.entries(studio.method).map(([key, value]) => `- **${key}:** ${String(value)}`),
    "- **Stress scene:** `?stress=1000` places 1,000 seeded primitives on a 3-cell lattice around the selected assembly; `?continuous=1` makes the renderer draw every animation frame (the lab otherwise draws only when something changed).",
    "- **Frame time:** requestAnimationFrame deltas after 20 warm-up frames, at least 15 samples, up to 8 s. The sample count is in the table; p95 over fewer than 100 samples is weak.",
    "- **Reproduce:** `pnpm bench` (Foldon and the WFC experiment), then `STUDIO_PORT=5183 pnpm bench:studio`.",
    "",
    "## 1. Foldon package (Node)",
    "",
    foldonTable(foldon),
    "## 2. Studio scenes",
    "",
    sceneTable(studio.scenes),
    "Draw calls, triangles and instances come from `renderer.info` and the status bar of the last frame; with outlines on, two extra line batches are drawn.",
    "",
    "## 3. Time to first frame",
    "",
    `Cold browser context, production bundle on a local preview server. Runs (ms): ${studio.timeToFirstFrameMs.runs.join(", ")}. **Median ${fixed(studio.timeToFirstFrameMs.median, 1)} ms.** ${studio.timeToFirstFrameMs.note}. Includes backend init and building the default scene; excludes network latency beyond localhost.`,
    "",
    "## 4. Resource lifetime after reset cycles",
    "",
    lifetimeTable(studio),
    "## 5. WFC placement experiment (by reference)",
    "",
    wfcTable(wfc),
    "## 6. §9.1 gate status",
    "",
    gateTable(gates),
  ].join("\n");
  const outputDirectory = join(repositoryRoot, "benchmarks");
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(join(outputDirectory, `phase-0-${date}.md`), `${markdown}\n`);
  writeFileSync(join(outputDirectory, `phase-0-${date}.json`), `${JSON.stringify({ studio, foldon, wfcReference: wfc, gates }, null, 2)}\n`);
  return date;
}

export const repositoryRootFrom = (directory: string): string => resolve(directory, "../../..");
