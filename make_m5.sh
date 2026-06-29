set -e
cd /Users/arnesauer/Dev/projects/Biosim/biosim-app
mkdir -p src/hypothesis/llm src/hypothesis/__tests__

cat > src/hypothesis/llm/types.ts <<'M5_TYPES'
// LLM layer contracts (M5). The LLM proposes experiment specs and writes prose only:
// deterministic code computes every number, a schema guard validates every LLM output,
// and a human approves the plan (two-phase propose/run CLIs) before anything executes.
import type { Hypothesis, Manipulation } from '../types'

export interface ProposedExperiment { manipulation: Manipulation; rationale: string }
export interface ProposedPlan {
  hypothesisId: string
  summary: string
  distance: 'absolute' | 'phase'
  experiments: ProposedExperiment[]
}
export interface InterpretationResult {
  verdict: 'supported' | 'refuted' | 'inconclusive'
  evidence: string
  refinedClaim?: string
}
export interface ExperimentDigest { kind: string; label: string; metrics: Record<string, number> }
export interface AnalysisDigest {
  hypothesisId: string
  metricKind: 'absolute' | 'phase'
  experiments: ExperimentDigest[]
}
export interface HypothesisBrief { id: string; statement: string; formal?: string; prediction?: string }
export interface Caps {
  maxExperiments: number
  logRangeAbs: number
  minSteps: number
  maxSteps: number
  maxSamples: number
  maxRadius: number
  maxTotalSims: number
}
export interface TransformInput {
  hypothesis: HypothesisBrief
  paramNames: string[]
  caps: Caps
  priorDigest?: AnalysisDigest
  catalogManipulations?: Manipulation[]
}
export interface InterpretInput { hypothesis: HypothesisBrief; digest: AnalysisDigest }
export interface Transformer { propose(input: TransformInput): Promise<ProposedPlan> }
export interface Interpreter { interpret(input: InterpretInput): Promise<InterpretationResult> }
export interface LLMConfig { model?: string; maxTokens?: number }

export function briefOf(h: Hypothesis): HypothesisBrief {
  const a = h as any
  return { id: a.id, statement: a.statement, formal: a.formal, prediction: a.prediction }
}
M5_TYPES

cat > src/hypothesis/llm/schema.ts <<'M5_SCHEMA'
// Schema guard: validates LLM-proposed plans and interpretations. Lenient about field
// presence (so trusted catalog manipulations always pass) but strict on the safety-
// critical checks: only implemented kinds, real parameter names, and numeric budgets.
import type { ProposedPlan, InterpretationResult, Caps } from './types'

export const DEFAULT_CAPS: Caps = {
  maxExperiments: 8,
  logRangeAbs: 6,
  minSteps: 3,
  maxSteps: 121,
  maxSamples: 2000,
  maxRadius: 5,
  maxTotalSims: 1500,
}

const IMPLEMENTED = ['scaleAll', 'ratio', 'randomDirections', 'sweep']

export function patternMatches(pattern: string, names: string[]): boolean {
  if (typeof pattern !== 'string' || !pattern) return false
  if (pattern.startsWith('*.')) { const suf = pattern.slice(1); return names.some(n => n.endsWith(suf)) }
  if (pattern.endsWith('*')) { const pre = pattern.slice(0, -1); return names.some(n => n.startsWith(pre)) }
  return names.includes(pattern)
}

export interface PlanValidation { ok: boolean; errors: string[]; plan?: ProposedPlan; estimatedSims: number }

