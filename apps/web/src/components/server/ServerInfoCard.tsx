import {
  Card,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

import { useServerAllocations } from "@/hooks/useServerAllocations"
import type { ServerDetailRow } from "@/hooks/useServers.types"

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 py-1.5 text-sm border-b border-border/50 last:border-0">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className="font-mono text-xs truncate" title={value}>{value}</span>
  </div>
)

export const ServerInfoCard = ({ server }: { server: ServerDetailRow }) => {
  const allocations = useServerAllocations(server.id)

  const primaryAlloc = allocations.data?.allocations.find(
    (a) => a.id === allocations.data?.primaryAllocationId
  )
  const address =
    primaryAlloc !== undefined
      ? `${primaryAlloc.ip}:${primaryAlloc.port}`
      : "—"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Instance</CardTitle>
      </CardHeader>
      <CardInner className="px-3 py-1">
        <Row label="Server ID" value={server.id} />
        <Row label="Node" value={server.nodeName ?? "—"} />
        <Row label="Address" value={address} />
        <Row label="Image" value={server.dockerImage} />
      </CardInner>
    </Card>
  )
}
