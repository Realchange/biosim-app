// src/hypothesis/primitives/sweep.ts
// sweep: vary a SINGLE parameter over a range while holding all others fixed. Used to test whether a
// parameter the local FIM flags as sloppy is globally redundant (shape unchanged across orders of
// magnitude) or merely small at θ* (log-space makes small conductances look sloppy locally).
import type { ParameterVector } from '../types'

export interface SweepPoint {
  amount: number
  vector: ParameterVector
}

/**
 * `amount` is added to the parameter's coordinate. space='log10' (default): amount is a log10 shift,
 * so range [-3,3] scales the parameter by ×0.001…×1000 of its θ* value. space='linear': amount is
 * added to the linear conductance (then mapped back to the vector's log10 coordinate).
 */
export function singleSweep(
  base: ParameterVector,
  param: string,
  range: [number, number],
  steps: number,
  space: 'log10' | 'linear' = 'log10',
): SweepPoint[] {
  const idx = base.names.indexOf(param)
  if (idx < 0) {
    throw new Error(`sweep: unknown parameter '${param}'. Known names include: ${base.names.slice(0, 8).join(', ')} …`)
  }
  const [lo, hi] = range
  const out: SweepPoint[] = []
  for (let i = 0; i < steps; i++) {
    const amount = steps === 1 ? lo : lo + ((hi - lo) * i) / (steps - 1)
    const values = base.values.slice()
    if (space === 'log10') {
      values[idx] = base.values[idx] + amount
    } else {
      const lin = Math.pow(10, base.values[idx]) + amount
      values[idx] = Math.log10(Math.max(lin, 1e-12))
    }
    out.push({ amount, vector: { ...base, values } })
  }
  return out
}