export function validatePlan(raw: any, tunableNames: string[], caps: Caps = DEFAULT_CAPS): PlanValidation {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['plan is not an object'], estimatedSims: 0 }
  if (typeof raw.hypothesisId !== 'string' || !raw.hypothesisId.trim()) errors.push('hypothesisId is missing')
  const distance = raw.distance === 'absolute' ? 'absolute' : 'phase'
  const exps: any[] = Array.isArray(raw.experiments) ? raw.experiments : []
  if (exps.length === 0) errors.push('experiments is empty')
  if (exps.length > caps.maxExperiments) errors.push(`too many experiments (${exps.length} > ${caps.maxExperiments})`)

  const num = (v: any) => typeof v === 'number' && Number.isFinite(v)
  const intIn = (v: any, lo: number, hi: number) => num(v) && Number.isInteger(v) && v >= lo && v <= hi
  const range2 = (v: any) => Array.isArray(v) && v.length === 2 && v.every(num)

  let estimatedSims = 0
  exps.forEach((e, i) => {
    const m = e?.manipulation
    if (!m || typeof m !== 'object') { errors.push(`experiment[${i}]: manipulation is missing`); return }
    if (!IMPLEMENTED.includes(m.kind)) { errors.push(`experiment[${i}]: kind '${m.kind}' is not implemented`); return }

    for (const key of ['logRange', 'range']) {
      if (key in m) {
        if (!range2(m[key])) errors.push(`experiment[${i}]: ${key} must be [number, number]`)
        else if (Math.abs(m[key][0]) > caps.logRangeAbs || Math.abs(m[key][1]) > caps.logRangeAbs)
          errors.push(`experiment[${i}]: ${key} exceeds +/-${caps.logRangeAbs}`)
      }
    }
    if ('steps' in m && !intIn(m.steps, caps.minSteps, caps.maxSteps))
      errors.push(`experiment[${i}]: steps must be an integer in [${caps.minSteps}, ${caps.maxSteps}]`)
    if ('samples' in m && !intIn(m.samples, 1, caps.maxSamples))
      errors.push(`experiment[${i}]: samples must be an integer in [1, ${caps.maxSamples}]`)
    if ('radius' in m && !(num(m.radius) && m.radius > 0 && m.radius <= caps.maxRadius))
      errors.push(`experiment[${i}]: radius must be in (0, ${caps.maxRadius}]`)

    if (m.kind === 'sweep') {
      if (typeof m.param !== 'string' || !tunableNames.includes(m.param))
        errors.push(`experiment[${i}]: sweep param '${m.param}' is not a tunable parameter`)
      if (!('range' in m)) errors.push(`experiment[${i}]: sweep requires a range`)
    }
    if (m.kind === 'ratio') {
      const up = Array.isArray(m.up) ? m.up : null
      const down = Array.isArray(m.down) ? m.down : null
      if (!up || !down || up.length === 0 || down.length === 0)
        errors.push(`experiment[${i}]: ratio requires non-empty up and down lists`)
      for (const p of [...(up || []), ...(down || [])])
        if (!patternMatches(p, tunableNames)) errors.push(`experiment[${i}]: pattern '${p}' matches no parameter`)
    }
    if (m.kind === 'scaleAll' && 'targets' in m && !['membrane', 'synaptic', 'all'].includes(m.targets))
      errors.push(`experiment[${i}]: targets must be membrane | synaptic | all`)

    if (num(m.steps)) estimatedSims += m.steps
    else if (num(m.samples)) estimatedSims += m.samples
  })

  if (estimatedSims > caps.maxTotalSims)
    errors.push(`estimated ${estimatedSims} simulations exceed the budget of ${caps.maxTotalSims}`)

  if (errors.length) return { ok: false, errors, estimatedSims }
  const plan: ProposedPlan = {
    hypothesisId: raw.hypothesisId,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    distance,
    experiments: exps.map(e => ({ manipulation: e.manipulation, rationale: typeof e.rationale === 'string' ? e.rationale : '' })),
  }
  return { ok: true, errors: [], plan, estimatedSims }
}

export interface InterpretationValidation { ok: boolean; errors: string[]; result?: InterpretationResult }

export function validateInterpretation(raw: any): InterpretationValidation {
  const errors: string[] = []
  const v = raw?.verdict
  if (!['supported', 'refuted', 'inconclusive'].includes(v)) errors.push('verdict must be supported | refuted | inconclusive')
  if (typeof raw?.evidence !== 'string' || !raw.evidence.trim()) errors.push('evidence is missing')
  if (errors.length) return { ok: false, errors }
  return { ok: true, errors: [], result: { verdict: v, evidence: raw.evidence, refinedClaim: typeof raw?.refinedClaim === 'string' ? raw.refinedClaim : undefined } }
}
M5_SCHEMA

cat > src/hypothesis/llm/prompts.ts <<'M5_PROMPTS'
// Auditable prompt templates. Both phases demand a single JSON object and nothing else.
import type { TransformInput, InterpretInput } from './types'

