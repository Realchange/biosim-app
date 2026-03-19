import type { Network } from '../types'

export const reflexArcPreset: Network = {
  version: 1, name: 'Reflexbogen',
  neurons: [
    { id: 'sensory', position: { x: 150, y: 200 }, model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 8,  R_m: 10, I_stim: 2.5 } },
    { id: 'inter',   position: { x: 350, y: 200 }, model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 0 } },
    { id: 'motor',   position: { x: 550, y: 200 }, model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 12, R_m: 10, I_stim: 0 } },
  ],
  synapses: [
    { id: 's1', sourceId: 'sensory', targetId: 'inter', targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 },
    { id: 's2', sourceId: 'inter',   targetId: 'motor', targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 },
  ],
  simulation: { length: 200, step: 0.1 },
}
