import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // `vite preview` blocks unknown Host headers in 7.x. The marketing
  // site is served behind Railway's edge under stellarstack.app, plus
  // the *.up.railway.app preview hostname while testing.
  preview: {
    host: "0.0.0.0",
    allowedHosts: [
      "stellarstack.app",
      "www.stellarstack.app",
      ".up.railway.app",
    ],
  },
})
