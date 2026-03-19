import type { Network } from '../types'

export const actionPotentialPreset: Network = {
  version: 1,
  name: 'Aktionspotential',
  neurons: [{
    id: 'n1',
    position: { x: 300, y: 200 },
    model: 'lif',
    params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 0.8 },
  }],
  synapses: [],
  simulation: { length: 100, step: 0.1 },
}
