export type NotifyKind = "success" | "error" | "info" | "loading"

export type NotifyItem = {
  id: string
  kind: NotifyKind
  title: string
  description?: string
}
