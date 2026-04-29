import { useMutation } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"

/**
 * Mutation: send a power action to a server. The API enqueues a
 * server.power job; the daemon's lifecycle Watcher emits the matching
 * `server.state.changed` event, which the panel-event WS picks up.
 */
export const useServerPower = (serverId: string) =>
  useMutation({
    mutationFn: (action: "start" | "stop" | "restart" | "kill") =>
      apiFetch<{ ok: true }>(`/servers/${serverId}/power`, {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
  })
