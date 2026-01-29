-- AlterTable
ALTER TABLE "servers" ADD COLUMN "autoShutdownEnabled" BOOLEAN;
ALTER TABLE "servers" ADD COLUMN "autoShutdownTimeout" INTEGER;
ALTER TABLE "servers" ADD COLUMN "lastActivityAt" TIMESTAMP(3);
