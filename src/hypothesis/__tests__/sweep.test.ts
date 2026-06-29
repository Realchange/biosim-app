// src/hypothesis/__tests__/sweep.test.ts
// Pure tests for the single-parameter sweep primitive.
import { describe, it, expect } from 'vitest'
import { pyloricPreset } from '../../presets/pyloric'
import { paramMapping } from '../paramVector'
import { singleSweep } from '../primitives/sweep'

const base = paramMapping.toVector(pyloricPreset)
const target = base.names[0]

describe('singleSweep', () => {
  it('varies only the target parameter and is identity at amount 0', () => {
    const pts = singleSweep(base, target, [-2, 2], 5)
    expect(pts).toHaveLength(5)
    expect(pts[2].amount).toBe(0)
    expect(pts[2].vector.values).toEqual(base.values) // amount 0 = unchanged
    // a non-zero point changes ONLY the target coordinate
    const changed = pts[4].vector.values
      .map((v, i) => (v !== base.values[i] ? i : -1))
      .filter((i) => i >= 0)
    expect(changed).toEqual([0])
    expect(pts[4].vector.values[0]).toBeCloseTo(base.values[0] + 2, 9) // log10 shift by +2
  })

  it('throws on an unknown parameter name', () => {
    expect(() => singleSweep(base, 'does.not.exist', [-1, 1], 3)).toThrow(/unknown parameter/)
  })
})
