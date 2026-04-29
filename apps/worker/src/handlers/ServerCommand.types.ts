/**
 * Payload shape for the `server.command` queue. Producers (the API
 * scheduler tick) hand off the resolved `serverId` + console line; the
 * worker bridges to the daemon.
 */
export type ServerCommandJobData = {
  serverId: string
  line: string
}
