// src/hypothesis/primitives/randomDirections.ts
// randomDirections: sample isotropic unit directions (seeded), step out by `radius`, and record
// each direction's alignment with the scaling axis. The distribution of resulting distances reveals
// the local anisotropy (few stiff directions, many sloppy ones); plotting distance vs alignment
// shows whether the scaling axis sits among the sloppy directions.
import type { ParameterVector } from '../types'
import { scalingAxis, step } from '../paramVector'
import { mulberry32, randomUnitVector } from '../rng'

export interface RandomPoint {
  vector: ParameterVector
  alignment: number // |cos angle| between the sampled direction and the scaling axis (0..1)
}

export function randomDirections(
  base: ParameterVector,
  radius: number,
  samples: number,
  seed: number,
): RandomPoint[] {
  const n = base.values.length
  const rng = mulberry32(seed)
  const axis = scalingAxis(n)
  const out: RandomPoint[] = []
  for (let i = 0; i < samples; i++) {
    const dir = randomUnitVector(n, rng)
    const dot = dir.reduce((s, x, j) => s + x * axis[j], 0)
    out.push({ vector: step(base, dir, radius), alignment: Math.abs(dot) })
  }
  return out
}
