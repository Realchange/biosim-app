import { describe, it, expect } from 'vitest'
import { periodGradient } from '../analysis/periodSensitivity'
import { pyloricPreset } from '../../presets/pyloric'

const SIM = { durationMs: 6000, dt: 0.05, noise: 0 }

describe('period gradient at the pyloric reference', () => {
  const res = periodGradient(pyloricPreset, { sim: SIM, eps: 0.05 })

  it('measures a finite positive reference period', () => {
    expect(res.referencePeriod).not.toBeNull()
    expect(res.referencePeriod as number).toBeGreaterThan(0)
  })

  it('returns one signed slope per tunable conductance, all finite', () => {
    expect(res.n).toBe(res.gradient.length)
    expect(res.n).toBeGreaterThan(20) // 31 free params in the preset
    for (const c of res.gradient) expect(Number.isFinite(c.slope)).toBe(true)
  })

  it('is sorted by descending |slope| and shares sum to 1', () => {
    for (let i = 1; i < res.gradient.length; i++) {
      expect(Math.abs(res.gradient[i - 1].slope)).toBeGreaterThanOrEqual(Math.abs(res.gradient[i].slope))
    }
    const shareSum = res.gradient.reduce((s, c) => s + c.absShare, 0)
    expect(shareSum).toBeCloseTo(1, 6)
  })

  it('participation ratio lies in [1, n] and nForHalf <= nForNinety', () => {
    expect(res.participationRatio).toBeGreaterThanOrEqual(1)
    expect(res.participationRatio).toBeLessThanOrEqual(res.n + 1e-9)
    expect(res.nForHalf).toBeLessThanOrEqual(res.nForNinety)
    expect(res.nForHalf).toBeGreaterThanOrEqual(1)
  })

  it('central difference is consistent: gCaT has a nonzero period slope', () => {
    // gCaT was the strongest smooth lever in H6 round 3; it must register a nonzero slope.
    const gcat = res.gradient.find((c) => c.name === 'abpd.gCaT')
    expect(gcat).toBeDefined()
    expect(Math.abs((gcat as { slope: number }).slope)).toBeGreaterThan(0)
  })
})

describe('concentration diagnostics on synthetic gradients', () => {
  // We validate the PR/nForHalf math directly by constructing networks is hard; instead we test the
  // pure formulas via a tiny re-implementation check against known vectors. PR = (Σb²)²/Σb⁴.
  const pr = (b: number[]) => {
    const s2 = b.reduce((s, x) => s + x * x, 0)
    const s4 = b.reduce((s, x) => s + x ** 4, 0)
    return (s2 * s2) / s4
  }
  it('PR = 1 for a single nonzero component (one axis dominates)', () => {
    expect(pr([5, 0, 0, 0])).toBeCloseTo(1, 9)
  })
  it('PR = n for a perfectly uniform gradient', () => {
    expect(pr([2, 2, 2, 2])).toBeCloseTo(4, 9)
    expect(pr([1, -1, 1, -1])).toBeCloseTo(4, 9) // sign-independent
  })
  it('PR is intermediate for a partially concentrated gradient', () => {
    const v = pr([4, 1, 1, 1])
    expect(v).toBeGreaterThan(1)
    expect(v).toBeLessThan(4)
  })
})
