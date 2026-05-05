import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  Loading03Icon,
  PowerSocket01Icon,
} from "@hugeicons/core-free-icons"

type Status = "offline" | "starting" | "running" | "stopping"

const visuals: Record<Status, {
  icon: typeof CheckmarkCircle02Icon
  spin: boolean
  text: string
  border: string
  bg: string
  label: string
}> = {
  running: {
    icon: CheckmarkCircle02Icon,
    spin: false,
    text: "text-emerald-400",
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/10",
    label: "Online",
  },
  starting: {
    icon: Loading03Icon,
    spin: true,
    text: "text-amber-400",
    border: "border-amber-500/25",
    bg: "bg-amber-500/10",
    label: "Starting",
  },
  stopping: {
    icon: Loading03Icon,
    spin: true,
    text: "text-amber-400",
    border: "border-amber-500/25",
    bg: "bg-amber-500/10",
    label: "Stopping",
  },
  offline: {
    icon: PowerSocket01Icon,
    spin: false,
    text: "text-zinc-500",
    border: "border-zinc-700/40",
    bg: "bg-zinc-800/40",
    label: "Offline",
  },
}

const cycle: Status[] = ["offline", "starting", "running", "stopping"]

export const ServerStatusBadgeDemo = () => {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setI((v) => (v + 1) % cycle.length), 2200)
    return () => window.clearInterval(t)
  }, [])
  const status = cycle[i]!
  const v = visuals[status]
  return (
    <motion.span
      layout
      transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.6 }}
      className={`inline-flex items-center gap-1.5 rounded-full border ${v.border} ${v.bg} ${v.text} px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          layout
          initial={{ opacity: 0, scale: 0.7, width: 0, marginRight: 0 }}
          animate={{ opacity: 1, scale: 1, width: "auto", marginRight: 0, rotate: v.spin ? 360 : 0 }}
          exit={{ opacity: 0, scale: 0.7, width: 0, marginRight: -6 }}
          transition={
            v.spin
              ? {
                  rotate: { duration: 1.1, ease: "linear", repeat: Infinity },
                  opacity: { duration: 0.15 },
                  scale: { duration: 0.15 },
                  width: { duration: 0.2 },
                }
              : { duration: 0.25 }
          }
          className="flex shrink-0 items-center overflow-hidden"
        >
          <HugeiconsIcon icon={v.icon} className="size-3.5" />
        </motion.span>
      </AnimatePresence>
      <motion.span layout className="leading-none">
        {v.label}
      </motion.span>
    </motion.span>
  )
}
