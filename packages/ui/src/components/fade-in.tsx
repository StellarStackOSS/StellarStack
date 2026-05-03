import { useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"

type FadeDirection = "up" | "down" | "left" | "right" | "none"

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  duration?: number
  className?: string
  direction?: FadeDirection
}

const directionClass: Record<FadeDirection, string> = {
  up:    "translate-y-4",
  down:  "-translate-y-4",
  left:  "translate-x-4",
  right: "-translate-x-4",
  none:  "",
}

const FadeIn = ({
  children,
  delay = 0,
  duration = 400,
  className,
  direction = "up",
}: FadeInProps) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(id)
  }, [delay])

  return (
    <div
      className={cn(
        "transition-all",
        visible
          ? "opacity-100 translate-x-0 translate-y-0"
          : `opacity-0 ${directionClass[direction]}`,
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  )
}

export { FadeIn }
