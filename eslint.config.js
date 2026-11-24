import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const noClassExtends = [
  {
    selector: "ClassDeclaration[superClass]",
    message: "Composition over inheritance: class extends is banned in packages/ (master-plan §7).",
  },
  {
    selector: "ClassExpression[superClass]",
    message: "Composition over inheritance: class extends is banned in packages/ (master-plan §7).",
  },
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
    files: ["packages/**/*.{ts,tsx}"],
    rules: { "no-restricted-syntax": ["error", ...noClassExtends] },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["./*", "../*"], message: "Behavioral tests import only the package entry point." },
          ],
          paths: [
            { name: "vitest", importNames: ["vi"], message: "No mocks or spies in behavioral tests." },
          ],
        },
      ],
    },
  },
);
