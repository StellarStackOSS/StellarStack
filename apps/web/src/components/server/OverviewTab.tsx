import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"

import { ApiFetchError } from "@/lib/ApiFetch"
import { ConsoleTerminal } from "@/components/ConsoleTerminal"
import { EventLog } from "@/components/EventLog"
import { LiveStatsCard } from "@/components/LiveStatsCard"
import { translateApiError } from "@/lib/TranslateError"
import { useConsole } from "@/hooks/useConsole"
import { useServerLayout } from "@/components/ServerLayoutContext"
import { useServerPower } from "@/hooks/useServerPower"
import { useServerStats } from "@/hooks/useServerStats"

type PowerAction = "start" | "stop" | "restart" | "kill"

/**
 * Default tab on `/servers/$id`. Hosts the power controls, live stats,
 * console terminal, and event log. Reads from `ServerLayoutContext` so it
 * shares the panel-event subscription with sibling tabs.
 */
export const OverviewTab = () => {
  const { t } = useTranslation()
  const { server, status, events, wsState } = useServerLayout()
  const power = useServerPower(server.id)
  const stats = useServerStats(server.id, events)

  const consoleEnabled =
    status === "starting" || status === "running" || status === "stopping"
  const consoleStream = useConsole(server.id, consoleEnabled)

  const [powerError, setPowerError] = useState<string | null>(null)

  const handlePower = async (action: PowerAction) => {
    setPowerError(null)
    try {
      await power.mutateAsync(action)
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setPowerError(translateApiError(t, err.body.error))
      } else if (err instanceof Error) {
        setPowerError(err.message)
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="border-border bg-card text-card-foreground rounded-md border p-4">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">{server.name}</h1>
            <p className="text-muted-foreground text-xs">
              {t(`lifecycle.${status}`, { ns: "common" })} · {server.dockerImage}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => handlePower("start")}
              disabled={
                power.isPending ||
                status === "running" ||
                status === "starting"
              }
            >
              Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePower("restart")}
              disabled={power.isPending || status !== "running"}
            >
              Restart
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePower("stop")}
              disabled={
                power.isPending ||
                status === "stopped" ||
                status === "installed_stopped" ||
                status === "crashed"
              }
            >
              Stop
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handlePower("kill")}
              disabled={
                power.isPending ||
                status === "stopped" ||
                status === "installed_stopped" ||
                status === "crashed"
              }
            >
              Kill
            </Button>
          </div>
        </header>
        {powerError !== null ? (
          <p className="text-destructive text-xs" role="alert">
            {powerError}
          </p>
        ) : null}
      </section>
      <LiveStatsCard stats={stats} />
      {consoleEnabled ? (
        <ConsoleTerminal
          state={consoleStream.state}
          lines={consoleStream.lines}
          onSend={consoleStream.send}
        />
      ) : (
        <section className="border-border bg-card text-card-foreground rounded-md border p-4">
          <header className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">Console</h2>
            <span className="text-muted-foreground text-xs">offline</span>
          </header>
          <p className="text-muted-foreground text-xs">
            The server is {t(`lifecycle.${status}`, { ns: "common" })}. Press{" "}
            <strong>Start</strong> to attach to the live console.
          </p>
        </section>
      )}
      <EventLog state={wsState} events={events} />
    </div>
  )
}
