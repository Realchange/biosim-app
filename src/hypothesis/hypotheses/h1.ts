// src/hypothesis/hypotheses/h1.ts
// H1 — "stiff vs. sloppy / ratios-vs-absolute-levels" (SPEC §9).
// Tested with the period-invariant phase metric + period-tolerant flag, so pure retiming (the
// scaling axis) is NOT counted as breaking the rhythm. Ranges/samples are starting values.
import type { Hypothesis } from '../types'

export const H1: Hypothesis = {
  id: 'h1-stiff-sloppy',
  statement: 'Only the ratios of conductances matter for the pyloric rhythm, not their absolute level.',
  formal:
    'In log-conductance space the homogeneous scaling axis (1,…,1) is a sloppy (low-curvature) direction ' +
    'of the phase (period-invariant) rhythm-distance cost, while ratio-changing (zero-sum) directions are ' +
    'stiff; equivalently the scaling axis projects onto the smallest-eigenvalue eigenvectors of the phase ' +
    'distance Hessian at θ*.',
  prediction:
    'Under the phase metric, scaling keeps the rhythm over a wide displacement (only the period shifts); ' +
    'ratio sweeps break the triphasic structure quickly; random directions aligned with the scaling axis ' +
    'stay pyloric more often than misaligned ones.',
  manipulations: [
    { kind: 'scaleAll', logRange: [-3, 3], steps: 61, targets: 'all' },
    { kind: 'ratio', up: ['*.gNa'], down: ['*.gKd'], logRange: [-3, 3], steps: 61 },
    { kind: 'ratio', up: ['*.gCaS'], down: ['*.gKCa'], logRange: [-3, 3], steps: 61 },
    { kind: 'randomDirections', radius: 0.7, samples: 300, seed: 1 },
  ],
  testableNow: true,
}
