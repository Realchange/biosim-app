import { Network } from '../types'
import { DEFAULT_HH_PARAMS } from '../types'

export const swimRhythmPreset: Network = {
  version: 1, name: 'Schwimmrhythmus',
  neurons: [
    { id: 'cpg1L', position: { x: 200, y: 150 }, model: 'hodgkin-huxley', params: { ...DEFAULT_HH_PARAMS, I_stim: 8 } },
    { id: 'cpg1R', position: { x: 200, y: 320 }, model: 'hodgkin-huxley', params: { ...DEFAULT_HH_PARAMS, I_stim: 8 } },
    { id: 'cpg2L', position: { x: 380, y: 150 }, model: 'hodgkin-huxley', params: { ...DEFAULT_HH_PARAMS, I_stim: 6 } },
    { id: 'cpg2R', position: { x: 380, y: 320 }, model: 'hodgkin-huxley', params: { ...DEFAULT_HH_PARAMS, I_stim: 6 } },
    { id: 'cpg3L', position: { x: 560, y: 150 }, model: 'hodgkin-huxley', params: { ...DEFAULT_HH_PARAMS, I_stim: 6 } },
    { id: 'cpg3R', position: { x: 560, y: 320 }, model: 'hodgkin-huxley', params: { ...DEFAULT_HH_PARAMS, I_stim: 6 } },
  ],
  synapses: [
    { id: 'ih1', sourceId: 'cpg1L', targetId: 'cpg1R', targetCompartment: 'soma', type: 'inhibitory', conductance: 4, deliveryTime: 1 },
    { id: 'ih2', sourceId: 'cpg1R', targetId: 'cpg1L', targetCompartment: 'soma', type: 'inhibitory', conductance: 4, deliveryTime: 1 },
    { id: 'ih3', sourceId: 'cpg2L', targetId: 'cpg2R', targetCompartment: 'soma', type: 'inhibitory', conductance: 4, deliveryTime: 1 },
    { id: 'ih4', sourceId: 'cpg2R', targetId: 'cpg2L', targetCompartment: 'soma', type: 'inhibitory', conductance: 4, deliveryTime: 1 },
    { id: 'ex1', sourceId: 'cpg1L', targetId: 'cpg2L', targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 },
    { id: 'ex2', sourceId: 'cpg1R', targetId: 'cpg2R', targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 },
    { id: 'ex3', sourceId: 'cpg2L', targetId: 'cpg3L', targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 },
    { id: 'ex4', sourceId: 'cpg2R', targetId: 'cpg3R', targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 },
  ],
  simulation: { length: 300, step: 0.1 },
}
