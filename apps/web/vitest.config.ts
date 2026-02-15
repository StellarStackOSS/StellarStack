import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "web",
    environment: "happy-dom",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["@testing-library/jest-dom/vitest"],
    alias: {
      "@stellarUI": new URL("../../packages/ui/src", import.meta.url).pathname,
    },
  },
});
