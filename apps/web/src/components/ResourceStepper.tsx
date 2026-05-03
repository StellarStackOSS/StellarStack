import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Slider } from "@workspace/ui/components/slider"

export const ResourceStepper = ({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  disabled = false,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
  disabled?: boolean
}) => {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))

  return (
    <div className={`flex flex-col gap-2 ${disabled ? "pointer-events-none opacity-40" : ""}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-muted-foreground text-xs tabular-nums">
          {value.toLocaleString()} {unit}
          <span className="ml-1 opacity-50">/ {max.toLocaleString()} {unit}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 shrink-0 px-0"
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - step))}
        >
          −
        </Button>
        <Slider
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={([v]) => v !== undefined && onChange(v)}
          className="flex-1"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 shrink-0 px-0"
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + step))}
        >
          +
        </Button>
      </div>
    </div>
  )
}
