import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["profile/**/*.test.ts"], pool: "forks", execArgv: ["--cpu-prof", "--cpu-prof-dir=runs/profile"] },
});
