import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AnimatePresence, motion } from "framer-motion"
import { LoaderIcon } from "lucide-react"

import type { ServerLifecycleState } from "@workspace/shared/events.types"

import { Icon, type IconName } from "@/components/Icon"

type StatusVisual = {
  icon: IconName | "spinner"
  spin: boolean
  text: string
  border: string
  bg: string
  labelKey: string
}

const visuals: Record<ServerLifecycleState, StatusVisual> = {
  running: {
    icon: "checkmark-circle",
    spin: false,
    text: "text-emerald-400",
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/10",
    labelKey: "status_badge.running",
  },
  starting: {
    icon: "spinner",
    spin: true,
    text: "text-amber-400",
    border: "border-amber-500/25",
    bg: "bg-amber-500/10",
    labelKey: "status_badge.starting",
  },
  stopping: {
    icon: "spinner",
    spin: true,
    text: "text-amber-400",
    border: "border-amber-500/25",
    bg: "bg-amber-500/10",
    labelKey: "status_badge.stopping",
  },
  offline: {
    icon: "power-socket",
    spin: false,
    text: "text-zinc-500",
    border: "border-zinc-700/40",
    bg: "bg-zinc-800/40",
    labelKey: "status_badge.offline",
  },
}

const RUNNING_ICON_HOLD_MS = 1500

/**
 * Animated server-status chip used in the per-server header titlebar.
 * The icon fades and the chip's width auto-resizes between states via
 * framer-motion's layout system, so transitions read as smooth swaps
 * rather than abrupt text replacements. The running tick is a one-shot
 * indicator: pop in, hold briefly, fade out and let the chip contract.
 */
export const ServerStatusBadge = ({
  status,
}: {
  status: ServerLifecycleState
}) => {
  const { t } = useTranslation()
  const v = visuals[status]
  const label = t(v.labelKey)

  const [showRunningIcon, setShowRunningIcon] = useState(true)
  useEffect(() => {
    if (status !== "running") {
      setShowRunningIcon(true)
      return
    }
    setShowRunningIcon(true)
    const timer = window.setTimeout(
      () => setShowRunningIcon(false),
      RUNNING_ICON_HOLD_MS
    )
    return () => window.clearTimeout(timer)
  }, [status])

  const renderIcon = status !== "running" || showRunningIcon

  return (
    <motion.span
      layout
      transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.6 }}
      className={`inline-flex h-6 items-center gap-1.5 rounded-md ${v.bg} ${v.text} px-2 text-[10.5px] font-medium uppercase tracking-wider`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {renderIcon ? (
          <motion.span
            key={status}
            layout
            initial={{ opacity: 0, scale: 0.7, width: 0, marginRight: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              width: "auto",
              marginRight: 0,
            }}
            exit={{ opacity: 0, scale: 0.7, width: 0, marginRight: -6 }}
            transition={{ duration: 0.2 }}
            className="flex shrink-0 items-center overflow-hidden"
          >
            {v.icon === "spinner" ? (
              <LoaderIcon className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Icon name={v.icon} className="size-3.5" />
            )}
          </motion.span>
        ) : null}
      </AnimatePresence>
      <motion.span layout className="leading-none">
        {label}
      </motion.span>
    </motion.span>
  )
}
