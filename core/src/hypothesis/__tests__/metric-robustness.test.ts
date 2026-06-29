import { describe, it, expect } from 'vitest'
import { makePeriodDistanceMetric, makePhaseDistanceMetric } from '../metrics'
import { summarizeSweep } from '../analysis/stiffSloppy'
import type { SummaryStats } from '../types'
import type { RunResultWithMeta } from '../runner'

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

describe('collapse is reported separately from a large distance', () => {
  const ref = stats(1000)
  it('period metric flags a lost rhythm as collapsed, not as a moderate distance', () => {
    const period = makePeriodDistanceMetric(ref)
    const ev = period.evaluate!(stats(null))
    expect(ev.collapsed).toBe(true)
  })
  it('a large-but-valid period change is NOT collapsed', () => {
    const period = makePeriodDistanceMetric(ref)
    const ev = period.evaluate!(stats(100000)) // huge but defined
    expect(ev.collapsed).toBe(false)
    expect(ev.distance).toBeGreaterThan(1)
  })
  it('phase metric: a defined rhythm is not collapsed', () => {
    const phase = makePhaseDistanceMetric(ref)
    expect(phase.evaluate!(stats(1000)).collapsed).toBe(false)
  })
})

// Build synthetic sweep results: distance rises linearly with |amount|, crossing tau=1 at radius 0.5.
function sweepResults(amounts: number[]): RunResultWithMeta[] {
  return amounts.map((a) => ({
    experimentId: 'x', vector: { values: [], names: [], space: 'log10' },
    stats: stats(1000), distance: Math.abs(a) * 2, // d=1 at |a|=0.5
    seed: 0, timestamp: '', codeVersion: 't', meta: { amount: a },
  }))
}

describe('toleratedRadius is resolution-robust (interpolated)', () => {
  it('coarse and fine sampling agree on the interpolated crossing (~0.5)', () => {
    const coarse = summarizeSweep('c', sweepResults([-1, -0.4, 0, 0.4, 1]), 1)
    const fine = summarizeSweep('f', sweepResults([-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1]), 1)
    expect(coarse.thresholdCrossed).toBe(true)
    expect(fine.thresholdCrossed).toBe(true)
    expect(Math.abs(coarse.toleratedRadius - 0.5)).toBeLessThan(0.05)
    expect(Math.abs(fine.toleratedRadius - 0.5)).toBeLessThan(0.05)
    expect(Math.abs(coarse.toleratedRadius - fine.toleratedRadius)).toBeLessThan(0.05)
  })
  it('reports thresholdCrossed=false when the rhythm never exceeds tau in range', () => {
    const s = summarizeSweep('s', sweepResults([-0.2, 0, 0.2]), 1) // max d = 0.4 < 1
    expect(s.thresholdCrossed).toBe(false)
    expect(s.toleratedRadius).toBeCloseTo(0.2, 6) // largest |amount| tested
  })
  it('counts the collapsed fraction of swept points', () => {
    const res = sweepResults([-1, 0, 1])
    res[0].collapsed = true
    const s = summarizeSweep('s', res, 1)
    expect(s.collapsedFraction).toBeCloseTo(1 / 3, 6)
  })
})

describe('one-directional sweeps do not report a spurious radius of 0', () => {
  it('reduction-only sweep that never crosses tau reports the max |amount|, not 0', () => {
    // negative side only, with d = 2*|a| staying below tau=1 (so |a| <= 0.4); plus the amount-0 point.
    const neg = sweepResults([-0.4, -0.3, -0.2, -0.1]).filter(r => (r.meta.amount as number) < 0)
    const s = summarizeSweep('red', neg.concat(sweepResults([0])), 1)
    expect(s.thresholdCrossed).toBe(false)
    expect(s.toleratedRadius).toBeCloseTo(0.4, 6) // largest |amount| tested, NOT 0
  })
  it('increase-only sweep that crosses tau reports the interpolated crossing', () => {
    // positive side only; d = 2*|a| crosses 1 at 0.5
    const pos = sweepResults([0, 0.2, 0.4, 0.6, 0.8]).filter(r => (r.meta.amount as number) >= 0)
    const s = summarizeSweep('inc', pos, 1)
    expect(s.thresholdCrossed).toBe(true)
    expect(Math.abs(s.toleratedRadius - 0.5)).toBeLessThan(0.05)
  })
})
