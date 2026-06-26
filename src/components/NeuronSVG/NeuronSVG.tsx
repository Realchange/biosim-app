import type { Neuron, Compartment } from '../../types'
import { voltageToColor } from '../../types'
import {
  SOMA_CY, SOMA_R, ROD_X, ROD_W, ROD_TOP, ROD_H, ROD_RX, SEG_H,
  DEND_SEGMENTS as SEGMENTS,
} from './geometry'
import styles from './NeuronSVG.module.css'

interface Props {
  neuron: Neuron
  somaColor?: string
  dend1Color?: string
  dend2Color?: string
  dend3Color?: string
  highlightCompartment?: Compartment | null
  onClick?: (compartment: Compartment, e: React.MouseEvent) => void
  selected?: boolean
  activity?: number   // 0..1 smoothed firing activity → soma glow halo
}

const SOMA_REST = '#f0883e'   // orange — active spike zone
const DEND_REST = '#f0f6fc'   // white  — passive dendrites
const HIGHLIGHT = '#1f6feb'   // blue   — electrode highlight (contrasts orange + white)

// Soma is orange at rest and flashes red while it overshoots (the action potential).
function somaFill(v: number): string {
  return v > 0 ? '#da3633' : SOMA_REST
}
// Dendrites are white at rest; they warm up as injected current passively spreads.
function dendFill(v: number): string {
  return v > -50 ? voltageToColor(v) : DEND_REST
}

export function NeuronSVG({
  neuron, somaColor, dend1Color, dend2Color, dend3Color,
  highlightCompartment, onClick, selected, activity = 0,
}: Props) {
  const graded = neuron.model === 'graded'
  // Graded neurons never spike → never flash red.
  const sc  = somaColor  ?? (graded ? SOMA_REST : somaFill(neuron.compartments?.soma.V  ?? -70))
  const segColors: Record<string, string> = {
    dend1: dend1Color ?? dendFill(neuron.compartments?.dend1.V ?? -70),
    dend2: dend2Color ?? dendFill(neuron.compartments?.dend2.V ?? -70),
    dend3: dend3Color ?? dendFill(neuron.compartments?.dend3.V ?? -70),
  }

  const hl = (c: Compartment) => highlightCompartment === c
  // Pass the event up so the canvas can distinguish select / connect (shift) / electrode.
  const compartmentClick = (c: Compartment) => (e: React.MouseEvent) => {
    onClick?.(c, e)
  }

  const clipId = `rod-clip-${neuron.id}`

  return (
    <g className={selected ? styles.selected : ''}>
      <defs>
        <clipPath id={clipId}>
          <rect x={ROD_X} y={ROD_TOP} width={ROD_W} height={ROD_H} rx={ROD_RX} ry={ROD_RX} />
        </clipPath>
        <filter id={`glow-${neuron.id}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Activity glow — the soma lights up with its firing rate */}
      {activity > 0.02 && (
        <circle cx={0} cy={SOMA_CY} r={SOMA_R + 4}
          fill={sc} opacity={Math.min(0.85, activity)}
          filter={`url(#glow-${neuron.id})`} pointerEvents="none" />
      )}

      {/* Dendrite rod — passive segments, voltage-coloured, clipped to a rounded bar */}
      <g clipPath={`url(#${clipId})`}>
        {SEGMENTS.map(seg => (
          <rect key={seg.id}
            x={ROD_X} y={seg.y} width={ROD_W} height={SEG_H}
            fill={segColors[seg.id]}
            stroke={hl(seg.id) ? HIGHLIGHT : 'none'}
            strokeWidth={hl(seg.id) ? 4 : 0}
            data-compartment={seg.id}
            data-highlight={hl(seg.id) ? seg.id : undefined}
            className={styles.compartmentHit}
            onClick={compartmentClick(seg.id)}
            style={{ cursor: 'pointer' }} />
        ))}
        {/* Segment dividers */}
        {[ROD_TOP + SEG_H, ROD_TOP + 2 * SEG_H].map(y => (
          <line key={y} x1={ROD_X} y1={y} x2={ROD_X + ROD_W} y2={y}
            stroke="#0d1117" strokeWidth={1} pointerEvents="none" />
        ))}
      </g>
      {/* Rod outline */}
      <rect x={ROD_X} y={ROD_TOP} width={ROD_W} height={ROD_H} rx={ROD_RX} ry={ROD_RX}
        fill="none" stroke="#30363d" strokeWidth={1.5} pointerEvents="none" />

      {/* Afferent marker — small input triangle to the left of the soma */}
      {neuron.kind === 'afferent' && (
        <polygon data-afferent points={`-40,${SOMA_CY - 6} -40,${SOMA_CY + 6} -28,${SOMA_CY}`}
          fill="#8b949e" pointerEvents="none" />
      )}

      {/* Soma — active spike-generating zone (dashed outline = non-spiking/graded) */}
      <circle cx={0} cy={SOMA_CY} r={SOMA_R}
        fill={sc}
        stroke={hl('soma') ? HIGHLIGHT : '#30363d'}
        strokeWidth={hl('soma') ? 4 : 2}
        strokeDasharray={graded ? '4 3' : undefined}
        data-compartment="soma"
        data-highlight={hl('soma') ? 'soma' : undefined}
        className={styles.compartmentHit}
        onClick={compartmentClick('soma')} style={{ cursor: 'pointer' }} />
    </g>
  )
}
