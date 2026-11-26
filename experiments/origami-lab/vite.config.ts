import { execSync } from "node:child_process";
import { defineConfig } from "vite";

const port = Number(process.env.ORIGAMI_LAB_PORT ?? 5182);

function build(): string {
  try {
    const run = (command: string): string => execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return `${run("git rev-parse --abbrev-ref HEAD")} @ ${run("git rev-parse --short HEAD")}`;
  } catch {
    return "git info unavailable";
  }
}

export default defineConfig({
  define: { __BUILD__: JSON.stringify(build()) },
  server: { host: "127.0.0.1", port, strictPort: true },
  preview: { host: "127.0.0.1", port, strictPort: true },
});
