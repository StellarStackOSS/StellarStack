/**
 * BullMQ payload for the `server.power` queue. Mirrors
 * `apps/api/src/queues.ts`.
 */
export type ServerPowerJobData = {
  serverId: string
  action: "start" | "stop" | "restart" | "kill"
}
