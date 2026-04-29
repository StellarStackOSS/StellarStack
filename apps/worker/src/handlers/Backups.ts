import type { Job } from "bullmq"
import { eq } from "drizzle-orm"
import type { Logger } from "pino"

import type { Db } from "@workspace/db/client.types"
import {
  backupDestinationsTable,
  backupsTable,
} from "@workspace/db/schema/backups"
import { serversTable } from "@workspace/db/schema/servers"

import { DaemonClient } from "@/lib/DaemonClient"
import type {
  BackupCreateJobData,
  BackupDeleteJobData,
  BackupRestoreJobData,
} from "@/handlers/Backups.types"

type AckEnvelope = {
  type: "ack"
  path?: string
  bytes?: number
  sha256?: string
  key?: string
}

const isAck = (payload: unknown): payload is AckEnvelope =>
  typeof payload === "object" &&
  payload !== null &&
  (payload as { type?: unknown }).type === "ack"

const requireServer = async (db: Db, serverId: string) => {
  const row = (
    await db.select().from(serversTable).where(eq(serversTable.id, serverId)).limit(1)
  )[0]
  if (row === undefined) {
    throw new Error(`Server ${serverId} not found`)
  }
  return row
}

const requireBackup = async (db: Db, backupId: string) => {
  const row = (
    await db.select().from(backupsTable).where(eq(backupsTable.id, backupId)).limit(1)
  )[0]
  if (row === undefined) {
    throw new Error(`Backup ${backupId} not found`)
  }
  return row
}

const loadDestination = async (db: Db, serverId: string) => {
  const rows = await db
    .select()
    .from(backupDestinationsTable)
    .where(eq(backupDestinationsTable.serverId, serverId))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Build the `backup.create` handler. Drives:
 *   1. server.create_backup → daemon archives the bind-mount
 *   2. (if storage = "s3") server.upload_backup_s3 → daemon streams the
 *      archive to the configured S3-compatible target
 *   3. update the backups row with sha256/bytes/state=ready
 */
export const buildBackupCreateHandler = (params: {
  daemonClient: DaemonClient
  db: Db
  logger: Logger
}) => {
  const { daemonClient, db, logger } = params
  return async (job: Job<BackupCreateJobData>) => {
    const log = logger.child({ jobId: job.id, backupId: job.data.backupId })
    const backup = await requireBackup(db, job.data.backupId)
    const server = await requireServer(db, backup.serverId)

    try {
      log.info("Creating archive on daemon")
      const archive = await daemonClient.request({
        nodeId: server.nodeId,
        message: {
          type: "server.create_backup",
          serverId: server.id,
          name: backup.name,
        } as never,
        timeoutMs: 30 * 60_000,
      })
      const archiveMessage = archive.envelope.message as unknown
      if (!isAck(archiveMessage)) {
        throw new Error("daemon refused archive")
      }

      let s3Key: string | null = null
      if (backup.storage === "s3") {
        const dest = await loadDestination(db, server.id)
        if (dest === null) {
          throw new Error("S3 destination missing")
        }
        log.info({ bucket: dest.bucket }, "Uploading archive to S3")
        const upload = await daemonClient.request({
          nodeId: server.nodeId,
          message: {
            type: "server.upload_backup_s3",
            serverId: server.id,
            name: backup.name,
            endpoint: dest.endpoint,
            region: dest.region,
            bucket: dest.bucket,
            prefix: dest.prefix,
            accessKeyId: dest.accessKeyId,
            secretAccessKey: dest.secretAccessKey,
            forcePathStyle: dest.forcePathStyle,
            sha256: archiveMessage.sha256 ?? "",
          } as never,
          timeoutMs: 60 * 60_000,
        })
        const uploadMessage = upload.envelope.message as unknown
        if (!isAck(uploadMessage)) {
          throw new Error("daemon refused upload")
        }
        s3Key = uploadMessage.key ?? null
      }

      await db
        .update(backupsTable)
        .set({
          state: "ready",
          sha256: archiveMessage.sha256 ?? null,
          bytes: archiveMessage.bytes ?? 0,
          s3ObjectKey: s3Key,
          completedAt: new Date(),
          failureCode: null,
        })
        .where(eq(backupsTable.id, backup.id))
      log.info({ bytes: archiveMessage.bytes }, "Backup ready")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error({ err }, "Backup create failed")
      await db
        .update(backupsTable)
        .set({
          state: "failed",
          failureCode: "backups.upload_failed",
        })
        .where(eq(backupsTable.id, backup.id))
      throw new Error(message)
    }
  }
}

/**
 * Build the `backup.restore` handler. Stops the server, asks the daemon
 * to unpack the archive over the bind-mount, then leaves the server in
 * `installed_stopped` for the operator to start.
 */
export const buildBackupRestoreHandler = (params: {
  daemonClient: DaemonClient
  db: Db
  logger: Logger
}) => {
  const { daemonClient, db, logger } = params
  return async (job: Job<BackupRestoreJobData>) => {
    const log = logger.child({ jobId: job.id, backupId: job.data.backupId })
    const backup = await requireBackup(db, job.data.backupId)
    const server = await requireServer(db, backup.serverId)

    log.info("Stopping server before restore")
    await daemonClient
      .request({
        nodeId: server.nodeId,
        message: { type: "server.kill", serverId: server.id },
        timeoutMs: 60_000,
      })
      .catch((err) => log.warn({ err }, "Stop on restore failed (continuing)"))

    log.info("Restoring archive")
    const result = await daemonClient.request({
      nodeId: server.nodeId,
      message: {
        type: "server.restore_backup",
        serverId: server.id,
        name: backup.name,
      } as never,
      timeoutMs: 60 * 60_000,
    })
    if (result.envelope.message.type === "error") {
      throw new Error(`daemon error: ${result.envelope.message.code}`)
    }

    await db
      .update(serversTable)
      .set({ status: "installed_stopped", updatedAt: new Date() })
      .where(eq(serversTable.id, server.id))
    log.info("Restore complete")
  }
}

/**
 * Build the `backup.delete` handler. Asks the daemon to remove the
 * archive (and any S3 object), then drops the row.
 */
export const buildBackupDeleteHandler = (params: {
  daemonClient: DaemonClient
  db: Db
  logger: Logger
}) => {
  const { daemonClient, db, logger } = params
  return async (job: Job<BackupDeleteJobData>) => {
    const log = logger.child({ jobId: job.id, backupId: job.data.backupId })
    const backup = await requireBackup(db, job.data.backupId)
    const server = await requireServer(db, backup.serverId)

    const dest =
      backup.storage === "s3" ? await loadDestination(db, server.id) : null

    log.info("Deleting backup on daemon")
    const message: Record<string, unknown> = {
      type: "server.delete_backup",
      serverId: server.id,
      name: backup.name,
    }
    if (dest !== null && backup.s3ObjectKey !== null) {
      message.s3 = {
        endpoint: dest.endpoint,
        region: dest.region,
        bucket: dest.bucket,
        accessKeyId: dest.accessKeyId,
        secretAccessKey: dest.secretAccessKey,
        forcePathStyle: dest.forcePathStyle,
        key: backup.s3ObjectKey,
      }
    }
    await daemonClient
      .request({
        nodeId: server.nodeId,
        message: message as never,
        timeoutMs: 5 * 60_000,
      })
      .catch((err) => log.warn({ err }, "Daemon delete failed (continuing)"))

    await db.delete(backupsTable).where(eq(backupsTable.id, backup.id))
    log.info("Backup row removed")
  }
}
