// cli-h6-recompute.ts
// Re-evaluate the H6 key round (plan 2026-06-28T14-55-59) with the CORRECTED collapse metric
// (fix/collapse-detection, v0.72) and produce a before/after comparison against the stored verdict
// 2026-06-28T17-55-14 — WITHOUT touching any file in results/verdicts/. Outputs go to
// results/h6-recompute/ only.
//
// Faithful reproduction: same code path as the original run (runExperiment + buildDigest), same
// deterministic settings (SIM below, noise off), same period distance, same tau=1. The only thing
// that changed is metrics.ts. slopeNearZero (small-perturbation slope, rhythm intact both before and
// after) is the reproduction ANCHOR: it must match the stored digest. collapsedFraction / maxDistance /
// toleratedRadius / thresholdCrossed legitimately change, because a periodic single-spike point that
// used to score as "collapsed" (period=null, penalty 3) now has a measured period.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pyloricPreset } from '../presets/pyloric'
import { APP_VERSION } from '../version'
import { runExperiment } from './runner'
import { buildDigest } from './llm/digest'
import { summaryStatsOf } from './metrics'
import type { PyloricRole, SummaryStats } from './types'

const SIM = { durationMs: 8000, dt: 0.05, noise: 0 } // identical to cli-run-plan.ts
const PLAN_FILE = 'results/plans/h6-period-control-2026-06-28T14-55-59-326Z.json'
const OLD_VERDICT = 'results/verdicts/h6-period-control-2026-06-28T17-55-14-317Z.json'
const OUT_DIR = 'results/h6-recompute'

const gitSha = () => { try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'unknown' } }
const ROLES = ['ABPD', 'LP', 'PY'] as const

// Per-point classification from the corrected stats (explains WHY collapsedFraction moved).
function classify(stats: SummaryStats, ref: SummaryStats): string {
  const refP = ref.cyclePeriod ?? 1000
  const cp = stats.cellPeriod
  if (!cp) return stats.cyclePeriod == null ? 'lost' : 'oscillating'
  const lost: PyloricRole[] = []
  const tonic: PyloricRole[] = []
  for (const r of ROLES) {
    if ((ref.cellPeriod?.[r] ?? null) == null) continue // ref cell not oscillating
    const p = cp[r]
    if (p == null) lost.push(r)
    else if (p < 0.3 * refP) tonic.push(r)
    else if (p > 3 * refP) lost.push(r)
  }
  if (lost.length === 0 && tonic.length === 0) {
    // Not collapsed. Distinguish single-spike (was flagged before) from multi-spike bursting.
    const spb = stats.spikesPerBurst?.ABPD
    return spb != null && spb < 2.5 ? 'oscillating (single-spike)' : 'oscillating (bursting)'
  }
  const parts: string[] = []
  if (lost.length) parts.push('silent:' + lost.join('+'))
  if (tonic.length) parts.push('tonic:' + tonic.join('+'))
  return parts.join(' ')
}

