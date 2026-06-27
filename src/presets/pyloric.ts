import type { Network } from '../types'

// Pyloric network of the crab stomatogastric ganglion (Prinz, Bucher & Marder,
// Nat Neurosci 2004, doi:10.1038/nn1352).
//
// This preset uses a VALIDATED parameter set taken directly from the reference
// implementation mackelab/pyloric (the 31-value circuit from its
// `test_valid_simulation`, which the repo certifies as a "pyloric_like" rhythm).
// Running these exact values through our engine reproduces the reference output
// (short AB/PD bursts, a long LP burst, a short PY burst, period ≈ 1 s) — a
// direct cross-check that our STG/synapse equations match the reference.
//
// Membrane conductances (8 currents, mS/cm²): [g_Na,g_CaT,g_CaS,g_A,g_KCa,g_Kd,g_H,g_leak]
// noise = 0.001 µA Gaussian current per step, matching the reference's noise_std.
const ABPD = { gNa: 286.921725, gCaT: 0.0975099899, gCaS: 5.53758392, gA: 21.755384,  gKCa: 12.1938578, gKd: 123.777092, gH: 0.00964585042, gLeak: 0.00516584517, I_stim: 0, noise: 0.001, stimOnset: 0, stimDuration: 0 }
const LP   = { gNa: 167.802913, gCaT: 0.994858342,  gCaS: 7.71058188, gA: 19.2827439,  gKCa: 7.30915903, gKd: 43.390796,  gH: 0.050381617,   gLeak: 0.021214225,  I_stim: 0, noise: 0.001, stimOnset: 0, stimDuration: 0 }
const PY   = { gNa: 477.249899, gCaT: 5.10924385,   gCaS: 0.713955321, gA: 39.6705037, gKCa: 4.89271588, gKd: 59.2566636, gH: 0.0551743568,  gLeak: 0.0121729756, I_stim: 0, noise: 0.001, stimOnset: 0, stimDuration: 0 }

// Synaptic strengths are stored in the reference as ln(ḡ_syn); ḡ_syn = exp(value), in mS.
// Glutamatergic: E_syn=−70 mV; cholinergic (the PD components): E_syn=−80 mV.
const syn = (id: string, src: string, tgt: string, lnG: number, synClass: 'glut' | 'chol') => ({
  id, sourceId: src, targetId: tgt, targetCompartment: 'soma' as const,
  type: 'inhibitory' as const, conductance: Math.exp(lnG), deliveryTime: 0,
  mechanism: 'graded' as const, synClass,
})

export const pyloricPreset: Network = {
  version: 1, name: 'Pylorisches Netzwerk',
  neurons: [
    { id: 'abpd', position: { x: 400, y: 120 }, label: 'AB/PD', model: 'stg', params: { ...ABPD } },
    { id: 'lp',   position: { x: 280, y: 330 }, label: 'LP',    model: 'stg', params: { ...LP } },
    { id: 'py',   position: { x: 520, y: 330 }, label: 'PY',    model: 'stg', params: { ...PY } },
  ],
  // Canonical 7-synapse connectivity (the AB and PD components of the pacemaker
  // synapse onto each follower glutamatergically AND cholinergically).
  synapses: [
    syn('s_ab_lp', 'abpd', 'lp',  -10.8318439, 'glut'),  // AB → LP
    syn('s_pd_lp', 'abpd', 'lp',  -10.5837408, 'chol'),  // PD → LP
    syn('s_ab_py', 'abpd', 'py',  -13.891689,  'glut'),  // AB → PY
    syn('s_pd_py', 'abpd', 'py',  -9.07825715, 'chol'),  // PD → PY
    syn('s_lp_pd', 'lp',   'abpd', -8.90034224, 'glut'), // LP → AB/PD
    syn('s_lp_py', 'lp',   'py',  -15.7819342, 'glut'),  // LP → PY
    syn('s_py_lp', 'py',   'lp',  -7.23973359, 'glut'),  // PY → LP
  ],
  // The reference integrates at dt = 0.025 ms; matching it keeps the rhythm faithful.
  simulation: { length: 5000, step: 0.025 },
  // Measure all three somata so the triphasic sequence is visible immediately.
  electrodes: [
    { neuronId: 'abpd', compartment: 'soma' },
    { neuronId: 'lp',   compartment: 'soma' },
    { neuronId: 'py',   compartment: 'soma' },
  ],
}
