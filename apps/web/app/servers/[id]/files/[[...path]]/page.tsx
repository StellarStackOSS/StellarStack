"use client";

import React, { type JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ColumnDef,
  ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { cn } from "@stellarUI/lib/utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Checkbox from "@stellarUI/components/Checkbox/Checkbox";
import DropdownMenu, {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@stellarUI/components/DropdownMenu/DropdownMenu";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import Dialog, {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@stellarUI/components/Dialog/Dialog";
import {
  BsArrowLeft,
  BsChevronDown,
  BsChevronExpand,
  BsChevronUp,
  BsClipboard,
  BsCloudUpload,
  BsDownload,
  BsEye,
  BsEyeSlash,
  BsFileEarmark,
  BsFileText,
  BsPencil,
  BsPlus,
  BsTerminal,
  BsThreeDotsVertical,
  BsTrash,
  BsUpload,
  BsX,
} from "react-icons/bs";
import type { FileInfo } from "@/lib/api";
import { servers } from "@/lib/api";
import { useServer } from "components/ServerStatusPages/server-provider/server-provider";
import { useAuth } from "@/hooks/auth-provider/auth-provider";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/server-installing-placeholder/server-installing-placeholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/server-suspended-placeholder/server-suspended-placeholder";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { toast } from "sonner";
import { useUploads } from "@/components/providers/UploadProvider/UploadProvider";
import DataTable from "@stellarUI/components/data-table/DataTable";
import Input from "@stellarUI/components/Input/Input";
import Label from "@stellarUI/components/Label/Label";
import { getMediaType, isMediaFile } from "@/lib/media-utils";
import { MediaPreviewModal } from "@/components/Modals/MediaPreviewModal/MediaPreviewModal";
import FilledFolder from "@stellarUI/components/FilledFolder/FilledFolder";
import { File, FileImage, FileVolume, Folder } from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  type: "folder" | "file";
  size: string;
  sizeBytes: number;
  modified: string;
  path: string;
}

const EDITABLE_EXTENSIONS = [
  ".yml",
  ".yaml",
  ".json",
  ".txt",
  ".properties",
  ".conf",
  ".cfg",
  ".ini",
  ".log",
  ".md",
  ".sh",
  ".bat",
  ".toml",
];

// Helper to parse daemon error messages
const parseDaemonError = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message;
    // Try to parse JSON error from daemon
    try {
      // Check if the message contains JSON
      const jsonMatch = message.match(/\{.*"error".*"message".*}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.error === "Conflict" && parsed.message) {
          // Extract the name from "Already exists: name"
          const existsMatch = parsed.message.match(/Already exists:\s*(.+)/);
          if (existsMatch) {
            return `"${existsMatch[1]}" already exists`;
          }
          return parsed.message;
        }
        return parsed.message || message;
      }
    } catch {
      // If parsing fails, try simpler extraction
      if (message.includes("Already exists")) {
        const match = message.match(/Already exists:\s*([^"}\]]+)/);
        if (match?.[1]) {
          return `"${match[1].trim()}" already exists`;
        }
        return "File or folder already exists";
      }
    }
    return message;
  }
  return "An unknown error occurred";
};

const FilesPage = (): JSX.Element | null => {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const pathSegments = params.path as string[] | undefined;
  const { server, isInstalling } = useServer();
  const { user } = useAuth();
  const { playSound } = useSoundEffects();
  const { addUpload, updateUpload, removeUpload } = useUploads();

  // Derive current path from URL params
  const currentPath = pathSegments && pathSegments.length > 0 ? "/" + pathSegments.join("/") : "/";

  const [mounted, setMounted] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const filesRef = useRef<FileItem[]>([]);
  const diskUsageRef = useRef<{ used: number; total: number }>({ used: 0, total: 0 });
  const isPollingRef = useRef(false);

  // Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<FileItem | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);
  const [newFileNameInput, setNewFileNameInput] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [diskUsage, setDiskUsage] = useState<{ used: number; total: number }>({
    used: 0,
    total: 0,
  });
  const [showHiddenFiles, setShowHiddenFiles] = useState(() => {
    // Load preference from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("stellarstack-show-hidden-files");
      return stored === "true";
    }
    return false;
  });
  // TODO: ADD BACK SEARCH FUNCTIONALITY TO THE FILES PAGE
  const [searchQuery] = useState("");
  const [sftpModalOpen, setSftpModalOpen] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [fileToEditPermissions, setFileToEditPermissions] = useState<FileItem | null>(null);
  const [permissions, setPermissions] = useState({
    owner: { read: true, write: true, execute: false },
    group: { read: true, write: false, execute: false },
    others: { read: true, write: false, execute: false },
  });

  // Media preview modal state
  const [mediaPreviewOpen, setMediaPreviewOpen] = useState(false);
  const [mediaPreviewFile, setMediaPreviewFile] = useState<FileItem | null>(null);

  // Storage info - total from server allocation, used from actual disk usage
  const storageUsedGB = diskUsage.used / (1024 * 1024 * 1024);
  const storageTotalGB =
    diskUsage.total > 0
      ? diskUsage.total / (1024 * 1024 * 1024)
      : server?.disk
        ? (server.disk as number) / 1024
        : 10; // fallback to server.disk (in MiB) if no limit set
  const storagePercentage = storageTotalGB > 0 ? (storageUsedGB / storageTotalGB) * 100 : 0;

  // Use local path if set, otherwise fall back to URL params
  const displayPath = currentPath;

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const fetchDiskUsage = useCallback(async () => {
    try {
      const usage = await servers.files.diskUsage(serverId);

      // Use the limit from daemon if available, otherwise fall back to server config
      const totalBytes = usage.limit_bytes || (server?.disk ? server.disk * 1024 * 1024 : 0);
      const usedBytes = usage.used_bytes || 0;

      // Only update if the data actually changed
      if (diskUsageRef.current.used !== usedBytes || diskUsageRef.current.total !== totalBytes) {
        diskUsageRef.current = { used: usedBytes, total: totalBytes };
        setDiskUsage({ used: usedBytes, total: totalBytes });
      }
    } catch (error) {
      console.error("[Disk Usage] Failed to fetch disk usage:", error);
      // Fall back to server config if daemon request fails
      if (server?.disk) {
        const fallbackUsage = { used: 0, total: server.disk * 1024 * 1024 };
        if (diskUsageRef.current.used !== 0 || diskUsageRef.current.total !== fallbackUsage.total) {
          diskUsageRef.current = fallbackUsage;
          setDiskUsage(fallbackUsage);
        }
      }
    }
  }, [serverId, server?.disk]);

  const fetchFiles = useCallback(async (isPolling: boolean = false) => {
    if (!isPolling) {
      setIsLoading(true);
    }
    try {
      const data = await servers.files.list(
        serverId,
        displayPath === "/" ? undefined : displayPath
      );
      const mappedFiles: FileItem[] = data.files.map((f: FileInfo) => ({
        id: f.path,
        name: f.name,
        type: f.type === "directory" ? "folder" : "file",
        size: f.type === "directory" ? "--" : formatFileSize(f.size),
        sizeBytes: f.size,
        modified: new Date(f.modified).toLocaleString(),
        path: f.path,
      }));

      // Only update if the file list actually changed
      const hasChanged =
        filesRef.current.length !== mappedFiles.length ||
        !filesRef.current.every((f, i) => f.id === mappedFiles[i]?.id);

      if (hasChanged) {
        filesRef.current = mappedFiles;
        setFiles(mappedFiles);
      }
    } catch (error) {
      if (!isPolling) {
        toast.error("Failed to fetch files");
      }
      if (filesRef.current.length > 0) {
        filesRef.current = [];
        setFiles([]);
      }
    } finally {
      if (!isPolling) {
        setIsLoading(false);
      }
    }
  }, [serverId, displayPath]);

  useEffect(() => {
    fetchFiles();
    setRowSelection({});
  }, [fetchFiles]);

  // Poll disk usage and file list independently to avoid cascading re-renders
  useEffect(() => {
    // Fetch disk usage on component mount
    fetchDiskUsage();

    // Poll disk usage every 5 seconds
    const diskInterval = setInterval(fetchDiskUsage, 5000);

    return () => clearInterval(diskInterval);
  }, [fetchDiskUsage]);

  // Poll file list for SFTP uploads and external changes
  useEffect(() => {
    // Poll files every 3 seconds
    const fileInterval = setInterval(() => {
      fetchFiles(true); // Pass true to indicate this is a polling call
    }, 3000);

    return () => clearInterval(fileInterval);
  }, [fetchFiles]);

  // Handle dropped files - upload directly with optimistic updates
  const handleDroppedFiles = useCallback(
    async (droppedFiles: File[]) => {
      if (droppedFiles.length === 0 || isUploading) return;

      setIsUploading(true);
      const toastId = toast.loading(`Uploading ${droppedFiles.length} file(s)...`);

      try {
        let successCount = 0;
        let failCount = 0;
        const newFiles: FileItem[] = [];

        for (const file of droppedFiles) {
          try {
            const content = await file.text();
            const filePath = displayPath === "/" ? `/${file.name}` : `${displayPath}/${file.name}`;
            await servers.files.create(serverId, filePath, "file", content);
            successCount++;

            // Add to optimistic list
            newFiles.push({
              id: filePath,
              name: file.name,
              type: "file",
              size: formatFileSize(file.size),
              sizeBytes: file.size,
              modified: new Date().toLocaleString(),
              path: filePath,
            });
          } catch {
            failCount++;
          }
        }

        // Optimistically add new files (filter out duplicates)
        if (newFiles.length > 0) {
          setFiles((prev) => {
            const existingPaths = new Set(prev.map((f) => f.path));
            const uniqueNewFiles = newFiles.filter((f) => !existingPaths.has(f.path));
            return [...prev, ...uniqueNewFiles];
          });
        }

        if (failCount === 0) {
          toast.success(`Uploaded ${successCount} file(s)`, { id: toastId });
        } else if (successCount === 0) {
          toast.error(`Failed to upload files`, { id: toastId });
        } else {
          toast.warning(`Uploaded ${successCount}, failed ${failCount}`, { id: toastId });
        }

        // Refresh disk usage
        fetchDiskUsage();
      } catch (error) {
        toast.error(parseDaemonError(error), { id: toastId });
      } finally {
        setIsUploading(false);
      }
    },
    [displayPath, serverId, isUploading, fetchDiskUsage]
  );

  // Global drag-and-drop handlers (disabled when modals are open)
  useEffect(() => {
    // Don't attach handlers if any modal is open
    if (mediaPreviewOpen || uploadModalOpen) {
      return;
    }

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDraggingOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDraggingOver(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDraggingOver(false);

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const droppedFiles = Array.from(e.dataTransfer.files);
        handleDroppedFiles(droppedFiles);
      }
    };

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
    };
  }, [mediaPreviewOpen, uploadModalOpen, handleDroppedFiles]);

  // Navigation helpers - updates local state to trigger row animations
  const navigateToFolder = useCallback((folderName: string) => {
    const newPath = displayPath === "/" ? `/${folderName}` : `${displayPath}/${folderName}`;
    router.push(`/servers/${serverId}/files${newPath}`, undefined);
  }, [displayPath, serverId, router]);

  const navigateUp = useCallback(() => {
    if (displayPath === "/") return;
    const segments = displayPath.split("/").filter(Boolean);
    segments.pop();
    const parentPath = segments.length > 0 ? `/${segments.join("/")}` : "/";
    router.push(`/servers/${serverId}/files${parentPath}`, undefined);
  }, [displayPath, serverId, router]);

  const getBasePath = useCallback(() => `/servers/${serverId}/files`, [serverId]);

  // Build breadcrumb segments
  const breadcrumbSegments = useMemo(() => {
    if (displayPath === "/") return [];
    return displayPath.split("/").filter(Boolean);
  }, [displayPath]);

  const isEditable = useCallback((fileName: string) => {
    return EDITABLE_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));
  }, []);

  const handleDelete = useCallback((file: FileItem) => {
    setFileToDelete(file);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!fileToDelete) return;
    const deletePath = fileToDelete.path;
    try {
      await servers.files.delete(serverId, deletePath);
      // Optimistically remove from list
      setFiles((prev) => prev.filter((f) => f.path !== deletePath));
      toast.success("File deleted");
      fetchDiskUsage();
    } catch (error) {
      toast.error("Failed to delete file");
    } finally {
      setFileToDelete(null);
      setDeleteModalOpen(false);
    }
  }, [fileToDelete, serverId, fetchDiskUsage]);

  const handleBulkDelete = useCallback(() => {
    setBulkDeleteModalOpen(true);
  }, []);

  const confirmBulkDelete = useCallback(async () => {
    const selectedIds = Object.keys(rowSelection);
    try {
      await Promise.all(selectedIds.map((path) => servers.files.delete(serverId, path)));
      // Optimistically remove from list
      setFiles((prev) => prev.filter((f) => !selectedIds.includes(f.path)));
      toast.success(`Deleted ${selectedIds.length} file(s)`);
      setRowSelection({});
      fetchDiskUsage();
    } catch (error) {
      toast.error("Failed to delete some files");
      // Refetch on error to ensure consistency
      fetchFiles();
    } finally {
      setBulkDeleteModalOpen(false);
    }
  }, [rowSelection, serverId, fetchDiskUsage, fetchFiles]);

  const handleRename = useCallback((file: FileItem) => {
    setFileToRename(file);
    setNewFileName(file.name);
    setRenameModalOpen(true);
  }, []);

  const confirmRename = useCallback(async () => {
    if (!fileToRename || !newFileName.trim()) return;
    const oldPath = fileToRename.path;
    const newPath =
      currentPath === "/" ? `/${newFileName.trim()}` : `${currentPath}/${newFileName.trim()}`;
    const newName = newFileName.trim();
    try {
      await servers.files.rename(serverId, oldPath, newPath);
      // Optimistically update the file in list
      setFiles((prev) =>
        prev.map((f) =>
          f.path === oldPath ? { ...f, name: newName, path: newPath, id: newPath } : f
        )
      );
      toast.success("File renamed");
    } catch (error) {
      toast.error(parseDaemonError(error));
    } finally {
      setRenameModalOpen(false);
      setFileToRename(null);
      setNewFileName("");
    }
  }, [fileToRename, newFileName, currentPath, serverId]);

  const handleEditPermissions = useCallback((file: FileItem) => {
    setFileToEditPermissions(file);
    // TODO: Fetch current permissions from API and set them
    // For now, use default permissions (644 for files, 755 for folders)
    if (file.type === "folder") {
      setPermissions({
        owner: { read: true, write: true, execute: true },
        group: { read: true, write: false, execute: true },
        others: { read: true, write: false, execute: true },
      });
    } else {
      setPermissions({
        owner: { read: true, write: true, execute: false },
        group: { read: true, write: false, execute: false },
        others: { read: true, write: false, execute: false },
      });
    }
    setPermissionsModalOpen(true);
  }, []);

  const confirmPermissions = useCallback(async () => {
    if (!fileToEditPermissions) return;
    // Convert permissions to octal
    const toOctal = (p: { read: boolean; write: boolean; execute: boolean }) =>
      (p.read ? 4 : 0) + (p.write ? 2 : 0) + (p.execute ? 1 : 0);
    const mode = `${toOctal(permissions.owner)}${toOctal(permissions.group)}${toOctal(permissions.others)}`;

    try {
      await servers.files.chmod(serverId, fileToEditPermissions.path, mode);
      toast.success(`Permissions updated to ${mode}`);
      playSound("copy");
      setPermissionsModalOpen(false);
      setFileToEditPermissions(null);
    } catch (error) {
      toast.error(parseDaemonError(error));
    }
  }, [fileToEditPermissions, permissions, serverId, playSound]);

  const handleNewFolder = useCallback(() => {
    setNewFolderName("");
    setNewFolderModalOpen(true);
  }, []);

  const confirmNewFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    const folderPath =
      displayPath === "/" ? `/${newFolderName.trim()}` : `${displayPath}/${newFolderName.trim()}`;
    const folderName = newFolderName.trim();
    try {
      await servers.files.create(serverId, folderPath, "directory");
      // Optimistically add folder to list and sort
      setFiles((prev) => {
        const newFiles = [
          ...prev,
          {
            id: folderPath,
            name: folderName,
            type: "folder" as const,
            size: "--",
            sizeBytes: 0,
            modified: new Date().toLocaleString(),
            path: folderPath,
          },
        ];
        // Sort: folders first (alphabetically), then files (alphabetically)
        return newFiles.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type === "folder" ? -1 : 1;
        });
      });
      playSound("copy");
      toast.success("Folder created");
    } catch (error) {
      toast.error(parseDaemonError(error));
    } finally {
      setNewFolderModalOpen(false);
      setNewFolderName("");
    }
  }, [newFolderName, displayPath, serverId, playSound]);

  const handleNewFile = useCallback(() => {
    setNewFileNameInput("");
    setNewFileModalOpen(true);
  }, []);

  const confirmNewFile = useCallback(async () => {
    if (!newFileNameInput.trim()) return;
    const filePath =
      displayPath === "/"
        ? `/${newFileNameInput.trim()}`
        : `${displayPath}/${newFileNameInput.trim()}`;
    const fileName = newFileNameInput.trim();
    try {
      await servers.files.create(serverId, filePath, "file", "");
      // Optimistically add file to list and sort
      setFiles((prev) => {
        const newFiles = [
          ...prev,
          {
            id: filePath,
            name: fileName,
            type: "file" as const,
            size: "0 B",
            sizeBytes: 0,
            modified: new Date().toLocaleString(),
            path: filePath,
          },
        ];
        // Sort: folders first (alphabetically), then files (alphabetically)
        return newFiles.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type === "folder" ? -1 : 1;
        });
      });
      playSound("copy");
      toast.success("File created");
      setNewFileModalOpen(false);
      setNewFileNameInput("");
      // Redirect to editor if file is editable
      if (isEditable(fileName)) {
        router.push(`/servers/${serverId}/files/edit?path=${encodeURIComponent(filePath)}`);
      }
    } catch (error) {
      toast.error(parseDaemonError(error));
    }
  }, [newFileNameInput, displayPath, serverId, playSound, isEditable, router]);

  const handleEdit = useCallback((file: FileItem) => {
    // Navigate to the dedicated file edit page
    router.push(`/servers/${serverId}/files/edit?path=${encodeURIComponent(file.path)}`);
  }, [serverId, router]);

  const handleUploadClick = useCallback(() => {
    setUploadFiles([]);
    setUploadModalOpen(true);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFiles(Array.from(e.target.files));
    }
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setUploadFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const removeUploadFile = useCallback((index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const isBinaryFile = useCallback((filename: string): boolean => {
    const binaryExtensions = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "bmp",
      "ico",
      "mp4",
      "webm",
      "mov",
      "avi",
      "mkv",
      "flv",
      "wmv",
      "m4v",
      "mp3",
      "wav",
      "ogg",
      "m4a",
      "flac",
      "aac",
      "wma",
      "zip",
      "tar",
      "gz",
      "7z",
      "rar",
      "exe",
      "dll",
      "so",
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "ppt",
      "pptx",
    ];
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    return binaryExtensions.includes(ext);
  }, []);

  const calculateSpeed = useCallback((startTime: number, totalBytes: number, currentTime: number): string => {
    const elapsed = (currentTime - startTime) / 1000;
    if (elapsed === 0) return "0 KB/s";
    const speed = totalBytes / elapsed / 1024;
    if (speed < 1024) return `${speed.toFixed(1)} KB/s`;
    return `${(speed / 1024).toFixed(1)} MB/s`;
  }, []);

  const confirmUpload = useCallback(async () => {
    if (uploadFiles.length === 0) return;
    setIsUploading(true);
    const newFiles: FileItem[] = [];
    setUploadModalOpen(false);

    const startTime = Date.now();

    for (const file of uploadFiles) {
      const fileId = `upload-${Date.now()}-${Math.random()}`;

      addUpload({
        id: fileId,
        name: file.name,
        progress: 0,
        speed: "0 KB/s",
        size: file.size,
        uploaded: 0,
      });

      try {
        const filePath = displayPath === "/" ? `/${file.name}` : `${displayPath}/${file.name}`;

        if (isBinaryFile(file.name)) {
          // For binary files, use multipart FormData upload via the API
          const uploadDir = displayPath === "/" ? "" : displayPath;
          const result = await servers.files.upload(serverId, [file], uploadDir);

          if (!result.success) {
            throw new Error("Upload failed - server returned success: false");
          }
        } else {
          // For text files, read as text and use the create endpoint
          const content = await file.text();
          await servers.files.create(serverId, filePath, "file", content);
        }

        newFiles.push({
          id: filePath,
          name: file.name,
          type: "file",
          size: formatFileSize(file.size),
          sizeBytes: file.size,
          modified: new Date().toLocaleString(),
          path: filePath,
        });

        updateUpload(fileId, {
          progress: 100,
          speed: calculateSpeed(startTime, file.size, Date.now()),
        });
        removeUpload(fileId);
      } catch (error) {
        removeUpload(fileId);
        console.error(`Upload failed for file ${file.name}:`, error);
      }
    }

    if (newFiles.length > 0) {
      setFiles((prev) => {
        const existingPaths = new Set(prev.map((f) => f.path));
        const uniqueNewFiles = newFiles.filter((f) => !existingPaths.has(f.path));
        const updatedFiles = [...prev, ...uniqueNewFiles];
        return updatedFiles.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type === "folder" ? -1 : 1;
        });
      });
    }

    playSound("copy");
    toast.success(`Uploaded ${uploadFiles.length} file(s)`);
    setUploadFiles([]);
    fetchDiskUsage();
    setIsUploading(false);
  }, [uploadFiles, displayPath, serverId, isBinaryFile, addUpload, updateUpload, removeUpload, formatFileSize, calculateSpeed, playSound, fetchDiskUsage]);

  const columns: ColumnDef<FileItem>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex w-fit pl-4">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
              className={cn("border-zinc-600 data-[state=checked]:bg-zinc-600")}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex w-fit pl-4">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className={cn("border-zinc-600 data-[state=checked]:bg-zinc-600")}
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => {
          return (
            <button
              className={cn("flex items-center gap-2 transition-colors", "hover:text-zinc-100")}
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Name
              {column.getIsSorted() === "asc" ? (
                <BsChevronUp className="h-3 w-3" />
              ) : column.getIsSorted() === "desc" ? (
                <BsChevronDown className="h-3 w-3" />
              ) : (
                <BsChevronExpand className="h-3 w-3 opacity-50" />
              )}
            </button>
          );
        },
        cell: ({ row }) => {
          const file = row.original;
          const mediaType = getMediaType(file.name);

          return (
            <div className="flex items-center gap-3">
              {file.type === "folder" ? (
                <Folder className={cn("h-4 w-4", "text-amber-400")} />
              ) : mediaType === "image" ? (
                <FileImage className={cn("h-4 w-4", "text-cyan-400")} />
              ) : mediaType === "video" ? (
                <FileImage className={cn("h-4 w-4", "text-purple-400")} />
              ) : mediaType === "audio" ? (
                <FileVolume className={cn("h-4 w-4", "text-orange-400")} />
              ) : (
                <File className={cn("h-4 w-4", "text-zinc-400")} />
              )}
              <span
                className={cn("cursor-pointer hover:underline", "text-zinc-200")}
                onClick={() => {
                  if (file.type === "folder") {
                    navigateToFolder(file.name);
                  } else if (file.type === "file" && isMediaFile(file.name)) {
                    setMediaPreviewFile(file);
                    setMediaPreviewOpen(true);
                  } else if (file.type === "file" && isEditable(file.name)) {
                    handleEdit(file);
                  }
                }}
              >
                {file.name}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "size",
        header: ({ column }) => {
          return (
            <button
              className={cn("flex items-center gap-2 transition-colors", "hover:text-zinc-100")}
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Size
              {column.getIsSorted() === "asc" ? (
                <BsChevronUp className="h-3 w-3" />
              ) : column.getIsSorted() === "desc" ? (
                <BsChevronDown className="h-3 w-3" />
              ) : (
                <BsChevronExpand className="h-3 w-3 opacity-50" />
              )}
            </button>
          );
        },
        cell: ({ row }) => (
          <span className={cn("text-xs", "text-zinc-500")}>{row.getValue("size")}</span>
        ),
      },
      {
        accessorKey: "modified",
        header: ({ column }) => {
          return (
            <button
              className={cn("flex items-center gap-2 transition-colors", "hover:text-zinc-100")}
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Modified
              {column.getIsSorted() === "asc" ? (
                <BsChevronUp className="h-3 w-3" />
              ) : column.getIsSorted() === "desc" ? (
                <BsChevronDown className="h-3 w-3" />
              ) : (
                <BsChevronExpand className="h-3 w-3 opacity-50" />
              )}
            </button>
          );
        },
        cell: ({ row }) => (
          <span className={cn("text-xs", "text-zinc-500")}>{row.getValue("modified")}</span>
        ),
      },
      {
        id: "actions",
        header: () => <span>Actions</span>,
        cell: ({ row }) => {
          const file = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <TextureButton size="sm" variant="ghost" className="w-fit">
                  <BsThreeDotsVertical className="h-4 w-4" />
                </TextureButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={cn("min-w-[160px]", "border-zinc-700 bg-zinc-900")}
              >
                <DropdownMenuItem
                  onClick={() => handleRename(file)}
                  className={cn(
                    "cursor-pointer gap-2 text-xs tracking-wider uppercase",
                    "text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                  )}
                >
                  <BsPencil className="h-3 w-3" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleEditPermissions(file)}
                  className={cn(
                    "cursor-pointer gap-2 text-xs tracking-wider uppercase",
                    "text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                  )}
                >
                  <BsTerminal className="h-3 w-3" />
                  Permissions
                </DropdownMenuItem>
                {file.type === "file" && isMediaFile(file.name) && (
                  <DropdownMenuItem
                    onClick={() => {
                      setMediaPreviewFile(file);
                      setMediaPreviewOpen(true);
                    }}
                    className={cn(
                      "cursor-pointer gap-2 text-xs tracking-wider uppercase",
                      "text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                    )}
                  >
                    <BsEye className="h-3 w-3" />
                    View
                  </DropdownMenuItem>
                )}
                {file.type === "file" && isEditable(file.name) && (
                  <DropdownMenuItem
                    onClick={() => handleEdit(file)}
                    className={cn(
                      "cursor-pointer gap-2 text-xs tracking-wider uppercase",
                      "text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                    )}
                  >
                    <BsFileText className="h-3 w-3" />
                    Edit
                  </DropdownMenuItem>
                )}
                {file.type === "file" && (
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        const { downloadUrl } = await servers.files.getDownloadToken(
                          serverId,
                          file.path
                        );
                        window.open(
                          `${typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.origin : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}${downloadUrl}`,
                          "_blank"
                        );
                      } catch (error) {
                        toast.error("Failed to generate download link");
                      }
                    }}
                    className={cn(
                      "cursor-pointer gap-2 text-xs tracking-wider uppercase",
                      "text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                    )}
                  >
                    <BsDownload className="h-3 w-3" />
                    Download
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-zinc-700" />
                <DropdownMenuItem
                  onClick={() => handleDelete(file)}
                  className={cn(
                    "cursor-pointer gap-2 text-xs tracking-wider uppercase",
                    "text-red-400 focus:bg-red-950/50 focus:text-red-300"
                  )}
                >
                  <BsTrash className="h-3 w-3" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [displayPath, serverId, navigateToFolder, handleEdit, handleDelete, handleRename, handleEditPermissions, isEditable]
  );

  // Toggle hidden files visibility
  const handleToggleHiddenFiles = useCallback(() => {
    const newValue = !showHiddenFiles;
    setShowHiddenFiles(newValue);
    localStorage.setItem("stellarstack-show-hidden-files", String(newValue));
  }, [showHiddenFiles]);

  // Filter files based on hidden files preference
  const displayFiles = useMemo(() => {
    let filtered = files;

    // Filter hidden files
    if (!showHiddenFiles) {
      filtered = filtered.filter((file) => !file.name.startsWith("."));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((file) => file.name.toLowerCase().includes(query));
    }

    return filtered;
  }, [files, showHiddenFiles, searchQuery]);

  const table = useReactTable({
    data: displayFiles,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  if (!mounted) return null;

  if (isInstalling) {
    return (
      <div className="min-h-svh">
        {/* Background is now rendered in the layout for persistence */}
        <ServerInstallingPlaceholder serverName={server?.name} />
      </div>
    );
  }

  if (server?.status === "SUSPENDED") {
    return (
      <div className="min-h-svh">
        <ServerSuspendedPlaceholder serverName={server?.name} />
      </div>
    );
  }

  return (
    <>
      <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
          <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
            {/* Header */}
            <FadeIn delay={0}>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <SidebarTrigger
                    className={cn(
                      "text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95"
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    <Link
                      href={getBasePath()}
                      className={cn(
                        "text-sm transition-colors hover:underline",
                        "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      / home
                    </Link>
                    {breadcrumbSegments.map((segment, index) => {
                      const pathUpToHere = "/" + breadcrumbSegments.slice(0, index + 1).join("/");
                      const isLast = index === breadcrumbSegments.length - 1;
                      return (
                        <span key={pathUpToHere} className="flex items-center gap-1">
                          <span className={cn("text-sm", "text-zinc-600")}>/</span>
                          {isLast ? (
                            <span className={cn("text-sm", "text-zinc-300")}>{segment}</span>
                          ) : (
                            <Link
                              href={`${getBasePath()}${pathUpToHere}`}
                              className={cn(
                                "text-sm transition-colors hover:underline",
                                "text-zinc-500 hover:text-zinc-300"
                              )}
                            >
                              {segment}
                            </Link>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TextureButton
                    variant="primary"
                    size="sm"
                    className="w-fit"
                    onClick={handleUploadClick}
                  >
                    <BsUpload className="h-4 w-4" />
                    Upload
                  </TextureButton>
                </div>
              </div>
            </FadeIn>

            <div className="space-y-4">
              {/* Storage Card */}
              <FadeIn delay={0.05}>
                <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                  <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">Storage</div>
                  <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20">
                    <div className="flex items-center gap-4">
                      <img src="/icons/24-file-download.svg" alt="storage_icon" />
                      <div className="flex-1">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs text-zinc-400">
                            {storageUsedGB.toFixed(2)} GB / {storageTotalGB.toFixed(1)} GB
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-lg bg-zinc-800">
                          <div
                            className={cn(
                              "h-full rounded-lg transition-all",
                              storagePercentage > 90
                                ? "bg-red-500"
                                : storagePercentage > 70
                                  ? "bg-amber-500"
                                  : "bg-green-500"
                            )}
                            style={{ width: `${Math.min(100, storagePercentage)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </FadeIn>

              {/* Folders Card */}
              <FadeIn delay={0.1}>
                <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                  <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">Folders</div>
                  <div className="relative flex h-72 flex-row flex-nowrap justify-center overflow-scroll rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20">
                    {/* filter out and display all the folder as well as their quanity */}
                    {displayFiles.some((file) => file.type === "folder") ? (
                      <div className="flex flex-wrap items-center gap-4 pb-2">
                        {displayFiles
                          .filter((file) => file.type === "folder")
                          .map((folder) => (
                            <div
                              key={folder.path}
                              onClick={() => navigateToFolder(folder.name)}
                              className="cursor-pointer"
                            >
                              <FilledFolder folderName={folder.name} folderQuantity={0} />
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="item-center flex h-full w-full flex-col justify-center text-center text-sm text-zinc-500">
                        <p>No folders found.</p>
                      </div>
                    )}
                  </div>
                </div>
              </FadeIn>

              {/* Toolbar Card */}
              <FadeIn delay={0.15}>
                {/* Toolbar */}
                <div
                  className={cn(
                    "sticky top-0 z-40 mb-6 overflow-hidden rounded-lg border border-zinc-200/10"
                  )}
                  style={{
                    background:
                      "linear-gradient(to bottom, rgba(20, 20, 20, 1), rgba(15, 15, 15, 1), rgba(10, 10, 10, 1))",
                  }}
                >
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <TextureButton
                        variant="minimal"
                        disabled={displayPath === "/"}
                        onClick={navigateUp}
                      >
                        <BsArrowLeft className="h-4 w-4" />
                        <span className="hidden text-xs tracking-wider uppercase sm:inline">
                          Back
                        </span>
                      </TextureButton>
                      <TextureButton variant="minimal" onClick={handleNewFolder}>
                        <BsPlus className="h-4 w-4" />
                        <span className="hidden text-xs tracking-wider uppercase sm:inline">
                          New Folder
                        </span>
                      </TextureButton>
                      <TextureButton variant="minimal" onClick={handleNewFile}>
                        <BsFileText className="h-4 w-4" />
                        <span className="hidden text-xs tracking-wider uppercase sm:inline">
                          New File
                        </span>
                      </TextureButton>
                      {selectedCount > 0 && (
                        <span className={cn("ml-2 text-xs", "text-zinc-500")}>
                          {selectedCount} selected
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {/*TODO: TO ADD BACK THE SEARCH*/}
                      {/*<Input*/}
                      {/*    type="text"*/}
                      {/*    value={searchQuery}*/}
                      {/*    onChange={(e) => setSearchQuery(e.target.value)}*/}
                      {/*    placeholder="Search..."*/}
                      {/*    className="pt-0 mt-0 w-1/4"*/}
                      {/*/>*/}
                      <TextureButton
                        variant="minimal"
                        onClick={() => setSftpModalOpen(true)}
                        title="SFTP Connection"
                      >
                        <BsTerminal className="h-4 w-4" />
                        <span className="hidden text-xs tracking-wider uppercase md:inline">
                          SFTP
                        </span>
                      </TextureButton>
                      <TextureButton
                        variant="minimal"
                        onClick={handleUploadClick}
                        title="Upload Files"
                      >
                        <BsUpload className="h-4 w-4" />
                        <span className="hidden text-xs tracking-wider uppercase md:inline">
                          Upload
                        </span>
                      </TextureButton>
                      <TextureButton
                        variant="minimal"
                        onClick={handleToggleHiddenFiles}
                        title={showHiddenFiles ? "Hide hidden files" : "Show hidden files"}
                      >
                        <div>
                          {showHiddenFiles ? (
                            <BsEye className="h-4 w-4" />
                          ) : (
                            <BsEyeSlash className="h-4 w-4" />
                          )}
                        </div>
                        <div className="text-xs tracking-wider uppercase">
                          {showHiddenFiles ? "Showing Hidden" : "Show Hidden"}
                        </div>
                      </TextureButton>
                      <TextureButton
                        variant="destructive"
                        disabled={selectedCount === 0}
                        onClick={handleBulkDelete}
                      >
                        <BsTrash className="h-4 w-4" />
                        <span className="text-xs tracking-wider uppercase">Delete</span>
                      </TextureButton>
                    </div>
                  </div>
                </div>
              </FadeIn>

              {/* Files Table Card */}
              <FadeIn delay={0.2}>
                <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                  <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">
                    Files{" "}
                    {table.getFilteredRowModel().rows.length > 0 &&
                      `(${table.getFilteredRowModel().rows.length})`}
                  </div>
                  <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                    <DataTable
                      table={table}
                      columns={columns}
                      isLoading={isLoading}
                      emptyMessage={
                        searchQuery
                          ? `No files matching "${searchQuery}" found.`
                          : "No files found."
                      }
                      animateRows={true}
                    />
                  </div>
                </div>
              </FadeIn>

              {/* Footer */}
              <div className="mt-2 text-xs text-zinc-600">{selectedCount} selected</div>
            </div>
          </div>
        </div>
      </FadeIn>

      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          >
            {/* Backdrop */}
            <div className={cn("absolute inset-0", "bg-black/80")} />
            {/* Drop zone indicator */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "relative border-4 border-dashed p-16 text-center",
                "border-zinc-500 bg-zinc-900/90"
              )}
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <BsCloudUpload className={cn("mx-auto mb-4 h-16 w-16", "text-zinc-400")} />
              </motion.div>
              <p className={cn("text-xl font-light tracking-wider", "text-zinc-200")}>
                DROP FILES TO UPLOAD
              </p>
              <p className={cn("mt-2 text-sm", "text-zinc-500")}>
                Files will be uploaded to: {currentPath}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete File"
        description={`Are you sure you want to delete "${fileToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />

      {/* Bulk Delete Modal */}
      <ConfirmationModal
        open={bulkDeleteModalOpen}
        onOpenChange={setBulkDeleteModalOpen}
        title="Delete Files"
        description={`Are you sure you want to delete ${selectedCount} selected file(s)? This action cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={confirmBulkDelete}
      />

      {/* Rename Modal */}
      <FormModal
        open={renameModalOpen}
        onOpenChange={setRenameModalOpen}
        title="Rename"
        description={`Enter a new name for "${fileToRename?.name}"`}
        submitLabel="Rename"
        onSubmit={confirmRename}
        isValid={newFileName.trim().length > 0}
      >
        <Input
          type="text"
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          placeholder="Enter new name"
          className={cn(
            "border-zinc-700/50 bg-zinc-900/50 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500"
          )}
        />
      </FormModal>

      {/* New Folder Modal */}
      <FormModal
        open={newFolderModalOpen}
        onOpenChange={setNewFolderModalOpen}
        title="New Folder"
        description="Enter a name for the new folder"
        submitLabel="Create"
        onSubmit={confirmNewFolder}
        isValid={newFolderName.trim().length > 0}
      >
        <Input
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="Folder name"
          className={cn(
            "border-zinc-700/50 bg-zinc-900/50 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500"
          )}
        />
      </FormModal>

      {/* New File Modal */}
      <FormModal
        open={newFileModalOpen}
        onOpenChange={setNewFileModalOpen}
        title="New File"
        description="Enter a name for the new file"
        submitLabel="Create"
        onSubmit={confirmNewFile}
        isValid={newFileNameInput.trim().length > 0}
      >
        <Input
          type="text"
          value={newFileNameInput}
          onChange={(e) => setNewFileNameInput(e.target.value)}
          placeholder="File name (e.g., config.yml)"
          className={cn(
            "w-full border border-zinc-700/50 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 transition-colors outline-none placeholder:text-zinc-600 focus:border-zinc-500"
          )}
        />
      </FormModal>

      {/* SFTP Connection Modal */}
      <Dialog open={sftpModalOpen} onOpenChange={setSftpModalOpen}>
        <DialogContent className={cn("max-w-2xl", "border-zinc-800 bg-zinc-900")}>
          <DialogHeader>
            <DialogTitle className={cn("text-lg font-semibold", "text-zinc-100")}>
              SFTP Connection Details
            </DialogTitle>
            <DialogDescription className={cn("text-sm", "text-zinc-400")}>
              Use these credentials to connect to your server via SFTP
            </DialogDescription>
          </DialogHeader>
          {server?.node && user && (
            <div className="mt-4 space-y-4">
              {/* Connection Details */}
              <div className="space-y-3">
                {/* Host */}
                <div>
                  <Label>Host</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <code
                      className={cn(
                        "flex-1 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200"
                      )}
                    >
                      {server.node.host}
                    </code>
                    <TextureButton
                      variant="minimal"
                      onClick={() => {
                        navigator.clipboard.writeText(server.node!.host);
                        toast.success("Host copied to clipboard");
                      }}
                    >
                      <BsClipboard className="h-3.5 w-3.5" />
                    </TextureButton>
                  </div>
                </div>

                {/* Port */}
                <div>
                  <Label>Port</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <code
                      className={cn(
                        "flex-1 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200"
                      )}
                    >
                      {server.node.sftpPort}
                    </code>
                    <TextureButton
                      variant="minimal"
                      onClick={() => {
                        navigator.clipboard.writeText(server.node!.sftpPort.toString());
                        toast.success("Port copied to clipboard");
                      }}
                    >
                      <BsClipboard className="h-3.5 w-3.5" />
                    </TextureButton>
                  </div>
                </div>

                {/* Username */}
                <div>
                  <Label>Username</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <code
                      className={cn(
                        "flex-1 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200"
                      )}
                    >
                      {server.id}.{user.email}
                    </code>
                    <TextureButton
                      variant="minimal"
                      onClick={() => {
                        navigator.clipboard.writeText(`${server.id}.${user.email}`);
                        toast.success("Username copied to clipboard");
                      }}
                    >
                      <BsClipboard className="h-3.5 w-3.5" />
                    </TextureButton>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <Label>Password</Label>
                  <div className="mt-1">
                    <div
                      className={cn(
                        "rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400"
                      )}
                    >
                      Your account password
                    </div>
                  </div>
                </div>

                {/* Connection String */}
                <div>
                  <Label
                    className={cn("text-xs font-medium tracking-wider uppercase", "text-zinc-500")}
                  >
                    Connection String
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <code
                      className={cn(
                        "flex-1 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm break-all whitespace-normal text-zinc-200"
                      )}
                    >
                      sftp://{server.id}.{user.email}@{server.node.host}:{server.node.sftpPort}
                    </code>
                    <TextureButton
                      variant="minimal"
                      onClick={() => {
                        if (server.node) {
                          navigator.clipboard.writeText(
                            `sftp://${server.id}.${user.email}@${server.node.host}:${server.node.sftpPort}`
                          );
                          toast.success("Connection string copied to clipboard");
                        }
                      }}
                    >
                      <BsClipboard className="h-3.5 w-3.5" />
                    </TextureButton>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className={cn("mt-6 rounded border p-4", "border-zinc-800 bg-zinc-950/50")}>
                <h4 className={cn("mb-2 text-sm font-semibold", "text-zinc-300")}>
                  Popular SFTP Clients:
                </h4>
                <ul className={cn("list-inside list-disc space-y-1 text-sm", "text-zinc-400")}>
                  <li>FileZilla (Windows, macOS, Linux)</li>
                  <li>WinSCP (Windows)</li>
                  <li>Cyberduck (Windows, macOS)</li>
                  <li>Transmit (macOS)</li>
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Permissions Editor Modal */}
      <Dialog open={permissionsModalOpen} onOpenChange={setPermissionsModalOpen}>
        <DialogContent className={cn("max-w-md", "border-zinc-800 bg-zinc-900")}>
          <DialogHeader>
            <DialogTitle className={cn("text-lg font-semibold", "text-zinc-100")}>
              Edit Permissions
            </DialogTitle>
            <DialogDescription className={cn("text-sm", "text-zinc-400")}>
              {fileToEditPermissions
                ? `Change permissions for "${fileToEditPermissions.name}"`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {fileToEditPermissions && (
            <div className="mt-4 space-y-4">
              {/* Permission Grid */}
              <div className={cn("overflow-hidden rounded border", "border-zinc-800")}>
                {/* Header Row */}
                <div
                  className={cn(
                    "grid grid-cols-4 border-b border-zinc-800 bg-zinc-950 text-xs font-semibold tracking-wider text-zinc-400 uppercase"
                  )}
                >
                  <div className="p-3"></div>
                  <div className="p-3 text-center">Read</div>
                  <div className="p-3 text-center">Write</div>
                  <div className="p-3 text-center">Execute</div>
                </div>

                {/* Owner Row */}
                <div className={cn("grid grid-cols-4 border-b", "border-zinc-800")}>
                  <div className={cn("p-3 text-sm font-medium", "text-zinc-300")}>Owner</div>
                  <div className="flex justify-center p-3">
                    <Checkbox
                      checked={permissions.owner.read}
                      onCheckedChange={(checked) =>
                        setPermissions((p) => ({
                          ...p,
                          owner: { ...p.owner, read: checked as boolean },
                        }))
                      }
                      className={cn("border-zinc-700")}
                    />
                  </div>
                  <div className="flex justify-center p-3">
                    <Checkbox
                      checked={permissions.owner.write}
                      onCheckedChange={(checked) =>
                        setPermissions((p) => ({
                          ...p,
                          owner: { ...p.owner, write: checked as boolean },
                        }))
                      }
                      className={cn("border-zinc-700")}
                    />
                  </div>
                  <div className="flex justify-center p-3">
                    <Checkbox
                      checked={permissions.owner.execute}
                      onCheckedChange={(checked) =>
                        setPermissions((p) => ({
                          ...p,
                          owner: { ...p.owner, execute: checked as boolean },
                        }))
                      }
                      className={cn("border-zinc-700")}
                    />
                  </div>
                </div>

                {/* Group Row */}
                <div className={cn("grid grid-cols-4 border-b", "border-zinc-800")}>
                  <div className={cn("p-3 text-sm font-medium", "text-zinc-300")}>Group</div>
                  <div className="flex justify-center p-3">
                    <Checkbox
                      checked={permissions.group.read}
                      onCheckedChange={(checked) =>
                        setPermissions((p) => ({
                          ...p,
                          group: { ...p.group, read: checked as boolean },
                        }))
                      }
                      className={cn("border-zinc-700")}
                    />
                  </div>
                  <div className="flex justify-center p-3">
                    <Checkbox
                      checked={permissions.group.write}
                      onCheckedChange={(checked) =>
                        setPermissions((p) => ({
                          ...p,
                          group: { ...p.group, write: checked as boolean },
                        }))
                      }
                      className={cn("border-zinc-700")}
                    />
                  </div>
                  <div className="flex justify-center p-3">
                    <Checkbox
                      checked={permissions.group.execute}
                      onCheckedChange={(checked) =>
                        setPermissions((p) => ({
                          ...p,
                          group: { ...p.group, execute: checked as boolean },
                        }))
                      }
                      className={cn("border-zinc-700")}
                    />
                  </div>
                </div>

                {/* Others Row */}
                <div className="grid grid-cols-4">
                  <div className={cn("p-3 text-sm font-medium", "text-zinc-300")}>Others</div>
                  <div className="flex justify-center p-3">
                    <Checkbox
                      checked={permissions.others.read}
                      onCheckedChange={(checked) =>
                        setPermissions((p) => ({
                          ...p,
                          others: { ...p.others, read: checked as boolean },
                        }))
                      }
                      className={cn("border-zinc-700")}
                    />
                  </div>
                  <div className="flex justify-center p-3">
                    <Checkbox
                      checked={permissions.others.write}
                      onCheckedChange={(checked) =>
                        setPermissions((p) => ({
                          ...p,
                          others: { ...p.others, write: checked as boolean },
                        }))
                      }
                      className={cn("border-zinc-700")}
                    />
                  </div>
                  <div className="flex justify-center p-3">
                    <Checkbox
                      checked={permissions.others.execute}
                      onCheckedChange={(checked) =>
                        setPermissions((p) => ({
                          ...p,
                          others: { ...p.others, execute: checked as boolean },
                        }))
                      }
                      className={cn("border-zinc-700")}
                    />
                  </div>
                </div>
              </div>

              {/* Octal Preview */}
              <div className={cn("rounded border p-4", "border-zinc-800 bg-zinc-950/50")}>
                <div
                  className={cn(
                    "mb-2 text-xs font-medium tracking-wider uppercase",
                    "text-zinc-500"
                  )}
                >
                  Octal Representation
                </div>
                <code className={cn("font-mono text-lg", "text-zinc-200")}>
                  {(permissions.owner.read ? 4 : 0) +
                    (permissions.owner.write ? 2 : 0) +
                    (permissions.owner.execute ? 1 : 0)}
                  {(permissions.group.read ? 4 : 0) +
                    (permissions.group.write ? 2 : 0) +
                    (permissions.group.execute ? 1 : 0)}
                  {(permissions.others.read ? 4 : 0) +
                    (permissions.others.write ? 2 : 0) +
                    (permissions.others.execute ? 1 : 0)}
                </code>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end gap-2">
                <TextureButton variant="minimal" onClick={() => setPermissionsModalOpen(false)}>
                  Cancel
                </TextureButton>
                <TextureButton onClick={confirmPermissions}>Apply</TextureButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      <FormModal
        open={uploadModalOpen}
        onOpenChange={(open) => {
          if (!isUploading) {
            setUploadModalOpen(open);
            if (!open) setUploadFiles([]);
          }
        }}
        title="Upload Files"
        description="Upload files to the current directory."
        onSubmit={confirmUpload}
        submitLabel={isUploading ? "Uploading..." : "Upload"}
        isValid={uploadFiles.length > 0 && !isUploading}
      >
        <div className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className={cn(
              "relative rounded-lg border-2 border-dashed border-zinc-700/50 bg-zinc-900/30 p-8 text-center transition-colors hover:border-zinc-500"
            )}
          >
            <Input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="absolute inset-0 h-full w-full cursor-pointer rounded-lg opacity-0"
            />
            <BsCloudUpload className={cn("mx-auto mb-3 h-10 w-10", "text-zinc-600")} />
            <p className={cn("text-sm", "text-zinc-400")}>
              Drag and drop files here, or click to browse
            </p>
            <p className={cn("mt-1 text-xs", "text-zinc-600")}>
              Text files only (binary uploads coming soon)
            </p>
          </div>

          {/* File list */}
          {uploadFiles.length > 0 && (
            <div className="space-y-2">
              <p className={cn("text-xs tracking-wider uppercase", "text-zinc-500")}>
                {uploadFiles.length} file(s) selected
              </p>
              <div className={cn("max-h-40 overflow-y-auto border", "border-zinc-800")}>
                {uploadFiles.map((file, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-between px-3 py-2",
                      index !== uploadFiles.length - 1 && "border-b border-zinc-800"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <BsFileEarmark className={cn("h-4 w-4 shrink-0", "text-zinc-500")} />
                      <span className={cn("truncate text-sm", "text-zinc-300")}>{file.name}</span>
                      <span className={cn("shrink-0 text-xs", "text-zinc-600")}>
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                    <TextureButton
                      variant="minimal"
                      onClick={() => removeUploadFile(index)}
                      disabled={isUploading}
                    >
                      <BsX className="h-4 w-4" />
                    </TextureButton>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload progress */}
          {isUploading && (
            <div className="flex items-center justify-center gap-3 py-2">
              <Spinner className={cn("h-4 w-4", "text-zinc-400")} />
              <span className={cn("text-sm", "text-zinc-400")}>Uploading files...</span>
            </div>
          )}
        </div>
      </FormModal>

      {/* Media Preview Modal */}
      {mediaPreviewFile && (
        <MediaPreviewModal
          isOpen={mediaPreviewOpen}
          fileName={mediaPreviewFile.name}
          filePath={mediaPreviewFile.path}
          serverId={serverId}
          onClose={() => {
            setMediaPreviewOpen(false);
            setMediaPreviewFile(null);
          }}
          fetchFile={(serverId, path) => servers.files.read(serverId, path)}
          fileSize={mediaPreviewFile.size}
          fileSizeBytes={mediaPreviewFile.sizeBytes}
          modified={mediaPreviewFile.modified}
          fileType={mediaPreviewFile.type}
        />
      )}
    </>
  );
};

export default FilesPage;