function main() {
  const sha = gitSha()
  const plan = JSON.parse(readFileSync(PLAN_FILE, 'utf8'))
  const oldVerdict = JSON.parse(readFileSync(OLD_VERDICT, 'utf8'))
  const oldExps: any[] = oldVerdict.digest.experiments

  const reference = summaryStatsOf(pyloricPreset, SIM)
  const items: { manipulation: any; results: any[] }[] = []
  const perPoint: any[] = []

  for (let i = 0; i < plan.experiments.length; i++) {
    const manipulation = plan.experiments[i].manipulation
    const run = runExperiment(pyloricPreset, manipulation, {
      experimentId: `h6-recompute:${i}`, sim: SIM, distance: plan.distance, codeVersion: APP_VERSION, gitSha: sha,
    })
    items.push({ manipulation, results: run.results })

    // Per-point breakdown for the collapse-bearing sweeps/ratio (explanatory).
    if (manipulation.kind === 'sweep' || manipulation.kind === 'ratio') {
      const label = manipulation.kind === 'sweep'
        ? `sweep ${manipulation.param} [${manipulation.range}]`
        : `ratio ${manipulation.up}/${manipulation.down}`
      const breakdown: Record<string, number> = {}
      let nCollapsedNew = 0
      for (const res of run.results) {
        const c = classify(res.stats, reference)
        breakdown[c] = (breakdown[c] ?? 0) + 1
        if (res.collapsed) nCollapsedNew++
      }
      perPoint.push({ experiment: label, nPoints: run.results.length, nCollapsedNew, breakdown })
    }
  }

  const newDigest = buildDigest(plan.hypothesisId, plan.distance, items)

  // Align new experiments to old by label + order, compare metric-by-metric.
  const comparison = newDigest.experiments.map((ne: any, idx: number) => {
    const oe = oldExps[idx]
    const keys = new Set([...Object.keys(ne.metrics ?? {}), ...Object.keys(oe?.metrics ?? {})])
    const metrics: Record<string, { old: number | null; new: number | null; changed: boolean }> = {}
    for (const k of keys) {
      const o = oe?.metrics?.[k] ?? null
      const n = ne.metrics?.[k] ?? null
      const changed = !(o != null && n != null && Math.abs(o - n) < 1e-3) && !(o == null && n == null)
      metrics[k] = { old: o, new: n, changed }
    }
    return { idx, label: ne.label, kindOld: oe?.kind, kindNew: ne.kind, metrics }
  })

  mkdirSync(OUT_DIR, { recursive: true })
  const provenance = {
    generatedBy: 'cli-h6-recompute.ts',
    engineVersion: APP_VERSION,
    gitSha: sha,
    sim: SIM,
    distance: plan.distance,
    tau: 1,
    planFile: PLAN_FILE,
    oldVerdictFile: OLD_VERDICT,
    oldVerdictCodeVersion: oldVerdict.provenance?.codeVersion,
    referenceCyclePeriodMs: reference.cyclePeriod,
    note: 'Corrected collapse metric (v0.72): a periodic single-spike rhythm is no longer counted as collapsed. slopeNearZero is the reproduction anchor and should match the stored digest.',
  }
  writeFileSync(`${OUT_DIR}/h6-recompute-2026-06-28T17-55-14.json`, JSON.stringify({ provenance, comparison, perPoint, newDigest }, null, 2) + '\n')

  // Console table
  console.log(`H6 recompute — plan ${PLAN_FILE}`)
  console.log(`reference cyclePeriod = ${reference.cyclePeriod?.toFixed(0)} ms   (anchor: slopeNearZero must match)\n`)
  const f = (x: number | null) => (x == null ? ' null ' : x.toFixed(3).padStart(6))
  for (const c of comparison) {
    console.log(`[${c.idx}] ${c.label}`)
    for (const k of ['slopeNearZero', 'collapsedFraction', 'maxDistance', 'maxDistanceSmooth', 'toleratedRadius', 'thresholdCrossed', 'knockoutDistance', 'collapsed']) {
      const m = (c.metrics as any)[k]
      if (!m) continue
      const flag = k === 'slopeNearZero' ? (m.changed ? '  <-- ANCHOR MISMATCH' : '  (anchor ok)') : m.changed ? '  <-- changed' : ''
      console.log(`     ${k.padEnd(18)} old=${f(m.old)}  new=${f(m.new)}${flag}`)
    }
  }
  console.log('\nPer-point behaviour (corrected metric):')
  for (const p of perPoint) {
    console.log(`  ${p.experiment}: ${p.nCollapsedNew}/${p.nPoints} collapsed(new)  | ${Object.entries(p.breakdown).map(([k, v]) => `${k}:${v}`).join('  ')}`)
  }
  console.log(`\nWrote ${OUT_DIR}/h6-recompute-2026-06-28T17-55-14.json`)
}

main()
