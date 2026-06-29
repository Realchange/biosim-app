import { useState } from 'react'

interface Props {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
}

// Compact numeric input for scientific parameters. Displays the value rounded to
// ~4 significant figures (so e.g. 286.921725 reads as 286.9), but keeps the stored
// value untouched until edited — and does NOT reformat while you type (a local
// string buffer avoids cursor jumps). On blur it snaps back to the clean display.
function fmt(v: number): string {
  if (!Number.isFinite(v) || v === 0) return '0'
  return String(parseFloat(v.toPrecision(4)))
}

export function NumberField({ value, onChange, step, min, max }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={editing ?? fmt(value)}
      onChange={e => {
        setEditing(e.target.value)
        const n = parseFloat(e.target.value)
        if (Number.isFinite(n)) onChange(n)
      }}
      onBlur={() => setEditing(null)}
      style={{
        width: '100%', background: '#21262d', color: '#c9d1d9',
        border: '1px solid #30363d', borderRadius: 4, padding: '3px 6px',
        fontSize: 11, boxSizing: 'border-box',
      }}
    />
  )
}