export const systemTransform =
  'You are an experiment designer for a deterministic neural-simulation hypothesis engine. ' +
  'You DO NOT compute or invent any numerical result; you only propose which experiments to run. ' +
  'Respond with a single JSON object and nothing else (no prose, no code fences).'

export function buildTransformUser(input: TransformInput): string {
  const c = input.caps
  return [
    `Hypothesis id: ${input.hypothesis.id}`,
    `Statement: ${input.hypothesis.statement}`,
    input.hypothesis.formal ? `Formal: ${input.hypothesis.formal}` : '',
    input.hypothesis.prediction ? `Prediction: ${input.hypothesis.prediction}` : '',
    input.priorDigest ? `Prior results digest (JSON): ${JSON.stringify(input.priorDigest)}` : '',
    '',
    'Design experiments to test (and try to falsify) this hypothesis using ONLY these manipulation kinds:',
    '- scaleAll: {"kind":"scaleAll","logRange":[lo,hi],"steps":N,"targets":"membrane|synaptic|all"}',
    '- ratio:    {"kind":"ratio","up":[names],"down":[names],"logRange":[lo,hi],"steps":N}',
    '- sweep:    {"kind":"sweep","param":name,"range":[lo,hi],"steps":N,"space":"log10"}',
    '- randomDirections: {"kind":"randomDirections","radius":r,"samples":N,"seed":S}',
    '',
    'Parameter names you may use (exact; ratio up/down also accept globs like "*.gKCa" or "lp*"):',
    input.paramNames.join(', '),
    '',
    `Constraints: at most ${c.maxExperiments} experiments; |logRange| <= ${c.logRangeAbs}; steps in [${c.minSteps},${c.maxSteps}]; ` +
      `samples in [1,${c.maxSamples}]; radius in (0,${c.maxRadius}]; total simulations (sum of steps and samples) <= ${c.maxTotalSims}.`,
    'Prefer single-parameter sweeps and direction-free probes over hand-picked ratios when testing necessity or redundancy.',
    '',
    'Output JSON shape:',
    '{"hypothesisId":"...","summary":"...","distance":"phase","experiments":[{"manipulation":{...},"rationale":"..."}]}',
  ].filter(Boolean).join('\n')
}

export const systemInterpret =
  'You interpret already-computed results of a deterministic neural simulation. ' +
  'Use ONLY the provided numbers; never invent data. Be Popperian: prefer refutation and sharper falsifiable claims. ' +
  'Respond with a single JSON object and nothing else.'

export function buildInterpretUser(input: InterpretInput): string {
  return [
    `Hypothesis id: ${input.hypothesis.id}`,
    `Statement: ${input.hypothesis.statement}`,
    input.hypothesis.formal ? `Formal: ${input.hypothesis.formal}` : '',
    input.hypothesis.prediction ? `Prediction: ${input.hypothesis.prediction}` : '',
    '',
    'Computed results digest (JSON; distances are dimensionless phase-shape distances unless metricKind is absolute; ' +
      'toleratedRadius is the displacement before the rhythm shape exceeds threshold; a higher slope means stiffer / more necessary):',
    JSON.stringify(input.digest, null, 2),
    '',
    'Decide whether the hypothesis is supported, refuted, or inconclusive, citing the specific numbers. ' +
      'If the data suggest a sharper, still-falsifiable claim, give it.',
    '',
    'Output JSON shape: {"verdict":"supported|refuted|inconclusive","evidence":"...","refinedClaim":"..."}',
  ].filter(Boolean).join('\n')
}
M5_PROMPTS

cat > src/hypothesis/llm/noop.ts <<'M5_NOOP'
// Deterministic fallback (no API key needed): lets the propose/run plumbing be tested
// end-to-end. The transformer echoes the catalog manipulations; the interpreter reports
// the digest factually without drawing a conclusion.
import type { Transformer, Interpreter, ProposedPlan, InterpretationResult, TransformInput, InterpretInput } from './types'

const IMPLEMENTED = ['scaleAll', 'ratio', 'randomDirections', 'sweep']

