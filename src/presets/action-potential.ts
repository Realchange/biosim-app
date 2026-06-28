import type { Network } from '../types'

// Uses Hodgkin-Huxley so the action potential shape (fast depolarisation,
// repolarisation, AHP) emerges naturally from Na⁺/K⁺ channel dynamics.
export const actionPotentialPreset: Network = {
  version: 1,
  name: 'Aktionspotential',
  neurons: [{
    id: 'n1',
    position: { x: 300, y: 200 },
    model: 'hodgkin-huxley',
    params: {
      I_stim: 12,
      // Brief 1 ms current pulse at t = 5 ms → exactly one clean action potential.
      // stimPeriod = 25 ms repeats it (a 40 Hz train): in the 30 ms run only the first
      // pulse fires, but the endless Live mode re-triggers it so parameter changes are
      // observable. Set stimDuration to 0 for a sustained drive instead.
      stimOnset: 5, stimDuration: 1, stimPeriod: 25,
      E_Na: 50, E_K: -77, E_Ca: 120, E_leak: -54.387,
      g_Na: 120, g_K: 36, g_Ca: 0.3, g_leak: 0.3,
      C_m: 1.0, g_core: 0.1,
    },
  }],
  synapses: [],
  // Fine step (0.025 ms) so the fast upstroke/repolarisation render as a smooth curve.
  simulation: { length: 30, step: 0.025 },
}
