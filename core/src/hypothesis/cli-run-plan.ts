/* M5 phase 2: execute a reviewed plan. Re-validates against the schema (the guard is
 * enforced at execution, not just proposal), runs each experiment, stores results, builds
 * a digest, and interprets it into a verdict. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pyloricPreset } from '../presets/pyloric'
import { paramMapping } from './paramVector'
import { APP_VERSION } from '../version'
import { HYPOTHESES, getHypothesis } from './registry'
import { runExperiment } from './runner'
import { openStore } from './store'
import { validatePlan, DEFAULT_CAPS } from './llm/schema'
import { buildDigest } from './llm/digest'
import { getInterpreter } from './llm'
import { briefOf } from './llm/types'
import type { HypothesisBrief } from './llm/types'

const SIM = { durationMs: 8000, dt: 0.05, noise: 0 }

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}
function gitSha(): string {
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'unknown' }
}
function resolveHypothesis(id: string): any {
  try { const h = getHypothesis(id); if (h) return h } catch { /* fall through */ }
  try { return Object.values(HYPOTHESES).find((h: any) => h && h.id === id) } catch { /* none */ }
  return undefined
}

async function main() {
  const planFile = process.argv.slice(2).find(a => !a.startsWith('--'))
  const interpreterKind = (arg('--interpreter') as 'noop' | 'anthropic') || 'noop'
  if (!planFile) {
    console.error('Usage: tsx src/hypothesis/cli-run-plan.ts <planFile> [--interpreter noop|anthropic]')
    process.exit(1); return
  }

  const plan = JSON.parse(readFileSync(planFile, 'utf8'))
  const paramNames = paramMapping.toVector(pyloricPreset).names

  const v = validatePlan(plan, paramNames, DEFAULT_CAPS)
  if (!v.ok) {
    console.error('Refusing to run: plan failed validation:')
    for (const e of v.errors) console.error('  - ' + e)
    process.exit(2); return
  }
  console.log(`Running plan for ${plan.hypothesisId}: ${v.estimatedSims} simulations across ${plan.experiments.length} experiments.`)

  const sha = gitSha()
  let store: any = null
  try { store = openStore() } catch (err) { console.warn('store unavailable:', String(err)) }

  const items: { manipulation: any; results: any[] }[] = []
  for (let i = 0; i < plan.experiments.length; i++) {
    const manipulation = plan.experiments[i].manipulation
    const experimentId = `${plan.hypothesisId}:plan:${i}`
    console.log(`  [${i}] ${JSON.stringify(manipulation)}`)
    const run = runExperiment(pyloricPreset, manipulation, { experimentId, sim: SIM, distance: plan.distance, codeVersion: APP_VERSION, gitSha: sha })
    items.push({ manipulation, results: run.results })
    if (store) {
      try {
        store.insertExperiment(
          { id: experimentId, hypothesisId: plan.hypothesisId, basePreset: 'pyloric', manipulation, metrics: ['distance'], simulation: SIM, seed: (manipulation && manipulation.seed) ?? 0, notes: `plan; distance=${plan.distance}` },
          { codeVersion: APP_VERSION, gitSha: sha },
        )
        store.insertRuns(run.results)
      } catch (err) { console.warn(`  store insert failed for ${experimentId}:`, String(err)) }
    }
  }

  const digest = buildDigest(plan.hypothesisId, plan.distance, items)
  console.log('\nDigest:')
  console.log(JSON.stringify(digest, null, 2))

  const catalog = resolveHypothesis(plan.hypothesisId)
  const brief: HypothesisBrief = catalog ? briefOf(catalog) : { id: plan.hypothesisId, statement: plan.summary || plan.hypothesisId }

  const interpreter = await getInterpreter(interpreterKind, { model: arg('--model') })
  const interpretation = await interpreter.interpret({ hypothesis: brief, digest })

  console.log(`\nVerdict (${interpreterKind}): ${interpretation.verdict}`)
  console.log(`Evidence: ${interpretation.evidence}`)
  if (interpretation.refinedClaim) console.log(`Refined claim: ${interpretation.refinedClaim}`)

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  mkdirSync('results/verdicts', { recursive: true })
  const out = `results/verdicts/${plan.hypothesisId}-${ts}.json`
  writeFileSync(out, JSON.stringify({ hypothesisId: plan.hypothesisId, summary: plan.summary, distance: plan.distance, digest, interpretation, provenance: { codeVersion: APP_VERSION, gitSha: sha, interpreter: interpreterKind } }, null, 2))
  console.log(`\nVerdict written to: ${out}`)

  if (store) { try { store.close() } catch { /* ignore */ } }
}

main().catch(err => { console.error(err); process.exit(1) })
