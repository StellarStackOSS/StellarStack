/**
 * CurseForge API client. Requires an `x-api-key` header — the admin
 * supplies one in the Extensions page (Console → Console → CF Studio →
 * "Get an API key"). Without a key, every method here throws and the
 * panel falls back to Modrinth-only.
 *
 * Game ID 432 = Minecraft.
 *
 * Docs: https://docs.curseforge.com/
 */

const BASE = "https://api.curseforge.com"
const MC_GAME_ID = 432

export type CfModSearchItem = {
  id: number
  slug: string
  name: string
  summary: string
  classId: number
  authors: { name: string }[]
  logo: { url: string | null } | null
  latestFiles: CfFile[]
  gameVersions?: string[]
}

export type CfFile = {
  id: number
  modId: number
  fileName: string
  fileSize: number
  downloadUrl: string | null
  gameVersions: string[]
  releaseType: number
}

export class CurseForgeUnavailableError extends Error {
  constructor() {
    super("CurseForge integration disabled (no API key configured)")
  }
}

const req = async <T>(apiKey: string, path: string, init?: RequestInit): Promise<T> => {
  if (apiKey === "") throw new CurseForgeUnavailableError()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "x-api-key": apiKey,
      Accept: "application/json",
    },
  })
  if (!res.ok) {
    throw new Error(`curseforge: ${res.status} ${res.statusText} on ${path}`)
  }
  const wrapped = (await res.json()) as { data: T }
  return wrapped.data
}

export const cfSearch = (apiKey: string, params: {
  query: string
  classId?: number   // 6=mod 12=resourcepack 17=world 4471=modpack 6552=shader
  gameVersion?: string
  modLoaderType?: number  // 1=Forge 4=Fabric 5=Quilt 6=NeoForge
  pageSize?: number
  index?: number
}): Promise<CfModSearchItem[]> => {
  const qs = new URLSearchParams()
  qs.set("gameId", String(MC_GAME_ID))
  qs.set("searchFilter", params.query)
  qs.set("pageSize", String(params.pageSize ?? 20))
  qs.set("index", String(params.index ?? 0))
  if (params.classId) qs.set("classId", String(params.classId))
  if (params.gameVersion) qs.set("gameVersion", params.gameVersion)
  if (params.modLoaderType) qs.set("modLoaderType", String(params.modLoaderType))
  return req<CfModSearchItem[]>(apiKey, `/v1/mods/search?${qs.toString()}`)
}

export const cfFiles = (
  apiKey: string,
  modId: number,
  filter: { gameVersion?: string; modLoaderType?: number } = {}
): Promise<CfFile[]> => {
  const qs = new URLSearchParams()
  qs.set("pageSize", "20")
  if (filter.gameVersion) qs.set("gameVersion", filter.gameVersion)
  if (filter.modLoaderType) qs.set("modLoaderType", String(filter.modLoaderType))
  return req<CfFile[]>(apiKey, `/v1/mods/${modId}/files?${qs.toString()}`)
}

export const cfDownloadUrl = (apiKey: string, fileId: number): Promise<string> =>
  req<string>(apiKey, `/v1/mods/files/${fileId}/download-url`)
