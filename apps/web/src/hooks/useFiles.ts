import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type {
  FileCredentials,
  FileEntry,
  SftpCredentials,
} from "@/hooks/useFiles.types"

const REFRESH_BEFORE_EXPIRY_MS = 30_000

/**
 * Lazily fetch + cache file-API credentials. Refreshes shortly before the
 * minted JWT expires so a long-running edit session doesn't trip 401s.
 */
const useFileCredentials = (serverId: string) => {
  const [cred, setCred] = useState<FileCredentials | null>(null)
  const fetchingRef = useRef<Promise<FileCredentials> | null>(null)

  const refresh = useCallback(async () => {
    if (fetchingRef.current !== null) {
      return fetchingRef.current
    }
    const promise = apiFetch<FileCredentials>(
      `/servers/${serverId}/files-credentials`,
      { method: "POST", body: JSON.stringify({}) }
    )
      .then((value) => {
        setCred(value)
        return value
      })
      .finally(() => {
        fetchingRef.current = null
      })
    fetchingRef.current = promise
    return promise
  }, [serverId])

  useEffect(() => {
    if (cred === null) {
      return undefined
    }
    const expires = new Date(cred.expiresAt).getTime()
    const ms = Math.max(1_000, expires - Date.now() - REFRESH_BEFORE_EXPIRY_MS)
    const timer = window.setTimeout(() => {
      void refresh()
    }, ms)
    return () => window.clearTimeout(timer)
  }, [cred, refresh])

  const get = useCallback(async (): Promise<FileCredentials> => {
    if (cred !== null && new Date(cred.expiresAt).getTime() > Date.now() + 5_000) {
      return cred
    }
    return refresh()
  }, [cred, refresh])

  return { get }
}

const buildHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
})

/**
 * Issue a daemon HTTP call for the given server, using the cached
 * credentials. Token is presented as `?token=` (the daemon's gate reads
 * it from the query string, since browsers can't set headers on plain
 * fetch streams in some scenarios — keeping the contract uniform).
 */
const useDaemonFetch = (serverId: string) => {
  const credentials = useFileCredentials(serverId)
  return useCallback(
    async <T>(
      method: string,
      path: string,
      query: Record<string, string> = {},
      body?: BodyInit | null
    ): Promise<T> => {
      const cred = await credentials.get()
      const url = new URL(cred.baseUrl + path)
      url.searchParams.set("token", cred.token)
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value)
      }
      const response = await fetch(url, {
        method,
        body: body ?? null,
        headers: buildHeaders(cred.token),
      })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(text || `daemon error ${response.status}`)
      }
      if (response.headers.get("Content-Type")?.includes("application/json") === true) {
        return JSON.parse(text) as T
      }
      return text as unknown as T
    },
    [credentials]
  )
}

const listKey = (serverId: string, path: string) =>
  ["servers", serverId, "files", path] as const
const contentKey = (serverId: string, path: string) =>
  ["servers", serverId, "files", "content", path] as const

/**
 * List files at `path` for a server. Calls the daemon directly using the
 * minted file credentials.
 */
export const useFileList = (serverId: string, path: string) => {
  const daemonFetch = useDaemonFetch(serverId)
  return useQuery({
    queryKey: listKey(serverId, path),
    queryFn: () =>
      daemonFetch<{ entries: FileEntry[] }>("GET", "/files", { path }),
  })
}

/**
 * Read a file's content as text.
 */
export const useFileContent = (
  serverId: string,
  path: string | null
) => {
  const daemonFetch = useDaemonFetch(serverId)
  return useQuery({
    queryKey: contentKey(serverId, path ?? "_none"),
    queryFn: () =>
      daemonFetch<string>("GET", "/files/content", { path: path ?? "" }),
    enabled: path !== null,
  })
}

/**
 * Write a file's content. Invalidates the surrounding directory listing
 * + the file's content cache on success.
 */
export const useWriteFile = (serverId: string) => {
  const daemonFetch = useDaemonFetch(serverId)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { path: string; content: string }) =>
      daemonFetch<{ ok: boolean }>(
        "PUT",
        "/files/content",
        { path: params.path },
        params.content
      ),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: contentKey(serverId, vars.path),
      })
      void queryClient.invalidateQueries({
        queryKey: ["servers", serverId, "files"],
      })
    },
  })
}

/**
 * Delete a file or directory recursively.
 */
export const useDeleteFile = (serverId: string) => {
  const daemonFetch = useDaemonFetch(serverId)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (path: string) =>
      daemonFetch<{ ok: boolean }>("DELETE", "/files", { path }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["servers", serverId, "files"],
      })
    },
  })
}

/**
 * Create a directory.
 */
export const useMkdir = (serverId: string) => {
  const daemonFetch = useDaemonFetch(serverId)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (path: string) =>
      daemonFetch<{ ok: boolean }>(
        "POST",
        "/files/mkdir",
        {},
        JSON.stringify({ path })
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["servers", serverId, "files"],
      })
    },
  })
}

/**
 * Mint SFTP credentials. The browser shows the connection details once
 * (host, port, username, JWT-as-password) — never persisted client-side.
 */
export const useSftpCredentials = (serverId: string) =>
  useMutation({
    mutationFn: () =>
      apiFetch<SftpCredentials>(
        `/servers/${serverId}/sftp-credentials`,
        { method: "POST", body: JSON.stringify({}) }
      ),
  })
