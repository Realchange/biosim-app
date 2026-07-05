// src/hypothesis/cli-export-trace.ts
// Export the three pyloric cells' voltage traces as CSV for the static reader page
// under docs/. Two cases make the H6 contrast visible ("sets the tempo" vs "chokes
// the rhythm"): the intact reference rhythm, and a collapsed rhythm (reduced gKd).
//
// Consumes ONLY the pure engine (via hypothesis/sim.ts) and the reference preset and
// paramVector convention used by the H6 experiments — no number is set by hand, noise
// is off (deterministic geometry/reference runs), and provenance (version + git sha)
// is written to the CSV header.
//
// Usage (run from biosim-app/core, or with node --import tsx):
//   npx tsx src/hypothesis/cli-export-trace.ts --out docs/data/traces/reference.csv
//   npx tsx src/hypothesis/cli-export-trace.ts --collapse abpd.gKd --logfactor -2.0 \
//        --out docs/data/traces/collapsed.csv --meta
//
// The collapse shifts exactly ONE parameter in log10-conductance space (paramVector
// convention); the rest stays reference. abpd.gKd in the reduction direction is the
// collapse documented in the H6 verdict; empirically it collapses (oscillation lost /
// pacemaker goes tonic) at logfactor ≲ -1.5, so the default is -2.0.
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync, realpathSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Network } from '../types'
import { pyloricPreset } from '../presets/pyloric'
import { APP_VERSION } from '../version'
import { paramMapping } from './paramVector'
import { runVoltageTraces } from './sim'
import { summaryStatsFromTraces } from './metrics'

// Deterministic run settings, matching the H6/M8 experiments (dt=0.05, noise off).
const DT = 0.05
const DURATION_MS = 3000 // three to four cycles, as in the existing reference figure
const BURN_IN_MS = 3000 // Prinz/Marder settling time discarded before t=0 (start on the limit cycle)
const SAMPLE_MS = 2 // web resolution: ~1 point / 2 ms => ~1500 rows
const DEFAULT_COLLAPSE_LOGFACTOR = -2.0 // reduction that reliably collapses abpd.gKd (onset ≈ -1.5)

const CELLS = ['abpd', 'lp', 'py'] as const

