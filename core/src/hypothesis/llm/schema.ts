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

const IMPLEMENTED = ['scaleAll', 'ratio', 'randomDirections', 'sweep', 'knockout']

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
  const distance = raw.distance === 'absolute' ? 'absolute' : raw.distance === 'period' ? 'period' : 'phase'
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
    if (m.kind === 'knockout') {
      const params = Array.isArray(m.params) ? m.params : null
      if (!params || params.length === 0) errors.push(`experiment[${i}]: knockout requires a non-empty params list`)
      else for (const p of params) if (typeof p !== 'string' || !tunableNames.includes(p)) errors.push(`experiment[${i}]: knockout param '${p}' is not a tunable parameter`)
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
    else if (m.kind === 'knockout') estimatedSims += (m.recover ? 2 : 1)
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
