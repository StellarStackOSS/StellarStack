CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "encrypted" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "server_mods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "server_id" uuid NOT NULL REFERENCES "servers"("id") ON DELETE CASCADE,
  "platform" text NOT NULL,
  "project_id" text NOT NULL,
  "version_id" text NOT NULL,
  "name" text NOT NULL,
  "slug" text,
  "kind" text NOT NULL,
  "loader" text,
  "game_version" text,
  "file_path" text NOT NULL,
  "file_size" bigint,
  "installed_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "server_mods_server_id_idx" ON "server_mods" ("server_id");
CREATE UNIQUE INDEX IF NOT EXISTS "server_mods_server_project_unique"
  ON "server_mods" ("server_id", "platform", "project_id");
