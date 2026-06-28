import type { Network } from '../types'

// "Half-centre oscillator" (HCO) — inspired by xolotl's HCO network example
// (Gorur-Shandilya, Hoyland & Marder 2018, github.com/sg-s/xolotl). Two identical
// conductance-based bursting neurons inhibit each other reciprocally; mutual
// inhibition forces them into anti-phase, so they fire in clean alternation —
// the classic motif behind locomotor central pattern generators.
//
// Implementation note: xolotl's HCO uses an escape/release mechanism (non-bursting
// cells + a very slow H-current). Our H-current time constant is fixed, so we use
// two intrinsic bursters (the Bursting-neuron set) with reciprocal graded
// inhibition — the same half-centre phenomenon (anti-phase bursting), reimplemented
// in our engine. A little membrane noise breaks the initial symmetry.
const CELL = {
  gNa: 1000, gCaT: 25, gCaS: 60, gA: 500, gKCa: 50, gKd: 1000, gH: 0.1, gLeak: 0,
  I_stim: 0, noise: 0.001, stimOnset: 0, stimDuration: 0,
}

const inh = (id: string, src: string, tgt: string) => ({
  id, sourceId: src, targetId: tgt, targetCompartment: 'soma' as const,
  type: 'inhibitory' as const, conductance: 3e-3, deliveryTime: 0,
  mechanism: 'graded' as const, synClass: 'glut' as const,
})

export const xolotlHcoPreset: Network = {
  version: 1, name: 'Xolotl: Half-Center-Oszillator',
  neurons: [
    { id: 'c1', position: { x: 300, y: 240 }, label: 'Zelle 1', model: 'stg', params: { ...CELL } },
    { id: 'c2', position: { x: 540, y: 240 }, label: 'Zelle 2', model: 'stg', params: { ...CELL } },
  ],
  synapses: [
    inh('s_c1_c2', 'c1', 'c2'),   // reciprocal inhibition →
    inh('s_c2_c1', 'c2', 'c1'),   // ← drives anti-phase alternation
  ],
  simulation: { length: 6000, step: 0.05 },
  electrodes: [
    { neuronId: 'c1', compartment: 'soma' },
    { neuronId: 'c2', compartment: 'soma' },
  ],
}
