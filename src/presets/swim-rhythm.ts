import type { Network } from '../types'

// Central pattern generator built from half-centres (see Half-Center-Oszillator).
// Each segment has a left and a right neuron that inhibit each other; spike-triggered
// fatigue (adapt) makes the active side tire so the other takes over — the pair fire
// in slow alternating bursts. Excitation links the segments along the body. Left
// neurons are driven slightly harder so the left side leads.
const base = { E_rest: -70, V_threshold: -55, tau_m: 12, R_m: 10, adapt: 1.6 }
const L_DRIVE = 4.2
const R_DRIVE = 4.0
const left  = (x: number, n: string, l: string) => ({
  id: n, position: { x, y: 150 }, label: l, model: 'lif' as const,
  params: { ...base, I_stim: L_DRIVE },
})
const right = (x: number, n: string, l: string) => ({
  id: n, position: { x, y: 330 }, label: l, model: 'lif' as const,
  params: { ...base, I_stim: R_DRIVE },
})

export const swimRhythmPreset: Network = {
  version: 1, name: 'Schwimmrhythmus',
  neurons: [
    left(200, 'cpg1L', 'Links 1'),  right(200, 'cpg1R', 'Rechts 1'),
    left(390, 'cpg2L', 'Links 2'),  right(390, 'cpg2R', 'Rechts 2'),
    left(580, 'cpg3L', 'Links 3'),  right(580, 'cpg3R', 'Rechts 3'),
  ],
  synapses: [
    // Reciprocal inhibition within each segment → left/right alternation (bursts)
    { id: 'ih1', sourceId: 'cpg1L', targetId: 'cpg1R', targetCompartment: 'soma', type: 'inhibitory', conductance: 5, deliveryTime: 2 },
    { id: 'ih2', sourceId: 'cpg1R', targetId: 'cpg1L', targetCompartment: 'soma', type: 'inhibitory', conductance: 5, deliveryTime: 2 },
    { id: 'ih3', sourceId: 'cpg2L', targetId: 'cpg2R', targetCompartment: 'soma', type: 'inhibitory', conductance: 5, deliveryTime: 2 },
    { id: 'ih4', sourceId: 'cpg2R', targetId: 'cpg2L', targetCompartment: 'soma', type: 'inhibitory', conductance: 5, deliveryTime: 2 },
    { id: 'ih5', sourceId: 'cpg3L', targetId: 'cpg3R', targetCompartment: 'soma', type: 'inhibitory', conductance: 5, deliveryTime: 2 },
    { id: 'ih6', sourceId: 'cpg3R', targetId: 'cpg3L', targetCompartment: 'soma', type: 'inhibitory', conductance: 5, deliveryTime: 2 },
    // Excitatory coupling links the segments along the body
    { id: 'ex1', sourceId: 'cpg1L', targetId: 'cpg2L', targetCompartment: 'dend1', type: 'excitatory', conductance: 2, deliveryTime: 4 },
    { id: 'ex2', sourceId: 'cpg1R', targetId: 'cpg2R', targetCompartment: 'dend1', type: 'excitatory', conductance: 2, deliveryTime: 4 },
    { id: 'ex3', sourceId: 'cpg2L', targetId: 'cpg3L', targetCompartment: 'dend1', type: 'excitatory', conductance: 2, deliveryTime: 4 },
    { id: 'ex4', sourceId: 'cpg2R', targetId: 'cpg3R', targetCompartment: 'dend1', type: 'excitatory', conductance: 2, deliveryTime: 4 },
  ],
  simulation: { length: 600, step: 0.1 },
}
