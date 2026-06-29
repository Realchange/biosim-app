// src/hypothesis/primitives/ratio.ts
// ratio: step along a zero-sum direction (+up, −down) — tests whether a specific balance is stiff.
// `amount` is the signed Euclidean displacement (log10 units) along the UNIT ratio direction,
// directly comparable to scaleAll's amount. Give balanced up/down sets (e.g. all gNa vs all gKd)
// for a strictly mean-preserving (sum-zero) move.
import type { ParameterVector } from '../types'
import { ratioDirection, step } from '../paramVector'

export interface RatioPoint {
  amount: number
  vector: ParameterVector
}

export function ratioSweep(
  base: ParameterVector,
  up: string[],
  down: string[],
  logRange: [number, number],
  steps: number,
): RatioPoint[] {
  const dir = ratioDirection(base.names, up, down)
  const [lo, hi] = logRange
  const out: RatioPoint[] = []
  for (let i = 0; i < steps; i++) {
    const amount = steps === 1 ? lo : lo + ((hi - lo) * i) / (steps - 1)
    out.push({ amount, vector: step(base, dir, amount) })
  }
  return out
}
