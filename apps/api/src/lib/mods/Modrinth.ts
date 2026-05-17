/**
 * Thin Modrinth API client. Public endpoints — no key required for
 * reads — but Modrinth requires a User-Agent identifying the caller
 * (`<github-org>/<project> (contact)`), so set one for everything.
 *
 * Docs: https://docs.modrinth.com/api
 */

const BASE = "https://api.modrinth.com/v2"
const UA = "StellarStackOSS/StellarStack (https://stellarstack.app)"

export type ModrinthProjectType =
  | "mod"
  | "modpack"
  | "resourcepack"
  | "shader"
  | "datapack"

export type ModrinthSearchHit = {
  project_id: string
  slug: string
  title: string
  description: string
  project_type: ModrinthProjectType
  author: string
  icon_url: string | null
  downloads: number
  latest_version: string | null
  versions: string[]
  categories: string[]
}

export type ModrinthSearch = {
  hits: ModrinthSearchHit[]
  total_hits: number
}

export type ModrinthVersionFile = {
  hashes: { sha1: string; sha512: string }
  url: string
  filename: string
  primary: boolean
  size: number
}

export type ModrinthVersion = {
  id: string
  project_id: string
  name: string
  version_number: string
  game_versions: string[]
  loaders: string[]
  files: ModrinthVersionFile[]
  date_published: string
}

const req = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  })
  if (!res.ok) {
    throw new Error(`modrinth: ${res.status} ${res.statusText} on ${path}`)
  }
  return (await res.json()) as T
}

/**
 * Search projects with optional faceting. `loader`, `gameVersion`, and
 * `projectType` map onto Modrinth's facets array.
 */
export const modrinthSearch = (params: {
  query: string
  projectType?: ModrinthProjectType
  loader?: string
  gameVersion?: string
  limit?: number
  offset?: number
}): Promise<ModrinthSearch> => {
  const facets: string[][] = []
  if (params.projectType) facets.push([`project_type:${params.projectType}`])
  if (params.loader) facets.push([`categories:${params.loader}`])
  if (params.gameVersion) facets.push([`versions:${params.gameVersion}`])
  const qs = new URLSearchParams()
  qs.set("query", params.query)
  qs.set("limit", String(params.limit ?? 20))
  qs.set("offset", String(params.offset ?? 0))
  if (facets.length > 0) qs.set("facets", JSON.stringify(facets))
  return req<ModrinthSearch>(`/search?${qs.toString()}`)
}

export const modrinthVersions = async (
  projectId: string,
  filter: { loader?: string; gameVersion?: string } = {}
): Promise<ModrinthVersion[]> => {
  const qs = new URLSearchParams()
  if (filter.loader) qs.set("loaders", JSON.stringify([filter.loader]))
  if (filter.gameVersion) qs.set("game_versions", JSON.stringify([filter.gameVersion]))
  return req<ModrinthVersion[]>(`/project/${projectId}/version?${qs.toString()}`)
}

export const modrinthVersion = (versionId: string): Promise<ModrinthVersion> =>
  req<ModrinthVersion>(`/version/${versionId}`)
