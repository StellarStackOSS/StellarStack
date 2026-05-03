-- Collapse the lifecycle enum to four states (offline, starting, running,
-- stopping) and add install_state to track install progress separately.
--
-- Mapping for existing rows:
--   running     -> running
--   starting    -> starting
--   stopping    -> stopping
--   stopped     -> offline
--   installed_stopped -> offline
--   crashed     -> offline
--   installing  -> offline (with install_state = 'running')
--   restoring_backup -> offline
--
-- The `status` column is plain text, not a Postgres enum, so this is a
-- simple UPDATE rather than a typed-enum migration.

ALTER TABLE "servers"
    ADD COLUMN "install_state" text NOT NULL DEFAULT 'pending';

UPDATE "servers"
SET "install_state" = 'running'
WHERE "status" = 'installing';

UPDATE "servers"
SET "install_state" = 'succeeded'
WHERE "install_state" = 'pending'
    AND "status" IN ('starting','running','stopping','stopped','installed_stopped','crashed');

UPDATE "servers"
SET "status" = 'offline'
WHERE "status" IN ('stopped','installed_stopped','crashed','installing','restoring_backup');

ALTER TABLE "servers"
    ALTER COLUMN "status" SET DEFAULT 'offline';
