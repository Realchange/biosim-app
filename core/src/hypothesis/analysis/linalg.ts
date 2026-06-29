// src/hypothesis/analysis/linalg.ts
// Minimal linear algebra for the FIM analysis: a cyclic Jacobi eigensolver for symmetric matrices
// (robust and ample for n≈31), plus small vector helpers. No external dependency.

export interface Eigen {
  values: number[] // eigenvalues, sorted descending
  vectors: number[][] // vectors[i] is the unit eigenvector for values[i] (param-space coordinates)
}

export function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

export function matVec(A: number[][], x: number[]): number[] {
  return A.map((row) => dot(row, x))
}

/** Eigendecomposition of a real symmetric matrix via the cyclic Jacobi rotation method. */
export function jacobiEigenSymmetric(input: number[][], maxSweeps = 100, tol = 1e-14): Eigen {
  const n = input.length
  const A = input.map((r) => r.slice())
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q]
    if (off <= tol) break

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue
        // Rotation angle that zeros A[p][q]: tan(2φ) = 2·a_pq / (a_qq − a_pp).
        const phi = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p])
        const c = Math.cos(phi)
        const s = Math.sin(phi)
        // A ← Jᵀ A J : first right-multiply (update columns p,q), then left-multiply (rows p,q).
        for (let k = 0; k < n; k++) {
          const akp = A[k][p]
          const akq = A[k][q]
          A[k][p] = c * akp - s * akq
          A[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k]
          const aqk = A[q][k]
          A[p][k] = c * apk - s * aqk
          A[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p]
          const vkq = V[k][q]
          V[k][p] = c * vkp - s * vkq
          V[k][q] = s * vkp + c * vkq
        }
      }
    }
  }

  const rawValues = A.map((row, i) => row[i])
  const rawVectors = Array.from({ length: n }, (_, i) => V.map((row) => row[i])) // column i
  const order = rawValues.map((_, i) => i).sort((a, b) => rawValues[b] - rawValues[a]) // descending
  return {
    values: order.map((i) => rawValues[i]),
    vectors: order.map((i) => rawVectors[i]),
  }
}
