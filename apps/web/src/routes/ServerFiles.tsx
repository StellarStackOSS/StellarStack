import { createRoute } from "@tanstack/react-router"
import { z } from "zod"

import { FilesTab } from "@/components/server/FilesTab"
import { Route as serverRoute } from "@/routes/Server"

const searchSchema = z.object({
  dir: z.string().default("/"),
})

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/files",
  component: FilesTab,
  validateSearch: searchSchema,
})
