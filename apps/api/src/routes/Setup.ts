import { Hono } from "hono"
import { count, eq } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { usersTable } from "@workspace/db/schema/auth"
import {
  nodeAllocationsTable,
  nodesTable,
} from "@workspace/db/schema/nodes"

import type { Auth } from "@/auth"
import type { Env } from "@/env"

const setupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(80),
})

/**
 * Onboarding endpoint for the desktop app. The first time the app launches
 * the user fills a one-form prompt that hits this route — it creates the
 * admin account, registers the bundled daemon as a `local` node with the
 * pre-generated HMAC key, and seeds a default allocation pool so the
 * panel is usable straight away.
 *
 * Subsequent launches see `needsSetup: false` and skip onboarding.
 *
 * `STELLAR_DESKTOP_DAEMON_KEY` is the per-install random secret the
 * Electron main process generated and pinned in `electron-store` — the
 * same key it wrote to the daemon's local config so the two ends agree
 * without any explicit pairing dance.
 */
export const buildSetupRoute = (params: {
  auth: Auth
  db: Db
  env: Env
}) => {
  const { auth, db, env } = params

  return new Hono()
    .get("/", async (c) => {
      const [row] = await db.select({ value: count() }).from(usersTable)
      const userCount = row?.value ?? 0
      return c.json({
        needsSetup: userCount === 0,
        // Surface this so the onboarding window can hide itself when run
        // against a hosted API by mistake.
        mode: env.STELLAR_DESKTOP_DAEMON_KEY !== undefined ? "desktop" : "hosted",
      })
    })
    .post("/", async (c) => {
      // Refuse if a user already exists — onboarding is one-shot.
      const [existing] = await db.select({ value: count() }).from(usersTable)
      if ((existing?.value ?? 0) > 0) {
        return c.json({ ok: false, error: "already_set_up" }, 409)
      }

      const parsed = setupBody.safeParse(await c.req.json())
      if (!parsed.success) {
        return c.json({ ok: false, error: "invalid_body" }, 400)
      }
      const { email, password, displayName } = parsed.data

      // Hand off to better-auth's email sign-up. It hashes the password,
      // inserts the user row, and the existing `databaseHooks.user.create`
      // hook flips `isAdmin: true` because they're the only user.
      // `auth.api.signUpEmail` returns headers we need to forward to the
      // browser so the session cookie sticks.
      const signUp = await auth.api.signUpEmail({
        body: { email, password, name: displayName },
        returnHeaders: true,
      })
      if (signUp.response === null || signUp.response === undefined) {
        return c.json({ ok: false, error: "signup_failed" }, 500)
      }

      // Seed the local node + allocation pool. Only when the desktop
      // app is the caller — `STELLAR_DESKTOP_DAEMON_KEY` gates it.
      // Hosted installs add nodes via the admin UI.
      const desktopKey = env.STELLAR_DESKTOP_DAEMON_KEY
      const desktopNodeId = env.STELLAR_DESKTOP_DAEMON_NODE_ID
      if (
        desktopKey !== undefined &&
        desktopKey !== "" &&
        desktopNodeId !== undefined &&
        desktopNodeId !== ""
      ) {
        await seedLocalNode({
          db,
          daemonKey: desktopKey,
          daemonNodeId: desktopNodeId,
          daemonPort: env.STELLAR_DESKTOP_DAEMON_PORT ?? 18081,
          sftpPort: env.STELLAR_DESKTOP_SFTP_PORT ?? 12022,
        })
      }

      // Forward better-auth's Set-Cookie headers so the browser picks up
      // the session — the next request from the renderer is signed-in.
      const headers = signUp.headers
      const setCookies = headers instanceof Headers
        ? headers.getSetCookie?.() ?? []
        : []
      for (const cookie of setCookies) {
        c.header("Set-Cookie", cookie, { append: true })
      }
      return c.json({ ok: true })
    })
}

const seedLocalNode = async (params: {
  db: Db
  daemonKey: string
  daemonNodeId: string
  daemonPort: number
  sftpPort: number
}): Promise<void> => {
  const { db, daemonKey, daemonNodeId, daemonPort, sftpPort } = params

  // Try to read the row by the desktop's pre-minted UUID first — that's
  // the canonical identity. Fall back to name match for the edge case
  // where the user nuked their secrets file but left the DB.
  const existingById = await db
    .select({ id: nodesTable.id })
    .from(nodesTable)
    .where(eq(nodesTable.id, daemonNodeId))
    .limit(1)
  let nodeId = existingById[0]?.id

  if (nodeId === undefined) {
    const existingByName = await db
      .select({ id: nodesTable.id })
      .from(nodesTable)
      .where(eq(nodesTable.name, "local"))
      .limit(1)
    nodeId = existingByName[0]?.id
  }

  if (nodeId === undefined) {
    const [inserted] = await db
      .insert(nodesTable)
      .values({
        id: daemonNodeId,
        name: "local",
        fqdn: "127.0.0.1",
        scheme: "http",
        daemonPort,
        sftpPort,
        daemonPublicKey: daemonKey,
        memoryTotalMb: 16_384,
        diskTotalMb: 200_000,
      })
      .returning({ id: nodesTable.id })
    nodeId = inserted?.id
  } else {
    // Sync the row's HMAC key with whatever electron-store currently
    // holds. This is the recovery path for "user reinstalled but kept
    // the database" — the desktop generates a fresh key and we update
    // the row to match.
    await db
      .update(nodesTable)
      .set({
        daemonPublicKey: daemonKey,
        daemonPort,
        sftpPort,
      })
      .where(eq(nodesTable.id, nodeId))
  }

  if (nodeId === undefined) return

  // Seed an allocation pool on 0.0.0.0 — most-flexible default; the
  // user binds to whatever interface they actually want via their
  // router. 100 ports is plenty for a single desktop install.
  const existingAllocations = await db
    .select({ value: count() })
    .from(nodeAllocationsTable)
    .where(eq(nodeAllocationsTable.nodeId, nodeId))
  if ((existingAllocations[0]?.value ?? 0) > 0) return

  const rows = []
  for (let port = 25_500; port <= 25_599; port++) {
    rows.push({
      nodeId,
      ip: "0.0.0.0",
      port,
    })
  }
  await db.insert(nodeAllocationsTable).values(rows)
}
