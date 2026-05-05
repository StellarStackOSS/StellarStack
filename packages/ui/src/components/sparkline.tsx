import { useId } from "react"
import {
  Area,
  AreaChart,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts"

type SparklineProps = {
  data: number[]
  color?: string
  height?: number
  minDomain?: number
  maxDomain?: number
  formatValue?: (v: number) => string
  label?: string
}

type DualSparklineProps = {
  data1: number[]
  data2: number[]
  color1?: string
  color2?: string
  height?: number
  minDomain?: number
  maxDomain?: number
  formatValue?: (v: number) => string
  label1?: string
  label2?: string
}

const DOT_COLOR = "rgba(255, 255, 255, 0.15)"

const tooltipContentStyle: React.CSSProperties = {
  background: "#0e0e0e",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: 11,
  color: "#e4e4e7",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
}

const tooltipCursor = {
  stroke: "rgba(255, 255, 255, 0.15)",
  strokeDasharray: "2 2",
}

export const Sparkline = ({
  data,
  color = "#22c55e",
  height = 32,
  minDomain = 0,
  maxDomain = 100,
  formatValue = (v) => v.toFixed(1),
  label,
}: SparklineProps) => {
  const id = useId()
  const gradientId = `sg-${id}`
  const patternId = `sp-${id}`
  const chartData = data.map((value, index) => ({ value, index }))

  return (
    <div style={{ height }} className="relative w-full">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 0 }}>
        <defs>
          <pattern id={patternId} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.5" fill={DOT_COLOR} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <div className="relative" style={{ height, zIndex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={[minDomain, maxDomain]} hide type="number" />
            <Tooltip
              cursor={tooltipCursor}
              contentStyle={tooltipContentStyle}
              labelFormatter={() => ""}
              formatter={((value: number | string) => [
                formatValue(typeof value === "number" ? value : Number(value)),
                label ?? "",
              ]) as never}
              wrapperStyle={{ outline: "none" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              baseValue={minDomain}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export const DualSparkline = ({
  data1,
  data2,
  color1 = "#3b82f6",
  color2 = "#a855f7",
  height = 32,
  minDomain = 0,
  maxDomain = 100,
  formatValue = (v) => v.toFixed(1),
  label1 = "Series 1",
  label2 = "Series 2",
}: DualSparklineProps) => {
  const id = useId()
  const g1 = `dsg1-${id}`
  const g2 = `dsg2-${id}`
  const patternId = `dsp-${id}`
  const chartData = data1.map((v, i) => ({ v1: v, v2: data2[i] ?? 0, index: i }))

  return (
    <div style={{ height }} className="relative w-full">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 0 }}>
        <defs>
          <pattern id={patternId} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.5" fill={DOT_COLOR} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <div className="relative" style={{ height, zIndex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <defs>
              <linearGradient id={g1} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color1} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color1} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={g2} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color2} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={[minDomain, maxDomain]} hide type="number" />
            <Tooltip
              cursor={tooltipCursor}
              contentStyle={tooltipContentStyle}
              labelFormatter={() => ""}
              formatter={((value: number | string, name: string) => [
                formatValue(typeof value === "number" ? value : Number(value)),
                name === "v1" ? label1 : label2,
              ]) as never}
              wrapperStyle={{ outline: "none" }}
            />
            <Area
              type="monotone"
              dataKey="v1"
              stroke={color1}
              strokeWidth={1.5}
              fill={`url(#${g1})`}
              isAnimationActive={false}
              baseValue={minDomain}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="v2"
              stroke={color2}
              strokeWidth={1.5}
              fill={`url(#${g2})`}
              isAnimationActive={false}
              baseValue={minDomain}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
