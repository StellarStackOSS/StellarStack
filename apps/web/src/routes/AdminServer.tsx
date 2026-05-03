import { createRoute } from "@tanstack/react-router"
import { z } from "zod"

import { AdminServerPage } from "@/components/AdminServerPage"
import { Route as adminRoute } from "@/routes/Admin"

const searchSchema = z.object({
  tab: z.enum(["overview", "blueprint", "allocations", "settings"]).catch("overview"),
})

export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/servers/$serverId",
  validateSearch: searchSchema,
  component: AdminServerPage,
})
