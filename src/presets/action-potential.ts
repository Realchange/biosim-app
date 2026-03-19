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
      I_stim: 10,
      E_Na: 50, E_K: -77, E_Ca: 120, E_leak: -54.387,
      g_Na: 120, g_K: 36, g_Ca: 0.3, g_leak: 0.3,
      C_m: 1.0, g_core: 0.1,
    },
  }],
  synapses: [],
  simulation: { length: 100, step: 0.1 },
}
