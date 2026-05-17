import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "@tanstack/react-router"
import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { apiFetch } from "@/lib/ApiFetch"

type Platform = "modrinth" | "curseforge"
type Kind = "mod" | "modpack" | "resourcepack" | "shader" | "datapack"

type SearchHit = {
  project_id: string
  slug: string
  title: string
  description: string
  project_type: Kind
  author: string
  icon_url: string | null
  downloads: number
  latest_version: string | null
  versions: string[]
}

type InstalledMod = {
  id: string
  platform: Platform
  projectId: string
  versionId: string
  name: string
  kind: Kind
  loader: string | null
  gameVersion: string | null
  filePath: string
  fileSize: number | null
  installedAt: string
}

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "mod", label: "Mods" },
  { value: "modpack", label: "Modpacks" },
  { value: "resourcepack", label: "Resource packs" },
  { value: "shader", label: "Shaders" },
  { value: "datapack", label: "Data packs" },
]

const LOADER_OPTIONS = ["fabric", "forge", "neoforge", "quilt", "paper"]

export const ModsTab = () => {
  const { id } = useParams({ from: "/_user/server/$id" })
  const qc = useQueryClient()
  const [platform, setPlatform] = useState<Platform>("modrinth")
  const [kind, setKind] = useState<Kind>("mod")
  const [loader, setLoader] = useState<string>("")
  const [gameVersion, setGameVersion] = useState<string>("")
  const [q, setQ] = useState("")
  const [submittedQuery, setSubmittedQuery] = useState("")

  const installed = useQuery({
    queryKey: ["server", id, "mods"] as const,
    queryFn: () => apiFetch<{ mods: InstalledMod[] }>(`/servers/${id}/mods`),
  })

  const results = useQuery({
    queryKey: ["server", id, "mods", "search", platform, kind, loader, gameVersion, submittedQuery] as const,
    enabled: submittedQuery.length > 0,
    queryFn: () => {
      const qs = new URLSearchParams({
        platform,
        kind,
        q: submittedQuery,
        ...(loader ? { loader } : {}),
        ...(gameVersion ? { gameVersion } : {}),
      })
      return apiFetch<{ platform: Platform; hits: SearchHit[]; total: number }>(
        `/servers/${id}/mods/search?${qs.toString()}`
      )
    },
  })

  const install = useMutation({
    mutationFn: (vars: { projectId: string; versionId: string; title: string }) =>
      apiFetch<{ ok: boolean }>(`/servers/${id}/mods/install`, {
        method: "POST",
        body: JSON.stringify({
          platform,
          projectId: vars.projectId,
          versionId: vars.versionId,
          loader: loader || undefined,
          gameVersion: gameVersion || undefined,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["server", id, "mods"] }),
  })

  const uninstall = useMutation({
    mutationFn: (rowId: string) =>
      apiFetch<{ ok: boolean }>(`/servers/${id}/mods/${rowId}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["server", id, "mods"] }),
  })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Mods</h1>
        <p className="text-muted-foreground text-sm">
          Browse Modrinth and CurseForge, install with one click. Files
          drop straight into the server's mods, resourcepacks, or
          shaderpacks directory.
        </p>
      </header>

      {/* Search bar */}
      <section className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex flex-wrap gap-2">
          <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="modrinth">Modrinth</SelectItem>
              <SelectItem value="curseforge">CurseForge</SelectItem>
            </SelectContent>
          </Select>
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={loader || "any"} onValueChange={(v) => setLoader(v === "any" ? "" : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Any loader" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any loader</SelectItem>
              {LOADER_OPTIONS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={gameVersion}
            onChange={(e) => setGameVersion(e.target.value)}
            placeholder="MC version (e.g. 1.21)"
            className="w-[180px]"
          />
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setSubmittedQuery(q.trim())
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search mods, packs, shaders…"
          />
          <Button type="submit" disabled={q.trim().length === 0}>
            Search
          </Button>
        </form>
      </section>

      {/* Search results */}
      {submittedQuery && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Results
          </h2>
          {results.isLoading && (
            <p className="text-muted-foreground text-sm">Searching…</p>
          )}
          {results.error && (
            <p className="text-destructive text-sm">
              {(results.error as Error).message}
            </p>
          )}
          {results.data?.hits.map((hit) => (
            <div
              key={hit.project_id}
              className="border-border bg-card flex items-start gap-3 rounded-lg border p-3"
            >
              {hit.icon_url && (
                <img
                  src={hit.icon_url}
                  alt=""
                  className="size-12 shrink-0 rounded-md bg-black/40 object-cover"
                />
              )}
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{hit.title}</span>
                  <span className="text-muted-foreground text-xs">
                    by {hit.author}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-2 text-xs">
                  {hit.description}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (hit.latest_version) {
                    install.mutate({
                      projectId: hit.project_id,
                      versionId: hit.latest_version,
                      title: hit.title,
                    })
                  }
                }}
                disabled={install.isPending || hit.latest_version === null}
              >
                Install
              </Button>
            </div>
          ))}
          {results.data?.hits.length === 0 && (
            <p className="text-muted-foreground text-sm">No results.</p>
          )}
        </section>
      )}

      {/* Installed list */}
      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Installed
        </h2>
        {installed.data?.mods.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Nothing installed yet. Search above and click Install.
          </p>
        )}
        {installed.data?.mods.map((m) => (
          <div
            key={m.id}
            className="border-border bg-card flex items-start justify-between gap-3 rounded-lg border p-3"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{m.name}</span>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  {m.platform}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {m.kind}
                </Badge>
                {m.loader && (
                  <Badge variant="outline" className="text-xs">
                    {m.loader}
                  </Badge>
                )}
              </div>
              <code className="text-muted-foreground font-mono text-xs">
                {m.filePath}
              </code>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => uninstall.mutate(m.id)}
              disabled={uninstall.isPending}
            >
              Remove
            </Button>
          </div>
        ))}
      </section>

      {install.isError && (
        <p className="text-destructive text-sm">
          {(install.error as Error).message}
        </p>
      )}
    </div>
  )
}
