-- The schema declared `startup_extra` (text, nullable) and
-- `allocation_limit` (int, default 3, not null) but neither column was
-- ever in a migration, so the server-create insert was failing with
-- `column "startup_extra" of relation "servers" does not exist`.
ALTER TABLE "servers"
    ADD COLUMN IF NOT EXISTS "startup_extra" text,
    ADD COLUMN IF NOT EXISTS "allocation_limit" integer NOT NULL DEFAULT 3;
