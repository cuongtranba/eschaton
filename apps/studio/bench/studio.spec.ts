import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_SEED } from "../src/lab/state";
import { repositoryRootFrom, writeReport, type ResourceSnapshot, type SceneResult, type StudioResult } from "./report";

type Scene = Readonly<{ id: string; label: string; item: string; stress?: number }>;

const SCENES: readonly Scene[] = [
  { id: "single-primitive", label: "Single primitive (P08 box shell)", item: "primitive:P08" },
  { id: "roof-house", label: "Assembly roof-house", item: "assembly:roof-house" },
  { id: "watchtower", label: "Assembly watchtower", item: "assembly:watchtower" },
  { id: "reference", label: "Reference composition (seed 20261124)", item: "scene:reference-composition" },
  { id: "lab-1000", label: "Lab with 1,000 seeded pieces (roof-house + ?stress=1000)", item: "assembly:roof-house", stress: 1000 },
];

const WARMUP_FRAMES = 20;
const SAMPLE_MS = 8_000;
const MIN_SAMPLES = 15;
const MAX_SAMPLES = 400;
const RESET_CYCLES = 20;
const COLD_LOADS = 5;

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = repositoryRootFrom(here);
const OUTPUT = resolve(ROOT, "benchmarks/raw/studio.json");

const url = (stress: number | undefined): string => `/?continuous=1${stress === undefined ? "" : `&stress=${stress}`}`;

const quantile = (sorted: readonly number[], q: number): number => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] ?? 0;
const round = (value: number, digits = 2): number => Math.round(value * 10 ** digits) / 10 ** digits;

const stat = async (page: Page, name: string): Promise<number> => Number(await page.getByTestId(`stat-${name}`).innerText());

