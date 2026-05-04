ALTER TABLE "servers"
    ADD COLUMN IF NOT EXISTS "backup_limit" integer NOT NULL DEFAULT 5;
