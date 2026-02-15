/**
 * In-memory state store for the mock daemon.
 * Manages servers, their files, console buffers, backups, and schedules.
 */

import type { MockServer, MockFile, ConsoleLine, BackupEntry, Schedule } from "./Types.js";

/** Global server store keyed by UUID */
const servers = new Map<string, MockServer>();

/**
 * Creates a new mock server entry in the store.
 *
 * @param uuid - Server UUID
 * @param name - Server display name
 * @param config - Full server creation config
 * @returns The created MockServer
 */
const CreateServer = (uuid: string, name: string, config: MockServer["config"]): MockServer => {
  const server: MockServer = {
    config,
    state: "offline",
    suspended: config.suspended ?? false,
    is_installing: false,
    is_transferring: false,
    is_restoring: false,
    console_buffer: [],
    files: CreateDefaultFileTree(),
    backups: new Map(),
    schedules: new Map(),
  };
  servers.set(uuid, server);
  return server;
};

/**
 * Retrieves a server by UUID.
 *
 * @param uuid - Server UUID
 * @returns The MockServer or undefined
 */
const GetServer = (uuid: string): MockServer | undefined => {
  return servers.get(uuid);
};

/**
 * Deletes a server by UUID.
 *
 * @param uuid - Server UUID
 * @returns True if the server was deleted
 */
const DeleteServer = (uuid: string): boolean => {
  return servers.delete(uuid);
};

/**
 * Returns all servers as an array of [uuid, server] tuples.
 *
 * @returns Array of server entries
 */
const GetAllServers = (): Array<[string, MockServer]> => {
  return Array.from(servers.entries());
};

/**
 * Adds a console line to a server's buffer (max 1000 lines).
 *
 * @param uuid - Server UUID
 * @param line - Console output line
 */
const AddConsoleLine = (uuid: string, line: string): void => {
  const server = servers.get(uuid);
  if (!server) return;
  const entry: ConsoleLine = { line, timestamp: Math.floor(Date.now() / 1000) };
  server.console_buffer.push(entry);
  if (server.console_buffer.length > 1000) {
    server.console_buffer.shift();
  }
};

/**
 * Gets a file from a server's file tree.
 *
 * @param uuid - Server UUID
 * @param path - File path
 * @returns The MockFile or undefined
 */
const GetFile = (uuid: string, path: string): MockFile | undefined => {
  const server = servers.get(uuid);
  if (!server) return undefined;
  return server.files.get(NormalizePath(path));
};

/**
 * Sets a file in a server's file tree.
 *
 * @param uuid - Server UUID
 * @param path - File path
 * @param file - The file data
 */
const SetFile = (uuid: string, path: string, file: MockFile): void => {
  const server = servers.get(uuid);
  if (!server) return;
  server.files.set(NormalizePath(path), file);
};

/**
 * Deletes a file from a server's file tree.
 *
 * @param uuid - Server UUID
 * @param path - File path
 * @returns True if the file was deleted
 */
const DeleteFile = (uuid: string, path: string): boolean => {
  const server = servers.get(uuid);
  if (!server) return false;
  const normalized = NormalizePath(path);
  /** Also delete children if it's a directory */
  const toDelete: string[] = [];
  for (const key of server.files.keys()) {
    if (key === normalized || key.startsWith(normalized + "/")) {
      toDelete.push(key);
    }
  }
  for (const key of toDelete) {
    server.files.delete(key);
  }
  return toDelete.length > 0;
};

/**
 * Lists files in a directory for a given server.
 *
 * @param uuid - Server UUID
 * @param directory - Directory path
 * @returns Array of files in the directory
 */
const ListFiles = (uuid: string, directory: string): MockFile[] => {
  const server = servers.get(uuid);
  if (!server) return [];
  const dir = NormalizePath(directory);
  const results: MockFile[] = [];
  for (const [path, file] of server.files.entries()) {
    const parent = path.substring(0, path.lastIndexOf("/")) || "/";
    if (parent === dir) {
      results.push(file);
    }
  }
  return results;
};

/**
 * Normalizes a file path (removes trailing slashes, ensures leading slash).
 *
 * @param path - Raw file path
 * @returns Normalized path
 */
