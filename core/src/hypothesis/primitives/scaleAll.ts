// src/hypothesis/primitives/scaleAll.ts
// scaleAll: step along the homogeneous-scaling direction — tests whether only ratios matter.
// `amount` is the signed Euclidean displacement (log10 units) along the UNIT scaling direction,
// so its distance-vs-amount slope is directly comparable to a ratio sweep's (both unit-normalised).
// A displacement `r` shifts each selected conductance's log10 by r/√k (k = # selected params),
// i.e. multiplies it by 10^(r/√k); ratios within the selected group are preserved.
import type { ParameterVector } from '../types'
import { step } from '../paramVector'

export interface ScaledPoint {
  amount: number
  vector: ParameterVector
}

export function scaleAll(
  base: ParameterVector,
  logRange: [number, number],
  steps: number,
  targets: 'membrane' | 'synaptic' | 'all' = 'all',
): ScaledPoint[] {
  const isSyn = (nm: string) => nm.startsWith('syn')
  const selected = (nm: string) =>
    targets === 'all' ? true : targets === 'synaptic' ? isSyn(nm) : !isSyn(nm)
  const mask = base.names.map((nm) => (selected(nm) ? 1 : 0))
  const norm = Math.hypot(...mask) || 1
  const axis = mask.map((x) => x / norm) // unit, uniform over selected components
  const [lo, hi] = logRange
  const out: ScaledPoint[] = []
  for (let i = 0; i < steps; i++) {
    const amount = steps === 1 ? lo : lo + ((hi - lo) * i) / (steps - 1)
    out.push({ amount, vector: step(base, axis, amount) })
  }
  return out
}
