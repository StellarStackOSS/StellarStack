/**
 * Schedule operation routes for the mock daemon.
 * Implements sync, create, update, delete, and run schedule endpoints.
 */

import { Hono } from "hono";
import type { Schedule } from "../Types.js";
import { GetServer, SetSchedules, UpsertSchedule, DeleteSchedule, GetSchedules } from "../State.js";
import { BroadcastToServer } from "../Websocket.js";

const ScheduleRoutes = new Hono();

/**
 * POST /schedules/sync — Sync all schedules from the panel.
 */
ScheduleRoutes.post("/sync", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const schedules = await c.req.json<Schedule[]>();
  SetSchedules(serverId, schedules);

  return c.body(null, 204);
});

/**
 * POST /schedules — Create a new schedule.
 */
ScheduleRoutes.post("/", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const schedule = await c.req.json<Schedule>();
  UpsertSchedule(serverId, schedule);

  return c.body(null, 201);
});

/**
 * PATCH /schedules — Update an existing schedule.
 */
ScheduleRoutes.patch("/", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const schedule = await c.req.json<Schedule>();
  UpsertSchedule(serverId, schedule);

  return c.body(null, 204);
});

/**
 * DELETE /schedules — Delete a schedule.
 */
ScheduleRoutes.delete("/", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const schedule = await c.req.json<Schedule>();
  DeleteSchedule(serverId, schedule.id);

  return c.body(null, 204);
});

/**
 * POST /schedules/:scheduleId/run — Manually run a schedule.
 */
ScheduleRoutes.post("/:scheduleId/run", (c) => {
  const serverId = c.req.param("server_id") as string;
  const scheduleId = c.req.param("scheduleId");
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const schedules = GetSchedules(serverId);
  const schedule = schedules.find((s) => s.id === scheduleId);

  if (!schedule) {
    return c.json({ error: "Schedule not found" }, 404);
  }

  /** Broadcast schedule execution status */
  BroadcastToServer(serverId, {
    event: "schedule status",
    args: [{
      id: schedule.id,
      name: schedule.name,
      is_executing: true,
      executing_task_index: 0,
      last_execution_time: Math.floor(Date.now() / 1000),
      enabled: schedule.enabled,
    }],
  });

  /** Simulate completion after 1 second */
  setTimeout(() => {
    BroadcastToServer(serverId, {
      event: "schedule status",
      args: [{
        id: schedule.id,
        name: schedule.name,
        is_executing: false,
        executing_task_index: 0,
        last_execution_time: Math.floor(Date.now() / 1000),
        enabled: schedule.enabled,
        last_result: "success",
      }],
    });
  }, 1000);

  return c.body(null, 204);
});

export default ScheduleRoutes;
