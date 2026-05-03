/**
 * Lightweight SVG sparkline. Renders a filled area chart from an array of
 * 0–1 normalised values. No external charting library needed.
 */
export const Sparkline = ({
  data,
  color = "rgba(99,102,241,0.8)",
  fillColor = "rgba(99,102,241,0.15)",
  height = 32,
  className,
}: {
  data: number[]
  color?: string
  fillColor?: string
  height?: number
  className?: string
}) => {
  if (data.length < 2) {
    return <div className={className} style={{ height }} />
  }

  const w = 200
  const h = height
  const pad = 2

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / range) * (h - pad * 2),
  }))

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ")

  const first = pts[0]
  const last = pts[pts.length - 1]
  const fillPath = `${linePath} L ${last?.x.toFixed(1)} ${h} L ${first?.x.toFixed(1)} ${h} Z`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={["w-full", className ?? ""].filter(Boolean).join(" ")}
      style={{ height }}
      aria-hidden
    >
      <path d={fillPath} fill={fillColor} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