export class NoopTransformer implements Transformer {
  async propose(input: TransformInput): Promise<ProposedPlan> {
    const manips = (input.catalogManipulations || []).filter((m: any) => m && IMPLEMENTED.includes(m.kind))
    if (manips.length === 0) {
      throw new Error(`NoopTransformer: no implemented catalog manipulations for '${input.hypothesis.id}'. Use --transformer anthropic for free-text hypotheses.`)
    }
    return {
      hypothesisId: input.hypothesis.id,
      summary: `Catalog manipulations for ${input.hypothesis.id} (deterministic, no LLM).`,
      distance: 'phase',
      experiments: manips.map((m: any) => ({ manipulation: m, rationale: 'from hypothesis catalog' })),
    }
  }
}

export class NoopInterpreter implements Interpreter {
  async interpret(input: InterpretInput): Promise<InterpretationResult> {
    const lines = input.digest.experiments.map(
      e => `${e.label}: ${Object.entries(e.metrics).map(([k, val]) => `${k}=${val}`).join(', ')}`,
    )
    return {
      verdict: 'inconclusive',
      evidence: `Deterministic digest (no LLM judgment): ${lines.join(' | ')}`,
      refinedClaim: undefined,
    }
  }
}
M5_NOOP

cat > src/hypothesis/llm/digest.ts <<'M5_DIGEST'
// Condenses raw run results into compact numeric metrics for the interpreter, reusing the
// existing sweep/random summaries. Defensive about their exact signature and field names.
import type { Manipulation } from '../types'
import type { AnalysisDigest, ExperimentDigest } from './types'
import { summarizeSweep, summarizeRandom } from '../analysis/stiffSloppy'

function labelOf(m: any): string {
  switch (m?.kind) {
    case 'ratio': return `ratio ${(m.up || []).join('+')}/${(m.down || []).join('+')}`
    case 'sweep': return `sweep ${m.param}`
    case 'scaleAll': return `scaleAll(${m.targets || 'all'})`
    case 'randomDirections': return `randomDirections r=${m.radius} n=${m.samples}`
    default: return String(m?.kind || 'unknown')
  }
}
function copyNumbers(obj: any): Record<string, number> {
  const out: Record<string, number> = {}
  if (obj && typeof obj === 'object') {
    for (const [k, val] of Object.entries(obj)) {
      if (typeof val === 'number' && Number.isFinite(val)) out[k] = Math.round(val * 1000) / 1000
    }
  }
  return out
}
function safeSummary(fn: any, label: string, results: any[]): any {
  try { const r = fn(label, results); if (r && typeof r === 'object') return r } catch { /* try next */ }
  try { const r = fn(results, label); if (r && typeof r === 'object') return r } catch { /* try next */ }
  try { const r = fn(results); if (r && typeof r === 'object') return r } catch { /* give up */ }
  return {}
}
export function buildDigest(
  hypothesisId: string,
  metricKind: 'absolute' | 'phase',
  items: { manipulation: Manipulation; results: any[] }[],
): AnalysisDigest {
  const experiments: ExperimentDigest[] = items.map(({ manipulation, results }) => {
    const label = labelOf(manipulation)
    const summary = (manipulation as any).kind === 'randomDirections'
      ? safeSummary(summarizeRandom, label, results)
      : safeSummary(summarizeSweep, label, results)
    return { kind: (manipulation as any).kind, label, metrics: copyNumbers(summary) }
  })
  return { hypothesisId, metricKind, experiments }
}
M5_DIGEST

cat > src/hypothesis/llm/anthropic.ts <<'M5_ANTHROPIC'
// Anthropic-backed transformer/interpreter (opt-in). Imported only via the dynamic factory,
// so the SDK is required solely when this provider is selected. JSON is parsed defensively
// with one validation-driven repair retry.
import Anthropic from '@anthropic-ai/sdk'
import type {
  Transformer, Interpreter, ProposedPlan, InterpretationResult, TransformInput, InterpretInput, LLMConfig,
} from './types'
import { validatePlan, validateInterpretation } from './schema'
import { systemTransform, buildTransformUser, systemInterpret, buildInterpretUser } from './prompts'

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const bodyText = (fence ? fence[1] : text).trim()
  const start = bodyText.indexOf('{')
  const end = bodyText.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('no JSON object found in model output')
  return JSON.parse(bodyText.slice(start, end + 1))
}

