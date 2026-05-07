import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["react-grid-layout"],
  },
  server: {
    proxy: {
      "/daemon": {
        target: "http://127.0.0.1:8081",
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/daemon/, ""),
      },
    },
  },
})
