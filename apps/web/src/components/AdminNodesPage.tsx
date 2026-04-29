import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { authClient, useSession } from "@/lib/AuthClient"
import {
  useCreateNode,
  useMintPairingToken,
  useNodes,
} from "@/hooks/useNodes"
import type {
  CreateNodeRequest,
  NodeListRow,
} from "@/hooks/useNodes.types"

const initialForm: CreateNodeRequest = {
  name: "",
  fqdn: "",
  scheme: "http",
  daemonPort: 8080,
  sftpPort: 2022,
  memoryTotalMb: 4096,
  diskTotalMb: 50_000,
}

/**
 * Admin-only page for managing nodes. List is driven by `useNodes` and
 * polled every 10s so connect/disconnect transitions become visible even
 * without the panel-event WS. Per-row "Generate pairing token" mints a
 * single-use token that is shown once and never persisted client-side.
 */
export const AdminNodesPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const nodesQuery = useNodes()
  const createMutation = useCreateNode()
  const mintMutation = useMintPairingToken()

  const [form, setForm] = useState<CreateNodeRequest>(initialForm)
  const [createError, setCreateError] = useState<string | null>(null)
  const [revealedToken, setRevealedToken] = useState<{
    nodeId: string
    token: string
    expiresAt: string
  } | null>(null)

  if (isPending) {
    return (
      <div className="bg-background text-foreground flex min-h-svh items-center justify-center text-sm">
        Loading session…
      </div>
    )
  }

  if (session === null || session.user.isAdmin !== true) {
    return (
      <div className="bg-background text-foreground flex min-h-svh items-center justify-center text-sm">
        <div className="text-center">
          <p>You don&apos;t have access to this page.</p>
          <Link to="/dashboard" className="text-primary mt-2 inline-block underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateError(null)
    try {
      await createMutation.mutateAsync(form)
      setForm(initialForm)
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setCreateError(translateApiError(t, err.body.error))
      } else if (err instanceof Error) {
        setCreateError(err.message)
      }
    }
  }

  const handleMint = async (nodeId: string) => {
    try {
      const result = await mintMutation.mutateAsync(nodeId)
      setRevealedToken({
        nodeId,
        token: result.token,
        expiresAt: result.expiresAt,
      })
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setCreateError(translateApiError(t, err.body.error))
      }
    }
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    await navigate({ to: "/login" })
  }

  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-base font-semibold">StellarStack — Nodes</h1>
          <p className="text-muted-foreground text-xs">
            Signed in as {session.user.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard">
            <Button variant="outline" size="sm">
              Dashboard
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        <NodeList
          rows={nodesQuery.data?.nodes ?? []}
          loading={nodesQuery.isLoading}
          onMint={handleMint}
          minting={mintMutation.isPending ? mintMutation.variables : null}
        />
        <CreateNodeForm
          value={form}
          onChange={setForm}
          onSubmit={handleSubmit}
          pending={createMutation.isPending}
          error={createError}
        />
        {revealedToken !== null ? (
          <PairingTokenDialog
            token={revealedToken.token}
            expiresAt={revealedToken.expiresAt}
            onClose={() => setRevealedToken(null)}
          />
        ) : null}
      </main>
    </div>
  )
}

