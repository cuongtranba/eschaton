import { existsSync, readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const noClassExtends = [
  {
    selector: "ClassDeclaration[superClass]",
    message: "Composition over inheritance: class extends is banned in first-party sources (master-plan §7.3).",
  },
  {
    selector: "ClassExpression[superClass]",
    message: "Composition over inheritance: class extends is banned in first-party sources (master-plan §7.3).",
  },
];

const manifestName = (file) => (existsSync(file) ? [JSON.parse(readFileSync(file, "utf8")).name] : []);

const packageNames = (dir) => {
  const root = join(import.meta.dirname, dir);
  if (!existsSync(root)) return [];
  const children = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  return [...manifestName(join(root, "package.json")), ...children.flatMap((entry) => manifestName(join(root, entry.name, "package.json")))];
};

const forbid = (message, ...names) => ({ paths: names.map((name) => ({ name, message })) });

const apps = packageNames("apps");
const experiments = packageNames("experiments");
const tools = packageNames("tools");
const benchmarks = packageNames("benchmarks");

const entryPointsOnly = {
  patterns: [
    { group: ["@eschaton/*/**"], message: "Import a workspace package only through its entry point (package.json exports)." },
    {
      group: ["**/apps/**", "**/packages/**", "**/experiments/**", "**/benchmarks/**", "**/tools/**"],
      message: "Cross-workspace relative imports are banned; import the package entry point.",
    },
  ],
};
const noThree = {
  paths: [{ name: "three", message: "three is imported only inside apps/studio/src/renderer." }],
  patterns: [{ group: ["three/*"], message: "three is imported only inside apps/studio/src/renderer." }],
};
const noReact = {
  paths: [
    { name: "react", message: "React is imported only by the Studio UI shell (src/ui, App, main), not by lab or renderer." },
    { name: "react-dom", message: "React is imported only by the Studio UI shell (src/ui, App, main), not by lab or renderer." },
  ],
  patterns: [{ group: ["react/*", "react-dom/*"], message: "React is imported only by the Studio UI shell (src/ui, App, main)." }],
};
const noUiLayer = {
  patterns: [{ group: ["**/ui", "**/ui/**", "**/App", "**/main"], message: "Dependencies run ui -> renderer -> lab; nothing below the UI imports it." }],
};
const noRendererLayer = {
  patterns: [{ group: ["**/renderer", "**/renderer/**"], message: "lab is pure state and view-model; it never imports the renderer." }],
};
const pureDomain = {
  paths: [
    ...["three", "react", "react-dom", ...builtinModules].map((name) => ({ name, message: "packages/foldon is pure domain: no renderer, UI or Node built-ins." })),
  ],
  patterns: [
    { group: ["three/*", "react/*", "react-dom/*", "node:*"], message: "packages/foldon is pure domain: no renderer, UI or Node built-ins." },
    { group: ["@eschaton/*", "!@eschaton/foldon"], message: "packages/foldon is the bottom of the graph: it imports no other workspace package (ADR 0001)." },
  ],
};
const pureRuntime = {
  paths: [
    ...["three", "react", "react-dom", ...builtinModules].map((name) => ({ name, message: "packages/world is pure runtime state: no renderer, UI or Node built-ins." })),
  ],
  patterns: [
    { group: ["three/*", "react/*", "react-dom/*", "node:*"], message: "packages/world is pure runtime state: no renderer, UI or Node built-ins." },
    { group: ["@eschaton/*", "!@eschaton/foldon", "!@eschaton/world"], message: "packages/world imports only @eschaton/foldon among workspace packages (ADR 0001 amendment)." },
  ],
};
const pureGeneration = {
  paths: [
    ...["three", "react", "react-dom", ...builtinModules].map((name) => ({ name, message: "packages/wave is pure generation: no renderer, UI or Node built-ins." })),
  ],
  patterns: [
    { group: ["three/*", "react/*", "react-dom/*", "node:*"], message: "packages/wave is pure generation: no renderer, UI or Node built-ins." },
    { group: ["@eschaton/*", "!@eschaton/foldon", "!@eschaton/world", "!@eschaton/wave"], message: "packages/wave imports only @eschaton/foldon and @eschaton/world among workspace packages (ADR 0015)." },
  ],
};
const solverCore = {
  paths: [{ name: "@eschaton/world", message: "The wave solver core knows no world state: it imports @eschaton/foldon only (ADR 0015)." }],
  patterns: [{ group: ["../*", "!../solver", "!../solver/*"], message: "The wave solver core does not import the region glue or the job host." }],
};
const behavioralTests = {
  patterns: [{ group: ["./*", "../*"], message: "Behavioral tests import only the package entry point." }],
  paths: [{ name: "vitest", importNames: ["vi"], message: "No mocks or spies in behavioral tests." }],
};

const restrict = (...parts) => [
  "error",
  { paths: parts.flatMap((part) => part.paths ?? []), patterns: parts.flatMap((part) => part.patterns ?? []) },
];

const libraryRules = [
  entryPointsOnly,
  forbid("Libraries never import apps, experiments, tools or benchmarks.", ...apps, ...experiments, ...tools, ...benchmarks),
];
const studioRules = [entryPointsOnly, forbid("The Studio imports neither experiments nor tools.", ...experiments, ...tools)];

// Later, narrower areas replace the whole rule value, so each lists its complete restriction set.
const importAreas = [
  { dir: "packages", rules: libraryRules },
  { dir: "packages/foldon", rules: [...libraryRules, pureDomain] },
  { dir: "packages/world", rules: [...libraryRules, pureRuntime] },
  { dir: "packages/wave", rules: [...libraryRules, pureGeneration] },
  { dir: "packages/wave/src/solver", rules: [...libraryRules, pureGeneration, solverCore] },
  { dir: "apps/studio", rules: [...studioRules, noThree] },
  { dir: "apps/studio/src/renderer", rules: [...studioRules, noReact, noUiLayer] },
  { dir: "apps/studio/src/lab", rules: [...studioRules, noThree, noReact, noUiLayer, noRendererLayer] },
  { dir: "experiments", rules: [entryPointsOnly, forbid("Experiments never import apps.", ...apps)] },
  { dir: "benchmarks", rules: [entryPointsOnly, forbid("Benchmarks never import apps.", ...apps)] },
  { dir: "tools", rules: [entryPointsOnly, forbid("Tools never import apps.", ...apps)] },
];

const importBoundaryConfigs = [
  { files: ["**/*.test.ts"], rules: { "no-restricted-imports": restrict(entryPointsOnly, behavioralTests) } },
  ...importAreas.map(({ dir, rules }) => ({
    files: [`${dir}/**/*.{ts,tsx}`],
    rules: { "no-restricted-imports": restrict(...rules) },
  })),
  ...importAreas.map(({ dir, rules }) => ({
    files: [`${dir}/**/*.test.ts`],
    rules: { "no-restricted-imports": restrict(...rules, behavioralTests) },
  })),
];

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "**/playwright-report/**", "**/test-results/**", ".worktrees/**", "docs/**", "assets/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["apps/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: { "no-restricted-syntax": ["error", ...noClassExtends] },
  },
  ...importBoundaryConfigs,
);
