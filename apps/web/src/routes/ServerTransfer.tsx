import { createRoute } from "@tanstack/react-router"

import { useServerLayout } from "@/components/ServerLayoutContext"
import { TransfersTab } from "@/components/server/TransfersTab"
import { Route as serverRoute } from "@/routes/Server"

const ServerTransferPage = () => {
  const { server } = useServerLayout()
  return <TransfersTab serverId={server.id} currentNodeId={server.nodeId} />
}

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/transfer",
  component: ServerTransferPage,
})
