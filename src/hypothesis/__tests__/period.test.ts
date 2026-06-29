import { describe, it, expect } from 'vitest'
import { makePeriodDistanceMetric, makePhaseDistanceMetric } from '../metrics'
import type { SummaryStats } from '../types'

// Minimal reference stats; only the fields the two metrics read need to be meaningful.
function stats(period: number | null, over: Partial<SummaryStats> = {}): SummaryStats {
  return {
    cyclePeriod: period,
    burstDuration: { ABPD: 200, LP: 200, PY: 200 },
    dutyCycle: { ABPD: 0.2, LP: 0.2, PY: 0.2 },
    phaseGap: { 'ABPD-LP': 300, 'LP-PY': 300 },
    relPhase: { LP: 0.4, PY: 0.7 },
    spikesPerBurst: { ABPD: 12, LP: 12, PY: 12 },
    pyloricLike: true,
    pyloricLikePhase: true,
    ...over,
  }
}

describe('period distance metric', () => {
  const ref = stats(1000)
  const period = makePeriodDistanceMetric(ref)
  const phase = makePhaseDistanceMetric(ref)

  it('is zero at the reference period', () => {
    expect(period.distance(stats(1000))).toBeCloseTo(0, 6)
  })
  it('grows with relative period change (1.26x -> ~1 unit at scale 0.1)', () => {
    const d = period.distance(stats(1000 * Math.pow(10, 0.1)))
    expect(d).toBeCloseTo(1, 5)
  })
  it('is symmetric in log: doubling and halving give equal distance', () => {
    expect(period.distance(stats(2000))).toBeCloseTo(period.distance(stats(500)), 6)
  })
  it('penalises a lost (null) period without NaN', () => {
    const d = period.distance(stats(null))
    expect(Number.isFinite(d)).toBe(true)
    expect(d).toBeGreaterThan(0)
  })

  it('separates period from shape: a pure period change is ~0 under the phase metric but large under period', () => {
    const periodOnly = stats(1500) // same duty/relPhase, different period
    expect(phase.distance(periodOnly)).toBeCloseTo(0, 6)
    expect(period.distance(periodOnly)).toBeGreaterThan(1)
  })
  it('conversely, a pure shape change moves phase but not period', () => {
    const shapeOnly = stats(1000, { relPhase: { LP: 0.55, PY: 0.8 } })
    expect(period.distance(shapeOnly)).toBeCloseTo(0, 6)
    expect(phase.distance(shapeOnly)).toBeGreaterThan(0)
  })
})
