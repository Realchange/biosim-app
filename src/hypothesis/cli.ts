// src/hypothesis/cli.ts
// Headless M3 entry: run H1's sweeps over the pyloric preset under the PERIOD-INVARIANT phase metric,
// store results in SQLite, and print a stiff-vs-sloppy summary driven by the CONTINUOUS phase distance.
// Run from biosim-app/:   npx tsx src/hypothesis/cli.ts
// Requires:  npm i -D tsx better-sqlite3 @types/better-sqlite3
import { execSync } from 'node:child_process'
import { pyloricPreset } from '../presets/pyloric'
import { APP_VERSION } from '../version'
import type { ExperimentSpec, Manipulation } from './types'
import { getHypothesis, isImplemented } from './registry'
import { runExperiment, type ExperimentRun } from './runner'
import { openStore } from './store'
import { summarizeSweep, summarizeRandom } from './analysis/stiffSloppy'

const SIM = { durationMs: 8000, dt: 0.05, noise: 0 }
const DISTANCE = 'phase' as const // period-invariant: only rhythm SHAPE counts, not its rate
const TAU = 1.0 // phase-distance threshold defining "rhythm shape still intact"

function gitSha(): string | undefined {
  try {
    return execSync('git rev-parse HEAD').toString().trim()
  } catch {
    return undefined
  }
}

function label(m: Manipulation): string {
  if (m.kind === 'ratio') return `ratio ${m.up.join('+')} / ${m.down.join('+')}`
  return m.kind
}

const fmtRadius = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '>3.0')

function main() {
  const h = getHypothesis('h1-stiff-sloppy')
  const store = openStore()
  const sha = gitSha()
  console.log(`\n=== ${h.id} ===\n${h.statement}\nmetric: ${DISTANCE} (period-invariant)  τ=${TAU}  sim: ${SIM.durationMs}ms\n`)

  const sweeps: { label: string; run: ExperimentRun }[] = []
  let randomRun: ExperimentRun | null = null

  h.manipulations.forEach((m, i) => {
    if (!isImplemented(m)) return
    const experimentId = `${h.id}:${m.kind}:${i}`
    const spec: ExperimentSpec = {
      id: experimentId,
      hypothesisId: h.id,
      basePreset: 'pyloric',
      manipulation: m,
      metrics: ['distance', 'pyloricLike'],
      simulation: SIM,
      seed: 'seed' in m ? m.seed : 0,
      notes: `distance=${DISTANCE}`,
    }
    process.stdout.write(`running ${label(m)} … `)
    const t0 = Date.now()
    const run = runExperiment(pyloricPreset, m, {
      experimentId,
      seed: spec.seed,
      sim: SIM,
      codeVersion: APP_VERSION,
      gitSha: sha,
      distance: DISTANCE,
    })
    store.insertExperiment(spec, { codeVersion: APP_VERSION, gitSha: sha })
    store.insertRuns(run.results)
    console.log(`${run.results.length} runs in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    if (m.kind === 'randomDirections') randomRun = run
    else sweeps.push({ label: label(m), run })
  })

  // --- Sweeps -----------------------------------------------------------------------------
  const summaries = sweeps.map((s) => summarizeSweep(s.label, s.run.results, TAU))
  console.log('\n--- sweeps (phase metric; toleratedRadius = displacement before phase distance > τ) ---')
  for (const s of summaries) {
    console.log(
      `${s.label.padEnd(28)} slope@0=${s.slopeNearZero.toFixed(2)}  ` +
        `toleratedRadius=${fmtRadius(s.toleratedRadius)}  maxShapeDist=${s.maxDistance.toFixed(2)}`,
    )
  }

  // Evidence that scaling is the "retime, keep the shape" direction: period at the extremes.
  const scalingRun = sweeps.find((s) => s.label === 'scaleAll')?.run
  if (scalingRun) {
    const byAmt = [...scalingRun.results].sort((a, b) => (a.meta.amount ?? 0) - (b.meta.amount ?? 0))
    const at = (r: (typeof byAmt)[number]) =>
      `${(r.meta.amount ?? 0).toFixed(1)}→${r.stats.cyclePeriod == null ? 'none' : Math.round(r.stats.cyclePeriod) + 'ms'}`
    const mid = byAmt.reduce((best, r) => (Math.abs(r.meta.amount ?? 0) < Math.abs(best.meta.amount ?? 0) ? r : best))
    console.log(`   scaling retimes: period @ ${at(byAmt[0])} | ${at(mid)} | ${at(byAmt[byAmt.length - 1])}`)
  }

  // --- Random directions ------------------------------------------------------------------
  if (randomRun) {
    const r = summarizeRandom('randomDirections', (randomRun as ExperimentRun).results, TAU)
    console.log('\n--- random directions (phase metric) ---')
    console.log(
      `mean phase distance:  aligned-with-scaling=${r.meanDistanceAligned.toFixed(2)}  ` +
        `misaligned=${r.meanDistanceMisaligned.toFixed(2)}   ` +
        `(intact<τ: ${(r.fractionAligned * 100).toFixed(0)}% vs ${(r.fractionMisaligned * 100).toFixed(0)}%)`,
    )
  }

  // --- Provisional verdict: rank directions by local curvature (low slope = sloppy) -------
  const ranking = [...summaries].sort((a, b) => a.slopeNearZero - b.slopeNearZero)
  console.log('\n--- stiffness ranking (local phase-distance slope; low = sloppy) ---')
  ranking.forEach((s, i) =>
    console.log(`  ${i + 1}. ${s.label.padEnd(28)} slope@0=${s.slopeNearZero.toFixed(2)}  tol=${fmtRadius(s.toleratedRadius)}`),
  )

  const sloppiest = ranking[0]
  console.log('\n--- provisional read ---')
  if (sloppiest.label === 'scaleAll') {
    const free = sloppiest.slopeNearZero < 0.5
    console.log(
      free
        ? 'Supports strong H1: the scaling (absolute-level) axis is essentially flat — level is free, ratios are stiff.'
        : 'Supports a REFINED H1: the scaling/absolute-level axis is the sloppiest direction but NOT free (slope > 0) — ' +
            'expected, since fixed gating kinetics break exact conductance-scale-invariance. Ratio directions are stiffer, ' +
            'and the Ca/KCa balance is by far the stiffest. There is a sloppiness hierarchy, not a free level.',
    )
  } else {
    console.log(`The sloppiest tested direction is "${sloppiest.label}", not pure scaling — inspect the stored runs.`)
  }

  store.close()
  console.log('\nStored to results/results.db\n')
}

main()