const gitSha = () => {
  try { return execSync('git rev-parse HEAD').toString().trim() } catch { return undefined }
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const hasFlag = (flag: string) => process.argv.includes(flag)

// Shift exactly one parameter in log10-conductance space (paramVector convention),
// leaving every other parameter at its reference value.
function applyCollapse(base: Network, name: string, logfactor: number): Network {
  const v = paramMapping.toVector(base, { space: 'log10' })
  const i = v.names.indexOf(name)
  if (i < 0) {
    throw new Error(`--collapse parameter "${name}" not found. Available: ${v.names.join(', ')}`)
  }
  v.values[i] += logfactor
  return paramMapping.toNetwork(base, v)
}

// Spike-preserving downsample: for each SAMPLE_MS window keep, per cell, the sample of
// largest |v| (peak-hold), so spikes are never dropped the way naive stride sampling can.
// Rows share one nominal window time so the three columns stay aligned.
interface Row { t: number; v: Record<string, number> }
function downsample(time: number[], voltages: Record<string, number[]>): Row[] {
  const rows: Row[] = []
  let curWin = -1
  let best: Record<string, number> | null = null
  const flush = () => { if (best) rows.push({ t: curWin * SAMPLE_MS, v: best }) }
  for (let i = 0; i < time.length; i++) {
    const tr = time[i] - BURN_IN_MS
    if (tr < 0) continue // discard settling transient
    if (tr > DURATION_MS) break
    const win = Math.floor(tr / SAMPLE_MS)
    if (win !== curWin) {
      flush()
      curWin = win
      best = {}
      for (const id of CELLS) best[id] = voltages[id][i]
    } else if (best) {
      for (const id of CELLS) {
        const v = voltages[id][i]
        if (Math.abs(v) > Math.abs(best[id])) best[id] = v
      }
    }
  }
  flush()
  return rows
}

const fmtV = (v: number) => (Object.is(v, -0) ? 0 : Number(v.toFixed(3))).toString()

export interface TraceOptions {
  collapse?: string // parameter name to shift (e.g. 'abpd.gKd'); omit for the intact reference
  logfactor?: number // log10-conductance shift for the collapse (default DEFAULT_COLLAPSE_LOGFACTOR)
  gitSha?: string // provenance; omit to leave 'nogit' in the header
}

export interface TraceResult {
  csv: string
  metaJson: string
  header: string[]
  rows: Row[]
  meta: Record<string, unknown>
  cyclePeriodMs: number | null
  oscillationLost: boolean
}

// Pure builder: runs the deterministic simulation and returns the CSV + meta strings.
// No file I/O and no process.argv — so it is directly unit-testable.
export function buildTrace(opts: TraceOptions = {}): TraceResult {
  const collapseName = opts.collapse
  const collapsed = collapseName !== undefined
  const logfactor = collapsed ? (opts.logfactor ?? DEFAULT_COLLAPSE_LOGFACTOR) : undefined
  if (collapsed && !Number.isFinite(logfactor)) {
    throw new Error(`logfactor must be a finite number (got ${logfactor})`)
  }

  const net = collapsed ? applyCollapse(pyloricPreset, collapseName!, logfactor!) : pyloricPreset

  // Run burn-in + measured window in one deterministic pass; the downsampler discards the burn-in.
  const tr = runVoltageTraces(net, { durationMs: BURN_IN_MS + DURATION_MS, dt: DT, noise: 0 })
  const rows = downsample(tr.time, tr.voltages)

  // Honest collapse status from the real rhythm metric (period undefined = oscillation lost).
  const stats = summaryStatsFromTraces(tr.spikeTimes, { burnInMs: BURN_IN_MS })
  const oscillationLost = stats.cyclePeriod == null
  const sha = opts.gitSha

  const header: string[] = [
    `# BIOSIM pyloric voltage traces (${collapsed ? 'collapsed' : 'reference'})`,
    `# version=${APP_VERSION}`,
    `# gitSha=${sha ?? 'nogit'}`,
    '# noise=off',
    `# durationMs=${DURATION_MS} dtSimMs=${DT} burnInMs=${BURN_IN_MS} sampleMs=${SAMPLE_MS}`,
  ]
  if (collapsed) {
    header.push(`# collapse=${collapseName} logfactor=${logfactor}`)
    header.push(`# collapsed=${oscillationLost}`)
  }
  header.push('t_ms,v_abpd,v_lp,v_py')

  const body = rows.map(r => `${r.t},${fmtV(r.v.abpd)},${fmtV(r.v.lp)},${fmtV(r.v.py)}`)
  const csv = header.join('\n') + '\n' + body.join('\n') + '\n'

  const meta: Record<string, unknown> = {
    mode: collapsed ? 'collapsed' : 'reference',
    durationMs: DURATION_MS,
    dtSampledMs: SAMPLE_MS,
    dtSimMs: DT,
    burnInMs: BURN_IN_MS,
    noise: 'off',
    nRows: rows.length,
    version: APP_VERSION,
    gitSha: sha,
    cyclePeriodMs: stats.cyclePeriod,
    ...(collapsed ? { collapse: { param: collapseName, logfactor, collapsed: oscillationLost } } : {}),
  }

  return { csv, metaJson: JSON.stringify(meta, null, 2) + '\n', header, rows, meta, cyclePeriodMs: stats.cyclePeriod, oscillationLost }
}

function main() {
  const out = arg('--out')
  if (!out) {
    console.error('error: --out <path> is required (e.g. --out docs/data/traces/reference.csv)')
    process.exit(1)
  }
  const logfactorRaw = arg('--logfactor')
  let result: TraceResult
  try {
    result = buildTrace({
      collapse: arg('--collapse'),
      logfactor: logfactorRaw !== undefined ? Number(logfactorRaw) : undefined,
      gitSha: gitSha(),
    })
  } catch (e) {
    console.error(`error: ${(e as Error).message}`)
    process.exit(1)
    return
  }

  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, result.csv)
  console.log(`Wrote ${result.rows.length} rows to ${out}`)
  console.log(`  mode=${result.meta.mode}`)
  console.log(`  cyclePeriod=${result.cyclePeriodMs == null ? 'null (oscillation lost)' : result.cyclePeriodMs.toFixed(0) + ' ms'}`)

  if (hasFlag('--meta')) {
    const metaPath = out.replace(/\.csv$/i, '') + '.meta.json'
    writeFileSync(metaPath, result.metaJson)
    console.log(`  meta → ${metaPath}`)
  }
}

// Run main() only when invoked directly as a script (so importing for tests is side-effect-free).
function isDirectRun(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try { return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url)) } catch { return false }
}
if (isDirectRun()) main()
