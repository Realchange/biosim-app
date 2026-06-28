import { useEffect, useRef, useState, useCallback } from 'react'
import { useNetworkStore } from '../../store/networkStore'
import { COMPARTMENT_COLORS } from '../../types'
import type { Compartment, LIFParams, HHParams, STGParams } from '../../types'
import type { VoltageTrace } from '../../store/networkStore'
import { stimulusPoints } from '../../utils/stimulus'
import { autoScaleVoltage, FIXED_V_RANGE } from '../../utils/scale'
import { HHParamsPanel } from '../ParameterPanel/HHParams'
import { LIFParamsPanel } from '../ParameterPanel/LIFParams'
import { STGParamsPanel } from '../ParameterPanel/STGParams'
import styles from './GraphModal.module.css'

interface Props {
  // The neuron whose detail view is open, or null when closed.
  neuronId: string | null
  onClose: () => void
}

// ── layout constants ─────────────────────────────────────────────────────────
const MV   = { top: 12, right: 16, bottom: 36, left: 42 }
const MI   = { top: 12, right: 16, bottom: 36, left: 42 }
const VH = 240   // voltage panel inner height (px, scales with SVG viewBox)
const IH = 140   // current panel inner height

function computeAutoScale(traces: VoltageTrace[]): [number, number] {
  const [lo, hi] = autoScaleVoltage(traces.flatMap(tr => tr.points.map(([, v]) => v)))
  return [Math.round(lo), Math.round(hi)]
}

function vToY(v: number, vMin: number, vMax: number, h: number): number {
  return MV.top + h * (1 - (v - vMin) / Math.max(vMax - vMin, 1))
}

function iToY(I: number, iMin: number, iMax: number, h: number): number {
  const span = Math.max(iMax - iMin, 0.01)
  return MI.top + h * (1 - (I - iMin) / span)
}

