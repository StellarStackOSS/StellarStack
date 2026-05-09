import { useEffect, useState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"

import { DotmSquare3 } from "@/components/DotmSquare3"
import { Icon } from "@/components/Icon"
import { notify } from "@/lib/notify"
import type { NotifyItem, NotifyKind } from "@/lib/notify.types"

const icons: Record<NotifyKind, React.ReactNode> = {
  success: <Icon name="checkmark-circle" className="text-emerald-500" />,
  error: <Icon name="multiplication-circle" className="text-destructive" />,
  info: <Icon name="info" className="text-blue-500" />,
  loading: <DotmSquare3 size={14} dotSize={2} speed={1.6} animated />,
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