class Base {
  protected client: Anthropic
  protected model: string
  protected maxTokens: number
  constructor(cfg: LLMConfig = {}) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    this.client = new Anthropic({ apiKey })
    this.model = cfg.model || DEFAULT_MODEL
    this.maxTokens = cfg.maxTokens || 2000
  }
  protected async call(system: string, user: string): Promise<string> {
    const msg = await this.client.messages.create({
      model: this.model, max_tokens: this.maxTokens, system, messages: [{ role: 'user', content: user }],
    })
    return (msg.content as any[]).filter(b => b.type === 'text').map(b => b.text).join('\n')
  }
}

export class AnthropicTransformer extends Base implements Transformer {
  async propose(input: TransformInput): Promise<ProposedPlan> {
    const base = buildTransformUser(input)
    let user = base
    let lastErr = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.call(systemTransform, user)
      let parsed: any
      try { parsed = extractJson(text) } catch (e) { lastErr = String(e); user = `${base}\n\nYour previous reply was not valid JSON (${lastErr}). Return ONLY a JSON object.`; continue }
      const v = validatePlan(parsed, input.paramNames, input.caps)
      if (v.ok) return v.plan!
      lastErr = v.errors.join('; ')
      user = `${base}\n\nYour previous JSON was invalid:\n- ${v.errors.join('\n- ')}\nReturn corrected JSON only.`
    }
    throw new Error(`Anthropic transformer failed validation after repair: ${lastErr}`)
  }
}

export class AnthropicInterpreter extends Base implements Interpreter {
  async interpret(input: InterpretInput): Promise<InterpretationResult> {
    const base = buildInterpretUser(input)
    let user = base
    let lastErr = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.call(systemInterpret, user)
      let parsed: any
      try { parsed = extractJson(text) } catch (e) { lastErr = String(e); user = `${base}\n\nReturn ONLY a JSON object (${lastErr}).`; continue }
      const v = validateInterpretation(parsed)
      if (v.ok) return v.result!
      lastErr = v.errors.join('; ')
      user = `${base}\n\nYour previous JSON was invalid:\n- ${v.errors.join('\n- ')}\nReturn corrected JSON only.`
    }
    throw new Error(`Anthropic interpreter failed validation after repair: ${lastErr}`)
  }
}
M5_ANTHROPIC

cat > src/hypothesis/llm/index.ts <<'M5_INDEX'
// Provider factory. Noop is static; Anthropic is loaded lazily so the SDK is only needed
// when actually used.
import type { Transformer, Interpreter, LLMConfig } from './types'
import { NoopTransformer, NoopInterpreter } from './noop'

export type ProviderKind = 'noop' | 'anthropic'

export async function getTransformer(kind: ProviderKind, cfg?: LLMConfig): Promise<Transformer> {
  if (kind === 'anthropic') { const m = await import('./anthropic'); return new m.AnthropicTransformer(cfg) }
  return new NoopTransformer()
}
export async function getInterpreter(kind: ProviderKind, cfg?: LLMConfig): Promise<Interpreter> {
  if (kind === 'anthropic') { const m = await import('./anthropic'); return new m.AnthropicInterpreter(cfg) }
  return new NoopInterpreter()
}
M5_INDEX

