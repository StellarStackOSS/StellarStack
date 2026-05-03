import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

import { FileManager } from "@/components/FileManager"
import { useServerLayout } from "@/components/ServerLayoutContext"

export const FilesTab = () => {
  const { server } = useServerLayout()
  return (
    <div className="flex flex-col gap-4">
      <Card size="sm" className="w-full">
        <CardHeader>
          <CardTitle>Files</CardTitle>
        </CardHeader>
        <CardContent>
          <CardInner className="p-3">
            <p className="text-sm text-muted-foreground">
              Edit on-disk files in the server's bind-mount. Use the SFTP
              credentials button below for binary uploads.
            </p>
          </CardInner>
        </CardContent>
      </Card>
      <FileManager serverId={server.id} />
    </div>
  )
}
