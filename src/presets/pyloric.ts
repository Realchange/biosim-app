import type { Network } from '../types'

// Pyloric network of the crab stomatogastric ganglion (Prinz, Bucher & Marder,
// Nat Neurosci 2004, doi:10.1038/nn1352). Three model neurons — the AB/PD
// pacemaker kernel and the LP and PY followers — wired by the canonical
// 7 graded chemical synapses produce the triphasic rhythm AB/PD → LP → PY.
//
// Conductance set per neuron (8 currents, mS/cm²):
//   [g_Na, g_CaT, g_CaS, g_A, g_KCa, g_Kd, g_H, g_leak]
// AB/PD uses the canonical Prinz pacemaker (PM_4). LP and PY were found by a
// systematic parameter search (Prinz's own method, in miniature) that scored
// thousands of conductance/synapse combinations for a sustained, correctly
// ordered, cleanly bursting rhythm. The key ingredients (matching the biology):
//   • LP carries a Ca-activated K current (g_KCa) → its burst self-terminates,
//   • the AB/PD→follower synapses are BOTH glutamatergic and cholinergic — the
//     cholinergic component (E_syn = −80 mV, slow) gives the strong, sustained
//     hyperpolarisation that shapes a clean post-inhibitory rebound burst,
//   • a small tonic drive (I_stim) on the followers stands in for neuromodulation.
// Result: each cell fires exactly one tight burst per cycle, in order. All 8
// conductances and all synapses stay editable to explore the circuit.
const ABPD = { gNa: 300, gCaT: 2.5,  gCaS: 2, gA: 10,    gKCa: 5,    gKd: 125, gH: 0.01,  gLeak: 0,    I_stim: 0,      stimOnset: 0, stimDuration: 0 }
const LP   = { gNa: 100, gCaT: 0,    gCaS: 4, gA: 7.48,  gKCa: 5.61, gKd: 25,  gH: 0.094, gLeak: 0.03, I_stim: 0.0017, stimOnset: 0, stimDuration: 0 }
const PY   = { gNa: 500, gCaT: 6.46, gCaS: 4, gA: 31.25, gKCa: 3.33, gKd: 125, gH: 0.095, gLeak: 0.03, I_stim: 0.0022, stimOnset: 0, stimDuration: 0 }

// Graded chemical synapse (ḡ_syn in mS).
const syn = (id: string, src: string, tgt: string, c: number, synClass: 'glut' | 'chol') => ({
  id, sourceId: src, targetId: tgt, targetCompartment: 'soma' as const,
  type: 'inhibitory' as const, conductance: c, deliveryTime: 0,
  mechanism: 'graded' as const, synClass,
})

export const pyloricPreset: Network = {
  version: 1, name: 'Pylorisches Netzwerk',
  neurons: [
    { id: 'abpd', position: { x: 400, y: 120 }, label: 'AB/PD', model: 'stg', params: { ...ABPD } },
    { id: 'lp',   position: { x: 280, y: 330 }, label: 'LP',    model: 'stg', params: { ...LP } },
    { id: 'py',   position: { x: 520, y: 330 }, label: 'PY',    model: 'stg', params: { ...PY } },
  ],
  // Canonical Prinz connectivity: AB/PD → LP and AB/PD → PY each via a glutamatergic
  // AND a cholinergic synapse; LP → PY; PY → LP; and a weak LP → AB/PD feedback.
  synapses: [
    syn('s_abpd_lp_g', 'abpd', 'lp', 3.97e-4, 'glut'),
    syn('s_abpd_lp_c', 'abpd', 'lp', 5.9e-5,  'chol'),
    syn('s_abpd_py_g', 'abpd', 'py', 2.37e-4, 'glut'),
    syn('s_abpd_py_c', 'abpd', 'py', 1.39e-4, 'chol'),
    syn('s_lp_py',     'lp',   'py', 4.64e-4, 'glut'),  // LP delays/terminates → PY fires last
    syn('s_py_lp',     'py',   'lp', 3.66e-4, 'glut'),  // PY feeds back onto LP
    syn('s_lp_abpd',   'lp',   'abpd', 5.6e-5, 'glut'), // weak LP → pacemaker feedback
  ],
  simulation: { length: 6000, step: 0.1 },
  // Measure all three somata so the triphasic sequence is visible immediately.
  electrodes: [
    { neuronId: 'abpd', compartment: 'soma' },
    { neuronId: 'lp',   compartment: 'soma' },
    { neuronId: 'py',   compartment: 'soma' },
  ],
}
