import type { Network } from '../types'

// The simplest oscillator: two neurons that inhibit each other. Neither oscillates
// on its own — the rhythm emerges from the coupling plus slow fatigue (adaptation).
// The active neuron builds up fatigue until it drops below its partner, which then
// takes over: the two fire in slow, alternating BURSTS. This is the building block
// of the swim-rhythm CPG, reduced to a single half-centre.
const base = { E_rest: -70, V_threshold: -55, tau_m: 12, R_m: 10, adapt: 1.6 }

export const halfCenterPreset: Network = {
  version: 1, name: 'Half-Center-Oszillator',
  neurons: [
    { id: 'n1', position: { x: 280, y: 240 }, label: 'Neuron 1', model: 'lif',
      params: { ...base, I_stim: 4.2 } },   // slightly stronger → leads
    { id: 'n2', position: { x: 520, y: 240 }, label: 'Neuron 2', model: 'lif',
      params: { ...base, I_stim: 4.0 } },
  ],
  synapses: [
    { id: 's1', sourceId: 'n1', targetId: 'n2', targetCompartment: 'soma', type: 'inhibitory', conductance: 5, deliveryTime: 2 },
    { id: 's2', sourceId: 'n2', targetId: 'n1', targetCompartment: 'soma', type: 'inhibitory', conductance: 5, deliveryTime: 2 },
  ],
  simulation: { length: 600, step: 0.1 },
}
