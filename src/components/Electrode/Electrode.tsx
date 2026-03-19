interface Props {
  x: number
  y: number
  color: string
  onRemove?: () => void
}

// Electrode compartment offsets relative to soma center (0,0)
export const ELECTRODE_OFFSETS: Record<string, { x: number; y: number }> = {
  soma:  { x: 0,   y: -22 },
  dend1: { x: -46, y: -16 },
  dend2: { x: -72, y: -30 },
  dend3: { x: -90, y: -40 },
}

export function ElectrodePin({ x, y, color, onRemove }: Props) {
  return (
    <g transform={`translate(${x},${y})`}
       onClick={onRemove} style={{ cursor: 'pointer' }}
       title="Elektrode entfernen">
      <rect x="-3" y="-18" width={6} height={14} rx={2} fill={color} opacity={0.9} />
      <polygon points="0,-4 -2,2 2,2" fill={color} />
      <line x1="0" y1="-18" x2="0" y2="-26" stroke={color} strokeWidth={1.5} />
      <circle cx="0" cy="2" r={4} fill="none" stroke={color} strokeWidth={1.5} opacity={0.6} />
    </g>
  )
}
