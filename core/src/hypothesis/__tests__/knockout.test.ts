import { describe, it, expect } from 'vitest'
import { knockout, KNOCKOUT_FLOOR } from '../primitives/knockout'
import { paramMapping } from '../paramVector'
import { pyloricPreset } from '../../presets/pyloric'
import { validatePlan, DEFAULT_CAPS } from '../llm/schema'

const base = paramMapping.toVector(pyloricPreset)
const names = base.names

describe('knockout primitive', () => {
  it('forces the listed parameter to the floor and leaves others unchanged', () => {
    const target = names[0]
    const pts = knockout(base, [target], false)
    expect(pts.length).toBe(1)
    const v = pts[0].vector
    expect(v.values[names.indexOf(target)]).toBe(KNOCKOUT_FLOOR)
    for (let i = 1; i < names.length; i++) expect(v.values[i]).toBe(base.values[i])
  })
  it('with recover, emits baseline (amount 1) then lesion (amount 0)', () => {
    const pts = knockout(base, [names[0]], true)
    expect(pts.map(p => p.amount)).toEqual([1, 0])
    expect(pts[0].vector.values).toEqual(base.values)
  })
  it('throws on an unknown parameter', () => {
    expect(() => knockout(base, ['not.a.param'], false)).toThrow()
  })
})

describe('schema accepts knockout', () => {
  it('accepts a valid knockout plan and budgets its sims', () => {
    const plan = { hypothesisId: 'h', distance: 'phase', experiments: [
      { manipulation: { kind: 'knockout', params: [names[0]], recover: true }, rationale: '' },
    ] }
    const v = validatePlan(plan, names, DEFAULT_CAPS)
    expect(v.ok).toBe(true)
    expect(v.estimatedSims).toBe(2)
  })
  it('rejects knockout of an unknown parameter', () => {
    const plan = { hypothesisId: 'h', experiments: [ { manipulation: { kind: 'knockout', params: ['nope'] } } ] }
    expect(validatePlan(plan, names, DEFAULT_CAPS).ok).toBe(false)
  })
})
