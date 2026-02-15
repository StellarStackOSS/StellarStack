/**
 * File operation routes for the mock daemon.
 * Implements list, read, write, create, rename, copy, delete, compress,
 * decompress, chmod, disk-usage, and pull endpoints.
 */

import { Hono } from "hono";
import type {
  WriteFileRequest,
  CreateFileRequest,
  RenameFileRequest,
  CopyFileRequest,
  DeleteFilesRequest,
  CompressFilesRequest,
  DecompressFileRequest,
  ChmodRequest,
  PullFileRequest,
  MockFile,
} from "../Types.js";
import { GetServer, ListFiles, GetFile, SetFile, DeleteFile, NormalizePath } from "../State.js";
import { MockFileToFileInfo, GenerateUUID } from "../Generators.js";

const FileRoutes = new Hono();

/**
 * GET /files/list?directory=... — List files in a directory.
 */
FileRoutes.get("/list", (c) => {
  const serverId = c.req.param("server_id") as string;
  const directory = c.req.query("directory") ?? "/";
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const files = ListFiles(serverId, directory);
  return c.json(files.map(MockFileToFileInfo));
});

/**
 * GET /files/contents?file=... — Read file contents.
 */
FileRoutes.get("/contents", (c) => {
  const serverId = c.req.param("server_id") as string;
  const filePath = c.req.query("file") ?? "";
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const file = GetFile(serverId, filePath);
  if (!file || file.is_directory) {
    return c.json({ error: "File not found" }, 404);
  }

  return c.text(file.content);
});

/**
 * POST /files/write — Write content to a file.
 */
FileRoutes.post("/write", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<WriteFileRequest>();
  const now = Math.floor(Date.now() / 1000);
  const normalized = NormalizePath(body.file);
  const name = normalized.split("/").pop() ?? body.file;

  const existing = GetFile(serverId, body.file);
  const file: MockFile = {
    name,
    content: body.content,
    is_directory: false,
    size: body.content.length,
    modified: now,
    created: existing?.created ?? now,
    mode: existing?.mode ?? 0o644,
  };

  SetFile(serverId, body.file, file);
  return c.json({ success: true });
});

/**
 * POST /files/create — Create a new file or directory.
 */
FileRoutes.post("/create", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<CreateFileRequest>();
  const now = Math.floor(Date.now() / 1000);
  const normalized = NormalizePath(body.path);
  const name = normalized.split("/").pop() ?? body.path;
  const isDir = body.type === "directory";

  const file: MockFile = {
    name,
    content: isDir ? "" : (body.content ?? ""),
    is_directory: isDir,
    size: isDir ? 4096 : (body.content?.length ?? 0),
    modified: now,
    created: now,
    mode: isDir ? 0o755 : 0o644,
  };

  SetFile(serverId, body.path, file);
  return c.json({ success: true });
});

/**
 * POST /files/create-directory — Create a new directory.
 */
FileRoutes.post("/create-directory", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<{ name: string; path?: string }>();
  const now = Math.floor(Date.now() / 1000);
  const fullPath = body.path ? `${body.path}/${body.name}` : `/${body.name}`;

  const dir: MockFile = {
    name: body.name,
    content: "",
    is_directory: true,
    size: 4096,
    modified: now,
    created: now,
    mode: 0o755,
  };

  SetFile(serverId, fullPath, dir);
  return c.json({ success: true });
});

/**
 * POST /files/rename — Rename files or directories.
 */
FileRoutes.post("/rename", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<RenameFileRequest>();
  const root = body.root ?? "/";

  for (const rename of body.files) {
    const fromPath = `${root}/${rename.from}`.replace(/\/+/g, "/");
    const toPath = `${root}/${rename.to}`.replace(/\/+/g, "/");
    const file = GetFile(serverId, fromPath);

    if (file) {
      const newName = toPath.split("/").pop() ?? rename.to;
      DeleteFile(serverId, fromPath);
      SetFile(serverId, toPath, { ...file, name: newName, modified: Math.floor(Date.now() / 1000) });
    }
  }

  return c.json({ success: true });
});

/**
 * POST /files/copy — Copy a file.
 */
