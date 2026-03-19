import { useEffect, useRef, useState, useCallback } from 'react'
import { useNetworkStore } from '../../store/networkStore'
import { COMPARTMENT_COLORS } from '../../types'
import type { Compartment, LIFParams, HHParams } from '../../types'
import styles from './GraphModal.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

// ── layout constants ─────────────────────────────────────────────────────────
const MV   = { top: 12, right: 16, bottom: 36, left: 42 }
const MI   = { top: 12, right: 16, bottom: 36, left: 42 }
const VH = 240   // voltage panel inner height (px, scales with SVG viewBox)
const IH = 140   // current panel inner height

function vToY(v: number, h: number): number {
  const V_MIN = -90, V_MAX = 60
  return MV.top + h * (1 - (v - V_MIN) / (V_MAX - V_MIN))
}

function iToY(I: number, iMin: number, iMax: number, h: number): number {
  const span = Math.max(iMax - iMin, 0.01)
  return MI.top + h * (1 - (I - iMin) / span)
}

export function GraphModal({ open, onClose }: Props) {
  const { traces, currentTraces, neurons, simulationParams } = useNetworkStore()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [zoom, setZoom] = useState<[number, number] | null>(null)

  // Open / close the native dialog
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (open && !d.open) { d.showModal(); setZoom(null) }
    if (!open && d.open) d.close()
  }, [open])

  // Close on Escape (native dialog already does this, but keep state in sync)
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    const handler = () => onClose()
    d.addEventListener('close', handler)
    return () => d.removeEventListener('close', handler)
  }, [onClose])

  // Derive time range from traces
  const allT = traces.flatMap(tr => tr.points.map(([t]) => t))
  const tTotal = allT.length ? Math.max(...allT) : simulationParams.length
  const [dispStart, dispEnd] = zoom ?? [0, tTotal]

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const [s, en] = zoom ?? [0, tTotal]
    const span = en - s
    const factor = e.deltaY > 0 ? 1.3 : 0.77
    const newSpan = Math.max(5, Math.min(tTotal, span * factor))
    const center = (s + en) / 2
    setZoom([
      Math.max(0, center - newSpan / 2),
      Math.min(tTotal, center + newSpan / 2),
    ])
  }, [zoom, tTotal])

  // Width is determined via ref after mount — use a fixed wide viewBox instead
  const SVG_W = 760
  const vInnerW = SVG_W - MV.left - MV.right
  const iInnerW = SVG_W - MI.left - MI.right

  function tToVX(t: number) {
    return MV.left + vInnerW * ((t - dispStart) / Math.max(dispEnd - dispStart, 1))
  }
  function tToIX(t: number) {
    return MI.left + iInnerW * ((t - dispStart) / Math.max(dispEnd - dispStart, 1))
  }

  // Derive current range across all currentTraces
  const allI = currentTraces.flatMap(ct => ct.points.map(([, I]) => I))
  const rawIMax = allI.length ? Math.max(...allI) : 0
  // Also include I_stim values
  const iStimValues = traces.map(tr => {
    const n = neurons.find(nn => nn.id === tr.neuronId)
    return n ? (n.params as LIFParams | HHParams).I_stim : 0
  })
  const iMax = Math.max(rawIMax, ...iStimValues, 1) * 1.2
  const iMin = Math.min(...allI, 0) * 1.2 - 0.5

  // X-axis tick helper (shared)
  function xTicks(toX: (t: number) => number, innerH: number, mg: typeof MV) {
    return [0, 0.25, 0.5, 0.75, 1].map(frac => {
      const t = dispStart + (dispEnd - dispStart) * frac
      const x = toX(t)
      return (
        <g key={frac}>
          <line x1={x} y1={mg.top + innerH} x2={x} y2={mg.top + innerH + 4} stroke="#8b949e" strokeWidth={0.5} />
          <text x={x} y={mg.top + innerH + 14} fill="#8b949e" fontSize={9} textAnchor="middle">{Math.round(t)}</text>
        </g>
      )
    })
  }

  // Unique electrode neuron IDs (for legend)
  const electrodeNeuronIds = Array.from(new Set(traces.map(tr => tr.neuronId)))

  if (!open) return null

  return (
    <dialog ref={dialogRef} className={styles.dialog} onWheel={handleWheel}>
      <div className={styles.header}>
        <span className={styles.title}>Messspur</span>
        <span className={styles.hint}>Scroll zum Zoomen</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* ── Voltage panel ── */}
      <div className={styles.panelLabel}>Spannung (mV)</div>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${SVG_W} ${VH + MV.top + MV.bottom}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x={MV.left} y={MV.top} width={vInnerW} height={VH} fill="#0d1117" rx={3} />

        {/* Y grid + labels */}
        {[-70, -40, 0, 40].map(v => {
          const y = vToY(v, VH)
          return (
            <g key={v}>
              <line x1={MV.left} y1={y} x2={MV.left + vInnerW} y2={y} stroke="#21262d" strokeWidth={0.5} />
              <text x={MV.left - 4} y={y + 4} fill="#8b949e" fontSize={9} textAnchor="end">{v}</text>
            </g>
          )
        })}

        {/* X ticks + axis label */}
        {xTicks(tToVX, VH, MV)}
        <text x={MV.left + vInnerW / 2} y={MV.top + VH + 30} fill="#8b949e" fontSize={9} textAnchor="middle">Zeit (ms)</text>

        {/* Traces */}
        {traces.map(tr => {
          const pts = tr.points
            .filter(([t]) => t >= dispStart && t <= dispEnd)
            .map(([t, v]) => `${tToVX(t).toFixed(1)},${vToY(v, VH).toFixed(1)}`)
            .join(' ')
          if (!pts) return null
          return (
            <polyline key={`${tr.neuronId}-${tr.compartment}`}
              points={pts} fill="none"
              stroke={COMPARTMENT_COLORS[tr.compartment as Compartment]}
              strokeWidth={1.5} />
          )
        })}
      </svg>

      {/* ── Current panel ── */}
      <div className={styles.panelLabel}>Synaptischer Strom (nA)</div>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${SVG_W} ${IH + MI.top + MI.bottom}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x={MI.left} y={MI.top} width={iInnerW} height={IH} fill="#0d1117" rx={3} />

        {/* Y grid + labels */}
        {[0, Math.round(iMax * 0.5 * 10) / 10, Math.round(iMax * 10) / 10].map(I => {
          const y = iToY(I, iMin, iMax, IH)
          return (
            <g key={I}>
              <line x1={MI.left} y1={y} x2={MI.left + iInnerW} y2={y} stroke="#21262d" strokeWidth={0.5} />
              <text x={MI.left - 4} y={y + 4} fill="#8b949e" fontSize={9} textAnchor="end">{I.toFixed(1)}</text>
            </g>
          )
        })}

        {/* X ticks + axis label */}
        {xTicks(tToIX, IH, MI)}
        <text x={MI.left + iInnerW / 2} y={MI.top + IH + 30} fill="#8b949e" fontSize={9} textAnchor="middle">Zeit (ms)</text>

        {/* I_stim reference lines (dashed, per neuron) */}
        {electrodeNeuronIds.map(nId => {
          const n = neurons.find(nn => nn.id === nId)
          if (!n) return null
          const iStim = (n.params as LIFParams | HHParams).I_stim
          const y = iToY(iStim, iMin, iMax, IH)
          const firstTrace = traces.find(tr => tr.neuronId === nId)
          const color = firstTrace ? COMPARTMENT_COLORS[firstTrace.compartment as Compartment] : '#8b949e'
          return (
            <line key={`stim-${nId}`}
              x1={MI.left} y1={y} x2={MI.left + iInnerW} y2={y}
              stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
          )
        })}

        {/* Synaptic current traces */}
        {currentTraces.map(ct => {
          const pts = ct.points
            .filter(([t]) => t >= dispStart && t <= dispEnd)
            .map(([t, I]) => `${tToIX(t).toFixed(1)},${iToY(I, iMin, iMax, IH).toFixed(1)}`)
            .join(' ')
          if (!pts) return null
          const firstTrace = traces.find(tr => tr.neuronId === ct.neuronId)
          const color = firstTrace ? COMPARTMENT_COLORS[firstTrace.compartment as Compartment] : '#8b949e'
          return (
            <polyline key={ct.neuronId}
              points={pts} fill="none"
              stroke={color} strokeWidth={1.5} />
          )
        })}
      </svg>

      {/* ── Legend ── */}
      <div className={styles.legend}>
        {electrodeNeuronIds.map(nId => {
          const firstTrace = traces.find(tr => tr.neuronId === nId)
          if (!firstTrace) return null
          const color = COMPARTMENT_COLORS[firstTrace.compartment as Compartment]
          const n = neurons.find(nn => nn.id === nId)
          const iStim = n ? (n.params as LIFParams | HHParams).I_stim : '?'
          return (
            <span key={nId} className={styles.legendItem}>
              <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} /></svg>
              {nId} · I_stim = {iStim} nA
            </span>
          )
        })}
        <span className={styles.legendHint}>— — Injektionsstrom · —— Synaptischer Strom</span>
      </div>
    </dialog>
  )
}
