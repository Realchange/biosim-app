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
