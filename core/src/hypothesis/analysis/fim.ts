// src/hypothesis/analysis/fim.ts
// Fisher-Information / Hessian analysis of the rhythm-shape cost at θ* (M4).
// For a least-squares shape cost C(θ) = ½ Σ_k (obs_k(θ) − obs_k(θ*))², the Hessian at the minimum θ*
// is exactly g = JᵀJ (the Gauss–Newton / Fisher Information Matrix), where J_ki = ∂obs_k/∂(log g_i).
// Its eigenvalues are the curvatures (stiffness) in each direction of log-conductance space; sloppy
// models show a spectrum spanning many decades. We then ask where the homogeneous SCALING axis sits.
// The Jacobian is built once; FIMs over observable-row SUBSETS (e.g. timing-only) reuse it — no resim.
import type { Network, SimSettings } from '../types'
import { paramMapping, scalingAxis } from '../paramVector'
import { observablesOf } from './observables'
import { jacobiEigenSymmetric, dot, matVec } from './linalg'

export interface FIMOptions {
  sim?: Partial<SimSettings>
  eps?: number // central-difference step in log10-conductance space (default 0.05 ≈ ±12%)
  harmonics?: number // circular harmonics per neuron (default 6)
}

export interface Jacobian {
  J: number[][] // m observables × n parameters, ∂obs/∂(log g)
  obsNames: string[] // length m
  paramNames: string[] // length n
  n: number
}

export interface FIMResult {
  paramNames: string[]
  eigenvalues: number[] // descending
  eigenvectors: number[][] // eigenvectors[i] aligned to eigenvalues[i], in log-conductance space
  diagonal: number[] // g_ii: single-axis curvature (squared total sensitivity) of each parameter
  conditionNumber: number // λmax / λmin(>0): the sloppiness spread
  decades: number // log10(conditionNumber)
  scaling: {
    rayleigh: number // sᵀ g s, curvature along the unit scaling axis
    percentile: number // fraction of eigenvalues below rayleigh (0 = sloppiest end, 1 = stiffest)
    cosSloppiest: number // |cos| between scaling axis and the single sloppiest eigenvector
    overlapSloppyHalf: number // Σ |⟨s, v⟩|² over the sloppiest half of eigenvectors (Σ over all = 1)
    overlapStiffHalf: number
  }
}

/** Jacobian of the (normalised) observable vector w.r.t. each log-conductance, via central differences. */
export function buildJacobian(base: Network, options: FIMOptions = {}): Jacobian {
  const opts = {
    sim: options.sim ?? { durationMs: 8000, dt: 0.05, noise: 0 },
    eps: options.eps ?? 0.05,
    harmonics: options.harmonics ?? 6,
  }
  const baseVec = paramMapping.toVector(base) // log10 space
  const paramNames = baseVec.names
  const n = paramNames.length
  const obs0 = observablesOf(base, opts.sim, opts.harmonics)
  const obsNames = obs0.names
  const m = obs0.values.length
  // Harmonics are O(1); scale the (larger) per-cycle rates by their reference value so a unit change
  // means a relative change and all observables are comparable.
  const scale = obs0.names.map((nm, k) => (nm.endsWith('.rate') ? Math.max(Math.abs(obs0.values[k]), 1) : 1))

  const J: number[][] = Array.from({ length: m }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    const plus = { ...baseVec, values: baseVec.values.map((x, j) => (j === i ? x + opts.eps : x)) }
    const minus = { ...baseVec, values: baseVec.values.map((x, j) => (j === i ? x - opts.eps : x)) }
    const op = observablesOf(paramMapping.toNetwork(base, plus), opts.sim, opts.harmonics)
    const om = observablesOf(paramMapping.toNetwork(base, minus), opts.sim, opts.harmonics)
    for (let k = 0; k < m; k++) J[k][i] = (op.values[k] - om.values[k]) / scale[k] / (2 * opts.eps)
  }
  return { J, obsNames, paramNames, n }
}

/** Build the FIM from (a subset of) the Jacobian rows and eigen-analyse it. rows = observable indices. */
export function fimEigen(J: number[][], paramNames: string[], rows?: number[]): FIMResult {
  const n = paramNames.length
  const useRows = rows ?? J.map((_, k) => k)
  const g: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let a = 0; a < n; a++) {
    for (let b = a; b < n; b++) {
      let s = 0
      for (const k of useRows) s += J[k][a] * J[k][b]
      g[a][b] = s
      g[b][a] = s
    }
  }

  const { values, vectors } = jacobiEigenSymmetric(g)
  const lmax = values[0]
  const positive = values.filter((v) => v > lmax * 1e-12)
  const lmin = positive.length ? positive[positive.length - 1] : values[values.length - 1]
  const conditionNumber = lmin > 0 ? lmax / lmin : Infinity

  const s = scalingAxis(n)
  const rayleigh = dot(s, matVec(g, s))
  const percentile = values.filter((v) => v < rayleigh).length / n
  const overlaps = vectors.map((v) => dot(s, v) ** 2)
  const half = Math.floor(n / 2)
  const overlapStiffHalf = overlaps.slice(0, half).reduce((a, b) => a + b, 0)
  const overlapSloppyHalf = overlaps.slice(half).reduce((a, b) => a + b, 0)
  const cosSloppiest = Math.abs(dot(s, vectors[n - 1]))

  return {
    paramNames,
    eigenvalues: values,
    eigenvectors: vectors,
    diagonal: g.map((row, i) => row[i]),
    conditionNumber,
    decades: Number.isFinite(conditionNumber) ? Math.log10(conditionNumber) : Infinity,
    scaling: { rayleigh, percentile, cosSloppiest, overlapSloppyHalf, overlapStiffHalf },
  }
}

/** Convenience: full FIM over all observables. */
export function computeFIM(base: Network, options: FIMOptions = {}): FIMResult {
  const jac = buildJacobian(base, options)
  return fimEigen(jac.J, jac.paramNames)
}

/** Top |contributions| of an eigenvector, for human-readable composition. */
export function topContributors(vector: number[], names: string[], k = 6): { name: string; weight: number }[] {
  return names
    .map((name, i) => ({ name, weight: vector[i] }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, k)
}
