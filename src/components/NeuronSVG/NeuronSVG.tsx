import type { Neuron, Compartment } from '../../types'
import { voltageToColor } from '../../types'
import styles from './NeuronSVG.module.css'

interface Props {
  neuron: Neuron
  somaColor?: string
  dend1Color?: string
  dend2Color?: string
  dend3Color?: string
  highlightCompartment?: Compartment | null
  onClick?: (compartment: Compartment) => void
  selected?: boolean
}

export function NeuronSVG({
  neuron, somaColor, dend1Color, dend2Color, dend3Color,
  highlightCompartment, onClick, selected
}: Props) {
  const sc  = somaColor  ?? voltageToColor(neuron.compartments?.soma.V  ?? -70)
  const d1c = dend1Color ?? voltageToColor(neuron.compartments?.dend1.V ?? -70)
  const d2c = dend2Color ?? voltageToColor(neuron.compartments?.dend2.V ?? -70)
  const d3c = dend3Color ?? voltageToColor(neuron.compartments?.dend3.V ?? -70)

  const hl = (c: Compartment) => highlightCompartment === c

  const compartmentClick = (c: Compartment) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick?.(c)
  }

  return (
    <g className={selected ? styles.selected : ''}>
      {/* Upper dendrite tree */}
      <line x1="-18" y1="0" x2="-46" y2="0" stroke={d1c} strokeWidth={3.5} />
      <circle cx="-46" cy="0" r={hl('dend1') ? 6 : 5}
        fill="#f0883e" stroke={hl('dend1') ? '#fff' : '#d29922'}
        strokeWidth={hl('dend1') ? 3 : 1.5}
        data-compartment="dend1"
        onClick={compartmentClick('dend1')} style={{ cursor: 'pointer' }} />
      <line x1="-46" y1="0" x2="-72" y2="-20" stroke={d2c} strokeWidth={2.5} />
      <line x1="-46" y1="0" x2="-72" y2="20" stroke={d2c} strokeWidth={2.5} />
      <circle cx="-72" cy="-20" r={hl('dend2') ? 5 : 3.5}
        fill="#388bfd" stroke={hl('dend2') ? '#fff' : '#58a6ff'}
        strokeWidth={hl('dend2') ? 3 : 1.5}
        data-compartment="dend2"
        onClick={compartmentClick('dend2')} style={{ cursor: 'pointer' }} />
      <circle cx="-72" cy="20" r={hl('dend2') ? 5 : 3.5}
        fill="#388bfd" stroke={hl('dend2') ? '#fff' : '#58a6ff'}
        strokeWidth={hl('dend2') ? 3 : 1.5}
        data-compartment="dend2"
        onClick={compartmentClick('dend2')} style={{ cursor: 'pointer' }} />
      {([[-72,-20,-90,-32],[-72,-20,-90,-12],[-72,20,-90,8],[-72,20,-90,32]] as number[][]).map(([x1,y1,x2,y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={d3c} strokeWidth={1.5}
          data-compartment="dend3" onClick={compartmentClick('dend3')} style={{ cursor: 'pointer' }} />
      ))}
      {[[-90,-32],[-90,-12],[-90,8],[-90,32]].map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={hl('dend3') ? 4 : 3}
          fill="#8957e5" stroke={hl('dend3') ? '#fff' : '#a371f7'}
          strokeWidth={hl('dend3') ? 2.5 : 1.5}
          data-compartment="dend3"
          onClick={compartmentClick('dend3')} style={{ cursor: 'pointer' }} />
      ))}

      {/* Soma */}
      <ellipse cx="0" cy="0" rx="20" ry="16"
        fill={sc}
        stroke={hl('soma') ? '#fff' : '#58a6ff'}
        strokeWidth={hl('soma') ? 3 : 2}
        data-compartment="soma"
        onClick={compartmentClick('soma')} style={{ cursor: 'pointer' }} />

      {/* Axon */}
      <line x1="20" y1="0" x2="80" y2="0" stroke="#f0f6fc" strokeWidth={3.5} />
      {[28, 44, 60].map(x => (
        <rect key={x} x={x} y="-5" width={12} height={10} rx={5}
          fill="none" stroke="#d29922" strokeWidth={1.5} opacity={0.8} />
      ))}
      <circle cx="82" cy="0" r={6} fill="#da3633" stroke="#f85149" strokeWidth={2} />
      <line x1="82" y1="-6" x2="96" y2="-18" stroke="#f0f6fc" strokeWidth={1.5} />
      <line x1="82" y1="6"  x2="96" y2="18"  stroke="#f0f6fc" strokeWidth={1.5} />
      <circle cx="98" cy="-20" r={4} fill="#da3633" stroke="#f85149" strokeWidth={1.5} />
      <circle cx="98" cy="20"  r={4} fill="#da3633" stroke="#f85149" strokeWidth={1.5} />
    </g>
  )
}
