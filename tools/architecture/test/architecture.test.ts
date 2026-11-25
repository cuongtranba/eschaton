import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";

const root = fileURLToPath(new URL("../../..", import.meta.url));

const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: `${root}eslint.config.js`,
  overrideConfig: [
    tseslint.configs.disableTypeChecked,
    { files: ["**/*.{ts,tsx}"], languageOptions: { parserOptions: { projectService: false } } },
  ],
});

type Verdict = "rejected" | "accepted";
type BoundaryRule = "no-restricted-imports" | "no-restricted-syntax";

type Case = Readonly<{ title: string; file: string; code: string; verdict: Verdict; rule: BoundaryRule }>;

const imports = (title: string, file: string, code: string, verdict: Verdict): Case => ({
  title,
  file,
  code,
  verdict,
  rule: "no-restricted-imports",
});

const syntax = (title: string, file: string, code: string, verdict: Verdict): Case => ({
  title,
  file,
  code,
  verdict,
  rule: "no-restricted-syntax",
});

const FOLDON = "packages/foldon/src/probe.ts";
const WORLD = "packages/world/src/probe.ts";
const WAVE = "packages/wave/src/probe.ts";
const SOLVER = "packages/wave/src/solver/probe.ts";
const GENESIS = "packages/genesis/src/probe.ts";
const LAB = "apps/studio/src/lab/probe.ts";
const RENDERER = "apps/studio/src/renderer/probe.ts";
const UI = "apps/studio/src/ui/Probe.tsx";
const EXPERIMENT = "experiments/wfc-placement/src/probe.ts";
const BENCHMARK = "benchmarks/src/probe.ts";

