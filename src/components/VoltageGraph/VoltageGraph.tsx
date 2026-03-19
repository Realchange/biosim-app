import { useMemo } from 'react'
import type { VoltageTrace } from '../../store/networkStore'
import { COMPARTMENT_COLORS } from '../../types'
import type { Compartment } from '../../types'
import styles from './VoltageGraph.module.css'

const W = 280, H = 220
const MARGIN = { top: 10, right: 10, bottom: 32, left: 36 }
const V_MIN = -90, V_MAX = 60
const WINDOW_MS = 100

interface Props {
  traces: VoltageTrace[]
  running: boolean
  currentT?: number
}

function vToY(v: number): number {
  return MARGIN.top + (H - MARGIN.top - MARGIN.bottom) * (1 - (v - V_MIN) / (V_MAX - V_MIN))
}

export function VoltageGraph({ traces, running, currentT = 0 }: Props) {
  const innerW = W - MARGIN.left - MARGIN.right
  const innerH = H - MARGIN.top - MARGIN.bottom

  const tMax = running ? currentT : Math.max(WINDOW_MS, ...traces.flatMap(tr => tr.points.map(([t]) => t)), 0)
  const tMin = running ? Math.max(0, tMax - WINDOW_MS) : 0

  function tToX(t: number): number {
    return MARGIN.left + innerW * ((t - tMin) / Math.max(tMax - tMin, 1))
  }

  const activeLegend = useMemo(() =>
    Array.from(new Set(traces.map(tr => tr.compartment))),
    [traces]
  )

  if (traces.length === 0) {
    return (
      <div className={styles.placeholder}>
        <span>Elektrode platzieren</span>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <rect x={MARGIN.left} y={MARGIN.top} width={innerW} height={innerH}
          fill="#0d1117" rx={3} />

        {[-70, -40, 0, 40].map(v => {
          const y = vToY(v)
          return (
            <g key={v}>
              <line x1={MARGIN.left} y1={y} x2={MARGIN.left + innerW} y2={y}
                stroke="#21262d" strokeWidth={0.5} />
              <text x={MARGIN.left - 4} y={y + 4}
                fill="#8b949e" fontSize={9} textAnchor="end">{v}mV</text>
            </g>
          )
        })}

        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const t = tMin + (tMax - tMin) * frac
          const x = tToX(t)
          return (
            <g key={frac}>
              <line x1={x} y1={MARGIN.top + innerH} x2={x} y2={MARGIN.top + innerH + 4}
                stroke="#8b949e" strokeWidth={0.5} />
              <text x={x} y={MARGIN.top + innerH + 13}
                fill="#8b949e" fontSize={9} textAnchor="middle">{Math.round(t)}</text>
            </g>
          )
        })}

        <text x={MARGIN.left + innerW / 2} y={MARGIN.top + innerH + 28}
          fill="#8b949e" fontSize={9} textAnchor="middle">Zeit (ms)</text>

        {traces.map(tr => {
          if (tr.points.length < 2) return null
          const pts = tr.points
            .filter(([t]) => t >= tMin && t <= tMax)
            .map(([t, v]) => `${tToX(t).toFixed(1)},${vToY(v).toFixed(1)}`)
            .join(' ')
          return (
            <polyline key={`${tr.neuronId}-${tr.compartment}`}
              points={pts}
              fill="none"
              stroke={COMPARTMENT_COLORS[tr.compartment]}
              strokeWidth={1.5} />
          )
        })}
      </svg>

      <div className={styles.legend}>
        {activeLegend.map(c => (
          <span key={c} className={styles.legendItem} data-legend>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={COMPARTMENT_COLORS[c as Compartment]} /></svg>
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}
