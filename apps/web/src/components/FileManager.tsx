import { useState } from "react"
import Editor from "@monaco-editor/react"

import { Button } from "@workspace/ui/components/button"

import {
  useDeleteFile,
  useFileContent,
  useFileList,
  useMkdir,
  useSftpCredentials,
  useWriteFile,
} from "@/hooks/useFiles"
import type { FileEntry } from "@/hooks/useFiles.types"
import type { FileManagerProps } from "@/components/FileManager.types"

const monacoLanguageFor = (path: string): string => {
  const lower = path.toLowerCase()
  if (lower.endsWith(".json")) return "json"
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml"
  if (lower.endsWith(".toml")) return "ini"
  if (lower.endsWith(".properties") || lower.endsWith(".ini")) return "ini"
  if (lower.endsWith(".md")) return "markdown"
  if (lower.endsWith(".sh") || lower.endsWith(".bash")) return "shell"
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "javascript"
  if (lower.endsWith(".ts")) return "typescript"
  if (lower.endsWith(".py")) return "python"
  if (lower.endsWith(".lua")) return "lua"
  if (lower.endsWith(".go")) return "go"
  if (lower.endsWith(".rs")) return "rust"
  return "plaintext"
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const parentOf = (path: string): string => {
  if (path === "" || path === "/") return "/"
  const trimmed = path.replace(/\/+$/, "")
  const idx = trimmed.lastIndexOf("/")
  if (idx <= 0) return "/"
  return trimmed.slice(0, idx)
}

/**
 * Two-pane file manager: directory listing on the left, Monaco editor on
 * the right. Browser → daemon traffic skips the API on the data path
 * using credentials minted by /servers/:id/files-credentials.
 */
export const FileManager = ({ serverId }: FileManagerProps) => {
  const [path, setPath] = useState("/")
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const list = useFileList(serverId, path)
  const content = useFileContent(serverId, selected)
  const writeFile = useWriteFile(serverId)
  const deleteFile = useDeleteFile(serverId)
  const mkdir = useMkdir(serverId)
  const sftp = useSftpCredentials(serverId)

  const entries: FileEntry[] = list.data?.entries ?? []
  const editorValue = draft ?? (typeof content.data === "string" ? content.data : "")

  const handleSelect = (entry: FileEntry) => {
    setErrorMessage(null)
    if (entry.isDir) {
      setPath(entry.path)
      setSelected(null)
      setDraft(null)
      return
    }
    setSelected(entry.path)
    setDraft(null)
  }

  const handleSave = async () => {
    if (selected === null || draft === null) {
      return
    }
    setErrorMessage(null)
    try {
      await writeFile.mutateAsync({ path: selected, content: draft })
      setDraft(null)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (target: string) => {
    if (!window.confirm(`Delete ${target}?`)) {
      return
    }
    try {
      await deleteFile.mutateAsync(target)
      if (selected === target) {
        setSelected(null)
        setDraft(null)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleMkdir = async () => {
    const name = window.prompt("New folder name")
    if (name === null || name.trim().length === 0) {
      return
    }
    const target =
      path === "/" ? `/${name.trim()}` : `${path.replace(/\/+$/, "")}/${name.trim()}`
    try {
      await mkdir.mutateAsync(target)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSftp = async () => {
    try {
      await sftp.mutateAsync()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section className="border-border bg-card text-card-foreground rounded-md border">
      <header className="border-border flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">path:</span>
          <code className="bg-muted rounded px-1.5 py-0.5">{path}</code>
        </div>
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setPath(parentOf(path))}
            disabled={path === "/"}
          >
            Up
          </Button>
          <Button size="xs" variant="outline" onClick={handleMkdir}>
            New folder
          </Button>
          <Button size="xs" variant="outline" onClick={handleSftp}>
            SFTP credentials
          </Button>
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr]">
        <aside className="border-border max-h-96 overflow-y-auto border-r p-2">
          {list.isLoading ? (
            <p className="text-muted-foreground text-xs">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-xs">Empty.</p>
          ) : (
            <ul className="flex flex-col">
              {entries
                .sort((a, b) =>
                  a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1
                )
                .map((entry) => (
                  <li
                    key={entry.path}
                    className="group flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(entry)}
                      className={`flex-1 truncate rounded px-2 py-1 text-left text-xs ${
                        selected === entry.path
                          ? "bg-muted text-foreground"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <span className={entry.isDir ? "font-medium" : ""}>
                        {entry.isDir ? "📁" : "📄"} {entry.name}
                      </span>
                      {!entry.isDir ? (
                        <span className="text-muted-foreground ml-1">
                          {formatBytes(entry.size)}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.path)}
                      className="text-destructive opacity-0 group-hover:opacity-100 px-1 text-xs"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </aside>
        <div className="flex flex-col">
          {selected === null ? (
            <p className="text-muted-foreground p-3 text-xs">
              Select a file to edit it. Folders open in the listing.
            </p>
          ) : content.isLoading ? (
            <p className="text-muted-foreground p-3 text-xs">Loading…</p>
          ) : (
            <>
              <div className="border-border flex items-center justify-between border-b px-3 py-2 text-xs">
                <code>{selected}</code>
                <Button
                  size="xs"
                  onClick={handleSave}
                  disabled={draft === null || writeFile.isPending}
                >
                  {writeFile.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
              <div className="h-72">
                <Editor
                  value={editorValue}
                  language={monacoLanguageFor(selected)}
                  onChange={(value) => setDraft(value ?? "")}
                  theme="vs-dark"
                  options={{ minimap: { enabled: false }, fontSize: 12 }}
                />
              </div>
            </>
          )}
        </div>
      </div>
      {sftp.data !== undefined ? (
        <div className="border-border bg-muted/40 border-t p-3 text-xs">
          <h3 className="mb-1 font-medium">SFTP credentials (visible once)</h3>
          <pre className="bg-background overflow-x-auto rounded p-2 font-mono">
{`Host:     ${sftp.data.host}
Port:     ${sftp.data.port}
Username: ${sftp.data.username}
Password: ${sftp.data.password}
Expires:  ${sftp.data.expiresAt}`}
          </pre>
        </div>
      ) : null}
      {errorMessage !== null ? (
        <p className="text-destructive p-2 text-xs" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  )
}
