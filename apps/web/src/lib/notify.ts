import type { NotifyItem, NotifyKind } from "@/lib/notify.types"

type Subscriber = (items: NotifyItem[]) => void

let _items: NotifyItem[] = []
const _subs = new Set<Subscriber>()
const _timers = new Map<string, ReturnType<typeof setTimeout>>()

const _emit = () => _subs.forEach((s) => s([..._items]))

const _scheduleDismiss = (id: string) => {
  if (_timers.has(id)) clearTimeout(_timers.get(id))
  _timers.set(
    id,
    setTimeout(() => {
      dismiss(id)
    }, 4000)
  )
}

const push = (
  kind: NotifyKind,
  title: string,
  opts?: { id?: string; description?: string }
): string => {
  const id = opts?.id ?? crypto.randomUUID()
  _items = [..._items.filter((i) => i.id !== id), { id, kind, title, description: opts?.description }]
  _emit()
  if (kind !== "loading") _scheduleDismiss(id)
  return id
}

const update = (id: string, patch: Partial<Omit<NotifyItem, "id">>) => {
  _items = _items.map((i) => (i.id === id ? { ...i, ...patch } : i))
  _emit()
  const item = _items.find((i) => i.id === id)
  if (item !== undefined && item.kind !== "loading") _scheduleDismiss(id)
}

const dismiss = (id: string) => {
  if (_timers.has(id)) {
    clearTimeout(_timers.get(id))
    _timers.delete(id)
  }
  _items = _items.filter((i) => i.id !== id)
  _emit()
}

const subscribe = (fn: Subscriber): (() => void) => {
  _subs.add(fn)
  return () => void _subs.delete(fn)
}

export const notify = {
  success: (title: string, opts?: { id?: string; description?: string }) =>
    push("success", title, opts),
  error: (title: string, opts?: { id?: string; description?: string }) =>
    push("error", title, opts),
  info: (title: string, opts?: { id?: string; description?: string }) =>
    push("info", title, opts),
  loading: (title: string, opts?: { id?: string; description?: string }) =>
    push("loading", title, opts),
  update,
  dismiss,
  subscribe,
}
