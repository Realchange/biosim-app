/* M5 phase 1 (approval gate): propose an experiment plan and write it for review.
 * Nothing is executed here. Inspect (and optionally edit) the JSON, then run cli-run-plan. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { pyloricPreset } from '../presets/pyloric'
import { paramMapping } from './paramVector'
import { HYPOTHESES, getHypothesis } from './registry'
import { getTransformer } from './llm'
import { validatePlan, DEFAULT_CAPS } from './llm/schema'
import { priorFromVerdictFile } from './llm/digest'
import { briefOf } from './llm/types'
import type { HypothesisBrief } from './llm/types'

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}
function resolveHypothesis(id: string): any {
  try { const h = getHypothesis(id); if (h) return h } catch { /* fall through */ }
  try { return Object.values(HYPOTHESES).find((h: any) => h && h.id === id) } catch { /* none */ }
  return undefined
}

async function main() {
  const flagValues = new Set<string>()
  for (const f of ['--transformer', '--hypothesis-file', '--prior', '--model']) {
    const v = arg(f); if (v) flagValues.add(v)
  }
  const positional = process.argv.slice(2).filter(a => !a.startsWith('--') && !flagValues.has(a))
  const hypothesisId = positional[0]
  const transformerKind = (arg('--transformer') as 'noop' | 'anthropic') || 'noop'
  const hypothesisFile = arg('--hypothesis-file')
  const priorFile = arg('--prior')

  if (!hypothesisId && !hypothesisFile) {
    console.error('Usage: tsx src/hypothesis/cli-propose.ts <hypothesisId> [--transformer noop|anthropic] [--hypothesis-file f.json] [--prior digest.json]')
    process.exit(1)
  }

  let brief: HypothesisBrief
  let catalogManipulations: any[] | undefined
  const catalog = hypothesisId ? resolveHypothesis(hypothesisId) : undefined
  if (hypothesisFile) {
    const raw = JSON.parse(readFileSync(hypothesisFile, 'utf8'))
    brief = { id: raw.id || hypothesisId || 'free-text', statement: raw.statement || '', formal: raw.formal, prediction: raw.prediction }
  } else if (catalog) {
    brief = briefOf(catalog)
    catalogManipulations = catalog.manipulations
  } else {
    const ids = Object.values(HYPOTHESES).map((h: any) => h.id).join(', ')
    console.error(`Hypothesis '${hypothesisId}' not found. Available: ${ids}. Or pass --hypothesis-file for a free-text hypothesis.`)
    process.exit(1); return
  }

  const paramNames = paramMapping.toVector(pyloricPreset).names
  const prior = priorFile ? priorFromVerdictFile(JSON.parse(readFileSync(priorFile, 'utf8'))) : { priorDigest: undefined, priorVerdict: undefined }
  if (priorFile) console.log(`Using prior from ${priorFile}` + (prior.priorVerdict ? ` (verdict: ${prior.priorVerdict.verdict})` : ''))

  const transformer = await getTransformer(transformerKind, { model: arg('--model') })
  const plan = await transformer.propose({ hypothesis: brief, paramNames, caps: DEFAULT_CAPS, priorDigest: prior.priorDigest, priorVerdict: prior.priorVerdict, catalogManipulations })

  const v = validatePlan(plan, paramNames, DEFAULT_CAPS)
  if (!v.ok) {
    console.error('Proposed plan failed validation:')
    for (const e of v.errors) console.error('  - ' + e)
    console.error('Offending manipulations:')
    plan.experiments.forEach((e, i) => console.error(`  [${i}] ${JSON.stringify(e.manipulation)}`))
    process.exit(2)
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  mkdirSync('results/plans', { recursive: true })
  const file = `results/plans/${brief.id}-${ts}.json`
  writeFileSync(file, JSON.stringify(plan, null, 2))

  console.log(`\nProposed plan for ${brief.id} (transformer: ${transformerKind})`)
  console.log(`Summary: ${plan.summary}`)
  console.log(`Metric: ${plan.distance}`)
  console.log(`Experiments (${plan.experiments.length}):`)
  plan.experiments.forEach((e, i) => {
    console.log(`  [${i}] ${JSON.stringify(e.manipulation)}`)
    if (e.rationale) console.log(`       rationale: ${e.rationale}`)
  })
  console.log(`Estimated simulations: ${v.estimatedSims}`)
  console.log(`\nPlan written to: ${file}`)
  console.log('Review (and edit if needed), then run:')
  console.log(`  npx tsx src/hypothesis/cli-run-plan.ts ${file} --interpreter ${transformerKind}`)
}

main().catch(err => { console.error(err); process.exit(1) })
