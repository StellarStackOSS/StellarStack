import type { Blueprint } from "@workspace/shared/blueprint.types"

/**
 * Wire shape returned by `GET /admin/blueprints`. The persisted columns mirror
 * the Blueprint schema; createdAt/updatedAt are ISO strings on the wire.
 */
export type BlueprintListRow = Omit<Blueprint, "schemaVersion" | "install"> & {
  id: string
  schemaVersion: string
  installImage: string
  installEntrypoint: string
  installScript: string
  createdAt: string
  updatedAt: string
}
