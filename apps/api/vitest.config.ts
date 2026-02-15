import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@workspace/api",
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
