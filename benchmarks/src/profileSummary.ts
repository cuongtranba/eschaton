import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Frame = Readonly<{ functionName: string; url: string; lineNumber: number }>;
type Node = Readonly<{ id: number; callFrame: Frame; children?: readonly number[] }>;
type Profile = Readonly<{ nodes: readonly Node[]; samples: readonly number[]; timeDeltas: readonly number[] }>;

/** Summarises a V8 .cpuprofile: self time per function and inclusive time for the named functions. */
const directory = process.argv[2] ?? "runs/profile";
const files = readdirSync(directory).filter((name) => name.endsWith(".cpuprofile")).sort();
const file = files.at(-1);
if (file === undefined) throw new Error(`no .cpuprofile in ${directory}`);
const profile = JSON.parse(readFileSync(join(directory, file), "utf8")) as Profile;

const byId = new Map(profile.nodes.map((node) => [node.id, node]));
const parent = new Map<number, number>();
for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id);
const label = (frame: Frame): string => `${frame.functionName === "" ? "(anonymous)" : frame.functionName} ${frame.url.split("/").slice(-2).join("/")}:${frame.lineNumber + 1}`;

const self = new Map<string, number>();
const inclusive = new Map<string, number>();
let total = 0;
profile.samples.forEach((id, i) => {
  const micros = profile.timeDeltas[i] ?? 0;
  total += micros;
  const node = byId.get(id);
  if (node === undefined) return;
  self.set(label(node.callFrame), (self.get(label(node.callFrame)) ?? 0) + micros);
  const seen = new Set<string>();
  for (let at: number | undefined = id; at !== undefined; at = parent.get(at)) {
    const name = byId.get(at)?.callFrame.functionName ?? "";
    if (name !== "" && !seen.has(name)) {
      seen.add(name);
      inclusive.set(name, (inclusive.get(name) ?? 0) + micros);
    }
  }
});

const percent = (micros: number): string => `${((micros / total) * 100).toFixed(1).padStart(5)}%  ${(micros / 1000).toFixed(0).padStart(7)} ms`;
console.log(`profile ${file}: ${(total / 1000).toFixed(0)} ms sampled`);
console.log("\nInclusive time of the commit-path functions:");
for (const name of process.argv.slice(3)) console.log(`  ${percent(inclusive.get(name) ?? 0)}  ${name}`);
console.log("\nTop self time:");
for (const [name, micros] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log(`  ${percent(micros)}  ${name}`);
