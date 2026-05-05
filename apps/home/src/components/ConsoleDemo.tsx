import { useEffect, useState } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

const SCRIPT: string[] = [
  "[StellarStack Daemon]: Updating process configuration files...",
  "[StellarStack Daemon]: Pulling Docker container image, this could take a few minutes to complete...",
  "[StellarStack Daemon]: Finished pulling Docker container image",
  "stellarstack@9457566a~ Server marked as starting...",
  "[14:12:05] [Server thread/INFO]: Starting minecraft server version 1.21.4",
  "[14:12:05] [Server thread/INFO]: Loading properties",
  "[14:12:05] [Server thread/INFO]: Default game type: SURVIVAL",
  "[14:12:06] [Server thread/INFO]: Generating keypair",
  "[14:12:06] [Server thread/INFO]: Starting Minecraft server on *:25565",
  "[14:12:07] [Server thread/INFO]: Preparing level \"world\"",
  "[14:12:09] [Worker-Main-2/INFO]: Preparing spawn area: 64%",
  "[14:12:11] [Server thread/INFO]: Time elapsed: 4203 ms",
  "[14:12:11] [Server thread/INFO]: Done (4.203s)! For help, type \"help\"",
  "stellarstack@9457566a~ Server marked as running...",
]

const colour = (line: string): string => {
  if (line.startsWith("[StellarStack")) return "text-amber-300/90"
  if (line.startsWith("stellarstack@")) return "text-emerald-400/90"
  if (line.includes("/INFO]")) return "text-zinc-300"
  return "text-zinc-300"
}

export const ConsoleDemo = () => {
  const [lines, setLines] = useState<string[]>([])
  useEffect(() => {
    let i = 0
    const id = window.setInterval(() => {
      setLines((prev) => {
        if (i >= SCRIPT.length) {
          // Loop: clear after a short pause
          if (prev.length === SCRIPT.length) return prev
          return prev
        }
        const next = [...prev, SCRIPT[i]!]
        i++
        return next
      })
    }, 600)
    const reset = window.setInterval(() => {
      i = 0
      setLines([])
    }, SCRIPT.length * 600 + 5_000)
    return () => {
      window.clearInterval(id)
      window.clearInterval(reset)
    }
  }, [])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Console</span>
          <span className="text-xs font-normal text-zinc-600">
            {lines.length} lines
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CardInner className="relative h-72 overflow-hidden p-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[#0f0f0f] to-transparent" />
          <div className="font-mono h-full overflow-auto px-3 py-2 text-[11.5px] leading-relaxed">
            {lines.map((l, i) => (
              <div key={i} className={`${colour(l)} whitespace-pre-wrap break-all`}>
                {l}
              </div>
            ))}
          </div>
        </CardInner>
      </CardContent>
    </Card>
  )
}
