import type { Synapse, Neuron } from '@biosim/core'
import { COMPARTMENT_CENTERS, ROD_W, SOMA_R } from '../NeuronSVG/geometry'

interface Props {
  synapse: Synapse
  neurons: Neuron[]
  selected: boolean
  onClick: () => void
  // 'line' renders under the neurons; 'dot' renders the terminal on top of them.
  layer: 'line' | 'dot'
}

// Excitatory → green, inhibitory → red. The synapse terminates in a small dot on
// the edge of the target compartment (the post-synaptic site, like a bouton);
// the source end leaves from the soma.
const EXCITATORY = '#3fb950'
const INHIBITORY = '#f85149'

export function SynapseArrow({ synapse, neurons, selected, onClick, layer }: Props) {
  const src = neurons.find(n => n.id === synapse.sourceId)
  const tgt = neurons.find(n => n.id === synapse.targetId)
  if (!src || !tgt) return null

  const color = synapse.type === 'excitatory' ? EXCITATORY : INHIBITORY

  // Source end: the soma of the source neuron.
  const soma = COMPARTMENT_CENTERS.soma
  const sx = src.position.x + soma.x
  const sy = src.position.y + soma.y

  // Target end: the edge of the targeted compartment, on the side facing the source.
  const center = COMPARTMENT_CENTERS[synapse.targetCompartment]
  const cx = tgt.position.x + center.x
  const cy = tgt.position.y + center.y
  const edgeR = synapse.targetCompartment === 'soma' ? SOMA_R : ROD_W / 2
  const dx = sx - cx
  const dy = sy - cy
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len

  // Offset the whole line sideways (perpendicular to its direction) so that a pair
  // of reciprocal synapses (A→B and B→A) separates into two distinct parallel lines
  // instead of overlapping. The perpendicular flips with direction, so the two land
  // on opposite sides.
  const OFFSET = 6
  const px = uy * OFFSET, py = -ux * OFFSET
  const x1 = sx + px, y1 = sy + py
  const x2 = cx + ux * edgeR + px, y2 = cy + uy * edgeR + py

  // Stop propagation so the SVG background click doesn't clear the selection.
  const handleClick = (e: React.MouseEvent) => { e.stopPropagation(); onClick() }

  if (layer === 'dot') {
    const dotR = selected ? 5 : 3.5
    return (
      <circle cx={x2} cy={y2} r={dotR}
        fill={color} stroke="#0d1117" strokeWidth={1}
        onClick={handleClick} style={{ cursor: 'pointer' }} />
    )
  }

  return (
    <g onClick={handleClick} style={{ cursor: 'pointer' }}>
      {/* Invisible wide hit area */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} />
      {/* Connecting line — always solid; colour (+ terminal dot) encodes the type */}
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={selected ? 3 : 1.5} />
    </g>
  )
}
