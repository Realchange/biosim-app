import { useMemo } from 'react'
import type { VoltageTrace } from '../../store/networkStore'
import { useNetworkStore } from '../../store/networkStore'
import { COMPARTMENT_COLORS } from '../../types'
import type { LIFParams, HHParams } from '../../types'
import { FIXED_V_RANGE } from '../../utils/scale'
import { stimulusCurrent } from '../../utils/stimulus'
import styles from './VoltageGraph.module.css'

const W = 280, PH = 120
const MARGIN = { top: 8, right: 10, bottom: 22, left: 34 }
const WINDOW_MS = 100

interface Props {
  traces: VoltageTrace[]
  running: boolean
  currentT?: number
  onExpand?: (neuronId: string) => void
}

type StimSpec = LIFParams | HHParams

// One compact voltage plot for a single neuron (its measured compartments).
function NeuronPanel({
  label, traces, tMin, tMax, stim, showTimeLabel, onExpand,
}: {
  label: string
  traces: VoltageTrace[]
  tMin: number
  tMax: number
  stim: StimSpec | null   // the neuron's stimulus params if it is stimulated (I_stim > 0)
  showTimeLabel: boolean
  onExpand?: () => void
}) {
  const innerW = W - MARGIN.left - MARGIN.right
  const innerH = PH - MARGIN.top - MARGIN.bottom
  const [vMin, vMax] = FIXED_V_RANGE

  const vToY = (v: number) => MARGIN.top + innerH * (1 - (v - vMin) / Math.max(vMax - vMin, 1))
  const tToX = (t: number) => MARGIN.left + innerW * ((t - tMin) / Math.max(tMax - tMin, 1))

  const compartments = Array.from(new Set(traces.map(tr => tr.compartment)))

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelLabel}>{label}</span>
        <span className={styles.legend}>
          {compartments.map(c => (
            <span key={c} className={styles.legendItem} data-legend>
              <svg width={9} height={9}><circle cx={4.5} cy={4.5} r={4} fill={COMPARTMENT_COLORS[c]} /></svg>
              {c}
            </span>
          ))}
          {onExpand && (
            <button className={styles.expandBtn} onClick={onExpand} title="Detailansicht öffnen">⛶</button>
          )}
        </span>
      </div>
      <svg width={W} height={PH} viewBox={`0 0 ${W} ${PH}`} style={{ overflow: 'visible' }}>
        <rect x={MARGIN.left} y={MARGIN.top} width={innerW} height={innerH} fill="#0d1117" rx={3} />

        {/* Stimulus current — drawn faintly behind the voltage trace, normalised to its
            own peak so the shape (pulse / ramp / + velocity) is visible without a scale. */}
        {stim && (() => {
          const peak = stim.I_stim * (1 + (stim.dynamicGain ?? 0) + (stim.accelGain ?? 0))
          if (peak <= 0) return null
          const baseY = MARGIN.top + innerH
          const sToY = (I: number) => baseY - (I / peak) * innerH * 0.7
          const N = 80
          const pts: string[] = []
          for (let i = 0; i <= N; i++) {
            const t = tMin + (tMax - tMin) * (i / N)
            pts.push(`${tToX(t).toFixed(1)},${sToY(stimulusCurrent(stim, t)).toFixed(1)}`)
          }
          const line = pts.join(' ')
          const area = `${tToX(tMin).toFixed(1)},${baseY} ${line} ${tToX(tMax).toFixed(1)},${baseY}`
          return (
            <g pointerEvents="none">
              <polygon points={area} fill="#f0883e" opacity={0.1} />
              <polyline points={line} fill="none" stroke="#f0883e" opacity={0.4} strokeWidth={1} />
            </g>
          )
        })()}

        {/* Y grid + labels */}
        {[0, 0.5, 1].map(frac => {
          const v = Math.round(vMin + (vMax - vMin) * frac)
          const y = vToY(v)
          return (
            <g key={frac}>
              <line x1={MARGIN.left} y1={y} x2={MARGIN.left + innerW} y2={y} stroke="#21262d" strokeWidth={0.5} />
              <text x={MARGIN.left - 4} y={y + 4} fill="#8b949e" fontSize={9} textAnchor="end">{v}</text>
            </g>
          )
        })}

        {/* X ticks */}
        {[0, 0.5, 1].map(frac => {
          const t = tMin + (tMax - tMin) * frac
          const x = tToX(t)
          return (
            <g key={frac}>
              <line x1={x} y1={MARGIN.top + innerH} x2={x} y2={MARGIN.top + innerH + 3} stroke="#8b949e" strokeWidth={0.5} />
              <text x={x} y={MARGIN.top + innerH + 12} fill="#8b949e" fontSize={9} textAnchor="middle">{Math.round(t)}</text>
            </g>
          )
        })}
        {showTimeLabel && (
          <text x={MARGIN.left + innerW / 2} y={PH - 1} fill="#8b949e" fontSize={9} textAnchor="middle">Zeit (ms)</text>
        )}

        {/* Traces */}
        {traces.map(tr => {
          if (tr.points.length < 2) return null
          const pts = tr.points
            .filter(([t]) => t >= tMin && t <= tMax)
            .map(([t, v]) => `${tToX(t).toFixed(1)},${vToY(v).toFixed(1)}`)
            .join(' ')
          return (
            <polyline key={`${tr.neuronId}-${tr.compartment}`}
              points={pts} fill="none"
              stroke={COMPARTMENT_COLORS[tr.compartment]} strokeWidth={1.5} />
          )
        })}
      </svg>
    </div>
  )
}

