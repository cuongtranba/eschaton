import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const port = Number(process.env.STUDIO_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  server: { port, strictPort: true },
});
