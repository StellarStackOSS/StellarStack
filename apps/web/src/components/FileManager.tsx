import { useEffect, useRef, useState } from "react"
import Editor from "@monaco-editor/react"

import { Button } from "@workspace/ui/components/button"

import {
  useCompressFiles,
  useDecompressFile,
  useDeleteFile,
  useDownloadFile,
  useFileContent,
  useFileList,
  useMkdir,
  useRenameFile,
  useSftpCredentials,
  useUploadFiles,
  useWriteFile,
} from "@/hooks/useFiles"
import type { FileEntry, UploadFileEntry } from "@/hooks/useFiles.types"
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

const isArchive = (name: string): boolean =>
  name.endsWith(".zip") || name.endsWith(".tar.gz") || name.endsWith(".tgz")

type RowActionsProps = {
  entry: FileEntry
  currentDir: string
  onDelete: (path: string) => Promise<void>
  onDownload: (path: string) => Promise<void>
  onRename: (entry: FileEntry) => Promise<void>
  onCompress: (entry: FileEntry) => Promise<void>
  onDecompress: (entry: FileEntry) => Promise<void>
}

const RowActions = ({
  entry,
  currentDir,
  onDelete,
  onDownload,
  onRename,
  onCompress,
  onDecompress,
}: RowActionsProps) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const handle = (fn: () => Promise<void>) => async () => {
    setOpen(false)
    await fn()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="opacity-0 group-hover:opacity-100 px-1 text-xs text-muted-foreground hover:text-foreground"
        title="Actions"
      >
        ⋯
      </button>
      {open ? (
        <div className="absolute right-0 top-5 z-10 bg-popover border border-border rounded shadow-md text-xs w-32 py-1">
          <button
            type="button"
            className="w-full text-left px-3 py-1 hover:bg-muted"
            onClick={handle(() => onRename(entry))}
          >
            Rename
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1 hover:bg-muted"
            onClick={handle(() => onDownload(entry.path))}
          >
            Download
          </button>
          {entry.isDir ? (
            <button
              type="button"
              className="w-full text-left px-3 py-1 hover:bg-muted"
              onClick={handle(() => onCompress(entry))}
            >
              Compress
            </button>
          ) : null}
          {!entry.isDir && isArchive(entry.name) ? (
            <button
              type="button"
              className="w-full text-left px-3 py-1 hover:bg-muted"
              onClick={handle(() => onDecompress(entry))}
            >
              Decompress
            </button>
          ) : null}
          <button
            type="button"
            className="w-full text-left px-3 py-1 hover:bg-muted text-destructive"
            onClick={handle(() => onDelete(entry.path))}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
}

export const FileManager = ({ serverId }: FileManagerProps) => {
  const [path, setPath] = useState("/")
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const list = useFileList(serverId, path)
  const content = useFileContent(serverId, selected)
  const writeFile = useWriteFile(serverId)
  const deleteFile = useDeleteFile(serverId)
  const mkdir = useMkdir(serverId)
  const sftp = useSftpCredentials(serverId)
  const uploadFiles = useUploadFiles(serverId)
  const downloadFile = useDownloadFile(serverId)
  const renameFile = useRenameFile(serverId)
  const compressFiles = useCompressFiles(serverId)
  const decompressFile = useDecompressFile(serverId)

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "")
    }
  }, [])

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

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const uploads: UploadFileEntry[] = Array.from(fileList).map((f) => ({
      file: f,
      relativePath: f.name,
    }))
    e.target.value = ""
    try {
      await uploadFiles.mutateAsync({ targetDir: path, files: uploads })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const uploads: UploadFileEntry[] = Array.from(fileList).map((f) => ({
      file: f,
      relativePath: f.webkitRelativePath || f.name,
    }))
    e.target.value = ""
    try {
      await uploadFiles.mutateAsync({ targetDir: path, files: uploads })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDownload = async (entryPath: string) => {
    try {
      await downloadFile(entryPath)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRename = async (entry: FileEntry) => {
    const newName = window.prompt("New name:", entry.name)
    if (newName === null || newName.trim().length === 0) return
    const dir = entry.path.includes("/")
      ? entry.path.slice(0, entry.path.lastIndexOf("/"))
      : ""
    const newPath = dir ? `${dir}/${newName.trim()}` : `/${newName.trim()}`
    try {
      await renameFile.mutateAsync({ from: entry.path, to: newPath })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleCompress = async (entry: FileEntry) => {
    const destination =
      path === "/"
        ? `/${entry.name}.zip`
        : `${path.replace(/\/+$/, "")}/${entry.name}.zip`
    try {
      await compressFiles.mutateAsync({ paths: [entry.path], destination })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDecompress = async (entry: FileEntry) => {
    try {
      await decompressFile.mutateAsync({ path: entry.path, destination: path })
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
        <div className="flex gap-2 flex-wrap">
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
          <Button
            size="xs"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadFiles.isPending}
          >
            {uploadFiles.isPending ? "Uploading…" : "Upload files"}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => folderInputRef.current?.click()}
            disabled={uploadFiles.isPending}
          >
            {uploadFiles.isPending ? "Uploading…" : "Upload folder"}
          </Button>
          <Button size="xs" variant="outline" onClick={handleSftp}>
            SFTP credentials
          </Button>
        </div>
      </header>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFolderInputChange}
      />
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
                    <RowActions
                      entry={entry}
                      currentDir={path}
                      onDelete={handleDelete}
                      onDownload={handleDownload}
                      onRename={handleRename}
                      onCompress={handleCompress}
                      onDecompress={handleDecompress}
                    />
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
