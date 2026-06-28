import type { Network } from '../types'

// "Bursting neuron" — reproduces the canonical single-neuron example of the xolotl
// simulator (Gorur-Shandilya, Hoyland & Marder 2018). A single-compartment
// conductance-based STG neuron with the Prinz channel set bursts intrinsically.
// The maximal conductances are taken from xolotl's BurstingNeuron('prinz') example
// (github.com/sg-s/xolotl). The model is reimplemented in our engine (the Prinz
// equations are published science) — xolotl's GPL-3.0 code is NOT used.
// [g_Na, g_CaT, g_CaS, g_A, g_KCa, g_Kd, g_H, g_leak] (mS/cm²)
const AB = {
  gNa: 1000, gCaT: 25, gCaS: 60, gA: 500, gKCa: 50, gKd: 1000, gH: 0.1, gLeak: 0,
  I_stim: 0, noise: 0, stimOnset: 0, stimDuration: 0,
}

export const xolotlBurstPreset: Network = {
  version: 1, name: 'Xolotl: Burst-Neuron',
  neurons: [
    { id: 'ab', position: { x: 420, y: 240 }, label: 'AB (Burster)', model: 'stg', params: { ...AB } },
  ],
  synapses: [],
  simulation: { length: 4000, step: 0.05 },
  electrodes: [{ neuronId: 'ab', compartment: 'soma' }],
}
