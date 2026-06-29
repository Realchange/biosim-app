// Stimulation electrode — visually distinct from the recording electrode (ElectrodePin).
// It approaches the compartment from the LEFT with an arrow injecting current into the
// neuron, plus a small pulse glyph marking it as a stimulus. It lights up while the
// stimulus is actually being injected.
export function StimElectrode({ x, y, active }: { x: number; y: number; active: boolean }) {
  const c = active ? '#f2cc60' : '#9e7b2f'
  return (
    <g transform={`translate(${x},${y})`} pointerEvents="none">
      <title>Stimulationselektrode (externer Reiz)</title>
      {/* glow while injecting */}
      {active && <circle cx={3} cy={0} r={8} fill="#f2cc60" opacity={0.35} />}
      {/* lead coming from the left */}
      <line x1={-24} y1={-3} x2={-3} y2={0} stroke={c} strokeWidth={2.5} strokeLinecap="round" />
      {/* arrowhead injecting into the neuron (pointing right) */}
      <polygon points="-3,-5 6,0 -3,5" fill={c} />
      {/* small pulse glyph: the "stimulus" symbol */}
      <polyline points="-28,-9 -24,-9 -24,-17 -17,-17 -17,-9 -13,-9"
        fill="none" stroke={c} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  )
}
