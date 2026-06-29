// src/hypothesis/cli-sweep.ts
// Headless diagnostic: single-parameter sweeps over orders of magnitude under the period-invariant
// phase distance. Tests whether the FIM's sloppiest direction (the abpd→py synapse) is GLOBALLY
// redundant (shape unchanged ×0.001…×1000) or merely small at θ*, with a stiff control (lp.gCaS).
// Run from biosim-app/:   npx tsx src/hypothesis/cli-sweep.ts
import { pyloricPreset } from '../presets/pyloric'
import { paramMapping } from './paramVector'
import { runExperiment, type RunResultWithMeta } from './runner'

const SIM = { durationMs: 8000, dt: 0.05, noise: 0 }
const RANGE: [number, number] = [-3, 3] // log10: ×0.001 … ×1000 of the θ* value
const STEPS = 31
const TAU = 1.0

function report(name: string, results: RunResultWithMeta[]) {
  const pts = [...results].sort((a, b) => (a.meta.amount ?? 0) - (b.meta.amount ?? 0))
  const at = (target: number) => pts.reduce((best, r) => (Math.abs((r.meta.amount ?? 0) - target) < Math.abs((best.meta.amount ?? 0) - target) ? r : best))
  console.log(`\n### ${name}`)
  console.log('  amount   factor     phaseDist  period   shape')
  for (const a of [-3, -2, -1, 0, 1, 2, 3]) {
    const r = at(a)
    const factor = `×10^${(r.meta.amount ?? 0).toFixed(0)}`.padEnd(8)
    const period = r.stats.cyclePeriod == null ? '  none' : `${Math.round(r.stats.cyclePeriod)}ms`.padStart(6)
    console.log(
      `  ${(r.meta.amount ?? 0).toFixed(1).padStart(5)}   ${factor}  ${r.distance.toFixed(2).padStart(8)}   ${period}   ${r.stats.pyloricLikePhase ? '✓' : '✗'}`,
    )
  }
  // Verdict from the CONTINUOUS distance, not the brittle flag (a lone ✗ at distance ≪ τ is a
  // burst-count edge artifact, not a real break).
  const maxDist = Math.max(...pts.map((p) => p.distance))
  const brokeNear = pts.some((p) => Math.abs(p.meta.amount ?? 0) <= 1 && p.distance >= TAU)
  const verdict =
    maxDist < TAU
      ? `REDUNDANT — shape barely moves across the whole range (maxDist=${maxDist.toFixed(2)} < τ).`
      : brokeNear
        ? 'NECESSARY — the rhythm shape breaks already within ×0.1…×10.'
        : `partially constrained — shape eventually shifts (maxDist=${maxDist.toFixed(2)}) but tolerates a wide range.`
  console.log(`  → ${verdict}`)
}

function main() {
  const baseVec = paramMapping.toVector(pyloricPreset)
  // Parameters to sweep come from the command line, e.g. `… cli-sweep.ts lp.gKCa py.gKCa` (H4).
  // With no args, run the default redundancy demo: the FIM's sloppiest direction vs a stiff control.
  const args = process.argv.slice(2)
  let targets: string[]
  if (args.length) {
    targets = args
  } else {
    const synName = baseVec.names.find((nm) => nm.includes('abpd->py'))
    if (!synName) throw new Error('Could not find the abpd→py synapse parameter in the preset.')
    targets = [synName, 'lp.gCaS']
  }

  console.log('\n=== single-parameter redundancy sweeps (phase metric) ===')
  console.log(`range ${RANGE[0]}..${RANGE[1]} (log10), ${STEPS} steps, τ=${TAU}, sim=${SIM.durationMs}ms`)

  for (const param of targets) {
    process.stdout.write(`running ${param} … `)
    const t0 = Date.now()
    const run = runExperiment(pyloricPreset, { kind: 'sweep', param, range: RANGE, steps: STEPS, space: 'log10' }, {
      experimentId: `sweep:${param}`,
      sim: SIM,
      distance: 'phase',
    })
    console.log(`${run.results.length} runs in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    report(param, run.results)
  }
  console.log('')
}

main()
