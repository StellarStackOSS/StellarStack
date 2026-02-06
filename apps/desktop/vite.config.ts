import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@stellarUI": resolve(__dirname, "../../packages/ui/src"),
      "@": resolve(__dirname, "src"),
    },
  },
  css: {
    postcss: resolve(__dirname, "../../packages/ui/postcss.config.mjs"),
  },
  build: {
    outDir: "dist",
    emptyDirBefore: true,
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});
