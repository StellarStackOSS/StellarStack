import { useEffect, useMemo, useRef, useState } from "react"
import type { editor } from "monaco-editor"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import Editor from "@monaco-editor/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete02Icon,
  DownloadIcon,
  Drag01Icon,
  File01Icon,
  FileAddIcon,
  FileUploadIcon,
  FolderIcon,
  FolderAddIcon,
  FolderUploadIcon,
  HashtagIcon,
  MoreHorizontalIcon,
  PackageIcon,
  PencilEdit01Icon,
  Search01Icon,
  TextWrapIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

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
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { FileMoveDialog } from "@/components/FileMoveDialog"
import { NewFileDialog } from "@/components/NewFileDialog"
import type { FileEntry, UploadFileEntry } from "@/hooks/useFiles.types"
import type { FileManagerProps } from "@/components/FileManager.types"

const monacoLanguageFor = (path: string): string => {
  const lower = path.toLowerCase()
  if (lower.endsWith(".json")) return "json"
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml"
  if (lower.endsWith(".toml") || lower.endsWith(".ini")) return "ini"
  if (lower.endsWith(".properties")) return "ini"
  if (lower.endsWith(".md")) return "markdown"
  if (lower.endsWith(".sh") || lower.endsWith(".bash")) return "shell"
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "javascript"
  if (lower.endsWith(".ts")) return "typescript"
  if (lower.endsWith(".py")) return "python"
  if (lower.endsWith(".lua")) return "lua"
  if (lower.endsWith(".go")) return "go"
  if (lower.endsWith(".rs")) return "rust"
  if (lower.endsWith(".xml")) return "xml"
  return "plaintext"
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const formatDate = (iso: string): string => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
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

const pathSegments = (path: string): { label: string; path: string }[] => {
  if (path === "/") return [{ label: "home", path: "/" }]
  const parts = path.split("/").filter(Boolean)
  const segments: { label: string; path: string }[] = [
    { label: "home", path: "/" },
  ]
  parts.forEach((part, i) => {
    segments.push({
      label: part,
      path: "/" + parts.slice(0, i + 1).join("/"),
    })
  })
  return segments
}

type RowActionsProps = {
  entry: FileEntry
  currentDir: string
  onNavigate: (entry: FileEntry) => void
  onEdit: (entry: FileEntry) => void
  onDelete: (path: string) => void
  onDownload: (path: string) => Promise<void>
  onRename: (entry: FileEntry) => Promise<void>
  onMove: (entry: FileEntry) => void
  onCompress: (entry: FileEntry) => Promise<void>
  onDecompress: (entry: FileEntry) => Promise<void>
}

const RowActions = ({
  entry,
  onDelete,
  onDownload,
  onRename,
  onMove,
  onCompress,
  onDecompress,
}: RowActionsProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 opacity-0 group-hover/row:opacity-100 data-[state=open]:opacity-100"
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-40">
      <DropdownMenuItem onClick={() => void onRename(entry)}>
        <HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 size-3.5" />
        Rename
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onMove(entry)}>
        <HugeiconsIcon icon={Drag01Icon} className="mr-2 size-3.5" />
        Move to…
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => void onDownload(entry.path)}>
        <HugeiconsIcon icon={DownloadIcon} className="mr-2 size-3.5" />
        Download
      </DropdownMenuItem>
      {entry.isDir ? (
        <DropdownMenuItem onClick={() => void onCompress(entry)}>
          <HugeiconsIcon icon={PackageIcon} className="mr-2 size-3.5" />
          Compress
        </DropdownMenuItem>
      ) : null}
      {!entry.isDir && isArchive(entry.name) ? (
        <DropdownMenuItem onClick={() => void onDecompress(entry)}>
          <HugeiconsIcon icon={PackageIcon} className="mr-2 size-3.5" />
          Decompress
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={() => void onDelete(entry.path)}
      >
        <HugeiconsIcon icon={Delete02Icon} className="mr-2 size-3.5" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

export const FileManager = ({ serverId }: FileManagerProps) => {
  const [path, setPath] = useState("/")
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ])
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [moveTarget, setMoveTarget] = useState<FileEntry | null>(null)
  const [newFileOpen, setNewFileOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    description: string
    onConfirm: () => Promise<void>
  } | null>(null)
  const [wordWrap, setWordWrap] = useState<"on" | "off">("off")
  const [lineNumbers, setLineNumbers] = useState<"on" | "off">("on")
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
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

  useEffect(() => {
    setRowSelection({})
    setFilter("")
  }, [path])

  const entries: FileEntry[] = useMemo(
    () =>
      (list.data?.entries ?? []).sort((a, b) =>
        a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1
      ),
    [list.data]
  )

  const editorValue =
    draft ?? (typeof content.data === "string" ? content.data : "")

  const handleNavigate = (entry: FileEntry) => {
    if (!entry.isDir) return
    setSelected(null)
    setDraft(null)
    setPath(entry.path)
  }

  const handleEdit = (entry: FileEntry) => {
    if (entry.isDir) {
      handleNavigate(entry)
      return
    }
    setSelected(entry.path)
    setDraft(null)
  }

  const handleSave = async () => {
    if (selected === null || draft === null) return
    setErrorMessage(null)
    try {
      await writeFile.mutateAsync({ path: selected, content: draft })
      setDraft(null)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = (target: string) => {
    setConfirmDialog({
      title: `Delete ${target.split("/").pop() ?? target}?`,
      description: "This will permanently remove the file or folder and cannot be undone.",
      onConfirm: async () => {
        await deleteFile.mutateAsync(target)
        if (selected === target) {
          setSelected(null)
          setDraft(null)
        }
      },
    })
  }

  const handleDeleteSelected = () => {
    const paths = Object.keys(rowSelection).filter((k) => rowSelection[k])
    if (paths.length === 0) return
    setConfirmDialog({
      title: `Delete ${paths.length} item${paths.length === 1 ? "" : "s"}?`,
      description: "This will permanently remove the selected files and folders and cannot be undone.",
      onConfirm: async () => {
        setErrorMessage(null)
        for (const p of paths) {
          await deleteFile.mutateAsync(p)
        }
        setRowSelection({})
      },
    })
  }

  const handleCompressSelected = async () => {
    const paths = Object.keys(rowSelection).filter((k) => rowSelection[k])
    if (paths.length === 0) return
    const dest =
      path === "/" ? "/archive.zip" : `${path.replace(/\/+$/, "")}/archive.zip`
    try {
      await compressFiles.mutateAsync({ paths, destination: dest })
      setRowSelection({})
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleMkdir = async () => {
    const name = window.prompt("New folder name")
    if (name === null || name.trim().length === 0) return
    const target =
      path === "/"
        ? `/${name.trim()}`
        : `${path.replace(/\/+$/, "")}/${name.trim()}`
    try {
      await mkdir.mutateAsync(target)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleNewFile = async (filePath: string) => {
    await writeFile.mutateAsync({ path: filePath, content: "" })
    setSelected(filePath)
    setDraft("")
  }

  const handleFormatDocument = () => {
    editorRef.current?.getAction("editor.action.formatDocument")?.run()
  }

  const handleSftp = async () => {
    try {
      await sftp.mutateAsync()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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

  const handleFolderInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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

  const handleMoveConfirm = async (entry: FileEntry, destDir: string) => {
    const dir = destDir.replace(/\/+$/, "") || ""
    const dest = dir ? `${dir}/${entry.name}` : `/${entry.name}`
    await renameFile.mutateAsync({ from: entry.path, to: dest })
  }

  const handleDecompress = async (entry: FileEntry) => {
    try {
      await decompressFile.mutateAsync({ path: entry.path, destination: path })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const columns: ColumnDef<FileEntry>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        size: 36,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Name
            {column.getIsSorted() === "asc" ? (
              <HugeiconsIcon icon={ArrowUp01Icon} className="size-3" />
            ) : column.getIsSorted() === "desc" ? (
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
            ) : null}
          </button>
        ),
        cell: ({ row }) => {
          const entry = row.original
          return (
            <button
              type="button"
              className="flex items-center gap-2 text-left hover:underline"
              onClick={() => handleEdit(entry)}
            >
              <HugeiconsIcon
                icon={entry.isDir ? FolderIcon : File01Icon}
                className={`size-4 shrink-0 ${
                  entry.isDir
                    ? "text-chart-2"
                    : "text-muted-foreground"
                }`}
              />
              <span className={entry.isDir ? "font-medium" : ""}>
                {entry.name}
              </span>
            </button>
          )
        },
      },
      {
        accessorKey: "size",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Size
            {column.getIsSorted() === "asc" ? (
              <HugeiconsIcon icon={ArrowUp01Icon} className="size-3" />
            ) : column.getIsSorted() === "desc" ? (
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
            ) : null}
          </button>
        ),
        cell: ({ row }) =>
          row.original.isDir ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            formatBytes(row.original.size)
          ),
        size: 100,
      },
      {
        accessorKey: "mode",
        header: "Permissions",
        cell: ({ row }) => (
          <code className="text-muted-foreground font-mono text-[0.7rem]">
            {row.original.mode}
          </code>
        ),
        size: 120,
        enableSorting: false,
      },
      {
        accessorKey: "modTime",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Modified
            {column.getIsSorted() === "asc" ? (
              <HugeiconsIcon icon={ArrowUp01Icon} className="size-3" />
            ) : column.getIsSorted() === "desc" ? (
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
            ) : null}
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.modTime)}
          </span>
        ),
        size: 160,
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions
              entry={row.original}
              currentDir={path}
              onNavigate={handleNavigate}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onRename={handleRename}
              onMove={setMoveTarget}
              onCompress={handleCompress}
              onDecompress={handleDecompress}
            />
          </div>
        ),
        size: 48,
        enableSorting: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path]
  )

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting, globalFilter: filter, rowSelection },
    getRowId: (row) => row.path,
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
  })

  const selectedCount = Object.values(rowSelection).filter(Boolean).length
  const segments = pathSegments(path)

  return (
    <div className="flex flex-col gap-0 rounded-md border border-border bg-card text-card-foreground overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-xs min-w-0">
          {segments.map((seg, i) => (
            <span key={seg.path} className="flex items-center gap-1">
              {i > 0 && (
                <span className="text-muted-foreground">/</span>
              )}
              {i < segments.length - 1 ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground truncate max-w-24"
                  onClick={() => setPath(seg.path)}
                >
                  {seg.label}
                </button>
              ) : (
                <span className="font-medium truncate max-w-32">
                  {seg.label}
                </span>
              )}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none"
            />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter files…"
              className="h-7 pl-6 pr-2 text-xs bg-muted rounded-md border-0 w-36 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <Button size="xs" variant="outline" onClick={handleMkdir}>
            <HugeiconsIcon icon={FolderAddIcon} className="mr-1 size-3" />
            New folder
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setNewFileOpen(true)}
          >
            <HugeiconsIcon icon={FileAddIcon} className="mr-1 size-3" />
            New file
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadFiles.isPending}
          >
            <HugeiconsIcon icon={FileUploadIcon} className="mr-1 size-3" />
            {uploadFiles.isPending ? "Uploading…" : "Upload files"}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => folderInputRef.current?.click()}
            disabled={uploadFiles.isPending}
          >
            <HugeiconsIcon icon={FolderUploadIcon} className="mr-1 size-3" />
            {uploadFiles.isPending ? "Uploading…" : "Upload folder"}
          </Button>
          <Button size="xs" variant="outline" onClick={handleSftp}>
            SFTP
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 ? (
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">
            {selectedCount} selected
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => void handleCompressSelected()}
          >
            <HugeiconsIcon icon={PackageIcon} className="mr-1 size-3" />
            Compress
          </Button>
          <Button
            size="xs"
            variant="destructive"
            onClick={() => void handleDeleteSelected()}
          >
            <HugeiconsIcon icon={Delete02Icon} className="mr-1 size-3" />
            Delete
          </Button>
          <button
            type="button"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => setRowSelection({})}
          >
            Clear
          </button>
        </div>
      ) : null}

      {/* Hidden file inputs */}
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

      {/* Table */}
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="text-xs h-9"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-xs text-muted-foreground h-24"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-xs text-muted-foreground h-24"
                >
                  {filter.length > 0 ? "No files match." : "This folder is empty."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="group/row text-xs"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-1.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Monaco editor panel */}
      {selected !== null ? (
        <div className="border-t border-border flex flex-col">
          {/* Editor header: path + save/close */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <code className="text-xs truncate max-w-xs">{selected}</code>
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                onClick={() => void handleSave()}
                disabled={draft === null || writeFile.isPending}
              >
                {writeFile.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => { setSelected(null); setDraft(null) }}
              >
                ✕
              </Button>
            </div>
          </div>
          {/* Editor toolbar: language + toggles + format */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1">
            <span className="text-[0.65rem] text-muted-foreground font-mono bg-muted rounded px-1.5 py-0.5">
              {monacoLanguageFor(selected)}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                title={`Line numbers: ${lineNumbers}`}
                onClick={() => setLineNumbers((v) => v === "on" ? "off" : "on")}
                className={[
                  "flex items-center gap-1 rounded px-2 py-0.5 text-[0.65rem]",
                  lineNumbers === "on"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <HugeiconsIcon icon={HashtagIcon} className="size-3" />
                Lines
              </button>
              <button
                type="button"
                title={`Word wrap: ${wordWrap}`}
                onClick={() => setWordWrap((v) => v === "on" ? "off" : "on")}
                className={[
                  "flex items-center gap-1 rounded px-2 py-0.5 text-[0.65rem]",
                  wordWrap === "on"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <HugeiconsIcon icon={TextWrapIcon} className="size-3" />
                Wrap
              </button>
              <button
                type="button"
                title="Format document"
                onClick={handleFormatDocument}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-[0.65rem] text-muted-foreground hover:text-foreground"
              >
                Format
              </button>
            </div>
          </div>
          {content.isLoading ? (
            <p className="text-muted-foreground p-3 text-xs">Loading…</p>
          ) : (
            <div className="h-96">
              <Editor
                value={editorValue}
                language={monacoLanguageFor(selected)}
                onChange={(value) => setDraft(value ?? "")}
                onMount={(ed) => { editorRef.current = ed }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers,
                  wordWrap,
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                  renderLineHighlight: "line",
                  smoothScrolling: true,
                }}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* SFTP credentials */}
      {sftp.data !== undefined ? (
        <div className="border-t border-border bg-muted/40 p-3 text-xs">
          <h3 className="mb-1 font-medium">SFTP credentials (visible once)</h3>
          <pre className="bg-background overflow-x-auto rounded p-2 font-mono">{`Host:     ${sftp.data.host}
Port:     ${sftp.data.port}
Username: ${sftp.data.username}
Password: ${sftp.data.password}
Expires:  ${sftp.data.expiresAt}`}</pre>
        </div>
      ) : null}

      {/* Error banner */}
      {errorMessage !== null ? (
        <p className="text-destructive border-t border-border p-2 text-xs" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmDialog !== null}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null) }}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDialog?.onConfirm ?? (async () => {})}
      />

      <NewFileDialog
        open={newFileOpen}
        currentDir={path}
        onOpenChange={setNewFileOpen}
        onCreate={handleNewFile}
      />

      <FileMoveDialog
        serverId={serverId}
        entry={moveTarget}
        open={moveTarget !== null}
        onOpenChange={(open) => { if (!open) setMoveTarget(null) }}
        onMove={handleMoveConfirm}
      />
    </div>
  )
}