const cases: readonly Case[] = [
  imports("rejects foldon importing three", FOLDON, `import { Vector3 } from "three";`, "rejected"),
  imports("rejects foldon importing a three subpath", FOLDON, `import { WebGPURenderer } from "three/webgpu";`, "rejected"),
  imports("rejects foldon importing react", FOLDON, `import { useState } from "react";`, "rejected"),
  imports("rejects foldon importing a Node built-in", FOLDON, `import { readFileSync } from "node:fs";`, "rejected"),
  imports("rejects foldon importing an unprefixed Node built-in", FOLDON, `import { join } from "path";`, "rejected"),
  imports("rejects foldon importing the studio app", FOLDON, `import { App } from "@eschaton/studio";`, "rejected"),
  imports("rejects foldon importing an experiment", FOLDON, `import { solvePlacement } from "@eschaton/exp-wfc-placement";`, "rejected"),
  imports("rejects foldon reaching into apps by relative path", FOLDON, `import { App } from "../../../apps/studio/src/App";`, "rejected"),
  imports("rejects foldon importing a sibling workspace package", FOLDON, `import { createWorld } from "@eschaton/world";`, "rejected"),
  imports("rejects foldon tests importing a sibling workspace package", "packages/foldon/test/probe.test.ts", `import { createWorld } from "@eschaton/world";`, "rejected"),
  imports("accepts foldon importing its own modules relatively", FOLDON, `import { add } from "./vec";`, "accepted"),
  imports("rejects foldon tests importing three", "packages/foldon/test/probe.test.ts", `import { Vector3 } from "three";`, "rejected"),
  imports("rejects foldon tests importing internals relatively", "packages/foldon/test/probe.test.ts", `import { add } from "../src/vec";`, "rejected"),
  imports("rejects tests importing vi", "packages/foldon/test/probe.test.ts", `import { vi } from "vitest";`, "rejected"),
  imports("accepts foldon tests importing the entry point", "packages/foldon/test/probe.test.ts", `import { createCatalog } from "@eschaton/foldon";`, "accepted"),

  imports("rejects world importing three", WORLD, `import { Vector3 } from "three";`, "rejected"),
  imports("rejects world importing a Node built-in", WORLD, `import { readFileSync } from "node:fs";`, "rejected"),
  imports("rejects world deep-importing foldon source", WORLD, `import { cellKey } from "@eschaton/foldon/src/definition";`, "rejected"),
  imports("rejects world importing the studio", WORLD, `import { App } from "@eschaton/studio";`, "rejected"),
  imports("rejects world importing another workspace package", WORLD, `import { solvePlacement } from "@eschaton/exp-wfc-placement";`, "rejected"),
  imports("accepts world importing the foldon entry point", WORLD, `import { createCatalog } from "@eschaton/foldon";`, "accepted"),
  imports("rejects world tests importing internals relatively", "packages/world/test/probe.test.ts", `import { applyPatch } from "../src/patch";`, "rejected"),
  imports("accepts world tests importing both entry points", "packages/world/test/probe.test.ts", `import { createWorld } from "@eschaton/world";`, "accepted"),
  imports("rejects world importing wave", WORLD, `import { solve } from "@eschaton/wave";`, "rejected"),
  imports("rejects foldon importing wave", FOLDON, `import { solve } from "@eschaton/wave";`, "rejected"),
  imports("rejects wave importing three", WAVE, `import { Vector3 } from "three";`, "rejected"),
  imports("rejects wave importing a Node built-in", WAVE, `import { Worker } from "node:worker_threads";`, "rejected"),
  imports("rejects wave importing the studio", WAVE, `import { App } from "@eschaton/studio";`, "rejected"),
  imports("accepts the wave region glue importing world", WAVE, `import { readRegion } from "@eschaton/world";`, "accepted"),
  imports("rejects the wave solver core importing world", SOLVER, `import { readRegion } from "@eschaton/world";`, "rejected"),
  imports("rejects the wave solver core importing the region glue", SOLVER, `import { prepareRegion } from "../region";`, "rejected"),
  imports("rejects wave importing genesis", WAVE, `import { planDistrict } from "@eschaton/genesis";`, "rejected"),
  imports("rejects world importing genesis", WORLD, `import { planDistrict } from "@eschaton/genesis";`, "rejected"),
  imports("accepts genesis importing wave", GENESIS, `import { solve } from "@eschaton/wave";`, "accepted"),
  imports("rejects genesis importing three", GENESIS, `import { Vector3 } from "three";`, "rejected"),
  imports("rejects genesis importing the studio", GENESIS, `import { App } from "@eschaton/studio";`, "rejected"),
  imports("accepts the wave solver core importing foldon and its own modules", SOLVER, `import { compileTiles } from "./compile";`, "accepted"),
  imports("rejects the studio deep-importing foldon source", LAB, `import { cellKey } from "@eschaton/foldon/src/definition";`, "rejected"),
  imports("rejects the studio importing foldon by relative path", LAB, `import { cellKey } from "../../../../packages/foldon/src/definition";`, "rejected"),
  imports("accepts the studio importing the foldon entry point", LAB, `import { createCatalog } from "@eschaton/foldon";`, "accepted"),
  imports("rejects three imported from ui", UI, `import * as THREE from "three";`, "rejected"),
  imports("rejects a three subpath imported from lab", LAB, `import type { Vector3 } from "three/webgpu";`, "rejected"),
  imports("accepts three imported from the renderer", RENDERER, `import { WebGPURenderer } from "three/webgpu";`, "accepted"),
  imports("rejects react imported from lab", LAB, `import { useState } from "react";`, "rejected"),
  imports("rejects react-dom imported from the renderer", RENDERER, `import { createRoot } from "react-dom/client";`, "rejected"),
  imports("accepts react imported from ui", UI, `import { useState } from "react";`, "accepted"),
  imports("rejects lab importing ui", LAB, `import { Panel } from "../ui/Panel";`, "rejected"),
  imports("rejects lab importing the renderer", LAB, `import { createLabRenderer } from "../renderer/labRenderer";`, "rejected"),
  imports("rejects the renderer importing ui", RENDERER, `import { Viewport } from "../ui/Viewport";`, "rejected"),
  imports("accepts the renderer importing lab", RENDERER, `import { palette } from "../lab/palette";`, "accepted"),
  imports("accepts ui importing lab and the renderer", UI, `import { createLabRenderer } from "../renderer/labRenderer";`, "accepted"),
  imports("rejects the solver worker importing three", "apps/studio/src/worker/probe.ts", `import { Vector3 } from "three";`, "rejected"),
  imports("rejects the solver worker importing react", "apps/studio/src/worker/probe.ts", `import { useState } from "react";`, "rejected"),
  imports("rejects the solver worker importing the renderer", "apps/studio/src/worker/probe.ts", `import { createLabRenderer } from "../renderer/labRenderer";`, "rejected"),
  imports("accepts the generation worker importing the genesis entry point", "apps/studio/src/worker/probe.ts", `import { createGenesisHost } from "@eschaton/genesis";`, "accepted"),
  imports("accepts the solver worker importing the wave entry point", "apps/studio/src/worker/probe.ts", `import { createWaveHost } from "@eschaton/wave";`, "accepted"),
  imports("rejects the studio importing an experiment", UI, `import { solvePlacement } from "@eschaton/exp-wfc-placement";`, "rejected"),

  imports("rejects an experiment importing the studio", EXPERIMENT, `import { App } from "@eschaton/studio";`, "rejected"),
  imports("rejects an experiment importing apps by relative path", EXPERIMENT, `import { App } from "../../../apps/studio/src/App";`, "rejected"),
  imports("rejects a benchmark deep-importing foldon source", BENCHMARK, `import { cellKey } from "@eschaton/foldon/src/definition";`, "rejected"),
  imports("rejects a tool importing the studio", "tools/architecture/src/probe.ts", `import { App } from "@eschaton/studio";`, "rejected"),
  imports("accepts an experiment importing package entry points", EXPERIMENT, `import { createCatalog } from "@eschaton/foldon";`, "accepted"),
  imports("accepts a benchmark importing an experiment entry point", BENCHMARK, `import { solvePlacement } from "@eschaton/exp-wfc-placement";`, "accepted"),

  syntax("rejects class extends in packages", FOLDON, `export class Child extends Parent {}`, "rejected"),
  syntax("rejects class extends in apps", UI, `export class Child extends Parent {}`, "rejected"),
  syntax("rejects class extends in experiments", EXPERIMENT, `export const Child = class extends Parent {};`, "rejected"),
  syntax("rejects class extends in benchmarks", BENCHMARK, `export class Child extends Parent {}`, "rejected"),
  syntax("rejects class extends in tools", "tools/architecture/src/probe.ts", `export class Child extends Parent {}`, "rejected"),
  syntax("accepts a class without extends", UI, `export class Counter { value = 0; }`, "accepted"),
  syntax("accepts interface extends", FOLDON, `export interface Child extends Parent {}`, "accepted"),
];

async function violations(item: Case): Promise<readonly string[]> {
  const [result] = await eslint.lintText(item.code, { filePath: `${root}${item.file}` });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === item.rule)
    .map((message) => message.message);
}

for (const item of cases) {
  test(item.title, async () => {
    const found = await violations(item);
    if (item.verdict === "rejected") expect(found.length).toBeGreaterThan(0);
    else expect(found).toEqual([]);
  });
}
