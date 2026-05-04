CREATE TABLE IF NOT EXISTS "install_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "server_id" uuid NOT NULL REFERENCES "servers"("id") ON DELETE CASCADE,
    "seq" bigint NOT NULL,
    "stream" text NOT NULL,
    "line" text NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "install_logs_server_id_seq_idx"
    ON "install_logs" ("server_id", "seq");
