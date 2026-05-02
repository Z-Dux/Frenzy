import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "src/ui",
  publicDir: "../../public",
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "esnext",
    sourcemap: true,
  },
});
