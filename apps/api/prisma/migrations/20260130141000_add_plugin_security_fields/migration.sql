-- Add security and git-related fields to plugins table
ALTER TABLE "plugins" ADD COLUMN "trustLevel" TEXT NOT NULL DEFAULT 'community';
ALTER TABLE "plugins" ADD COLUMN "securityScore" INTEGER;
ALTER TABLE "plugins" ADD COLUMN "securityReport" JSONB;
ALTER TABLE "plugins" ADD COLUMN "gitRepoUrl" TEXT;
ALTER TABLE "plugins" ADD COLUMN "gitBranch" TEXT;
ALTER TABLE "plugins" ADD COLUMN "lastChecked" TIMESTAMP(3);
