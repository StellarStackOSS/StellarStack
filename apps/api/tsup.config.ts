import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // Inline workspace deps so the runtime image never has to resolve
  // `@workspace/db/client` to its raw .ts source. Without this Node
  // tries to load packages/db/src/client.ts and crashes with
  // ERR_UNKNOWN_FILE_EXTENSION on every request.
  noExternal: [/^@workspace\//],
})
