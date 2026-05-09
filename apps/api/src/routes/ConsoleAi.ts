import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { serversTable } from "@workspace/db/schema/servers"
import { ApiException, apiValidationError } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import type { Env } from "@/env"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

const chatSchema = z.object({
  question: z.string().min(1).max(2000),
  logs: z.array(z.string()).max(200),
})

const SYSTEM_PROMPT = `You are a helpful game server assistant integrated into StellarStack, a game server management panel. You have access to recent console logs from a game server.

Your role is to:
- Help diagnose crashes, errors, and performance issues
- Explain what log messages mean in plain language
- Suggest fixes and next steps
- Answer questions about server configuration and operations

Keep your answers concise and actionable. Use markdown formatting for code and commands. If the logs do not contain enough information to answer confidently, say so.`

export const buildConsoleAiRoute = (params: {
  auth: Auth
  db: Db
  env: Env
}) => {
  const { auth, db, env } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .post("/:id/console/ai", async (c) => {
      if (!env.ANTHROPIC_API_KEY) {
        throw new ApiException("ai.not_configured", { status: 503 })
      }

      const id = c.req.param("id")
      const user = c.get("user")

      const server = (
        await db
          .select({ id: serversTable.id, name: serversTable.name, ownerId: serversTable.ownerId })
          .from(serversTable)
          .where(eq(serversTable.id, id))
          .limit(1)
      )[0]
      if (server === undefined) {
        throw new ApiException("servers.not_found", { status: 404 })
      }
      if (!user.isAdmin && server.ownerId !== user.id) {
        throw new ApiException("permissions.denied", { status: 403 })
      }

      const parsed = chatSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const { question, logs } = parsed.data

      const logBlock =
        logs.length > 0
          ? `Recent console output (last ${logs.length} lines):\n\`\`\`\n${logs.join("\n")}\n\`\`\``
          : "No console output is available."

      const userMessage = `${logBlock}\n\n---\n\n${question}`

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        console.error("Anthropic API error", res.status, body)
        throw new ApiException("ai.upstream_error", { status: 502 })
      }

      const data = (await res.json()) as {
        content: Array<{ type: string; text: string }>
      }
      const reply = data.content.find((b) => b.type === "text")?.text ?? ""

      return c.json({ reply })
    })
}
