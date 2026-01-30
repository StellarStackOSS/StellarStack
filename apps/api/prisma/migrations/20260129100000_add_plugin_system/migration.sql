-- CreateTable
CREATE TABLE "plugins" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "author" TEXT,
    "license" TEXT NOT NULL DEFAULT 'MIT',
    "category" TEXT NOT NULL DEFAULT 'other',
    "icon" TEXT,
    "homepage" TEXT,
    "repository" TEXT,
    "status" TEXT NOT NULL DEFAULT 'installed',
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "gameTypes" TEXT[] DEFAULT ARRAY['*']::TEXT[],
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "manifest" JSONB NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "defaultConfig" JSONB NOT NULL DEFAULT '{}',
    "configSchema" JSONB,
    "uiMetadata" JSONB,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_storage" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "serverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_storage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plugins_pluginId_key" ON "plugins"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_storage_pluginId_idx" ON "plugin_storage"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_storage_serverId_idx" ON "plugin_storage"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_storage_pluginId_key_serverId_key" ON "plugin_storage"("pluginId", "key", "serverId");

-- AddForeignKey
ALTER TABLE "plugin_storage" ADD CONSTRAINT "plugin_storage_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