export function VoltageGraph({ traces, running, currentT = 0, onExpand }: Props) {
  const neurons = useNetworkStore(s => s.neurons)

  // Group traces by neuron — one stacked panel per measured neuron. The label uses
  // the neuron's role name if set, else its number in the FULL network (same as the
  // canvas), NOT a running count of measured neurons.
  const groups = useMemo(() => {
    const byNeuron = new Map<string, VoltageTrace[]>()
    for (const tr of traces) {
      const arr = byNeuron.get(tr.neuronId) ?? []
      arr.push(tr)
      byNeuron.set(tr.neuronId, arr)
    }
    const ordered: string[] = []
    for (const n of neurons) if (byNeuron.has(n.id)) ordered.push(n.id)
    for (const id of byNeuron.keys()) if (!ordered.includes(id)) ordered.push(id)
    const labelOf = new Map(neurons.map(n => [n.id, n.label]))
    const indexOf = new Map(neurons.map((n, i) => [n.id, i]))
    return ordered.map((id, i) => ({
      id,
      label: labelOf.get(id) ?? `Neuron ${(indexOf.get(id) ?? i) + 1}`,
      traces: byNeuron.get(id)!,
    }))
  }, [traces, neurons])

  // Shared time axis across all panels so they line up for comparison.
  const tMax = running ? currentT : Math.max(WINDOW_MS, ...traces.flatMap(tr => tr.points.map(([t]) => t)), 0)
  const tMin = running ? Math.max(0, tMax - WINDOW_MS) : 0

  // A stimulated neuron's stimulus params (for the faint current trace); else null.
  // Works for LIF, HH and graded — all carry I_stim.
  const stimFor = (neuronId: string): StimSpec | null => {
    const n = neurons.find(nn => nn.id === neuronId)
    if (!n) return null
    const p = n.params as LIFParams | HHParams
    return (p.I_stim ?? 0) > 0 ? p : null
  }

  if (traces.length === 0) {
    return (
      <div className={styles.placeholder}>
        <span>Elektrode platzieren</span>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Spannung (mV)</span>
      </div>
      <div className={styles.scroll}>
        {groups.map((g, i) => (
          <NeuronPanel key={g.id}
            label={g.label}
            traces={g.traces}
            tMin={tMin} tMax={tMax}
            stim={stimFor(g.id)}
            showTimeLabel={i === groups.length - 1}
            onExpand={onExpand ? () => onExpand(g.id) : undefined} />
        ))}
      </div>
    </div>
  )
}
