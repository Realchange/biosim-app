// src/hypothesis/hypotheses/h2.ts
// H2 — synaptic vs. intrinsic. Answered from the FIM diagonal (cli-fim.ts), not a sweep.
import type { Hypothesis } from '../types'

export const H2: Hypothesis = {
  id: 'h2-synaptic-vs-intrinsic',
  statement: 'Intrinsic conductances constrain the rhythm shape more tightly than synaptic conductances.',
  formal:
    'At θ*, the single-axis FIM stiffness √g_ii is systematically larger for intrinsic-conductance parameters ' +
    'than for graded-synapse parameters.',
  prediction:
    'Grouping √g_ii by type, the intrinsic group has a higher geometric mean than the synaptic group; the ' +
    'sloppiest single directions are synaptic, the stiffest intrinsic.',
  manipulations: [], // evaluated from the FIM diagonal, not via the runner
  testableNow: true,
}
