import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearch } from "@tanstack/react-router"
import type { editor } from "monaco-editor"
import { useMonaco } from "@monaco-editor/react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
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
import { Card } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
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

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import {
  useCompressFiles,
  useDecompressFile,
  useDeleteFile,
  useDownloadFile,
  useFileContent,
  useFileList,
  useMediaBlobUrl,
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
import { notify } from "@/lib/notify"


const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const formatSpeed = (bytesPerSec: number): string => {
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
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

const isArchive = (name: string): boolean =>
  name.endsWith(".zip") || name.endsWith(".tar.gz") || name.endsWith(".tgz")

const mediaKind = (path: string): "image" | "video" | null => {
  const lower = path.toLowerCase()
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".bmp") ||
    lower.endsWith(".ico")
  ) {
    return "image"
  }
  if (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".ogg") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".mkv")
  ) {
    return "video"
  }
  return null
}

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
  ".properties", ".env", ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd",
  ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".vue", ".svelte",
  ".py", ".rb", ".php", ".java", ".kt", ".go", ".rs", ".cs", ".cpp", ".c", ".h",
  ".html", ".htm", ".xml", ".css", ".scss", ".sass", ".less",
  ".sql", ".graphql", ".gql", ".lua", ".r", ".m", ".swift",
  ".log", ".lock", ".gitignore", ".dockerignore", ".editorconfig",
  ".nginx", ".htaccess",
])

