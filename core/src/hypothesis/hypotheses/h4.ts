// src/hypothesis/hypotheses/h4.ts
// H4 — KCa necessity. Evaluated with single-parameter sweeps:  npx tsx src/hypothesis/cli-sweep.ts lp.gKCa py.gKCa
import type { Hypothesis } from '../types'

export const H4: Hypothesis = {
  id: 'h4-kca-necessary',
  statement: 'Calcium-activated potassium (KCa) conductance is among the least replaceable currents for the rhythm.',
  formal:
    'Single-parameter sweeps of gKCa over orders of magnitude break the period-invariant rhythm shape at small ' +
    'displacements (high √g_ii), unlike a sloppy control such as the abpd→py synapse.',
  prediction:
    'Sweeping lp.gKCa and py.gKCa by ×0.1…×10 drives the phase distance above τ and/or loses the triphasic structure.',
  manipulations: [
    { kind: 'sweep', param: 'lp.gKCa', range: [-3, 3], steps: 31, space: 'log10' },
    { kind: 'sweep', param: 'py.gKCa', range: [-3, 3], steps: 31, space: 'log10' },
  ],
  testableNow: true,
}