const nextFrames = (page: Page, count: number): Promise<void> =>
  page.evaluate(
    (total) =>
      new Promise<void>((done) => {
        let seen = 0;
        const tick = (): void => {
          seen += 1;
          if (seen >= total) done();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count,
  );

async function openLab(page: Page, stress: number | undefined): Promise<number> {
  await page.goto(url(stress), { waitUntil: "commit" });
  const handle = await page.waitForFunction(
    () => (Number(document.querySelector('[data-testid="stats"]')?.getAttribute("data-frames")) >= 1 ? performance.now() : false),
    null,
    { polling: "raf", timeout: 120_000 },
  );
  return Number(await handle.jsonValue());
}

async function choose(page: Page, key: string): Promise<void> {
  await page.locator(`[data-item="${key}"]`).click();
  await expect(page.locator(`[data-item="${key}"]`)).toHaveAttribute("aria-current", "true");
  await nextFrames(page, 4);
}

function sampleFrames(page: Page): Promise<number[]> {
  return page.evaluate(
    ({ warmup, windowMs, minSamples, maxSamples }) =>
      new Promise<number[]>((done) => {
        const deltas: number[] = [];
        let last: number | undefined;
        let seen = 0;
        let started: number | undefined;
        const step = (now: number): void => {
          seen += 1;
          if (seen > warmup && last !== undefined) {
            started ??= now;
            deltas.push(now - last);
          }
          last = now;
          const elapsed = started === undefined ? 0 : now - started;
          if (deltas.length >= maxSamples || (elapsed >= windowMs && deltas.length >= minSamples)) done(deltas);
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    { warmup: WARMUP_FRAMES, windowMs: SAMPLE_MS, minSamples: MIN_SAMPLES, maxSamples: MAX_SAMPLES },
  );
}

async function measureScene(page: Page, scene: Scene): Promise<SceneResult> {
  await choose(page, scene.item);
  const deltas = await sampleFrames(page);
  const sorted = [...deltas].sort((a, b) => a - b);
  return {
    id: scene.id,
    label: scene.label,
    backend: await page.getByTestId("stat-backend").innerText(),
    frameSamples: sorted.length,
    frameP50Ms: round(quantile(sorted, 0.5)),
    frameP95Ms: round(quantile(sorted, 0.95)),
    frameMaxMs: round(sorted.at(-1) ?? 0),
    drawCalls: await stat(page, "draw-calls"),
    triangles: await stat(page, "triangles"),
    instances: await stat(page, "instances"),
    geometries: await stat(page, "geometries"),
    textures: await stat(page, "textures"),
  };
}

async function heapBytes(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const collect = (globalThis as { gc?: () => void }).gc;
    collect?.();
    const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory;
    return memory?.usedJSHeapSize ?? null;
  });
}

async function snapshot(page: Page): Promise<ResourceSnapshot> {
  return {
    instances: await stat(page, "instances"),
    geometries: await stat(page, "geometries"),
    textures: await stat(page, "textures"),
    heapBytes: await heapBytes(page),
  };
}

async function gpuInfo(page: Page): Promise<Readonly<Record<string, string>>> {
  return page.evaluate(async () => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info") ?? null;
    const read = (name: number): string => String(gl?.getParameter(name) ?? "unavailable");
    const gpu = (navigator as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    const adapter = gpu === undefined ? "navigator.gpu missing" : (await gpu.requestAdapter()) === null ? "no WebGPU adapter" : "WebGPU adapter available";
    return {
      webglRenderer: debug === null || gl === null ? read(0x1f01) : read(debug.UNMASKED_RENDERER_WEBGL),
      webglVendor: debug === null || gl === null ? read(0x1f00) : read(debug.UNMASKED_VENDOR_WEBGL),
      webgpu: adapter,
      userAgent: navigator.userAgent,
    };
  });
}

const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8" }).trim();

test("records Phase 0 studio benchmarks", async ({ page, browser, browserName }) => {
  const cold: number[] = [];
  for (let load = 0; load < COLD_LOADS; load++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
    const coldPage = await context.newPage();
    cold.push(round(await openLab(coldPage, undefined)));
    await context.close();
  }

  await openLab(page, undefined);
  const gpu = await gpuInfo(page);
  const backend = await page.getByTestId("stat-backend").innerText();

  const scenes: SceneResult[] = [];
  for (const scene of SCENES.filter((entry) => entry.stress === undefined)) scenes.push(await measureScene(page, scene));

  const cycles: ResourceSnapshot[] = [];
  await choose(page, "assembly:roof-house");
  const baseline = await snapshot(page);
  for (let cycle = 0; cycle < RESET_CYCLES; cycle++) {
    await choose(page, "scene:reference-composition");
    await choose(page, "assembly:roof-house");
    cycles.push(await snapshot(page));
  }
  const afterCycles = cycles.at(-1) ?? baseline;

  const stressScene = SCENES.find((entry) => entry.stress !== undefined);
  if (stressScene === undefined) throw new Error("stress scene missing");
  await openLab(page, stressScene.stress);
  scenes.push(await measureScene(page, stressScene));

  const sorted = [...cold].sort((a, b) => a - b);
  const cpus = os.cpus();
  const result: StudioResult = {
    generatedAt: new Date().toISOString(),
    commit: git("rev-parse", "HEAD"),
    workingTreeDirty: git("status", "--porcelain").length > 0,
    seed: DEFAULT_SEED,
    machine: {
      os: `${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
      cpu: cpus[0]?.model ?? "unknown",
      logicalCores: cpus.length,
      totalMemoryGiB: round(os.totalmem() / 1024 ** 3, 1),
      node: process.version,
      browser: `${browserName} ${browser.version()}`,
      viewport: "1440×860 CSS px at devicePixelRatio 1",
      backend,
      ...gpu,
    },
    method: {
      warmupFrames: WARMUP_FRAMES,
      sampleWindowMs: SAMPLE_MS,
      minSamples: MIN_SAMPLES,
      maxSamples: MAX_SAMPLES,
      frameTime: "requestAnimationFrame deltas with ?continuous=1 (every frame renders)",
      build: "vite build + vite preview (production bundle)",
      resetCycle: "select Reference composition, then select roof-house (content disposed and rebuilt twice per cycle)",
    },
    timeToFirstFrameMs: { runs: cold, median: sorted[Math.floor(sorted.length / 2)] ?? 0, note: "page timeOrigin to first rendered frame, cold context, preview server on localhost" },
    scenes,
    resourceLifetime: { cycles: RESET_CYCLES, baseline, afterCycles, perCycle: cycles },
  };
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  writeReport(result, ROOT);

  expect(scenes).toHaveLength(SCENES.length);
});
