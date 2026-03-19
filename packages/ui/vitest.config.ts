import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@stellarUI",
    environment: "jsdom",
    include: ["src/**/*.spec.{ts,tsx}"],
    setupFiles: ["@testing-library/jest-dom/vitest"],
    alias: {
      "@stellarUI": new URL("./src", import.meta.url).pathname,
    },
  },
});
