import { eq } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import { backupsTable } from "@workspace/db/schema/backups"
import { nodesTable } from "@workspace/db/schema/nodes"
import { serversTable } from "@workspace/db/schema/servers"

import { callDaemon } from "@/lib/DaemonHttp"

/**
 * Insert a `pending` backup row and kick off the daemon call in the
 * background. Returns the pending row's id immediately so the API
 * response doesn't block on the tarball walk + gzip — useBackups polls
 * the list every 5s while any row is `pending`, so the UI tracks the
 * progression pending → ready (or pending → failed) without the POST
 * hanging for tens of seconds.
 *
 * Used by the manual /servers/:id/backups POST and by the schedule
 * executor's `backup` task type.
 */
export const runBackup = async (params: {
  db: Db
  serverId: string
  name: string
}): Promise<string | null> => {
  const { db, serverId, name } = params
  const row = (
    await db
      .select({ server: serversTable, node: nodesTable })
      .from(serversTable)
      .innerJoin(nodesTable, eq(nodesTable.id, serversTable.nodeId))
      .where(eq(serversTable.id, serverId))
      .limit(1)
  )[0]
  if (row === undefined) return null
  if (row.node.daemonPublicKey === null) return null

  const [created] = await db
    .insert(backupsTable)
    .values({ serverId, name, storage: "local", state: "pending" })
    .returning({ id: backupsTable.id })
  if (created === undefined) return null

  const baseUrl = `${row.node.scheme}://${row.node.fqdn}:${row.node.daemonPort}`
  const nodeId = row.node.id
  const signingKeyHex = row.node.daemonPublicKey
  const backupId = created.id
  void (async () => {
    try {
      const resp = await callDaemon({
        baseUrl,
        nodeId,
        signingKeyHex,
        method: "POST",
        path: `/api/servers/${serverId}/backups?op=create`,
        body: { name },
      })
      if (!resp.ok) {
        await db
          .update(backupsTable)
          .set({ state: "failed", failureCode: "backups.create_failed" })
          .where(eq(backupsTable.id, backupId))
        return
      }
      const result = (await resp.json()) as {
        name: string
        bytes: number
        sha256: string
      }
      await db
        .update(backupsTable)
        .set({
          state: "ready",
          bytes: result.bytes,
          sha256: result.sha256,
          completedAt: new Date(),
        })
        .where(eq(backupsTable.id, backupId))
    } catch (err) {
      console.error("backup runner:", err)
      await db
        .update(backupsTable)
        .set({
          state: "failed",
          failureCode: "backups.create_failed",
        })
        .where(eq(backupsTable.id, backupId))
    }
  })()
  return backupId
}
