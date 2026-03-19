import type { Synapse, Neuron } from '../../types'

interface Props {
  synapse: Synapse
  neurons: Neuron[]
  selected: boolean
  onClick: () => void
}

export function SynapseArrow({ synapse, neurons, selected, onClick }: Props) {
  const src = neurons.find(n => n.id === synapse.sourceId)
  const tgt = neurons.find(n => n.id === synapse.targetId)
  if (!src || !tgt) return null
  const { x: x1, y: y1 } = src.position
  const { x: x2, y: y2 } = tgt.position
  const color = synapse.type === 'excitatory' ? '#3fb950' : '#f85149'
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Invisible wide hit area */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12} />
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={selected ? 3 : 1.5}
        strokeDasharray={synapse.type === 'inhibitory' ? '6,3' : undefined}
        markerEnd={`url(#arrow-${synapse.type})`} />
    </g>
  )
}