cat > src/hypothesis/cli-propose.ts <<'M5_PROPOSE'
/* M5 phase 1 (approval gate): propose an experiment plan and write it for review.
 * Nothing is executed here. Inspect (and optionally edit) the JSON, then run cli-run-plan. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { pyloricPreset } from '../presets/pyloric'
import { paramMapping } from './paramVector'
import { HYPOTHESES, getHypothesis } from './registry'
import { getTransformer } from './llm'
import { validatePlan, DEFAULT_CAPS } from './llm/schema'
import { briefOf } from './llm/types'
import type { HypothesisBrief, AnalysisDigest } from './llm/types'

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
  const priorDigest: AnalysisDigest | undefined = priorFile ? JSON.parse(readFileSync(priorFile, 'utf8')) : undefined

  const transformer = await getTransformer(transformerKind, { model: arg('--model') })
  const plan = await transformer.propose({ hypothesis: brief, paramNames, caps: DEFAULT_CAPS, priorDigest, catalogManipulations })

  const v = validatePlan(plan, paramNames, DEFAULT_CAPS)
  if (!v.ok) {
    console.error('Proposed plan failed validation:')
    for (const e of v.errors) console.error('  - ' + e)
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
M5_PROPOSE

cat > src/hypothesis/cli-run-plan.ts <<'M5_RUNPLAN'
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
M5_RUNPLAN

cat > src/hypothesis/__tests__/llm.test.ts <<'M5_TEST'
import { describe, it, expect } from 'vitest'
import { validatePlan, validateInterpretation, DEFAULT_CAPS } from '../llm/schema'
import { NoopTransformer, NoopInterpreter } from '../llm/noop'
import { briefOf } from '../llm/types'
import { HYPOTHESES } from '../registry'
import { pyloricPreset } from '../../presets/pyloric'
import { paramMapping } from '../paramVector'

const names = paramMapping.toVector(pyloricPreset).names
const anyHyp = Object.values(HYPOTHESES)[0] as any

describe('plan schema', () => {
  it('accepts a valid sweep plan', () => {
    const plan = { hypothesisId: 'h', distance: 'phase', experiments: [{ manipulation: { kind: 'sweep', param: names[0], range: [-1, 1], steps: 5, space: 'log10' }, rationale: '' }] }
    const v = validatePlan(plan, names, DEFAULT_CAPS)
    expect(v.ok).toBe(true)
    expect(v.estimatedSims).toBe(5)
  })
  it('rejects an unimplemented kind', () => {
    expect(validatePlan({ hypothesisId: 'h', experiments: [{ manipulation: { kind: 'knockout' } }] }, names, DEFAULT_CAPS).ok).toBe(false)
  })
  it('rejects an unknown sweep parameter', () => {
    expect(validatePlan({ hypothesisId: 'h', experiments: [{ manipulation: { kind: 'sweep', param: 'not.a.param', range: [-1, 1], steps: 5 } }] }, names, DEFAULT_CAPS).ok).toBe(false)
  })
  it('rejects oversized steps', () => {
    expect(validatePlan({ hypothesisId: 'h', experiments: [{ manipulation: { kind: 'sweep', param: names[0], range: [-1, 1], steps: 99999 } }] }, names, DEFAULT_CAPS).ok).toBe(false)
  })
  it('rejects a ratio pattern matching nothing', () => {
    expect(validatePlan({ hypothesisId: 'h', experiments: [{ manipulation: { kind: 'ratio', up: ['*.gNope'], down: [names[0]], logRange: [-1, 1], steps: 5 } }] }, names, DEFAULT_CAPS).ok).toBe(false)
  })
  it('rejects an over-budget plan', () => {
    const big = { manipulation: { kind: 'randomDirections', radius: 1, samples: 2000, seed: 1 } }
    expect(validatePlan({ hypothesisId: 'h', experiments: [big, { ...big, manipulation: { ...big.manipulation, seed: 2 } }] }, names, DEFAULT_CAPS).ok).toBe(false)
  })
})

describe('interpretation schema', () => {
  it('accepts a valid interpretation', () => {
    expect(validateInterpretation({ verdict: 'refuted', evidence: 'because x' }).ok).toBe(true)
  })
  it('rejects a bad verdict', () => {
    expect(validateInterpretation({ verdict: 'maybe', evidence: 'x' }).ok).toBe(false)
  })
})

describe('noop provider', () => {
  it('turns catalog manipulations into a valid plan', async () => {
    const plan = await new NoopTransformer().propose({ hypothesis: briefOf(anyHyp), paramNames: names, caps: DEFAULT_CAPS, catalogManipulations: anyHyp.manipulations })
    expect(plan.experiments.length).toBeGreaterThan(0)
    expect(validatePlan(plan, names, DEFAULT_CAPS).ok).toBe(true)
  })
  it('interprets a digest without inventing a verdict', async () => {
    const r = await new NoopInterpreter().interpret({ hypothesis: briefOf(anyHyp), digest: { hypothesisId: anyHyp.id, metricKind: 'phase', experiments: [{ kind: 'sweep', label: 'sweep x', metrics: { maxDistance: 1 } }] } })
    expect(r.verdict).toBe('inconclusive')
    expect(r.evidence).toContain('sweep x')
  })
})
M5_TEST

echo "M5 files written:"
ls -1 src/hypothesis/llm/ && ls -1 src/hypothesis/cli-propose.ts src/hypothesis/cli-run-plan.ts src/hypothesis/__tests__/llm.test.ts
