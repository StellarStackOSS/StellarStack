CREATE TABLE "database_hosts" (
  "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                     TEXT NOT NULL,
  "node_id"                  UUID NOT NULL REFERENCES "nodes"("id") ON DELETE RESTRICT,
  "allocation_id"            UUID NOT NULL REFERENCES "node_allocations"("id") ON DELETE RESTRICT,
  "db_type"                  TEXT NOT NULL,
  "root_user"                TEXT NOT NULL,
  "root_password_encrypted"  TEXT NOT NULL,
  "memory_limit_mb"          BIGINT NOT NULL,
  "disk_limit_mb"            BIGINT NOT NULL,
  "status"                   TEXT NOT NULL DEFAULT 'offline',
  "suspended"                BOOLEAN NOT NULL DEFAULT FALSE,
  "shared"                   BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "database_hosts_node_id_idx" ON "database_hosts"("node_id");

CREATE TABLE "databases" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "host_id"             UUID NOT NULL REFERENCES "database_hosts"("id") ON DELETE CASCADE,
  "server_id"           UUID NOT NULL REFERENCES "servers"("id") ON DELETE CASCADE,
  "created_by_id"       UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "name"                TEXT NOT NULL,
  "username"            TEXT NOT NULL,
  "password_encrypted"  TEXT NOT NULL,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "databases_host_id_idx" ON "databases"("host_id");
CREATE INDEX "databases_server_id_idx" ON "databases"("server_id");