FileRoutes.post("/copy", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<CopyFileRequest>();
  const file = GetFile(serverId, body.location);

  if (!file) {
    return c.json({ error: "File not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);
  const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
  const base = file.name.replace(ext, "");
  const copyName = `${base}-copy${ext}`;
  const dir = NormalizePath(body.location).split("/").slice(0, -1).join("/") || "/";
  const copyPath = `${dir}/${copyName}`;

  SetFile(serverId, copyPath, { ...file, name: copyName, created: now, modified: now });
  return c.json({ name: copyName });
});

/**
 * DELETE /files/delete — Delete files and directories.
 */
FileRoutes.delete("/delete", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<DeleteFilesRequest>();
  const root = body.root ?? "/";

  for (const filePath of body.files) {
    const fullPath = `${root}/${filePath}`.replace(/\/+/g, "/");
    DeleteFile(serverId, fullPath);
  }

  return c.json({ success: true });
});

/**
 * POST /files/compress — Compress files into an archive.
 */
FileRoutes.post("/compress", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<CompressFilesRequest>();
  const now = Math.floor(Date.now() / 1000);
  const archiveName = `archive-${GenerateUUID().slice(0, 8)}.tar.gz`;
  const archivePath = `${body.root}/${archiveName}`.replace(/\/+/g, "/");

  const archive: MockFile = {
    name: archiveName,
    content: `[compressed: ${body.files.join(", ")}]`,
    is_directory: false,
    size: 1024 * 1024,
    modified: now,
    created: now,
    mode: 0o644,
  };

  SetFile(serverId, archivePath, archive);
  return c.json(MockFileToFileInfo(archive));
});

/**
 * POST /files/decompress — Decompress an archive.
 */
FileRoutes.post("/decompress", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  await c.req.json<DecompressFileRequest>();
  return c.json({ success: true });
});

/**
 * POST /files/chmod — Change file permissions.
 */
FileRoutes.post("/chmod", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<ChmodRequest>();
  const root = body.root ?? "/";

  for (const entry of body.files) {
    const fullPath = `${root}/${entry.file}`.replace(/\/+/g, "/");
    const file = GetFile(serverId, fullPath);
    if (file) {
      SetFile(serverId, fullPath, { ...file, mode: entry.mode });
    }
  }

  return c.json({ success: true });
});

/**
 * GET /files/disk-usage — Get disk usage for a server.
 */
FileRoutes.get("/disk-usage", (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  /** Sum up all file sizes */
  let used = 0;
  for (const file of server.files.values()) {
    used += file.size;
  }

  const total = (server.config.build?.disk_space ?? 10240) * 1024 * 1024;
  return c.json({ total, used, available: total - used });
});

/**
 * POST /files/pull — Pull a remote file to the server.
 */
FileRoutes.post("/pull", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<PullFileRequest>();
  const now = Math.floor(Date.now() / 1000);
  const fileName = body.file_name ?? body.url.split("/").pop() ?? "downloaded-file";
  const dir = body.directory ?? "/";
  const fullPath = `${dir}/${fileName}`.replace(/\/+/g, "/");

  const file: MockFile = {
    name: fileName,
    content: `[pulled from: ${body.url}]`,
    is_directory: false,
    size: 1024,
    modified: now,
    created: now,
    mode: 0o644,
  };

  SetFile(serverId, fullPath, file);
  return c.json({ success: true });
});

/**
 * POST /files/upload — Handle file upload (multipart).
 */
FileRoutes.post("/upload", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const directory = c.req.query("directory") ?? "/";
  const now = Math.floor(Date.now() / 1000);

  /** In mock mode, just acknowledge the upload */
  const uploadedFiles: string[] = [];
  try {
    const formData = await c.req.formData();
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        const fileName = value.name || key;
        const fullPath = `${directory}/${fileName}`.replace(/\/+/g, "/");
        const content = await value.text();

        SetFile(serverId, fullPath, {
          name: fileName,
          content,
          is_directory: false,
          size: value.size,
          modified: now,
          created: now,
          mode: 0o644,
        });
        uploadedFiles.push(fileName);
      }
    }
  } catch {
    /** If form parsing fails, still return success (mock) */
    uploadedFiles.push("mock-uploaded-file");
  }

  return c.json({ success: true, files: uploadedFiles });
});

export default FileRoutes;
