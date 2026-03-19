/**
 * System routes for the mock daemon.
 * Provides system info and hardware stats endpoints.
 */

import { Hono } from "hono";
import { GenerateSystemInfo, GenerateHardwareStats } from "../Generators.js";
import { GetAllServers } from "../State.js";

const SystemRoutes = new Hono();

/**
 * GET /api/system — Returns static system information.
 */
SystemRoutes.get("/system", (c) => {
  const serverCount = GetAllServers().length;
  return c.json(GenerateSystemInfo(serverCount));
});

/**
 * GET /api/stats — Returns randomized hardware statistics.
 */
SystemRoutes.get("/stats", (c) => {
  return c.json(GenerateHardwareStats());
});

export default SystemRoutes;
