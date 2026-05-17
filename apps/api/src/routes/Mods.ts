import { Hono } from "hono"
import { z } from "zod"
import { and, desc, eq } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import { nodesTable } from "@workspace/db/schema/nodes"
import { serverModsTable } from "@workspace/db/schema/mods"
import { serversTable } from "@workspace/db/schema/servers"
import { ApiException } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import { callDaemon } from "@/lib/DaemonHttp"
import { SettingsStore } from "@/lib/Settings"
import {
  cfFiles,
  cfSearch,
  cfDownloadUrl,
  CurseForgeUnavailableError,
} from "@/lib/mods/CurseForge"
import {
  modrinthSearch,
  modrinthVersion,
  modrinthVersions,
} from "@/lib/mods/Modrinth"
import { buildRequireSession, type AuthVariables } from "@/middleware/RequireSession"

const PROJECT_KIND = ["mod", "modpack", "resourcepack", "shader", "datapack"] as const
type ProjectKind = (typeof PROJECT_KIND)[number]

const searchQuery = z.object({
  platform: z.enum(["modrinth", "curseforge"]).default("modrinth"),
  q: z.string().min(1).max(120),
  kind: z.enum(PROJECT_KIND).default("mod"),
  loader: z.string().optional(),
  gameVersion: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const installBody = z.object({
  platform: z.enum(["modrinth", "curseforge"]),
  projectId: z.string().min(1),
  versionId: z.string().min(1),
  loader: z.string().optional(),
  gameVersion: z.string().optional(),
})

const CF_CLASS = { mod: 6, resourcepack: 12, modpack: 4471, shader: 6552, datapack: 6945 } as const
const CF_LOADER = { forge: 1, cauldron: 2, fabric: 4, quilt: 5, neoforge: 6 } as const

const kindFolder: Record<ProjectKind, string> = {
  mod: "mods",
  resourcepack: "resourcepacks",
  shader: "shaderpacks",
  datapack: "world/datapacks",
  modpack: ".", // installed via the modpack runner, lands at server root
}

/**
 * Per-server mods routes:
 *   GET    /api/servers/:id/mods/search?...    — proxy to Modrinth/CF
 *   GET    /api/servers/:id/mods               — list installed
 *   POST   /api/servers/:id/mods/install       — install one mod
 *   DELETE /api/servers/:id/mods/:rowId        — uninstall
 *
 * Modpacks have their own follow-up route — single mods first.
 */
export const buildModsRoute = (params: {
  auth: Auth
  db: Db
  betterAuthSecret: string
}) => {
  const requireSession = buildRequireSession(params.auth)
  const settings = new SettingsStore(params.db, params.betterAuthSecret)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:id/mods/search", async (c) => {
      const parsed = searchQuery.safeParse(
        Object.fromEntries(new URL(c.req.url).searchParams)
      )
      if (!parsed.success) {
        throw new ApiException("validation.invalid_query", { status: 400 })
      }
      const { platform, q, kind, loader, gameVersion, limit } = parsed.data

      if (platform === "modrinth") {
        const results = await modrinthSearch({
          query: q,
          projectType: kind,
          loader,
          gameVersion,
          limit,
        })
        return c.json({ platform, hits: results.hits, total: results.total_hits })
      }

      const cfKey = (await settings.get("extensions.curseforge.api_key")) ?? ""
      try {
        const hits = await cfSearch(cfKey, {
          query: q,
          classId: CF_CLASS[kind],
          gameVersion,
          modLoaderType:
            loader !== undefined
              ? CF_LOADER[loader as keyof typeof CF_LOADER]
              : undefined,
          pageSize: limit,
        })
        return c.json({
          platform,
          hits: hits.map((h) => ({
            project_id: String(h.id),
            slug: h.slug,
            title: h.name,
            description: h.summary,
            project_type: kind,
            author: h.authors[0]?.name ?? "",
            icon_url: h.logo?.url ?? null,
            downloads: 0,
            latest_version: h.latestFiles[0] ? String(h.latestFiles[0].id) : null,
            versions: h.latestFiles.map((f) => String(f.id)),
            categories: [],
          })),
          total: hits.length,
        })
      } catch (err) {
        if (err instanceof CurseForgeUnavailableError) {
          throw new ApiException("extensions.curseforge_not_configured", {
            status: 412,
          })
        }
        throw err
      }
    })
    .get("/:id/mods", async (c) => {
      const id = c.req.param("id")
      const rows = await params.db
        .select()
        .from(serverModsTable)
        .where(eq(serverModsTable.serverId, id))
        .orderBy(desc(serverModsTable.installedAt))
      return c.json({ mods: rows })
    })
    .post("/:id/mods/install", async (c) => {
      const id = c.req.param("id")
      const parsed = installBody.safeParse(await c.req.json())
      if (!parsed.success) {
        throw new ApiException("validation.invalid_body", { status: 400 })
      }
      const { platform, projectId, versionId, loader, gameVersion } = parsed.data

      // Look up the server + node so we know where to push the file.
      const server = (
        await params.db
          .select()
          .from(serversTable)
          .where(eq(serversTable.id, id))
          .limit(1)
      )[0]
      if (server === undefined) throw new ApiException("servers.not_found", { status: 404 })
      const node = (
        await params.db
          .select()
          .from(nodesTable)
          .where(eq(nodesTable.id, server.nodeId))
          .limit(1)
      )[0]
      if (node === undefined || node.daemonPublicKey === null) {
        throw new ApiException("nodes.unreachable", { status: 503 })
      }

      // Resolve the download URL on the panel side.
      let url: string, filename: string, size: number | null, kind: ProjectKind, displayName: string, slug: string | null
      if (platform === "modrinth") {
        const v = await modrinthVersion(versionId)
        const file = v.files.find((f) => f.primary) ?? v.files[0]
        if (file === undefined) throw new ApiException("mods.no_files", { status: 422 })
        url = file.url
        filename = file.filename
        size = file.size
        kind = inferKind(file.filename, v.loaders)
        displayName = v.name
        slug = v.project_id
      } else {
        const cfKey = (await settings.get("extensions.curseforge.api_key")) ?? ""
        const dl = await cfDownloadUrl(cfKey, Number(versionId))
        const files = await cfFiles(cfKey, Number(projectId), { gameVersion, modLoaderType: loader ? CF_LOADER[loader as keyof typeof CF_LOADER] : undefined })
        const file = files.find((f) => String(f.id) === versionId)
        if (file === undefined) throw new ApiException("mods.no_files", { status: 422 })
        url = dl
        filename = file.fileName
        size = file.fileSize
        kind = inferKind(file.fileName, [loader ?? ""])
        displayName = file.fileName
        slug = null
      }

      // Ask the daemon to fetch the file into the server's data dir.
      // The daemon route returns 204 on success.
      const folder = kindFolder[kind]
      const destPath = `${folder}/${filename}`
      const baseUrl = `${node.scheme}://${node.fqdn}:${String(node.daemonPort)}`
      const resp = await callDaemon({
        baseUrl,
        nodeId: node.id,
        signingKeyHex: node.daemonPublicKey,
        method: "POST",
        path: `/api/servers/${id}/files/download`,
        body: { url, dest: destPath },
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => "")
        throw new ApiException("mods.daemon_install_failed", {
          status: 502,
          params: { detail: `${String(resp.status)} ${text}` },
        })
      }

      // Record it. Onconflict-do-update keeps the row idempotent across
      // re-installs (e.g. updating to a newer version of the same mod).
      await params.db
        .insert(serverModsTable)
        .values({
          serverId: id,
          platform,
          projectId,
          versionId,
          name: displayName,
          slug,
          kind,
          loader: loader ?? null,
          gameVersion: gameVersion ?? null,
          filePath: destPath,
          fileSize: size,
        })
        .onConflictDoUpdate({
          target: [serverModsTable.serverId, serverModsTable.platform, serverModsTable.projectId],
          set: {
            versionId,
            name: displayName,
            filePath: destPath,
            fileSize: size,
            installedAt: new Date(),
          },
        })

      return c.json({ ok: true })
    })
    .delete("/:id/mods/:rowId", async (c) => {
      const id = c.req.param("id")
      const rowId = c.req.param("rowId")
      const [row] = await params.db
        .select()
        .from(serverModsTable)
        .where(and(eq(serverModsTable.id, rowId), eq(serverModsTable.serverId, id)))
        .limit(1)
      if (row === undefined) throw new ApiException("mods.not_found", { status: 404 })

      // Tell the daemon to delete the file. Best-effort; we still
      // remove the row even if the daemon is unreachable so the panel
      // matches the user's intent.
      const server = (
        await params.db
          .select()
          .from(serversTable)
          .where(eq(serversTable.id, id))
          .limit(1)
      )[0]
      if (server !== undefined) {
        const node = (
          await params.db
            .select()
            .from(nodesTable)
            .where(eq(nodesTable.id, server.nodeId))
            .limit(1)
        )[0]
        if (node !== undefined && node.daemonPublicKey !== null) {
          await callDaemon({
            baseUrl: `${node.scheme}://${node.fqdn}:${String(node.daemonPort)}`,
            nodeId: node.id,
            signingKeyHex: node.daemonPublicKey,
            method: "DELETE",
            path: `/api/servers/${id}/files?path=${encodeURIComponent(row.filePath)}`,
          }).catch(() => undefined)
        }
      }
      await params.db.delete(serverModsTable).where(eq(serverModsTable.id, rowId))
      return c.json({ ok: true })
    })
}

const inferKind = (filename: string, loaders: string[]): ProjectKind => {
  if (filename.endsWith(".mrpack")) return "modpack"
  if (loaders.some((l) => l.toLowerCase().includes("resource"))) return "resourcepack"
  if (loaders.some((l) => l.toLowerCase().includes("shader"))) return "shader"
  if (loaders.some((l) => l.toLowerCase().includes("datapack"))) return "datapack"
  return "mod"
}
