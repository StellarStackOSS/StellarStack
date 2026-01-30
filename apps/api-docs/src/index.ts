import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { apiReference } from "@scalar/hono-api-reference";
import { openApiSpec } from "./openapi.js";

/**
 * Custom CSS to match StellarStack's ultra-dark design system.
 *
 * Brand reference:
 *   - Backgrounds: #090909, #0b0b0a, #0f0f0f, #141414
 *   - Font: Space Grotesk (sans), Geist Mono (mono)
 *   - Accent: Indigo (indigo-400 #818cf8 / indigo-500 #6366f1)
 *   - Borders: ~#262626 to #333
 *   - Card gradient: from-[#141414] via-[#0f0f0f] to-[#0a0a0a]
 */
const customCss = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap');

:root {
  --scalar-font: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
  --scalar-font-code: 'Geist Mono', ui-monospace, monospace;
}

.dark-mode,
.dark-mode .scalar-app {
  --scalar-background-1: #0b0b0a;
  --scalar-background-2: #0f0f0f;
  --scalar-background-3: #141414;
  --scalar-background-4: #1a1a1a;
  --scalar-background-accent: #6366f110;

  --scalar-color-1: #f4f4f5;
  --scalar-color-2: #a1a1aa;
  --scalar-color-3: #71717a;
  --scalar-color-disabled: #52525b;
  --scalar-color-ghost: #3f3f46;

  --scalar-color-accent: #818cf8;
  --scalar-color-green: #22c55e;
  --scalar-color-red: #ef4444;
  --scalar-color-yellow: #f59e0b;
  --scalar-color-blue: #6366f1;
  --scalar-color-orange: #f97316;

  --scalar-border-color: #262626;

  --scalar-radius: 0.625rem;
  --scalar-radius-lg: 0.75rem;
  --scalar-radius-xl: 1rem;

  --scalar-shadow-1: 0 1px 3px 0 rgba(0, 0, 0, 0.5);
  --scalar-shadow-2: 0 4px 12px 0 rgba(0, 0, 0, 0.6);

  --scalar-button-1: #6366f1;
  --scalar-button-1-color: #f4f4f5;
  --scalar-button-1-hover: #818cf8;

  color-scheme: dark;
}

/* Sidebar styling */
.dark-mode .sidebar {
  background: #090909 !important;
  border-right-color: #1a1a1a !important;
}

/* Top header / navigation bar */
.dark-mode .t-app__navigation {
  background: rgba(11, 11, 10, 0.85) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  border-bottom-color: #1a1a1a !important;
}

/* Card surfaces */
.dark-mode .scalar-card,
.dark-mode .section-container {
  background: linear-gradient(180deg, #141414 0%, #0f0f0f 50%, #0a0a0a 100%) !important;
  border-color: #262626 !important;
}

/* Code blocks */
.dark-mode pre,
.dark-mode .cm-editor {
  background: #090909 !important;
  border-color: #1a1a1a !important;
}

/* Request examples panel */
.dark-mode .scalar-api-client,
.dark-mode .request-body,
.dark-mode .response-body {
  background: #0a0a0a !important;
}

/* HTTP method badges */
.dark-mode .http-method--get { color: #818cf8 !important; }
.dark-mode .http-method--post { color: #22c55e !important; }
.dark-mode .http-method--put { color: #f59e0b !important; }
.dark-mode .http-method--patch { color: #f97316 !important; }
.dark-mode .http-method--delete { color: #ef4444 !important; }

/* Scrollbar */
.dark-mode ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.dark-mode ::-webkit-scrollbar-track {
  background: transparent;
}
.dark-mode ::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}
.dark-mode ::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Tag section headings */
.dark-mode .tag-section-header {
  border-bottom-color: #1a1a1a !important;
}

/* Remove section header background */
.dark-mode .section-header,
.dark-mode .scalar-api-reference .section-header {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* Hide "Deploy on Scalar" intro card */
.scalar-reference-intro-server {
  display: none !important;
}

/* Hide "Configure" intro card */
.scalar-reference-intro-auth {
  display: none !important;
}

/* Smooth transitions */
.dark-mode * {
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
`;

const app = new Hono();

// Enable CORS for all origins (docs are public)
app.use("*", cors());

// Serve the raw OpenAPI spec as JSON
app.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

// Serve the Scalar API reference UI at the root
app.get(
  "/",
  apiReference({
    ...{
      spec: {
        content: openApiSpec,
      },
      theme: "none",
      layout: "modern",
      darkMode: true,
      forceDarkModeState: "dark",
      customCss,
      withDefaultFonts: false,
      metaData: {
        title: "StellarStack API Documentation",
        description:
          "Interactive API documentation for the StellarStack game server management panel.",
      },
      hideClientButton: true,
      hideDownloadButton: false,
      // Hides the "Ask AI", "Share", and other developer toolbar buttons
      showDeveloperTools: "never",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
      favicon: "/favicon.svg",
    },
  } as any)
);

const port = Number(process.env.PORT) || 3003;

console.log(`StellarStack API Docs running at http://localhost:${port}`);
console.log(`OpenAPI spec available at http://localhost:${port}/openapi.json`);

serve({
  fetch: app.fetch,
  port,
});
