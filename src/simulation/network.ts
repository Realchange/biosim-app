// src/simulation/network.ts
import type { Neuron, Synapse, LIFParams, HHParams } from '../types'
import { lifStep, DEFAULT_LIF_STATE } from './lif'
import type { LIFState } from './lif'
import { hhStep, DEFAULT_HH_COMPARTMENT } from './hodgkin-huxley'
import type { HHAllCompartments } from './hodgkin-huxley'

export interface NetworkStepResult {
  neurons: Neuron[]
  voltages: Record<string, number>        // soma voltage per neuron id
  spikes: Record<string, boolean>         // true if neuron fired this step
  synapticCurrents: Record<string, number> // total synaptic input current (nA) per neuron
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
  const synapticCurrents: Record<string, number> = {}
  const updatedNeurons: Neuron[] = []

  for (const neuron of neurons) {
    const synI = drainSynapticCurrent(neuron.id, currentT)

    if (neuron.model === 'lif') {
      const params = neuron.params as LIFParams
      const state  = lifStates.get(neuron.id) ?? { ...DEFAULT_LIF_STATE }
      // LIF neurons: all compartment input intentionally collapsed to soma
      const totalSyn = synI.soma + synI.dend1 + synI.dend2 + synI.dend3
      synapticCurrents[neuron.id] = totalSyn
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
      synapticCurrents[neuron.id] = synI.soma
      // HH Forward-Euler is only stable at dt ≤ ~0.04 ms.
      // Sub-step 4× so the reported step (typically 0.1 ms) stays stable.
      const HH_SUB_STEPS = 4
      const subDt = dt / HH_SUB_STEPS
      const subSyn = { soma: synI.soma / HH_SUB_STEPS, dend1: synI.dend1 / HH_SUB_STEPS, dend2: synI.dend2 / HH_SUB_STEPS, dend3: synI.dend3 / HH_SUB_STEPS }
      let next = prev ?? {
        soma: { ...DEFAULT_HH_COMPARTMENT },
        dend1: { ...DEFAULT_HH_COMPARTMENT },
        dend2: { ...DEFAULT_HH_COMPARTMENT },
        dend3: { ...DEFAULT_HH_COMPARTMENT },
      }
      for (let s = 0; s < HH_SUB_STEPS; s++) {
        next = hhStep(next.soma, params, subSyn.soma, subDt, next, { dend1: subSyn.dend1, dend2: subSyn.dend2, dend3: subSyn.dend3 })
      }
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

  return { neurons: updatedNeurons, voltages, spikes, synapticCurrents }
}
