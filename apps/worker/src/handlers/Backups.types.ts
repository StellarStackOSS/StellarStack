/**
 * BullMQ payloads for the backup queues. Mirrors apps/api/src/queues.ts.
 */
export type BackupCreateJobData = {
  backupId: string
}

export type BackupRestoreJobData = {
  backupId: string
  snapshotBeforeRestore?: boolean
}

export type BackupDeleteJobData = {
  backupId: string
}