export function GraphModal({ neuronId, onClose }: Props) {
  const { traces: allTraces, currentTraces: allCurrentTraces, neurons, simulationParams, sim, graphWindowMs } = useNetworkStore()
  const open = neuronId != null
  // Show only the selected neuron's traces — each neuron has its own detail view.
  const traces = allTraces.filter(t => t.neuronId === neuronId)
  const currentTraces = allCurrentTraces.filter(t => t.neuronId === neuronId)
  const neuron = neurons.find(n => n.id === neuronId)
  const neuronLabel = neuronId
    ? (neuron?.label ?? `Neuron ${neurons.findIndex(n => n.id === neuronId) + 1}`)
    : ''
  const dialogRef = useRef<HTMLDialogElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const panRef = useRef<{ x: number; start: number; end: number } | null>(null)
  const [zoom, setZoom] = useState<[number, number] | null>(null)
  const [vAxisOverride, setVAxisOverride] = useState<[number, number] | null>(null)
  const [panning, setPanning] = useState(false)

  // Default to the fixed physiological window; the user rescales on demand
  // (typing values, clicking Auto, or zoom/pan).
  const [vMin, vMax] = vAxisOverride ?? FIXED_V_RANGE

  // Inputs: local string state so user can type freely
  const [vMinStr, setVMinStr] = useState('')
  const [vMaxStr, setVMaxStr] = useState('')

  // Open / close the native dialog
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      setZoom(null)
      setVAxisOverride(null)
      setVMinStr(String(FIXED_V_RANGE[0]))
      setVMaxStr(String(FIXED_V_RANGE[1]))
    }
    if (!open && d.open) d.close()
  }, [open])

  // "Auto" = fit the Y-axis to the actual data, on demand (a user interaction).
  const handleAutoScale = () => {
    const fitted = computeAutoScale(traces)
    setVAxisOverride(fitted)
    setVMinStr(String(fitted[0]))
    setVMaxStr(String(fitted[1]))
  }

  const applyVAxis = () => {
    const lo = parseFloat(vMinStr)
    const hi = parseFloat(vMaxStr)
    if (!isNaN(lo) && !isNaN(hi) && hi > lo) setVAxisOverride([lo, hi])
  }

  // Close on Escape (native dialog already does this, but keep state in sync)
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    const handler = () => onClose()
    d.addEventListener('close', handler)
    return () => d.removeEventListener('close', handler)
  }, [onClose])

  // Derive time range from traces (loop, not spread — the buffer can hold thousands
  // of points and this recomputes on every live frame).
  let tTotal = simulationParams.length, tDataMin = 0
  {
    let mn = Infinity, mx = -Infinity
    for (const tr of traces) for (const p of tr.points) { if (p[0] < mn) mn = p[0]; if (p[0] > mx) mx = p[0] }
    if (mx > -Infinity) { tTotal = mx; tDataMin = mn }
  }

  // Default time window. In the continuous Live mode this acts like an oscilloscope:
  //  - with a repeating stimulus (stimPeriod): lock onto ONE period (so a single
  //    action potential is shown standing still and morphs as you change parameters);
  //  - otherwise: a scrolling window ending at the current time.
  // Stopped/fixed run: show the whole recorded range.
  const stimPeriod = (neuron?.params as { stimPeriod?: number } | undefined)?.stimPeriod ?? 0
  const scope = sim.live && sim.running && stimPeriod > 0 && tTotal > stimPeriod
  let defStart = tDataMin, defEnd = tTotal
  if (sim.live && sim.running) {
    if (scope) {
      const k = Math.floor(sim.t / stimPeriod)        // last COMPLETE period: [(k−1)p, kp]
      defStart = Math.max(tDataMin, (k - 1) * stimPeriod)
      defEnd = k * stimPeriod
    } else {
      defEnd = sim.t
      defStart = Math.max(0, sim.t - graphWindowMs)
    }
  }
  // Zoom is stored as a RELATIVE fraction [a,b] ⊂ [0,1] of the (possibly live,
  // possibly period-locked) base window — NOT absolute time. So a zoom stays locked
  // to the period/scrolling window as the live simulation advances, instead of
  // pointing at an ever-growing absolute time and squashing the plot.
  const baseSpan = Math.max(defEnd - defStart, 1)
  const dispStart = defStart + (zoom ? zoom[0] : 0) * baseSpan
  const dispEnd = defStart + (zoom ? zoom[1] : 1) * baseSpan
  // Scope mode labels time relative to the period start (0 … period) so the trace
  // truly stands still instead of the numbers running away.
  const tLabelOffset = scope ? defStart : 0

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const [a, b] = zoom ?? [0, 1]
    const span = b - a
    const factor = e.deltaY > 0 ? 1.07 : 0.935        // gentle zoom per wheel tick
    const newSpan = Math.max(0.02, Math.min(1, span * factor))
    const center = (a + b) / 2
    let na = center - newSpan / 2, nb = center + newSpan / 2
    if (na < 0) { nb -= na; na = 0 }
    if (nb > 1) { na -= nb - 1; nb = 1 }
    setZoom(newSpan >= 0.999 ? null : [Math.max(0, na), Math.min(1, nb)])
  }, [zoom])

  // Width is determined via ref after mount — use a fixed wide viewBox instead
  const SVG_W = 760
  const vInnerW = SVG_W - MV.left - MV.right
  const iInnerW = SVG_W - MI.left - MI.right

  // Drag-to-pan within the base window (fraction space; only meaningful when zoomed).
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    panRef.current = { x: e.clientX, start: zoom ? zoom[0] : 0, end: zoom ? zoom[1] : 1 }
    setPanning(true)
  }, [zoom])

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    const pan = panRef.current
    const svg = svgRef.current
    if (!pan || !svg) return
    const rect = svg.getBoundingClientRect()
    const plotPx = rect.width * (vInnerW / SVG_W)   // displayed width of the plot area
    if (plotPx <= 0) return
    const span = pan.end - pan.start
    const dFrac = ((e.clientX - pan.x) / plotPx) * span   // fraction of base window to shift
    let a = pan.start - dFrac, b = pan.end - dFrac
    if (a < 0) { b -= a; a = 0 }
    if (b > 1) { a -= b - 1; b = 1 }
    setZoom([Math.max(0, a), Math.min(1, b)])
  }, [vInnerW])

  const handlePanEnd = useCallback(() => {
    panRef.current = null
    setPanning(false)
  }, [])

  function tToVX(t: number) {
    return MV.left + vInnerW * ((t - dispStart) / Math.max(dispEnd - dispStart, 1))
  }
  function tToIX(t: number) {
    return MI.left + iInnerW * ((t - dispStart) / Math.max(dispEnd - dispStart, 1))
  }

  // Derive current range across all currentTraces (loop, not spread).
  let rawIMax = 0, rawIMin = 0
  for (const ct of currentTraces) for (const p of ct.points) { if (p[1] > rawIMax) rawIMax = p[1]; if (p[1] < rawIMin) rawIMin = p[1] }
  const iStimMax = Math.max(0, ...traces.map(tr => {
    const n = neurons.find(nn => nn.id === tr.neuronId)
    return n ? (n.params as LIFParams | HHParams).I_stim : 0
  }))
  const iMax = Math.max(rawIMax, iStimMax, 1) * 1.2
  const iMin = Math.min(rawIMin, 0) * 1.2 - 0.5

  // X-axis tick helper (shared)
  function xTicks(toX: (t: number) => number, innerH: number, mg: typeof MV) {
    return [0, 0.25, 0.5, 0.75, 1].map(frac => {
      const t = dispStart + (dispEnd - dispStart) * frac
      const x = toX(t)
      return (
        <g key={frac}>
          <line x1={x} y1={mg.top + innerH} x2={x} y2={mg.top + innerH + 4} stroke="#8b949e" strokeWidth={0.5} />
          <text x={x} y={mg.top + innerH + 14} fill="#8b949e" fontSize={9} textAnchor="middle">{Math.round(t - tLabelOffset)}</text>
        </g>
      )
    })
  }

  // Unique electrode neuron IDs (for legend)
  const electrodeNeuronIds = Array.from(new Set(traces.map(tr => tr.neuronId)))

  if (!open) return null

  return (
    <dialog ref={dialogRef} className={styles.dialog}>
      <div className={styles.header}>
        <span className={styles.title}>Messspur — {neuronLabel}</span>
        <span className={styles.hint}>
          {scope ? '🔬 Oszilloskop: eine Reizperiode (Parameter rechts live ändern) · Scroll = Zoom'
                 : 'Scroll zum Zoomen · Ziehen zum Verschieben'}
        </span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
      <div className={styles.graphs} onWheel={handleWheel}
        onMouseMove={handlePanMove} onMouseUp={handlePanEnd} onMouseLeave={handlePanEnd}>

      {/* ── Y-axis controls ── */}
      <div className={styles.axisControls}>
        <label className={styles.axisLabel}>Y-Achse:</label>
        <input className={styles.axisInput} type="number" value={vMinStr}
          onChange={e => setVMinStr(e.target.value)}
          onBlur={applyVAxis} onKeyDown={e => e.key === 'Enter' && applyVAxis()}
          title="Y min (mV)" />
        <span className={styles.axisSep}>–</span>
        <input className={styles.axisInput} type="number" value={vMaxStr}
          onChange={e => setVMaxStr(e.target.value)}
          onBlur={applyVAxis} onKeyDown={e => e.key === 'Enter' && applyVAxis()}
          title="Y max (mV)" />
        <span className={styles.axisUnit}>mV</span>
        <button className={styles.autoBtn} onClick={handleAutoScale}>Auto</button>
      </div>

      {/* ── Voltage panel ── */}
      <div className={styles.panelLabel}>Spannung (mV)</div>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${SVG_W} ${VH + MV.top + MV.bottom}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: 'visible', cursor: panning ? 'grabbing' : 'grab' }}
        onMouseDown={handlePanStart}
      >
        <defs>
          <clipPath id="vClip">
            <rect x={MV.left} y={MV.top} width={vInnerW} height={VH} />
          </clipPath>
        </defs>
        <rect x={MV.left} y={MV.top} width={vInnerW} height={VH} fill="#0d1117" rx={3} />

        {/* Y grid + labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const v = Math.round(vMin + (vMax - vMin) * frac)
          const y = vToY(v, vMin, vMax, VH)
          return (
            <g key={frac}>
              <line x1={MV.left} y1={y} x2={MV.left + vInnerW} y2={y} stroke="#21262d" strokeWidth={0.5} />
              <text x={MV.left - 4} y={y + 4} fill="#8b949e" fontSize={9} textAnchor="end">{v}</text>
            </g>
          )
        })}

        {/* X ticks + axis label */}
        {xTicks(tToVX, VH, MV)}
        <text x={MV.left + vInnerW / 2} y={MV.top + VH + 30} fill="#8b949e" fontSize={9} textAnchor="middle">Zeit (ms)</text>

        {/* Traces — clipped to plot area */}
        <g clipPath="url(#vClip)">
          {traces.map(tr => {
            const pts = tr.points
              .filter(([t]) => t >= dispStart && t <= dispEnd)
              .map(([t, v]) => `${tToVX(t).toFixed(1)},${vToY(v, vMin, vMax, VH).toFixed(1)}`)
              .join(' ')
            if (!pts) return null
            return (
              <polyline key={`${tr.neuronId}-${tr.compartment}`}
                points={pts} fill="none"
                stroke={COMPARTMENT_COLORS[tr.compartment as Compartment]}
                strokeWidth={1.5} />
            )
          })}
        </g>
      </svg>

      {/* ── Current panel ── */}
      <div className={styles.panelLabel}>Strom (nA)</div>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${SVG_W} ${IH + MI.top + MI.bottom}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: panning ? 'grabbing' : 'grab' }}
        onMouseDown={handlePanStart}
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

        {/* Injected stimulus current as a step waveform (dashed, per neuron) */}
        {electrodeNeuronIds.map(nId => {
          const n = neurons.find(nn => nn.id === nId)
          if (!n) return null
          const pts = stimulusPoints(n.params as LIFParams | HHParams, dispStart, dispEnd)
            .map(([t, I]) => `${tToIX(t).toFixed(1)},${iToY(I, iMin, iMax, IH).toFixed(1)}`)
            .join(' ')
          const firstTrace = traces.find(tr => tr.neuronId === nId)
          const color = firstTrace ? COMPARTMENT_COLORS[firstTrace.compartment as Compartment] : '#8b949e'
          return (
            <polyline key={`stim-${nId}`}
              points={pts} fill="none"
              stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
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
      </div>{/* .graphs */}

      {/* ── Parameter sidebar — edit while watching the detail (live) ── */}
      {neuron && (
        <div className={styles.paramSidebar}>
          <div className={styles.sidebarTitle}>Parameter — {neuronLabel}</div>
          {neuron.model === 'hodgkin-huxley'
            ? <HHParamsPanel neuronId={neuron.id} params={neuron.params as HHParams} />
            : neuron.model === 'stg'
            ? <STGParamsPanel neuronId={neuron.id} params={neuron.params as STGParams} />
            : <LIFParamsPanel neuronId={neuron.id} params={neuron.params as LIFParams} />}
        </div>
      )}
      </div>{/* .body */}
    </dialog>
  )
}
