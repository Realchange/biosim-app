// src/hypothesis/__tests__/hypothesis.test.ts
// M1 smoke tests: parameter-vector round-trip + rhythm metrics/distance on the reference preset.
import { describe, it, expect } from 'vitest'
import { pyloricPreset } from '../../presets/pyloric'
import { paramMapping } from '../paramVector'
import { summaryStatsOf, makeDistanceMetric } from '../metrics'

const SIM = { durationMs: 8000, dt: 0.05, noise: 0 }

describe('paramVector mapping', () => {
  it('round-trips Network -> vector -> Network -> vector', () => {
    const v = paramMapping.toVector(pyloricPreset)
    const net2 = paramMapping.toNetwork(pyloricPreset, v)
    const v2 = paramMapping.toVector(net2)
    expect(v2.names).toEqual(v.names)
    v.values.forEach((x, i) => expect(v2.values[i]).toBeCloseTo(x, 9))
  })

  it('exposes the conductances + synapses as a log10 vector (≤31 tunable params)', () => {
    const v = paramMapping.toVector(pyloricPreset)
    expect(v.space).toBe('log10')
    expect(v.names.length).toBeGreaterThanOrEqual(24) // at least the 3×8 conductances (minus any structural 0)
    expect(v.names.length).toBeLessThanOrEqual(31)
    expect(v.names).toContain('lp.gKCa')
  })
})

describe('metrics on the reference rhythm', () => {
  it('classifies the pyloric preset as pyloric_like with zero self-distance', () => {
    const ref = summaryStatsOf(pyloricPreset, SIM)
    expect(ref.pyloricLike).toBe(true)
    expect(ref.cyclePeriod).not.toBeNull()
    const d = makeDistanceMetric(ref)
    expect(d.distance(ref)).toBeCloseTo(0, 6)
  }, 30000)

  it('distance grows sharply when synaptic coupling is removed', () => {
    const ref = summaryStatsOf(pyloricPreset, SIM)
    const d = makeDistanceMetric(ref)
    // Silence every graded synapse -> the triphasic rhythm cannot form.
    const v = paramMapping.toVector(pyloricPreset)
    const broken = paramMapping.toNetwork(pyloricPreset, {
      ...v,
      values: v.values.map((x, i) => (v.names[i].startsWith('syn') ? Math.log10(1e-6) : x)),
    })
    const stats = summaryStatsOf(broken, SIM)
    expect(stats.pyloricLike).toBe(false)
    expect(d.distance(stats)).toBeGreaterThan(d.distance(ref))
  }, 30000)
})
