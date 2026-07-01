import type { Compartment } from '@biosim/core'
import type { VoltageTrace } from '../store/networkStore'

// One neuron's measured traces, already grouped and labelled by the caller
// (VoltageGraph builds exactly this from the store).
export interface TraceGroup {
  label: string
  traces: VoltageTrace[]
}

// Fixed compartment order so legends/columns are stable across exports.
const COMP_ORDER: Compartment[] = ['soma', 'dend1', 'dend2', 'dend3']
const compRank = (c: Compartment) => {
  const i = COMP_ORDER.indexOf(c)
  return i < 0 ? COMP_ORDER.length : i
}

// Black-on-white line styles (canvas dash patterns) per compartment, so multiple
// measured compartments stay distinguishable without colour.
const DASH: Record<Compartment, number[]> = {
  soma: [],          // solid
  dend1: [6, 4],     // dashed
  dend2: [2, 3],     // dotted
  dend3: [8, 3, 2, 3], // dash-dot
}

function safeFilename(name: string): string {
  const base = name.trim().replace(/\s+/g, '-').replace(/[^\w.-]/g, '') || 'biosim'
  return base
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Flatten every group's traces into ordered columns: neuron, then compartment.
function columns(groups: TraceGroup[]): { key: string; header: string; group: string; comp: Compartment; points: [number, number][] }[] {
  const cols: { key: string; header: string; group: string; comp: Compartment; points: [number, number][] }[] = []
  for (const g of groups) {
    const sorted = [...g.traces].sort((a, b) => compRank(a.compartment) - compRank(b.compartment))
    for (const tr of sorted) {
      cols.push({
        key: `${tr.neuronId}-${tr.compartment}`,
        header: `${g.label} (${tr.compartment}) [mV]`,
        group: g.label,
        comp: tr.compartment,
        points: tr.points,
      })
    }
  }
  return cols
}

// ── CSV ──────────────────────────────────────────────────────────────────────
// Wide format on a shared, sorted time grid (union of all sample times). Traces
// are appended together so their times normally coincide; the union keeps it
// correct even if electrodes were added mid-run and a column is shorter.
export function exportTracesCSV(groups: TraceGroup[], networkName: string) {
  const cols = columns(groups)
  const times = new Set<number>()
  for (const c of cols) for (const [t] of c.points) times.add(t)
  const grid = Array.from(times).sort((a, b) => a - b)

  // Per-column lookup time → voltage.
  const maps = cols.map(c => {
    const m = new Map<number, number>()
    for (const [t, v] of c.points) m.set(t, v)
    return m
  })

  const lines: string[] = []
  lines.push(['time_ms', ...cols.map(c => `"${c.header}"`)].join(','))
  for (const t of grid) {
    const row = [String(t)]
    for (const m of maps) {
      const v = m.get(t)
      row.push(v === undefined ? '' : String(v))
    }
    lines.push(row.join(','))
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, `${safeFilename(networkName)}-spannungen.csv`)
}

// ── Figure (PNG) ─────────────────────────────────────────────────────────────
// Black-on-white publication-style figure: one stacked coordinate system per
// neuron, the neuron's label above it, voltage traces in black (line style per
// compartment), shared time axis across panels.
export function exportTracesPNG(
  groups: TraceGroup[],
  networkName: string,
  vRange: [number, number],
) {
  if (groups.length === 0) return

  const dpr = 2
  const W = 900
  const PANEL_H = 170
  const GAP = 28
  const M = { top: 28, right: 24, bottom: 30, left: 64 }  // per-panel inner margins
  const TITLE_H = 22
  const PAD = 28                                          // outer figure padding
  const panelTotal = TITLE_H + PANEL_H
  const H = PAD * 2 + groups.length * panelTotal + (groups.length - 1) * GAP

  const canvas = document.createElement('canvas')
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)

  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  const [vMin, vMax] = vRange
  // Shared full-run time axis across all panels.
  let tMax = 0
  for (const g of groups) for (const tr of g.traces) for (const [t] of tr.points) if (t > tMax) tMax = t
  if (tMax <= 0) tMax = 1

  const plotW = W - PAD * 2 - M.left - M.right
  const plotX0 = PAD + M.left

  groups.forEach((g, gi) => {
    const panelTop = PAD + gi * (panelTotal + GAP)
    const plotTop = panelTop + TITLE_H + M.top
    const plotH = PANEL_H - M.top - M.bottom
    const plotBottom = plotTop + plotH

    const tToX = (t: number) => plotX0 + plotW * (t / tMax)
    const vToY = (v: number) => plotTop + plotH * (1 - (v - vMin) / Math.max(vMax - vMin, 1))

    // Neuron label
    ctx.fillStyle = '#000000'
    ctx.font = '600 15px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(g.label, plotX0, panelTop + 15)

    // Axes box
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 1
    ctx.strokeRect(plotX0, plotTop, plotW, plotH)

    // Y ticks (mV) — 0, mid, full
    ctx.font = '11px system-ui, sans-serif'
    ctx.fillStyle = '#000000'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      const v = Math.round(vMin + (vMax - vMin) * frac)
      const y = vToY(v)
      ctx.strokeStyle = frac === 0 || frac === 1 ? '#000000' : '#cccccc'
      ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(plotX0, y); ctx.lineTo(plotX0 + plotW, y); ctx.stroke()
      ctx.fillText(String(v), plotX0 - 6, y)
    }
    // Y axis title
    ctx.save()
    ctx.translate(plotX0 - 44, plotTop + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText('Voltage (mV)', 0, 0)
    ctx.restore()

    // X ticks (ms)
    ctx.textBaseline = 'top'
    ctx.textAlign = 'center'
    ctx.font = '11px system-ui, sans-serif'
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      const t = tMax * frac
      const x = tToX(t)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(x, plotBottom); ctx.lineTo(x, plotBottom + 4); ctx.stroke()
      ctx.fillText(String(Math.round(t)), x, plotBottom + 6)
    }
    // X axis title only under the last panel
    if (gi === groups.length - 1) {
      ctx.font = '12px system-ui, sans-serif'
      ctx.fillText('Time (ms)', plotX0 + plotW / 2, plotBottom + 22)
    }

    // Clip to plot area, draw traces in black with per-compartment dash
    const sorted = [...g.traces].sort((a, b) => compRank(a.compartment) - compRank(b.compartment))
    ctx.save()
    ctx.beginPath(); ctx.rect(plotX0, plotTop, plotW, plotH); ctx.clip()
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 1.2
    for (const tr of sorted) {
      if (tr.points.length < 2) continue
      ctx.setLineDash(DASH[tr.compartment] ?? [])
      ctx.beginPath()
      let started = false
      for (const [t, v] of tr.points) {
        const x = tToX(t), y = vToY(v)
        if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.restore()

    // Per-compartment legend (only when more than soma is measured)
    if (sorted.length > 1) {
      let lx = plotX0 + 4
      const ly = plotTop + 12
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = '10px system-ui, sans-serif'
      for (const tr of sorted) {
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 1.2
        ctx.setLineDash(DASH[tr.compartment] ?? [])
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 22, ly); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#000000'
        ctx.fillText(tr.compartment, lx + 26, ly)
        lx += 26 + ctx.measureText(tr.compartment).width + 16
      }
    }
  })

  canvas.toBlob(blob => {
    if (blob) triggerDownload(blob, `${safeFilename(networkName)}-spannungen.png`)
  }, 'image/png')
}
