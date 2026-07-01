// src/hypothesis/cli-period-sensitivity.ts
// M8 — Period-sensitivity (gradient) analysis at θ*. Answers the open question from the H6 cycle-period
// study: is cycle-period control distributed or dominated by a single conductance axis?
// Computes b_i = ∂log10(T)/∂log10(g_i) by central differences, then reports the signed gradient,
// how many conductances carry 50%/90% of it, and the participation ratio. Run from biosim-app/:
//     npx tsx src/hypothesis/cli-period-sensitivity.ts
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { pyloricPreset } from '../presets/pyloric'
import { APP_VERSION } from '../version'
import { periodGradient } from './analysis/periodSensitivity'

const SIM = { durationMs: 8000, dt: 0.05, noise: 0 }
const EPS = 0.05

const gitSha = () => {
  try { return execSync('git rev-parse HEAD').toString().trim() } catch { return undefined }
}

function main() {
  console.log('\n=== M8 — Period-sensitivity gradient at θ* ===')
  console.log(`target: log10(cycle period)   ε=${EPS} (±${((10 ** EPS - 1) * 100).toFixed(0)}%)   sim=${SIM.durationMs}ms`)
  process.stdout.write('computing period gradient (2·n sims) … ')
  const t0 = Date.now()
  const res = periodGradient(pyloricPreset, { sim: SIM, eps: EPS })
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`)

  console.log(`reference period T* = ${res.referencePeriod?.toFixed(1)} ms   (n = ${res.n} conductances)\n`)

  // --- Signed gradient, strongest first --------------------------------------------------
  const fmt = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(3)
  console.log('--- period gradient  ∂log10(T)/∂log10(g), strongest |slope| first ---')
  console.log('  (positive = increasing this conductance LENGTHENS the period; negative = shortens)')
  for (const c of res.gradient.slice(0, 12)) {
    const flag = c.collapsedAtStep ? '  ⚠ collapsed at step (unreliable)' : ''
    const bar = '█'.repeat(Math.round(c.absShare * 40))
    console.log(`  ${c.name.padEnd(12)} ${fmt(c.slope).padStart(8)}  ${(c.absShare * 100).toFixed(1).padStart(5)}%  ${bar}${flag}`)
  }

  // --- Concentration diagnostics ---------------------------------------------------------
  console.log('\n--- how distributed is period control? ---')
  console.log(`  gradient norm: L1=${res.gradientNormL1.toFixed(3)}  L2=${res.gradientNormL2.toFixed(3)}`)
  console.log(`  conductances carrying 50% of the gradient (L1): ${res.nForHalf} of ${res.n}`)
  console.log(`  conductances carrying 90% of the gradient (L1): ${res.nForNinety} of ${res.n}`)
  console.log(`  participation ratio PR = ${res.participationRatio.toFixed(2)}  (1 = one axis dominates, ${res.n} = perfectly uniform)`)
  console.log(`  participation fraction PR/n = ${(res.participationFraction * 100).toFixed(1)}%`)
  if (res.anyCollapsed) {
    const bad = res.gradient.filter((c) => c.collapsedAtStep).map((c) => c.name)
    console.log(`  ⚠ ${bad.length} component(s) flagged (rhythm collapsed at the displacement): ${bad.join(', ')}`)
  }

  // --- Read ------------------------------------------------------------------------------
  console.log('\n--- read ---')
  const topName = res.gradient[0]?.name
  const topShare = res.gradient[0]?.absShare ?? 0
  const distributed = res.participationFraction > 0.15 || res.nForHalf >= 3
  console.log(
    distributed
      ? `Period control is DISTRIBUTED: the strongest single axis (${topName}) carries only ${(topShare * 100).toFixed(0)}% of the gradient, ` +
          `and ${res.nForHalf} conductances are needed for half of it (PR=${res.participationRatio.toFixed(1)} of ${res.n}). ` +
          `This quantifies the H6 round-3 finding — no single conductance is the pacemaker of period; cycle period is set jointly.`
      : `Period control is CONCENTRATED on ${topName} (${(topShare * 100).toFixed(0)}% of the gradient; PR=${res.participationRatio.toFixed(1)}). ` +
          `A single axis dominates the local period gradient.`,
  )

  // --- Persist ---------------------------------------------------------------------------
  const sha = gitSha()
  mkdirSync('results', { recursive: true })
  const path = `results/period-sensitivity-${(sha ?? 'nogit').slice(0, 8)}.json`
  // `res` already carries `eps`; the spread provides it, so no explicit `eps: EPS` (which
  // the spread would overwrite anyway — the written value is unchanged).
  writeFileSync(path, JSON.stringify({ codeVersion: APP_VERSION, gitSha: sha, sim: SIM, ...res }, null, 2))
  console.log(`\nStored to ${path}\n`)
}

main()
