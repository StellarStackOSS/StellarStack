-- two-factor: per-user TOTP secret + backup codes
CREATE TABLE "two_factor" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "secret"       TEXT NOT NULL,
  "backup_codes" TEXT NOT NULL
);

-- two_factor_enabled flag on users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN DEFAULT FALSE;

-- passkeys: WebAuthn credential records
CREATE TABLE "passkey" (
  "id"            TEXT PRIMARY KEY,
  "name"          TEXT,
  "public_key"    TEXT NOT NULL,
  "user_id"       UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "credential_id" TEXT NOT NULL,
  "counter"       INTEGER NOT NULL,
  "device_type"   TEXT NOT NULL,
  "backed_up"     BOOLEAN NOT NULL,
  "transports"    TEXT,
  "created_at"    TIMESTAMPTZ DEFAULT NOW(),
  "aaguid"        TEXT
);

CREATE INDEX "passkey_user_id_idx" ON "passkey"("user_id");
CREATE INDEX "passkey_credential_id_idx" ON "passkey"("credential_id");
