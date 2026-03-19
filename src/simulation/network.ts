// src/simulation/network.ts
import { Neuron, Synapse, LIFParams, HHParams } from '../types'
import { lifStep, DEFAULT_LIF_STATE, LIFState } from './lif'
import { hhStep, DEFAULT_HH_COMPARTMENT, HHAllCompartments } from './hodgkin-huxley'

export interface NetworkStepResult {
  neurons: Neuron[]
  voltages: Record<string, number>   // soma voltage per neuron id
  spikes: Record<string, boolean>    // true if neuron fired this step
}

// Per-compartment synaptic current breakdown
interface SynapticCurrents {
  soma: number
  dend1: number
  dend2: number
  dend3: number
}

// Internal runtime state kept outside Neuron (not serialized)
// Note: these are module-level but reset via resetSimulationState() before each run
const lifStates = new Map<string, LIFState>()
const hhStates  = new Map<string, HHAllCompartments>()
// Synaptic delay queue: Map<targetNeuronId, Array<{deliveryT, current, compartment}>>
const synapticQueue = new Map<string, Array<{ deliveryT: number; current: number; compartment: string }>>()
let stepCount = 0

export function resetSimulationState() {
  lifStates.clear()
  hhStates.clear()
  synapticQueue.clear()
  stepCount = 0
}

// Drain all synaptic events due at currentT, return per-compartment currents
function drainSynapticCurrent(neuronId: string, currentT: number): SynapticCurrents {
  const queue = synapticQueue.get(neuronId)
  if (!queue || queue.length === 0) return { soma: 0, dend1: 0, dend2: 0, dend3: 0 }
  const result: SynapticCurrents = { soma: 0, dend1: 0, dend2: 0, dend3: 0 }
  const remaining = queue.filter(ev => {
    if (ev.deliveryT <= currentT) {
      const comp = ev.compartment as keyof SynapticCurrents
      if (comp in result) result[comp] += ev.current
      else result.soma += ev.current
      return false
    }
    return true
  })
  synapticQueue.set(neuronId, remaining)
  return result
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
  stepCount += 1
  const currentT = stepCount * dt
  const voltages: Record<string, number> = {}
  const spikes:   Record<string, boolean> = {}
  const updatedNeurons: Neuron[] = []

  for (const neuron of neurons) {
    const synapticCurrents = drainSynapticCurrent(neuron.id, currentT)

    if (neuron.model === 'lif') {
      const params = neuron.params as LIFParams
      const state  = lifStates.get(neuron.id) ?? { ...DEFAULT_LIF_STATE }
      // Add synaptic current as additional input on top of neuron's own I_stim
      // LIF neurons: all compartment input intentionally collapsed to soma
      const totalSyn = synapticCurrents.soma + synapticCurrents.dend1 + synapticCurrents.dend2 + synapticCurrents.dend3
      const augmented = { ...params, I_stim: params.I_stim + totalSyn }
      const next   = lifStep(state, augmented, dt)
      lifStates.set(neuron.id, next)
      voltages[neuron.id] = next.V
      spikes[neuron.id]   = next.spiked ?? false
      updatedNeurons.push(neuron)
    } else {
      const params = neuron.params as HHParams
      const prev   = hhStates.get(neuron.id)
      const prevSomaV = prev?.soma.V ?? DEFAULT_HH_COMPARTMENT.V
      const soma   = prev?.soma  ?? { ...DEFAULT_HH_COMPARTMENT }
      const dends  = prev ? { dend1: prev.dend1, dend2: prev.dend2, dend3: prev.dend3 } : undefined
      const I_syn_dend = { dend1: synapticCurrents.dend1, dend2: synapticCurrents.dend2, dend3: synapticCurrents.dend3 }
      const next   = hhStep(soma, params, synapticCurrents.soma, dt, dends, I_syn_dend)
      hhStates.set(neuron.id, next)
      voltages[neuron.id] = next.soma.V
      // Upward zero-crossing detection: fires only on rising phase of action potential
      spikes[neuron.id]   = prevSomaV <= 0 && next.soma.V > 0
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
