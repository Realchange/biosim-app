// src/hypothesis/cli-fim.ts
// Headless M4 entry: Fisher-Information / Hessian eigen-analysis of the rhythm-shape cost at θ*.
// Builds the Jacobian once, then analyses two FIMs from it — the FULL observable set (harmonics +
// spikes-per-cycle) and a TIMING-ONLY set (harmonics, rates dropped) — to separate whether the
// scaling axis's stiffness comes from spike COUNT or from spike TIMING. Run from biosim-app/:
//     npx tsx src/hypothesis/cli-fim.ts
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { pyloricPreset } from '../presets/pyloric'
import { APP_VERSION } from '../version'
import { buildJacobian, fimEigen, topContributors } from './analysis/fim'
import { parameterStiffness, groupSummary } from './analysis/stiffnessByGroup'

const SIM = { durationMs: 8000, dt: 0.05, noise: 0 }
const EPS = 0.05
const HARMONICS = 6

const log10 = (x: number) => (x > 0 ? Math.log10(x) : -Infinity)
const gitSha = () => {
  try {
    return execSync('git rev-parse HEAD').toString().trim()
  } catch {
    return undefined
  }
}

function main() {
  console.log('\n=== H1 — Fisher-Information eigen-analysis at θ* ===')
  console.log(`metric: circular-harmonic phase observables (period-invariant)  ε=${EPS}  H=${HARMONICS}  sim=${SIM.durationMs}ms`)
  process.stdout.write('building Jacobian (62 sims) … ')
  const t0 = Date.now()
  const jac = buildJacobian(pyloricPreset, { sim: SIM, eps: EPS, harmonics: HARMONICS })
  const full = fimEigen(jac.J, jac.paramNames)
  const timingRows = jac.obsNames.map((nm, i) => ({ nm, i })).filter((o) => !o.nm.endsWith('.rate')).map((o) => o.i)
  const timing = fimEigen(jac.J, jac.paramNames, timingRows)
  const coarseRows = jac.obsNames.map((nm, i) => ({ nm, i })).filter((o) => /\.(cos|sin)1$/.test(o.nm)).map((o) => o.i)
  const coarse = fimEigen(jac.J, jac.paramNames, coarseRows)
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`)

  const n = full.eigenvalues.length

  // --- Eigenvalue spectrum (full observable set) ----------------------------------------
  console.log('--- eigenvalue spectrum (full): log10(λ), stiff → sloppy ---')
  const logs = full.eigenvalues.map((v) => (Number.isFinite(log10(v)) ? log10(v).toFixed(2) : '-inf'))
  for (let i = 0; i < n; i += 8) console.log('  ' + logs.slice(i, i + 8).join('  '))
  console.log(`\nλmax/λmin = ${full.conditionNumber.toExponential(2)}  (${full.decades.toFixed(1)} decades)`)

  // --- Scaling axis: full vs timing-only ------------------------------------------------
  const row = (label: string, f: typeof full) =>
    `  ${label.padEnd(12)} percentile=${(f.scaling.percentile * 100).toFixed(0)}%  ` +
    `log10(sᵀgs)=${log10(f.scaling.rayleigh).toFixed(2)}  ` +
    `overlap sloppy-half=${(f.scaling.overlapSloppyHalf * 100).toFixed(0)}%  |cos|sloppiest=${f.scaling.cosSloppiest.toFixed(2)}`
  console.log('\n--- scaling axis (1,…,1) in the spectrum: full vs timing-only ---')
  console.log(row('full', full))
  console.log(row('timing-only', timing))
  console.log('  (full includes spikes-per-cycle; timing-only = phase harmonics, so rate changes are removed)')

  // --- Resolution check: coarse (h=1) vs fine (all harmonics), per-observable curvature ---
  // NB: percentile is NOT comparable across these — the coarse FIM is low-rank (≤ #coarse observables),
  // so its many zero eigenvalues sit below the scaling curvature and inflate its percentile. The fair
  // comparison is curvature per observable.
  const coarsePO = coarse.scaling.rayleigh / Math.max(coarseRows.length, 1)
  const finePO = timing.scaling.rayleigh / Math.max(timingRows.length, 1)
  console.log('\n--- scaling axis: coarse (h=1, gross phase) vs fine (all harmonics), curvature per observable ---')
  console.log(`  coarse: ${coarsePO.toExponential(2)} /obs (${coarseRows.length} obs)    fine: ${finePO.toExponential(2)} /obs (${timingRows.length} obs)`)
  console.log(
    finePO > 1.5 * coarsePO
      ? `  → scaling perturbs FINE timing ~${(finePO / coarsePO).toFixed(1)}× more than the gross pattern (per observable): it largely preserves the gross triphasic structure while reshaping fine within-cycle timing — reconciling M3's tolerant coarse sweep with M4's constrained fine FIM.`
      : '  → scaling affects coarse and fine structure comparably per observable.',
  )

  // --- Eigenvector composition (full) ---------------------------------------------------
  const fmt = (c: { name: string; weight: number }[]) => c.map((x) => `${x.weight >= 0 ? '+' : ''}${x.weight.toFixed(2)}·${x.name}`).join('  ')
  console.log('\n--- stiffest eigenvector (the most necessary combination) ---')
  console.log('  ' + fmt(topContributors(full.eigenvectors[0], full.paramNames, 6)))
  console.log('--- sloppiest eigenvector (the most dispensable combination) ---')
  console.log('  ' + fmt(topContributors(full.eigenvectors[n - 1], full.paramNames, 6)))

  // --- H2: synaptic vs intrinsic stiffness (FIM diagonal √g_ii) -------------------------
  const stiff = parameterStiffness(jac.paramNames, full.diagonal)
  const tag = (gr: 'synaptic' | 'intrinsic') => (gr === 'synaptic' ? 'syn' : 'int')
  console.log('\n--- per-parameter stiffness √g_ii (top/bottom 6) ---')
  console.log('  stiffest:  ' + stiff.slice(0, 6).map((p) => `${p.stiffness.toExponential(1)}·${p.name}[${tag(p.group)}]`).join('  '))
  console.log('  sloppiest: ' + stiff.slice(-6).map((p) => `${p.stiffness.toExponential(1)}·${p.name}[${tag(p.group)}]`).join('  '))
  const synG = groupSummary(stiff, 'synaptic')
  const intG = groupSummary(stiff, 'intrinsic')
  console.log('\n--- H2: synaptic vs intrinsic (geometric-mean single-axis stiffness) ---')
  console.log(`  intrinsic (n=${intG.n}): geomean=${intG.geomean.toExponential(1)}  median=${intG.median.toExponential(1)}`)
  console.log(`  synaptic  (n=${synG.n}): geomean=${synG.geomean.toExponential(1)}  median=${synG.median.toExponential(1)}`)
  console.log(
    intG.geomean > 2 * synG.geomean
      ? `  → intrinsic conductances are ~${(intG.geomean / synG.geomean).toFixed(1)}× stiffer than synaptic on average: the rhythm shape is set mainly by intrinsic currents (consistent with Marder-lab findings).`
      : intG.geomean * 2 < synG.geomean
        ? `  → synaptic conductances are ~${(synG.geomean / intG.geomean).toFixed(1)}× stiffer than intrinsic on average.`
        : '  → synaptic and intrinsic single-axis stiffness are comparable here.',
  )

  // --- Read -----------------------------------------------------------------------------
  console.log('\n--- read ---')
  console.log(
    `Scaling sits at the ${(full.scaling.percentile * 100).toFixed(0)}th curvature percentile under the full metric ` +
      `and the ${(timing.scaling.percentile * 100).toFixed(0)}th under timing-only. ` +
      (timing.scaling.percentile < full.scaling.percentile - 0.15
        ? "A large drop means much of scaling's stiffness was spike-COUNT (excitability); the timing pattern is comparatively better preserved."
        : 'Little change means scaling distorts spike TIMING too, not just counts — absolute level is genuinely constrained.'),
  )

  // --- Persist --------------------------------------------------------------------------
  const sha = gitSha()
  mkdirSync('results', { recursive: true })
  const path = `results/fim-${(sha ?? 'nogit').slice(0, 8)}.json`
  writeFileSync(
    path,
    JSON.stringify(
      {
        codeVersion: APP_VERSION,
        gitSha: sha,
        sim: SIM,
        eps: EPS,
        harmonics: HARMONICS,
        full: { eigenvalues: full.eigenvalues, conditionNumber: full.conditionNumber, scaling: full.scaling },
        timingOnly: { scaling: timing.scaling },
        coarse: { scaling: coarse.scaling },
        h2: { intrinsic: intG, synaptic: synG },
        parameterStiffness: stiff,
        stiffest: topContributors(full.eigenvectors[0], full.paramNames, 10),
        sloppiest: topContributors(full.eigenvectors[n - 1], full.paramNames, 10),
      },
      null,
      2,
    ),
  )
  console.log(`\nStored to ${path}\n`)
}

main()
