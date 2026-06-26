import type { Network } from '../types'

// Stretch reflex with reciprocal (Ia) inhibition — the defining principle of a
// reflex arc (Sherrington's reciprocal innervation):
//   Sensory (Ia afferent) ──(+)──► Agonist motoneuron      → muscle contracts
//                         └──(+)──► Ia inhibitory interneuron ──(−)──► Antagonist
//                                                              motoneuron → relaxes
// A brief "stretch" drives the Ia afferent: the agonist fires (contracts) while the
// antagonist's tonic activity is suppressed (relaxes). Modelled after the spinal
// reflex circuits in Rybak et al. 2006, J Physiol (doi:10.1113/jphysiol.2006.118711).
export const reflexArcPreset: Network = {
  version: 1, name: 'Reflexbogen',
  neurons: [
    // Ia afferent: a transient "stretch" stimulus drives it (pulse window).
    { id: 'sensory', position: { x: 160, y: 250 }, label: 'Sensorisch', model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 8, R_m: 10, I_stim: 2.5, stimOnset: 40, stimDuration: 100 } },
    { id: 'inter',   position: { x: 380, y: 130 }, label: 'Ia-Interneuron', model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 0 } },
    { id: 'agonist', position: { x: 600, y: 190 }, label: 'Agonist', model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 12, R_m: 10, I_stim: 0 } },
    // Antagonist fires at a baseline tonus so its reflex suppression is visible.
    { id: 'antagonist', position: { x: 600, y: 340 }, label: 'Antagonist', model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 12, R_m: 10, I_stim: 2.0 } },
  ],
  synapses: [
    // Monosynaptic excitation of the agonist (the stretch reflex proper)
    { id: 's1', sourceId: 'sensory', targetId: 'agonist', targetCompartment: 'dend1', type: 'excitatory', conductance: 10, deliveryTime: 2 },
    // Ia afferent also excites the inhibitory interneuron…
    { id: 's2', sourceId: 'sensory', targetId: 'inter', targetCompartment: 'dend1', type: 'excitatory', conductance: 10, deliveryTime: 2 },
    // …which reciprocally inhibits the antagonist motoneuron
    { id: 's3', sourceId: 'inter', targetId: 'antagonist', targetCompartment: 'dend2', type: 'inhibitory', conductance: 5, deliveryTime: 2 },
  ],
  simulation: { length: 220, step: 0.1 },
}
