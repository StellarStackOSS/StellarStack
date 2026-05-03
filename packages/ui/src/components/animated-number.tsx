import NumberFlow from "@number-flow/react"
import { cn } from "@workspace/ui/lib/utils"

type Props = {
  value: number
  decimals?: number
  suffix?: string
  prefix?: string
  duration?: number
  className?: string
}

export const AnimatedNumber = ({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  duration = 400,
  className,
}: Props) => (
  <NumberFlow
    value={value}
    format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
    transformTiming={{ duration, easing: "ease-out" }}
    prefix={prefix}
    suffix={suffix}
    className={cn("tabular-nums", className)}
  />
)
