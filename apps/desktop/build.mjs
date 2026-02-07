/**
 * Desktop build orchestrator.
 *
 * --dev: Skip web/API builds, just launch Tauri (sidecars start live servers)
 * (no flag): Full production build pipeline
 */

import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const isDev = process.argv.includes("--dev");

const run = (cmd, cwd = root, extraEnv = {}) => {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, {
    stdio: "inherit",
    cwd,
    env: { ...process.env, ...extraEnv },
  });
};

if (isDev) {
  // Dev mode: no build steps, Tauri sidecars start live dev servers
  run("pnpm --filter desktop tauri dev", root, { RUST_LOG: "debug" });
} else {
  // Production: full build pipeline
  run("pnpm --filter web build:desktop", root, { DESKTOP_BUILD: "true" });
  run("node apps/api/build-desktop.mjs");
  run("node apps/desktop/prepare-resources.mjs");
  run("pnpm --filter desktop tauri build");
}
