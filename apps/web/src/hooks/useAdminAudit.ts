import { useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type { AuditListResponse } from "@/hooks/useAdminAudit.types"

type AuditQueryParams = {
  limit?: number
  offset?: number
  actorId?: string
  action?: string
  targetType?: string
  targetId?: string
}

const auditKey = (params: AuditQueryParams) =>
  ["admin", "audit", params] as const

export const useAdminAudit = (params: AuditQueryParams = {}) => {
  const qs = new URLSearchParams()
  if (params.limit !== undefined) qs.set("limit", String(params.limit))
  if (params.offset !== undefined) qs.set("offset", String(params.offset))
  if (params.actorId) qs.set("actorId", params.actorId)
  if (params.action) qs.set("action", params.action)
  if (params.targetType) qs.set("targetType", params.targetType)
  if (params.targetId) qs.set("targetId", params.targetId)
  const query = qs.toString()

  return useQuery({
    queryKey: auditKey(params),
    queryFn: () =>
      apiFetch<AuditListResponse>(`/admin/audit${query ? `?${query}` : ""}`),
    refetchInterval: 30_000,
  })
}
