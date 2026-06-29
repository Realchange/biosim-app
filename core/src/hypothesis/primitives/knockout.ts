// src/hypothesis/primitives/knockout.ts
// knockout: set one or more conductances to (effectively) zero, all others fixed. Unlike a reduction
// sweep, this tests true necessity at the boundary: a parameter that the log-space sweep can only
// approach is here removed outright. The zero is represented in the vector by a log10 FLOOR low
// enough that exp10(floor) is numerically negligible relative to any physiological conductance.
import type { ParameterVector } from '../types'

// 10^-12 nS is ~12 orders below the smallest reference conductance: an effective zero.
export const KNOCKOUT_FLOOR = -12

export interface KnockoutPoint {
  amount: number // 1 = baseline (recover), 0 = knocked out — recorded as meta for digests
  vector: ParameterVector
}

/**
 * Produce the knockout point (all listed params forced to the floor). If `recover` is true, also
 * include the unperturbed baseline as a first point, so a single run shows both the intact rhythm
 * and the lesion side by side (amount 1 then 0).
 */
export function knockout(base: ParameterVector, params: string[], recover = false): KnockoutPoint[] {
  for (const p of params) {
    if (base.names.indexOf(p) < 0) {
      throw new Error(`knockout: unknown parameter '${p}'. Known names include: ${base.names.slice(0, 8).join(', ')} …`)
    }
  }
  const lesion = base.values.slice()
  for (const p of params) lesion[base.names.indexOf(p)] = KNOCKOUT_FLOOR
  const pts: KnockoutPoint[] = []
  if (recover) pts.push({ amount: 1, vector: { ...base, values: base.values.slice() } })
  pts.push({ amount: 0, vector: { ...base, values: lesion } })
  return pts
}
