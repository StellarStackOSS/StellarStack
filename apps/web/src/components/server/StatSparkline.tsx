/** Builds an SVG area-chart path pair from a 0–1 normalised values array. */
const buildPaths = (
  values: number[],
  w: number,
  h: number
): { area: string; line: string } => {
  if (values.length < 2) return { area: "", line: "" }
  const stepX = w / (values.length - 1)
  const pts = values.map((v, i) => ({
    x: i * stepX,
    y: h - Math.max(0, Math.min(1, v)) * h,
  }))
  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ")
  const area = `${line} L${(w).toFixed(1)},${h} L0,${h} Z`
  return { area, line }
}

export const StatSparkline = ({
  values,
  color,
}: {
  values: number[]
  color: string
}) => {
  const { area, line } = buildPaths(values, 100, 32)
  if (line === "") return <div className="h-8" />
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className="h-8 w-full"
      aria-hidden
    >
      <path d={area} fill={color} fillOpacity={0.15} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
