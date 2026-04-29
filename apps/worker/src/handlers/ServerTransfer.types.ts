/**
 * BullMQ job payload for the `server.transfer` queue.
 * The actual parameters (source/target nodes, token) are loaded from
 * the `server_transfers` row so they don't float around in Redis.
 */
export type ServerTransferJobData = {
  transferId: string
}
