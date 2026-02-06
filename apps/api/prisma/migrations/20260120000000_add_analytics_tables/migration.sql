-- Add Analytics Tables

-- Node metrics snapshots
CREATE TABLE "node_metrics_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "cpuUsage" REAL NOT NULL,
    "memoryUsage" BIGINT NOT NULL,
    "memoryLimit" BIGINT NOT NULL,
    "diskUsage" BIGINT NOT NULL,
    "diskLimit" BIGINT NOT NULL,
    "activeContainers" INTEGER NOT NULL,
    "totalContainers" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "node_metrics_snapshots_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes" ("id") ON DELETE CASCADE
);

CREATE INDEX "node_metrics_snapshots_nodeId_idx" ON "node_metrics_snapshots"("nodeId");
CREATE INDEX "node_metrics_snapshots_capturedAt_idx" ON "node_metrics_snapshots"("capturedAt");

-- Server metrics snapshots
CREATE TABLE "server_metrics_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "cpuUsage" REAL NOT NULL,
    "memoryUsage" BIGINT NOT NULL,
    "memoryLimit" BIGINT NOT NULL,
    "diskUsage" BIGINT NOT NULL,
    "diskLimit" BIGINT NOT NULL,
    "uptime" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "players" INTEGER,
    "fps" REAL,
    "tps" REAL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "server_metrics_snapshots_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers" ("id") ON DELETE CASCADE
);

CREATE INDEX "server_metrics_snapshots_serverId_idx" ON "server_metrics_snapshots"("serverId");
CREATE INDEX "server_metrics_snapshots_capturedAt_idx" ON "server_metrics_snapshots"("capturedAt");

-- API metrics snapshots
CREATE TABLE "api_metrics_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latency" INTEGER NOT NULL,
    "requestSize" INTEGER,
    "responseSize" INTEGER,
    "userId" TEXT,
    "ipAddress" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "api_metrics_snapshots_endpoint_idx" ON "api_metrics_snapshots"("endpoint");
CREATE INDEX "api_metrics_snapshots_method_idx" ON "api_metrics_snapshots"("method");
CREATE INDEX "api_metrics_snapshots_capturedAt_idx" ON "api_metrics_snapshots"("capturedAt");

-- Webhook metrics snapshots
CREATE TABLE "webhook_metrics_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "webhookId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "statusCode" INTEGER,
    "latency" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "retryAttempt" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_metrics_snapshots_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks" ("id") ON DELETE CASCADE
);

CREATE INDEX "webhook_metrics_snapshots_webhookId_idx" ON "webhook_metrics_snapshots"("webhookId");
CREATE INDEX "webhook_metrics_snapshots_eventType_idx" ON "webhook_metrics_snapshots"("eventType");
CREATE INDEX "webhook_metrics_snapshots_success_idx" ON "webhook_metrics_snapshots"("success");
CREATE INDEX "webhook_metrics_snapshots_capturedAt_idx" ON "webhook_metrics_snapshots"("capturedAt");

-- Analytics aggregates
CREATE TABLE "analytics_aggregates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "referenceId" TEXT,
    "timeRange" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "dataPoints" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "analytics_aggregates_type_referenceId_timeRange_endTime_key" ON "analytics_aggregates"("type", "referenceId", "timeRange", "endTime");
CREATE INDEX "analytics_aggregates_type_idx" ON "analytics_aggregates"("type");
CREATE INDEX "analytics_aggregates_referenceId_idx" ON "analytics_aggregates"("referenceId");
CREATE INDEX "analytics_aggregates_endTime_idx" ON "analytics_aggregates"("endTime");