const isViewable = (path: string): boolean => {
  if (mediaKind(path) !== null) return true
  const lower = path.toLowerCase()
  const dot = lower.lastIndexOf(".")
  const ext = dot >= 0 ? lower.slice(dot) : ""
  if (TEXT_EXTENSIONS.has(ext)) return true
  if (ext === "") return true
  return false
}

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
}: RowActionsProps) => {
  const { t } = useTranslation()
  return (
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
          {t("files.action.rename")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onMove(entry)}>
          <HugeiconsIcon icon={Drag01Icon} className="mr-2 size-3.5" />
          {t("files.action.move")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void onDownload(entry.path)}>
          <HugeiconsIcon icon={DownloadIcon} className="mr-2 size-3.5" />
          {t("files.action.download")}
        </DropdownMenuItem>
        {entry.isDir ? (
          <DropdownMenuItem onClick={() => void onCompress(entry)}>
            <HugeiconsIcon icon={PackageIcon} className="mr-2 size-3.5" />
            {t("files.action.compress")}
          </DropdownMenuItem>
        ) : null}
        {!entry.isDir && isArchive(entry.name) ? (
          <DropdownMenuItem onClick={() => void onDecompress(entry)}>
            <HugeiconsIcon icon={PackageIcon} className="mr-2 size-3.5" />
            {t("files.action.decompress")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => void onDelete(entry.path)}
        >
          <HugeiconsIcon icon={Delete02Icon} className="mr-2 size-3.5" />
          {t("files.action.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const FileManager = ({ serverId }: FileManagerProps) => {
  const { t } = useTranslation()
  const monaco = useMonaco()
  const { dir: path } = useSearch({ from: "/servers/$id/files" })
  const navigate = useNavigate({ from: "/servers/$id/files" })
  const setPath = (next: string) => {
    void navigate({ search: (prev) => ({ ...prev, dir: next }) })
  }
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
  const editorPanelRef = useRef<HTMLDivElement | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const selectedMedia = selected !== null ? mediaKind(selected) : null
  const selectedViewable = selected !== null ? isViewable(selected) : false
  const textPath = selectedMedia === null && selectedViewable ? selected : null
  const mediaPath = selectedMedia !== null ? selected : null

  const list = useFileList(serverId, path)
  const content = useFileContent(serverId, textPath)
  const mediaBlobUrl = useMediaBlobUrl(serverId, mediaPath)
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

  useEffect(() => {
    if (!content.isLoading && editorRef.current !== null) {
      editorRef.current.setPosition({ lineNumber: 1, column: 1 })
      editorRef.current.revealLine(1)
    }
  }, [selected, content.isLoading])

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
    if (selected === entry.path && draft === null) {
      setSelected(null)
      return
    }
    setSelected(entry.path)
    setDraft(null)
  }

  const handleSave = async () => {
    if (selected === null || draft === null) return
    try {
      await writeFile.mutateAsync({ path: selected, content: draft })
      setDraft(null)
      notify.success(t("files.notify.saved"))
    } catch (err) {
      if (err instanceof ApiFetchError) {
        notify.error(translateApiError(t, err.body.error))
      } else {
        notify.error(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

  const handleDelete = (target: string) => {
    const name = target.split("/").pop() ?? target
    setConfirmDialog({
      title: t("files.confirm.delete_title", { name }),
      description: t("files.confirm.delete_description"),
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
      title: t(
        paths.length === 1
          ? "files.confirm.delete_many_title"
          : "files.confirm.delete_many_title_plural",
        { count: paths.length }
      ),
      description: t("files.confirm.delete_many_description"),
      onConfirm: async () => {
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
      notify.success(t("files.notify.compressed_selection"))
    } catch (err) {
      if (err instanceof ApiFetchError) {
        notify.error(translateApiError(t, err.body.error))
      } else {
        notify.error(t("internal.unexpected", { ns: "errors" }))
      }
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
      if (err instanceof ApiFetchError) {
        notify.error(translateApiError(t, err.body.error))
      } else {
        notify.error(t("internal.unexpected", { ns: "errors" }))
      }
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
      if (err instanceof ApiFetchError) {
        notify.error(translateApiError(t, err.body.error))
      } else {
        notify.error(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

  const runUpload = async (uploads: UploadFileEntry[]) => {
    const label = `Uploading ${uploads.length} file${uploads.length === 1 ? "" : "s"}…`
    const total = uploads.reduce((sum, u) => sum + u.file.size, 0)
    const id = notify.loading(label, { description: `0% · ${formatBytes(total)} total` })
    try {
      const result = await uploadFiles.mutateAsync({
        targetDir: path,
        files: uploads,
        onProgress: (loaded, _total, bytesPerSec) => {
          const pct = Math.round((loaded / _total) * 100)
          notify.update(id, { description: `${pct}% · ${formatSpeed(bytesPerSec)}` })
        },
      })
      notify.update(id, {
        kind: "success",
        title: `Uploaded ${result.count} file${result.count === 1 ? "" : "s"}`,
        description: undefined,
      })
    } catch (err) {
      notify.update(id, {
        kind: "error",
        title: err instanceof Error ? err.message : "Upload failed",
        description: undefined,
      })
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
    await runUpload(uploads)
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
    await runUpload(uploads)
  }

  const handleDownload = async (entryPath: string) => {
    try {
      await downloadFile(entryPath)
    } catch (err) {
      if (err instanceof ApiFetchError) {
        notify.error(translateApiError(t, err.body.error))
      } else {
        notify.error(t("internal.unexpected", { ns: "errors" }))
      }
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
      if (err instanceof ApiFetchError) {
        notify.error(translateApiError(t, err.body.error))
      } else {
        notify.error(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

  const handleCompress = async (entry: FileEntry) => {
    const destination =
      path === "/"
        ? `/${entry.name}.zip`
        : `${path.replace(/\/+$/, "")}/${entry.name}.zip`
    try {
      await compressFiles.mutateAsync({ paths: [entry.path], destination })
      notify.success(t("files.notify.compressed", { name: `${entry.name}.zip` }))
    } catch (err) {
      if (err instanceof ApiFetchError) {
        notify.error(translateApiError(t, err.body.error))
      } else {
        notify.error(t("internal.unexpected", { ns: "errors" }))
      }
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
      notify.success(t("files.notify.decompressed"))
    } catch (err) {
      if (err instanceof ApiFetchError) {
        notify.error(translateApiError(t, err.body.error))
      } else {
        notify.error(t("internal.unexpected", { ns: "errors" }))
      }
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
        sortingFn: (rowA, rowB) => {
          if (rowA.original.isDir !== rowB.original.isDir) {
            return rowA.original.isDir ? -1 : 1
          }
          return rowA.original.name.localeCompare(rowB.original.name)
        },
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            {t("files.col.name")}
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
            {t("files.col.size")}
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
        header: () => t("files.col.permissions"),
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
            {t("files.col.modified")}
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
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
    enableRowSelection: true,
    autoResetPageIndex: true,
  })

  const selectedCount = Object.values(rowSelection).filter(Boolean).length
  const segments = pathSegments(path)

  return (
    <Card className="gap-0 p-0 rounded-xl">
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
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("files.filter_placeholder")}
              className="h-7 pl-6 pr-2 text-xs bg-muted border-0 w-36"
            />
          </div>

          <Button size="xs" variant="outline" onClick={handleMkdir}>
            <HugeiconsIcon icon={FolderAddIcon} className="mr-1 size-3" />
            {t("files.new_folder")}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setNewFileOpen(true)}
          >
            <HugeiconsIcon icon={FileAddIcon} className="mr-1 size-3" />
            {t("files.new_file")}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadFiles.isPending}
          >
            <HugeiconsIcon icon={FileUploadIcon} className="mr-1 size-3" />
            {uploadFiles.isPending ? t("files.uploading") : t("files.upload_files")}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => folderInputRef.current?.click()}
            disabled={uploadFiles.isPending}
          >
            <HugeiconsIcon icon={FolderUploadIcon} className="mr-1 size-3" />
            {uploadFiles.isPending ? t("files.uploading") : t("files.upload_folder")}
          </Button>
          <Button size="xs" variant="outline" onClick={handleSftp}>
            {t("files.sftp_button")}
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 ? (
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">
            {t("files.bulk.selected", { count: selectedCount })}
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => void handleCompressSelected()}
          >
            <HugeiconsIcon icon={PackageIcon} className="mr-1 size-3" />
            {t("files.bulk.compress")}
          </Button>
          <Button
            size="xs"
            variant="destructive"
            onClick={() => void handleDeleteSelected()}
          >
            <HugeiconsIcon icon={Delete02Icon} className="mr-1 size-3" />
            {t("files.bulk.delete")}
          </Button>
          <button
            type="button"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => setRowSelection({})}
          >
            {t("files.bulk.clear")}
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
      <div className="overflow-auto min-h-64 max-h-[calc(100vh-var(--header-height)-16rem)]">
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
                  {t("files.loading")}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-xs text-muted-foreground h-24"
                >
                  {filter.length > 0 ? t("files.no_match") : t("files.empty_folder")}
                </TableCell>
              </TableRow>
            ) : (
              table.getPaginationRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow
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
                  <AnimatePresence initial={false}>
                    {selected === row.original.path ? (
                      <TableRow key="editor-row">
                        <TableCell colSpan={columns.length} className="p-0 border-b border-border">
                          <motion.div
                            ref={editorPanelRef}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            style={{ overflow: "hidden" }}
                          >
                            {/* Header: path + save/close */}
                            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                              <code className="text-xs truncate max-w-xs">{selected}</code>
                              <div className="flex items-center gap-2">
                                {selectedMedia === null && selectedViewable ? (
                                  <Button
                                    size="xs"
                                    onClick={() => void handleSave()}
                                    disabled={draft === null || writeFile.isPending}
                                  >
                                    {writeFile.isPending ? t("files.editor.saving") : t("files.editor.save")}
                                  </Button>
                                ) : null}
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => { setSelected(null); setDraft(null) }}
                                >
                                  ✕
                                </Button>
                              </div>
                            </div>
                            {!selectedViewable ? (
                              <div className="flex items-center justify-center bg-muted/20 p-8 min-h-24">
                                <p className="text-muted-foreground text-xs">
                                  {t("files.editor.unsupported_format")}
                                </p>
                              </div>
                            ) : selectedMedia !== null ? (
                              <div className="flex items-center justify-center bg-muted/20 p-4 min-h-48">
                                {mediaBlobUrl === null ? (
                                  <p className="text-muted-foreground text-xs">Loading…</p>
                                ) : selectedMedia === "image" ? (
                                  <img
                                    src={mediaBlobUrl}
                                    alt={selected.split("/").pop()}
                                    className="max-w-full max-h-[32rem] object-contain rounded"
                                  />
                                ) : (
                                  <video
                                    src={mediaBlobUrl}
                                    controls
                                    className="max-w-full max-h-[32rem] rounded"
                                  />
                                )}
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1">
                                  <span className="text-[0.65rem] text-muted-foreground font-mono bg-muted rounded px-1.5 py-0.5">
                                    {monaco?.languages
                                      .getLanguages()
                                      .find((l) =>
                                        l.extensions?.some((ext) =>
                                          selected.toLowerCase().endsWith(ext)
                                        )
                                      )?.id ?? "plaintext"}
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
                                      {t("files.editor.toggle_lines")}
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
                                      {t("files.editor.toggle_wrap")}
                                    </button>
                                    <button
                                      type="button"
                                      title={t("files.editor.format")}
                                      onClick={handleFormatDocument}
                                      className="flex items-center gap-1 rounded px-2 py-0.5 text-[0.65rem] text-muted-foreground hover:text-foreground"
                                    >
                                      {t("files.editor.format")}
                                    </button>
                                  </div>
                                </div>
                                {content.isLoading ? (
                                  <p className="text-muted-foreground p-3 text-xs">{t("files.editor.loading")}</p>
                                ) : (
                                  <div className="h-96">
                                    <Editor
                                      // key forces a fresh editor instance per
                                      // file so the *initial* value (defaultValue)
                                      // is loaded once and ownership stays with
                                      // Monaco — using `value=` instead would
                                      // drive an internal setValue on every
                                      // keystroke and reset the cursor to end.
                                      key={selected ?? "_none"}
                                      path={selected}
                                      defaultValue={editorValue}
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
                              </>
                            )}
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </AnimatePresence>
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{" "}
            of {table.getFilteredRowModel().rows.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant="ghost"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              ‹ Prev
            </Button>
            <span className="px-1">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button
              size="xs"
              variant="ghost"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next ›
            </Button>
          </div>
        </div>
      )}

      {/* SFTP credentials */}
      {sftp.data !== undefined ? (
        <div className="border-t border-border bg-muted/40 p-3 text-xs">
          <h3 className="mb-1 font-medium">{t("files.sftp_heading")}</h3>
          <pre className="bg-background overflow-x-auto rounded p-2 font-mono">{`Host:     ${sftp.data.host}
Port:     ${sftp.data.port}
Username: ${sftp.data.username}
Password: ${sftp.data.password}
Expires:  ${sftp.data.expiresAt}`}</pre>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDialog !== null}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null) }}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description}
        confirmLabel={t("actions.delete")}
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
    </Card>
  )
}
