// src/simulation/network.ts
import { Neuron, Synapse } from '../types'
import { lifStep, DEFAULT_LIF_STATE, LIFState } from './lif'
import { hhStep, DEFAULT_HH_COMPARTMENT, HHAllCompartments } from './hodgkin-huxley'

export interface NetworkStepResult {
  neurons: Neuron[]
  voltages: Record<string, number>   // soma voltage per neuron id
  spikes: Record<string, boolean>    // true if neuron fired this step
}

// Internal runtime state kept outside Neuron (not serialized)
// Note: these are module-level but reset via resetSimulationState() before each run
const lifStates = new Map<string, LIFState>()
const hhStates  = new Map<string, HHAllCompartments>()
// Synaptic delay queue: Map<targetNeuronId, Array<{deliveryT, current, compartment}>>
const synapticQueue = new Map<string, Array<{ deliveryT: number; current: number; compartment: string }>>()
let currentT = 0

export function resetSimulationState() {
  lifStates.clear()
  hhStates.clear()
  synapticQueue.clear()
  currentT = 0
}

// Drain all synaptic events due at currentT, return total current
function drainSynapticCurrent(neuronId: string): number {
  const queue = synapticQueue.get(neuronId) ?? []
  let total = 0
  const remaining = queue.filter(ev => {
    if (ev.deliveryT <= currentT) { total += ev.current; return false }
    return true
  })
  synapticQueue.set(neuronId, remaining)
  return total
}

function enqueueSynapticEvent(targetId: string, deliveryT: number, current: number, compartment: string) {
  const queue = synapticQueue.get(targetId) ?? []
  queue.push({ deliveryT, current, compartment })
  synapticQueue.set(targetId, queue)
}

export function networkStep(
  neurons: Neuron[],
  synapses: Synapse[],
  dt: number
): NetworkStepResult {
  currentT += dt
  const voltages: Record<string, number> = {}
  const spikes:   Record<string, boolean> = {}
  const updatedNeurons: Neuron[] = []

  for (const neuron of neurons) {
    const I_syn = drainSynapticCurrent(neuron.id)

    if (neuron.model === 'lif') {
      const params = neuron.params as import('../types').LIFParams
      const state  = lifStates.get(neuron.id) ?? { ...DEFAULT_LIF_STATE }
      // Add synaptic current as additional input on top of neuron's own I_stim
      const augmented = { ...params, I_stim: params.I_stim + I_syn }
      const next   = lifStep(state, augmented, dt)
      lifStates.set(neuron.id, next)
      voltages[neuron.id] = next.V
      spikes[neuron.id]   = next.spiked ?? false
      updatedNeurons.push(neuron)
    } else {
      const params = neuron.params as import('../types').HHParams
      const prev   = hhStates.get(neuron.id)
      const soma   = prev?.soma  ?? { ...DEFAULT_HH_COMPARTMENT }
      const dends  = prev ? { dend1: prev.dend1, dend2: prev.dend2, dend3: prev.dend3 } : undefined
      const next   = hhStep(soma, params, I_syn, dt, dends)
      hhStates.set(neuron.id, next)
      voltages[neuron.id] = next.soma.V
      spikes[neuron.id]   = next.soma.V > 0  // threshold for HH spike detection
      updatedNeurons.push({
        ...neuron,
        compartments: {
          soma:  { V: next.soma.V },
          dend1: { V: next.dend1.V },
          dend2: { V: next.dend2.V },
          dend3: { V: next.dend3.V },
        },
      })
    }
  }

  // Enqueue synaptic events from neurons that spiked this step
  for (const synapse of synapses) {
    if (!spikes[synapse.sourceId]) continue
    // Sign: excitatory = positive current, inhibitory = negative
    const sign = synapse.type === 'excitatory' ? 1 : -1
    enqueueSynapticEvent(
      synapse.targetId,
      currentT + synapse.deliveryTime,
      sign * synapse.conductance,
      synapse.targetCompartment,
    )
  }

  return { neurons: updatedNeurons, voltages, spikes }
}
