import { FileManager } from "@/components/FileManager"
import { useServerLayout } from "@/components/ServerLayoutContext"

/**
 * `/servers/$id/files` — wraps the existing FileManager so its
 * directory / Monaco state survives layout re-renders. The file API is
 * jail-locked to the server, so the only piece of context it needs is
 * the server id.
 */
export const FilesTab = () => {
  const { server } = useServerLayout()
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-base font-semibold">Files</h1>
        <p className="text-muted-foreground text-xs">
          Edit on-disk files in the server's bind-mount. Use the SFTP
          credentials button below for binary uploads.
        </p>
      </header>
      <FileManager serverId={server.id} />
    </div>
  )
}