const NodeList = ({
  rows,
  loading,
  onMint,
  minting,
}: {
  rows: NodeListRow[]
  loading: boolean
  onMint: (nodeId: string) => void
  minting: string | null | undefined
}) => {
  return (
    <section className="border-border bg-card text-card-foreground rounded-md border p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Nodes</h2>
        <span className="text-muted-foreground text-xs">
          {rows.length} node{rows.length === 1 ? "" : "s"}
        </span>
      </header>
      {loading ? (
        <p className="text-muted-foreground text-xs">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No nodes yet. Create one below to get a pairing token.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((node) => {
            const connected = node.connectedAt !== null
            return (
              <li
                key={node.id}
                className="border-border flex flex-col gap-1 rounded border px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-1.5 rounded-full ${
                        connected ? "bg-chart-1" : "bg-muted-foreground"
                      }`}
                    />
                    <span className="font-medium">{node.name}</span>
                    <span className="text-muted-foreground">
                      {node.scheme}://{node.fqdn}:{node.daemonPort}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {connected ? `connected at ${node.connectedAt}` : "offline"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={minting === node.id}
                  onClick={() => onMint(node.id)}
                >
                  {minting === node.id
                    ? "Generating…"
                    : "Generate pairing token"}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const CreateNodeForm = ({
  value,
  onChange,
  onSubmit,
  pending,
  error,
}: {
  value: CreateNodeRequest
  onChange: (next: CreateNodeRequest) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  pending: boolean
  error: string | null
}) => {
  const update = <K extends keyof CreateNodeRequest>(
    key: K,
    next: CreateNodeRequest[K]
  ) => onChange({ ...value, [key]: next })

  return (
    <section className="border-border bg-card text-card-foreground rounded-md border p-4">
      <h2 className="mb-3 text-sm font-medium">Create node</h2>
      <form className="grid grid-cols-2 gap-3" onSubmit={onSubmit}>
        <Field label="Name">
          <input
            value={value.name}
            onChange={(e) => update("name", e.target.value)}
            required
            className="border-border bg-background h-8 rounded-md border px-2 text-sm"
          />
        </Field>
        <Field label="FQDN">
          <input
            value={value.fqdn}
            onChange={(e) => update("fqdn", e.target.value)}
            required
            className="border-border bg-background h-8 rounded-md border px-2 text-sm"
            placeholder="node1.example.com"
          />
        </Field>
        <Field label="Scheme">
          <select
            value={value.scheme}
            onChange={(e) =>
              update("scheme", e.target.value === "https" ? "https" : "http")
            }
            className="border-border bg-background h-8 rounded-md border px-2 text-sm"
          >
            <option value="http">http</option>
            <option value="https">https</option>
          </select>
        </Field>
        <Field label="Daemon port">
          <input
            type="number"
            value={value.daemonPort}
            onChange={(e) => update("daemonPort", Number(e.target.value))}
            required
            className="border-border bg-background h-8 rounded-md border px-2 text-sm"
          />
        </Field>
        <Field label="SFTP port">
          <input
            type="number"
            value={value.sftpPort}
            onChange={(e) => update("sftpPort", Number(e.target.value))}
            required
            className="border-border bg-background h-8 rounded-md border px-2 text-sm"
          />
        </Field>
        <Field label="Memory (MB)">
          <input
            type="number"
            value={value.memoryTotalMb}
            onChange={(e) => update("memoryTotalMb", Number(e.target.value))}
            required
            className="border-border bg-background h-8 rounded-md border px-2 text-sm"
          />
        </Field>
        <Field label="Disk (MB)">
          <input
            type="number"
            value={value.diskTotalMb}
            onChange={(e) => update("diskTotalMb", Number(e.target.value))}
            required
            className="border-border bg-background h-8 rounded-md border px-2 text-sm"
          />
        </Field>
        <div className="col-span-2 flex items-center justify-between">
          {error !== null ? (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create node"}
          </Button>
        </div>
      </form>
    </section>
  )
}

const Field = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <label className="flex flex-col gap-1 text-xs">
    <span>{label}</span>
    {children}
  </label>
)

const PairingTokenDialog = ({
  token,
  expiresAt,
  onClose,
}: {
  token: string
  expiresAt: string
  onClose: () => void
}) => {
  const command = `stellar-daemon configure ${token}`
  return (
    <div className="border-destructive bg-card text-card-foreground rounded-md border p-4">
      <h2 className="mb-2 text-sm font-medium">
        New pairing token (visible once)
      </h2>
      <p className="text-muted-foreground mb-2 text-xs">
        Run this on the host that should become the node. The token expires
        at {expiresAt}.
      </p>
      <pre className="bg-muted overflow-x-auto rounded p-2 font-mono text-xs">
        {command}
      </pre>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigator.clipboard.writeText(command)}
        >
          Copy
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}
