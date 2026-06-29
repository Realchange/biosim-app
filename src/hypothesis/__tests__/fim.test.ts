// src/hypothesis/__tests__/fim.test.ts
// M4 tests: the symmetric eigensolver (against known/reconstructible matrices) and the
// period-invariance of the circular-harmonic observable vector. All pure — no simulation.
import { describe, it, expect } from 'vitest'
import { jacobiEigenSymmetric, dot, matVec } from '../analysis/linalg'
import { observablesFromPhases } from '../analysis/observables'
import { spikePhases } from '../metrics'

describe('jacobi symmetric eigensolver', () => {
  it('diagonalises [[2,1],[1,2]] → eigenvalues 3 and 1 with the expected eigenvectors', () => {
    const { values, vectors } = jacobiEigenSymmetric([
      [2, 1],
      [1, 2],
    ])
    expect(values[0]).toBeCloseTo(3, 8)
    expect(values[1]).toBeCloseTo(1, 8)
    expect(vectors[0][0] * vectors[0][1]).toBeGreaterThan(0) // (1,1) direction (sign-free)
    expect(vectors[1][0] * vectors[1][1]).toBeLessThan(0) // (1,−1) direction
  })

  it('recovers a diagonal matrix as axis-aligned eigenvectors', () => {
    const { values, vectors } = jacobiEigenSymmetric([
      [5, 0, 0],
      [0, 3, 0],
      [0, 0, 1],
    ])
    expect(values[0]).toBeCloseTo(5, 8)
    expect(values[1]).toBeCloseTo(3, 8)
    expect(values[2]).toBeCloseTo(1, 8)
    // each eigenvector has one ~±1 component and the rest ~0
    for (const v of vectors) {
      const big = v.filter((x) => Math.abs(x) > 0.99).length
      const small = v.filter((x) => Math.abs(x) < 1e-6).length
      expect(big).toBe(1)
      expect(small).toBe(2)
    }
  })

  it('satisfies A·vᵢ = λᵢ·vᵢ and orthonormal vectors for a general symmetric matrix', () => {
    const A = [
      [4, 1, -2, 0.5],
      [1, 3, 0.3, -1],
      [-2, 0.3, 5, 0.7],
      [0.5, -1, 0.7, 2],
    ]
    const { values, vectors } = jacobiEigenSymmetric(A)
    values.forEach((lam, i) => {
      const Av = matVec(A, vectors[i])
      Av.forEach((x, j) => expect(x).toBeCloseTo(lam * vectors[i][j], 6))
      expect(dot(vectors[i], vectors[i])).toBeCloseTo(1, 8) // unit length
    })
    // trace is preserved
    const trace = A.reduce((s, row, i) => s + row[i], 0)
    expect(values.reduce((s, v) => s + v, 0)).toBeCloseTo(trace, 6)
  })
})

describe('observable vector is period-invariant', () => {
  // Build a synthetic triphasic rhythm: AB/PD burst at cycle start, LP at phase ~0.4, PY at ~0.65.
  function synthetic(scale: number): Record<string, number[]> {
    const abpd: number[] = []
    const lp: number[] = []
    const py: number[] = []
    for (let c = 0; c < 8; c++) {
      const t0 = (2000 + c * 1000) * scale
      for (const d of [0, 10, 20, 30]) abpd.push(t0 + d * scale)
      for (const d of [400, 410, 420, 430, 440]) lp.push(t0 + d * scale)
      for (const d of [650, 660, 670]) py.push(t0 + d * scale)
    }
    return { abpd, lp, py }
  }

  it('yields the same circular-harmonic observables when the whole rhythm is sped up ×2', () => {
    const slow = observablesFromPhases(spikePhases(synthetic(1), { burnInMs: 1500 }).phases, 6)
    const fast = observablesFromPhases(spikePhases(synthetic(2), { burnInMs: 1500 }).phases, 6)
    expect(fast.names).toEqual(slow.names)
    slow.values.forEach((v, i) => expect(fast.values[i]).toBeCloseTo(v, 9))
  })
})
