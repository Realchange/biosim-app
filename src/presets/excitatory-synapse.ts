import type { Network } from '../types'

export const excitatorySynapsePreset: Network = {
  version: 1, name: 'Exzitatorische Synapse',
  neurons: [
    { id: 'pre',  position: { x: 180, y: 200 }, model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 1.0 } },
    { id: 'post', position: { x: 420, y: 200 }, model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 0 } },
  ],
  synapses: [{ id: 's1', sourceId: 'pre', targetId: 'post',
    targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 }],
  simulation: { length: 150, step: 0.1 },
}
