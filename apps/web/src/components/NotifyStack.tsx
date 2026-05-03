import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
  MultiplicationSignCircleIcon,
} from "@hugeicons/core-free-icons"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"

import { notify } from "@/lib/notify"
import type { NotifyItem, NotifyKind } from "@/lib/notify.types"

const icons: Record<NotifyKind, React.ReactNode> = {
  success: (
    <HugeiconsIcon
      icon={CheckmarkCircle02Icon}
      strokeWidth={2}
      className="text-emerald-500"
    />
  ),
  error: (
    <HugeiconsIcon
      icon={MultiplicationSignCircleIcon}
      strokeWidth={2}
      className="text-destructive"
    />
  ),
  info: (
    <HugeiconsIcon
      icon={InformationCircleIcon}
      strokeWidth={2}
      className="text-blue-500"
    />
  ),
  loading: (
    <HugeiconsIcon
      icon={Loading03Icon}
      strokeWidth={2}
      className="animate-spin text-muted-foreground"
    />
  ),
}

const NotifyToast = ({ item }: { item: NotifyItem }) => (
  <Alert
    variant={item.kind === "error" ? "destructive" : "default"}
    className="w-80 cursor-default shadow-sm"
    onClick={() => notify.dismiss(item.id)}
  >
    {icons[item.kind]}
    <AlertTitle>{item.title}</AlertTitle>
    {item.description !== undefined ? (
      <AlertDescription>{item.description}</AlertDescription>
    ) : null}
  </Alert>
)

export const NotifyStack = () => {
  const [items, setItems] = useState<NotifyItem[]>([])

  useEffect(() => notify.subscribe(setItems), [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((item) => (
        <NotifyToast key={item.id} item={item} />
      ))}
    </div>
  )
}
