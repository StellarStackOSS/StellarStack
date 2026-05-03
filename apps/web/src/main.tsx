import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@fontsource-variable/geist"
import "@workspace/ui/globals.css"
import { App } from "@/App"
import { ThemeProvider } from "@/components/ThemeProvider"
import { bootstrapI18n } from "@/lib/I18n"

const rootElement = document.getElementById("root")
if (rootElement === null) {
  throw new Error("Root element #root not found")
}

const root = createRoot(rootElement)

bootstrapI18n()
  .then(() => {
    root.render(
      <StrictMode>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </StrictMode>
    )
  })
  .catch((err) => {
    console.error("Failed to bootstrap i18n", err)
    root.render(
      <StrictMode>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </StrictMode>
    )
  })
