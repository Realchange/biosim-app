// src/hypothesis/analysis/periodSensitivity.ts
// M8 — Period-sensitivity (gradient) analysis at θ*.
//
// The companion cycle-period study (H6) left one open question: is cycle-period control genuinely
// DISTRIBUTED across conductances, or dominated by a single axis? Single-parameter sweeps and a
// direction-free probe suggested "distributed", but could not quantify it. Here we compute the
// gradient of the (log) cycle period in log-conductance space directly:
//
//     b_i = ∂ log10(T) / ∂ log10(g_i),   estimated by central differences (same scheme as the
//                                          shape-FIM Jacobian, but with the SCALAR log-period as the
//                                          target instead of the 39-dim observable vector).
//
// Unlike a period-FIM built from one observable (which is rank-1 by construction and so trivially
// "one nonzero eigenvalue"), the gradient is well defined and lets us ask, honestly, HOW concentrated
// the period control is:
//   - sorted |b_i|: how many conductances are needed for ≥50% / ≥90% of the gradient L1 norm;
//   - participation ratio PR = (Σ b_i²)² / Σ b_i⁴ : ~1 if one conductance dominates, ~n if uniform;
//   - the sign of each b_i: which conductances lengthen vs shorten the period.
//
// The gradient is LOCAL to θ* and valid only while the rhythm stays intact, so we use a small step
// (default ±0.05 log10 ≈ ±12%, the value used by the shape-FIM) and FLAG any displacement point whose
// rhythm collapsed (period undefined) — a flagged component is unreliable and reported as such.
import type { Network, SimSettings } from '../types'
import { paramMapping } from '../paramVector'
import { summaryStatsOf } from '../metrics'

export interface PeriodSensitivityOptions {
  sim?: Partial<SimSettings>
  eps?: number // central-difference step in log10-conductance space (default 0.05 ≈ ±12%)
}

export interface PeriodGradientComponent {
  name: string
  slope: number // b_i = ∂ log10(T) / ∂ log10(g_i) (signed)
  absShare: number // |b_i| / Σ|b| (fraction of the gradient's L1 norm)
  collapsedAtStep: boolean // true if + or − displacement collapsed the rhythm (component unreliable)
}

export interface PeriodSensitivityResult {
  referencePeriod: number | null // T* at θ* (ms)
  eps: number
  gradient: PeriodGradientComponent[] // sorted by |slope|, descending
  gradientNormL1: number // Σ |b_i|
  gradientNormL2: number // sqrt(Σ b_i²)
  participationRatio: number // (Σ b²)² / Σ b⁴ ∈ [1, n]; 1 = one axis dominates, n = uniform
  participationFraction: number // participationRatio / n ∈ (0, 1]
  nForHalf: number // # of top conductances whose |b| sum reaches 50% of the L1 norm
  nForNinety: number // … reaches 90%
  anyCollapsed: boolean // any component flagged (then read the gradient with caution)
  n: number
}

const log10 = (x: number) => Math.log10(x)

/**
 * Compute the period gradient ∂log10(T)/∂log10(g) at the network's parameter point via central
 * differences. Returns the signed per-conductance slopes plus concentration diagnostics.
 */
export function periodGradient(base: Network, options: PeriodSensitivityOptions = {}): PeriodSensitivityResult {
  const sim = options.sim ?? { durationMs: 8000, dt: 0.05, noise: 0 }
  const eps = options.eps ?? 0.05

  const baseVec = paramMapping.toVector(base) // log10 space
  const names = baseVec.names
  const n = names.length

  const refStats = summaryStatsOf(base, sim)
  const referencePeriod = refStats.cyclePeriod

  const raw: { name: string; slope: number; collapsedAtStep: boolean }[] = []
  for (let i = 0; i < n; i++) {
    const plus = { ...baseVec, values: baseVec.values.map((x, j) => (j === i ? x + eps : x)) }
    const minus = { ...baseVec, values: baseVec.values.map((x, j) => (j === i ? x - eps : x)) }
    const tp = summaryStatsOf(paramMapping.toNetwork(base, plus), sim).cyclePeriod
    const tm = summaryStatsOf(paramMapping.toNetwork(base, minus), sim).cyclePeriod
    const collapsedAtStep = tp == null || tp <= 0 || tm == null || tm <= 0
    // Central difference on log10(T). If a side collapsed, the slope is undefined → 0 and flagged.
    const slope = collapsedAtStep ? 0 : (log10(tp as number) - log10(tm as number)) / (2 * eps)
    raw.push({ name: names[i], slope, collapsedAtStep })
  }

  const absSum = raw.reduce((s, c) => s + Math.abs(c.slope), 0)
  const sumSq = raw.reduce((s, c) => s + c.slope * c.slope, 0)
  const sumQuad = raw.reduce((s, c) => s + c.slope ** 4, 0)
  const participationRatio = sumQuad > 0 ? (sumSq * sumSq) / sumQuad : 0

  const sorted = raw
    .map((c) => ({ ...c, absShare: absSum > 0 ? Math.abs(c.slope) / absSum : 0 }))
    .sort((a, b) => Math.abs(b.slope) - Math.abs(a.slope))

  const countForFraction = (frac: number): number => {
    let acc = 0
    for (let k = 0; k < sorted.length; k++) {
      acc += sorted[k].absShare
      if (acc >= frac) return k + 1
    }
    return sorted.length
  }

  return {
    referencePeriod,
    eps,
    gradient: sorted,
    gradientNormL1: absSum,
    gradientNormL2: Math.sqrt(sumSq),
    participationRatio,
    participationFraction: n > 0 ? participationRatio / n : 0,
    nForHalf: countForFraction(0.5),
    nForNinety: countForFraction(0.9),
    anyCollapsed: raw.some((c) => c.collapsedAtStep),
    n,
  }
}