const NormalizePath = (path: string): string => {
  let normalized = path.replace(/\/+/g, "/");
  if (!normalized.startsWith("/")) normalized = "/" + normalized;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
};

/**
 * Creates a default file tree for a new server.
 *
 * @returns Map of path to MockFile
 */
const CreateDefaultFileTree = (): Map<string, MockFile> => {
  const now = Math.floor(Date.now() / 1000);
  const files = new Map<string, MockFile>();

  const MakeDir = (name: string, path: string): void => {
    files.set(path, {
      name,
      content: "",
      is_directory: true,
      size: 4096,
      modified: now,
      created: now,
      mode: 0o755,
    });
  };

  const MakeFile = (name: string, path: string, content: string): void => {
    files.set(path, {
      name,
      content,
      is_directory: false,
      size: content.length,
      modified: now,
      created: now,
      mode: 0o644,
    });
  };

  MakeDir("/", "/");
  MakeDir("logs", "/logs");
  MakeDir("plugins", "/plugins");
  MakeDir("config", "/config");
  MakeFile(
    "server.properties",
    "/server.properties",
    "# Mock server properties\nserver-port=25565\nmotd=A StellarStack Mock Server\n"
  );
  MakeFile("eula.txt", "/eula.txt", "eula=true\n");
  MakeFile(
    "server.log",
    "/logs/server.log",
    "[INFO] Mock daemon server started\n[INFO] Ready for connections\n"
  );

  return files;
};

/**
 * Adds a backup entry for a server.
 *
 * @param uuid - Server UUID
 * @param backup - Backup entry
 */
const AddBackup = (uuid: string, backup: BackupEntry): void => {
  const server = servers.get(uuid);
  if (!server) return;
  server.backups.set(backup.uuid, backup);
};

/**
 * Gets all backups for a server.
 *
 * @param uuid - Server UUID
 * @returns Array of backup entries
 */
const GetBackups = (uuid: string): BackupEntry[] => {
  const server = servers.get(uuid);
  if (!server) return [];
  return Array.from(server.backups.values());
};

/**
 * Deletes a backup from a server.
 *
 * @param uuid - Server UUID
 * @param backupId - Backup UUID
 * @returns True if deleted
 */
const DeleteBackup = (uuid: string, backupId: string): boolean => {
  const server = servers.get(uuid);
  if (!server) return false;
  return server.backups.delete(backupId);
};

/**
 * Sets schedules for a server (replaces all).
 *
 * @param uuid - Server UUID
 * @param schedules - Array of schedule definitions
 */
const SetSchedules = (uuid: string, schedules: Schedule[]): void => {
  const server = servers.get(uuid);
  if (!server) return;
  server.schedules.clear();
  for (const schedule of schedules) {
    server.schedules.set(schedule.id, schedule);
  }
};

/**
 * Adds or updates a single schedule for a server.
 *
 * @param uuid - Server UUID
 * @param schedule - Schedule definition
 */
const UpsertSchedule = (uuid: string, schedule: Schedule): void => {
  const server = servers.get(uuid);
  if (!server) return;
  server.schedules.set(schedule.id, schedule);
};

/**
 * Deletes a schedule from a server.
 *
 * @param uuid - Server UUID
 * @param scheduleId - Schedule ID
 * @returns True if deleted
 */
const DeleteSchedule = (uuid: string, scheduleId: string): boolean => {
  const server = servers.get(uuid);
  if (!server) return false;
  return server.schedules.delete(scheduleId);
};

/**
 * Gets all schedules for a server.
 *
 * @param uuid - Server UUID
 * @returns Array of schedules
 */
const GetSchedules = (uuid: string): Schedule[] => {
  const server = servers.get(uuid);
  if (!server) return [];
  return Array.from(server.schedules.values());
};

export {
  servers,
  CreateServer,
  GetServer,
  DeleteServer,
  GetAllServers,
  AddConsoleLine,
  GetFile,
  SetFile,
  DeleteFile,
  ListFiles,
  NormalizePath,
  AddBackup,
  GetBackups,
  DeleteBackup,
  SetSchedules,
  UpsertSchedule,
  DeleteSchedule,
  GetSchedules,
};
