/**
 * BullMQ payload for the `server.install` queue. Mirrors
 * `apps/api/src/queues.ts`.
 */
export type ServerInstallJobData = {
  serverId: string
  reinstall?: boolean
  keepFiles?: boolean
  snapshotFirst?: boolean
}
