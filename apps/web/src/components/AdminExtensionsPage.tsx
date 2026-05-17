import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { apiFetch } from "@/lib/ApiFetch"

type ExtensionsResponse = {
  curseforge: { configured: boolean; preview: string | null }
  modrinth: { enabled: boolean }
}

type ExtensionsPut = {
  curseforgeApiKey?: string | null
  modrinthEnabled?: boolean
}

/**
 * Admin → Extensions. One screen, lists every third-party integration.
 * Today: CurseForge (API key) and Modrinth (just an enabled toggle —
 * Modrinth's public API is keyless). Future: SMTP, S3 backup
 * destinations, OAuth providers, etc.
 */
export const AdminExtensionsPage = () => {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const settings = useQuery({
    queryKey: ["admin", "extensions"] as const,
    queryFn: () => apiFetch<ExtensionsResponse>("/admin/extensions"),
  })

  const save = useMutation({
    mutationFn: (body: ExtensionsPut) =>
      apiFetch<{ ok: boolean }>("/admin/extensions", {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "extensions"] }),
  })

  return (
    <div className="flex flex-col gap-6 pt-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Extensions</h1>
        <p className="text-muted-foreground text-sm">
          Third-party integrations. Keys live in the database encrypted
          with AES-256-GCM; rotating the panel's auth secret will require
          re-entering them.
        </p>
      </header>

      {settings.data && (
        <>
          <ModrinthCard
            initial={settings.data.modrinth.enabled}
            onSave={(enabled) => save.mutate({ modrinthEnabled: enabled })}
            saving={save.isPending}
          />
          <CurseForgeCard
            configured={settings.data.curseforge.configured}
            preview={settings.data.curseforge.preview}
            onSave={(key) => save.mutate({ curseforgeApiKey: key })}
            saving={save.isPending}
          />
        </>
      )}

      {save.isError && (
        <p className="text-destructive text-sm">
          {t("extensions.save_failed", "Failed to save changes.")}
        </p>
      )}
    </div>
  )
}

const ModrinthCard = (props: {
  initial: boolean
  onSave: (enabled: boolean) => void
  saving: boolean
}) => {
  const [enabled, setEnabled] = useState(props.initial)
  useEffect(() => setEnabled(props.initial), [props.initial])
  return (
    <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Modrinth</h2>
          <p className="text-muted-foreground text-sm">
            Public API; no key required. Enabling lets server owners
            browse and install mods, resource packs, data packs, and
            shaders from modrinth.com.
          </p>
        </div>
        <Checkbox
          checked={enabled}
          onCheckedChange={(v) => {
            const next = v === true
            setEnabled(next)
            props.onSave(next)
          }}
          disabled={props.saving}
          className="size-5"
        />
      </div>
    </section>
  )
}

const CurseForgeCard = (props: {
  configured: boolean
  preview: string | null
  onSave: (key: string | null) => void
  saving: boolean
}) => {
  const [value, setValue] = useState("")
  const [editing, setEditing] = useState(!props.configured)

  return (
    <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">CurseForge</h2>
        <p className="text-muted-foreground text-sm">
          Requires an API key from{" "}
          <a
            href="https://console.curseforge.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline"
          >
            console.curseforge.com
          </a>
          . Free, takes about a minute to request.
        </p>
      </div>

      {!editing && props.configured && (
        <div className="mt-4 flex items-center gap-3">
          <code className="bg-muted rounded px-2 py-1 font-mono text-xs">
            {props.preview ?? "•••••••••"}
          </code>
          <span className="text-muted-foreground text-xs">configured</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setValue("")
              setEditing(true)
            }}
          >
            Replace
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => props.onSave(null)}
            disabled={props.saving}
          >
            Remove
          </Button>
        </div>
      )}

      {editing && (
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="cf-key" className="text-xs uppercase tracking-wider">
            API key
          </Label>
          <Input
            id="cf-key"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="$2a$10$…"
            autoComplete="off"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (value !== "") {
                  props.onSave(value)
                  setValue("")
                  setEditing(false)
                }
              }}
              disabled={props.saving || value === ""}
            >
              Save
            </Button>
            {props.configured && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
