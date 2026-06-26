import type { Network } from '../types'

export const inhibitorySynapsePreset: Network = {
  version: 1, name: 'Inhibitorische Synapse',
  neurons: [
    { id: 'driver',   position: { x: 150, y: 200 }, label: 'Antreiber', model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 2.5 } },
    // Target rests at -70 mV (no self-drive) so the inhibitory input shows up as
    // a clear downward hyperpolarisation (IPSP) — the opposite of an EPSP.
    { id: 'inhibited', position: { x: 420, y: 200 }, label: 'Gehemmt', model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 0 } },
  ],
  synapses: [{ id: 's1', sourceId: 'driver', targetId: 'inhibited',
    targetCompartment: 'dend2', type: 'inhibitory', conductance: 2, deliveryTime: 2 }],
  simulation: { length: 200, step: 0.1 },
}
