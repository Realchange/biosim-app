interface Props {
  x: number
  y: number
  color: string
  onRemove?: () => void
}

// Electrode compartment offsets relative to the neuron origin (0,0).
// Pins sit just to the right of each segment of the thermometer body.
export const ELECTRODE_OFFSETS: Record<string, { x: number; y: number }> = {
  soma:  { x: 22, y: -44 },
  dend1: { x: 18, y: -11 },
  dend2: { x: 18, y: 16 },
  dend3: { x: 18, y: 43 },
}

export function ElectrodePin({ x, y, color, onRemove }: Props) {
  return (
    <g transform={`translate(${x},${y})`}
       onClick={onRemove} style={{ cursor: 'pointer' }}>
      <title>Ableitungselektrode (Messung) — klicken zum Entfernen</title>
      <rect x="-3" y="-18" width={6} height={14} rx={2} fill={color} opacity={0.9} />
      <polygon points="0,-4 -2,2 2,2" fill={color} />
      <line x1="0" y1="-18" x2="0" y2="-26" stroke={color} strokeWidth={1.5} />
      <circle cx="0" cy="2" r={4} fill="none" stroke={color} strokeWidth={1.5} opacity={0.6} />
    </g>
  )
}
