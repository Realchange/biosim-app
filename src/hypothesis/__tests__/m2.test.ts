// src/hypothesis/__tests__/m2.test.ts
// M2 tests: primitives (pure, fast) + a runner smoke test over the reference preset.
import { describe, it, expect } from 'vitest'
import { pyloricPreset } from '../../presets/pyloric'
import { paramMapping, ratioDirection } from '../paramVector'
import { scaleAll } from '../primitives/scaleAll'
import { ratioSweep } from '../primitives/ratio'
import { randomDirections } from '../primitives/randomDirections'
import { runExperiment } from '../runner'

const base = paramMapping.toVector(pyloricPreset)

describe('primitives (pure)', () => {
  it('scaleAll yields `steps` points and is identity at amount 0', () => {
    const pts = scaleAll(base, [-1, 1], 3)
    expect(pts.map((p) => p.amount)).toEqual([-1, 0, 1])
    expect(pts[1].vector.values).toEqual(base.values) // amount 0 = unchanged
  })

  it('ratioDirection is zero-sum for balanced up/down sets', () => {
    const dir = ratioDirection(base.names, ['*.gNa'], ['*.gKd'])
    const sum = dir.reduce((s, x) => s + x, 0)
    expect(Math.abs(sum)).toBeLessThan(1e-9)
    expect(Math.hypot(...dir)).toBeCloseTo(1, 9) // unit length
  })

  it('ratioSweep is identity at amount 0', () => {
    const pts = ratioSweep(base, ['*.gCaS'], ['*.gKCa'], [-2, 2], 5)
    expect(pts).toHaveLength(5)
    expect(pts[2].amount).toBe(0)
    expect(pts[2].vector.values).toEqual(base.values)
  })

  it('randomDirections is deterministic per seed and reports alignment in [0,1]', () => {
    const a = randomDirections(base, 0.5, 10, 42)
    const b = randomDirections(base, 0.5, 10, 42)
    expect(a[0].vector.values).toEqual(b[0].vector.values)
    for (const p of a) {
      expect(p.alignment).toBeGreaterThanOrEqual(0)
      expect(p.alignment).toBeLessThanOrEqual(1)
    }
  })
})

describe('runner smoke', () => {
  it('runs a small scaleAll sweep; the amount-0 point reproduces the reference (distance 0, pyloric)', () => {
    const run = runExperiment(pyloricPreset, { kind: 'scaleAll', logRange: [-1, 1], steps: 3 }, {
      experimentId: 'test',
      sim: { durationMs: 8000, dt: 0.05, noise: 0 },
      codeVersion: 'test',
    })
    expect(run.results).toHaveLength(3)
    const mid = run.results[1] // amount 0
    expect(mid.meta.amount).toBe(0)
    expect(mid.distance).toBeCloseTo(0, 6)
    expect(mid.stats.pyloricLike).toBe(true)
    for (const r of run.results) expect(Number.isFinite(r.distance)).toBe(true)
  }, 60000)
})
