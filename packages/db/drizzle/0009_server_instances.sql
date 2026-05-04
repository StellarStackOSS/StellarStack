ALTER TABLE "servers"
  ADD COLUMN "parent_id" uuid REFERENCES "servers"("id") ON DELETE CASCADE;

CREATE INDEX "servers_parent_id_idx" ON "servers" ("parent_id");
