-- DropForeignKey
ALTER TABLE "node_metrics_snapshots" DROP CONSTRAINT "node_metrics_snapshots_nodeId_fkey";

-- DropForeignKey
ALTER TABLE "server_metrics_snapshots" DROP CONSTRAINT "server_metrics_snapshots_serverId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_metrics_snapshots" DROP CONSTRAINT "webhook_metrics_snapshots_webhookId_fkey";

-- AlterTable
ALTER TABLE "node_metrics_snapshots" ALTER COLUMN "cpuUsage" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "schedule_tasks" ADD COLUMN     "triggerMode" TEXT NOT NULL DEFAULT 'TIME_DELAY';

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "executingTaskIndex" INTEGER;

-- AlterTable
ALTER TABLE "server_metrics_snapshots" ALTER COLUMN "cpuUsage" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "fps" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "tps" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "plugin_audit_logs" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT,
    "params" JSONB NOT NULL,
    "result" TEXT NOT NULL,
    "denialReason" TEXT,
    "error" TEXT,
    "executedOperations" INTEGER,
    "duration" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plugin_audit_logs_pluginId_timestamp_idx" ON "plugin_audit_logs"("pluginId", "timestamp");

-- CreateIndex
CREATE INDEX "plugin_audit_logs_userId_timestamp_idx" ON "plugin_audit_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "plugin_audit_logs_serverId_timestamp_idx" ON "plugin_audit_logs"("serverId", "timestamp");

-- CreateIndex
CREATE INDEX "plugin_audit_logs_result_idx" ON "plugin_audit_logs"("result");

-- AddForeignKey
ALTER TABLE "node_metrics_snapshots" ADD CONSTRAINT "node_metrics_snapshots_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_metrics_snapshots" ADD CONSTRAINT "server_metrics_snapshots_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_metrics_snapshots" ADD CONSTRAINT "webhook_metrics_snapshots_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
