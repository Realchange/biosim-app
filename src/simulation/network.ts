// src/simulation/network.ts
import type { Neuron, Synapse, LIFParams, HHParams } from '../types'
import { lifStep, DEFAULT_LIF_STATE, dendCableStep, makeDendCableState } from './lif'
import type { LIFState, DendCableState } from './lif'
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
// Passive dendrite cable voltages for LIF neurons (visualization / electrode traces).
const lifDendStates = new Map<string, DendCableState>()
// Soma voltage of non-spiking (graded) neurons.
const gradedStates = new Map<string, number>()
const hhStates  = new Map<string, HHAllCompartments>()
// Synaptic delay queue: Map<targetNeuronId, Array<{deliveryT, current, compartment}>>
const synapticQueue = new Map<string, Array<{ deliveryT: number; current: number; compartment: string }>>()
// Decaying synaptic current per target compartment (the EPSC/IPSC waveform).
// Excitation and inhibition decay on separate time constants — fast excitation,
// slow inhibition — so the two are tracked in separate accumulators.
const synExcState = new Map<string, SynapticCurrents>()
const synInhState = new Map<string, SynapticCurrents>()
let stepCount = 0

// Synaptic current time constants (ms). Excitation is fast (AMPA-like). Inhibition
// is slower (GABA-like) so that during a burst it stays elevated between the
// presynaptic spikes — that sustained silence is what lets a reciprocal-inhibition
// pair fire in clean alternating bursts rather than both sneaking through.
const TAU_SYN_EXC = 5
const TAU_SYN_INH = 15

// Synaptic gain for HH targets: the conductance→current scale is calibrated for LIF;
// HH neurons need ~10× more for the same effect. This makes a synapse's conductance
// slider behave comparably whether the target is LIF or HH.
const HH_SYN_GAIN = 11

// Electrotonic attenuation of synaptic input by injection site, for LIF soma firing.
// soma = full effect; the farther out the dendrite, the weaker its effect on the
// soma. (HH neurons get this from their multi-compartment cable instead.)
const LIF_ELECTROTONIC: Record<'soma' | 'dend1' | 'dend2' | 'dend3', number> = {
  soma: 1.0, dend1: 0.5, dend2: 0.35, dend3: 0.22,
}

// Axial coupling for the dendrite visualization cable. Weak enough that the
// injection site clearly stands out above the soma, strong enough that input
// still spreads visibly to neighbouring dendrites.
const LIF_DEND_GC = 0.008

export function resetSimulationState() {
  lifStates.clear()
  lifDendStates.clear()
  gradedStates.clear()
  hhStates.clear()
  synapticQueue.clear()
  synExcState.clear()
  synInhState.clear()
  stepCount = 0
}

// Advance the decaying synaptic current for one neuron by dt: decay the existing
// excitatory and inhibitory currents on their own time constants, then add any
// events delivered at currentT (positive = excitatory/fast, negative = inhibitory/
// slow). Returns the combined current per compartment for this step.
function advanceSynapticCurrent(neuronId: string, currentT: number, dt: number): SynapticCurrents {
  const exc = synExcState.get(neuronId) ?? { soma: 0, dend1: 0, dend2: 0, dend3: 0 }
  const inh = synInhState.get(neuronId) ?? { soma: 0, dend1: 0, dend2: 0, dend3: 0 }
  const dE = Math.exp(-dt / TAU_SYN_EXC), dI = Math.exp(-dt / TAU_SYN_INH)
  exc.soma *= dE; exc.dend1 *= dE; exc.dend2 *= dE; exc.dend3 *= dE
  inh.soma *= dI; inh.dend1 *= dI; inh.dend2 *= dI; inh.dend3 *= dI

  const queue = synapticQueue.get(neuronId)
  if (queue && queue.length > 0) {
    const remaining = queue.filter(ev => {
      if (ev.deliveryT <= currentT) {
        const acc = ev.current >= 0 ? exc : inh
        const comp = ev.compartment as keyof SynapticCurrents
        if (comp in acc) acc[comp] += ev.current
        else acc.soma += ev.current
        return false
      }
      return true
    })
    synapticQueue.set(neuronId, remaining)
  }

  synExcState.set(neuronId, exc)
  synInhState.set(neuronId, inh)
  return {
    soma: exc.soma + inh.soma, dend1: exc.dend1 + inh.dend1,
    dend2: exc.dend2 + inh.dend2, dend3: exc.dend3 + inh.dend3,
  }
}

function enqueueSynapticEvent(targetId: string, deliveryT: number, current: number, compartment: string) {
  const queue = synapticQueue.get(targetId) ?? []
  queue.push({ deliveryT, current, compartment })
  synapticQueue.set(targetId, queue)
}

// Effective stimulus current at time currentT, honouring the optional pulse window.
// stimDuration absent or 0 => sustained current (always on once past stimOnset).
function stimAtTime(p: { I_stim: number; stimOnset?: number; stimDuration?: number }, currentT: number): number {
  const onset = p.stimOnset ?? 0
  if (currentT < onset) return 0
  const dur = p.stimDuration ?? 0
  if (dur > 0 && currentT >= onset + dur) return 0
  return p.I_stim
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
    const synI = advanceSynapticCurrent(neuron.id, currentT, dt)

    if (neuron.model === 'lif') {
      const params = neuron.params as LIFParams
      const state  = lifStates.get(neuron.id) ?? { ...DEFAULT_LIF_STATE }
      // Soma firing: synaptic input is attenuated by injection site (electrotonic
      // factor) before driving the integrate-and-fire soma.
      const somaSyn =
        synI.soma  * LIF_ELECTROTONIC.soma  +
        synI.dend1 * LIF_ELECTROTONIC.dend1 +
        synI.dend2 * LIF_ELECTROTONIC.dend2 +
        synI.dend3 * LIF_ELECTROTONIC.dend3
      synapticCurrents[neuron.id] = somaSyn
      const augmented = { ...params, I_stim: stimAtTime(params, currentT) + somaSyn }
      const next = lifStep(state, augmented, dt)
      lifStates.set(neuron.id, next)
      voltages[neuron.id] = next.V
      spikes[neuron.id]   = next.spiked ?? false

      // Dendrite voltages: a passive cable anchored to the soma, so the injection
      // site shows the largest deflection and it attenuates toward the soma.
      const dprev = lifDendStates.get(neuron.id) ?? makeDendCableState(params.E_rest)
      const dnext = dendCableStep(dprev, params, next.V,
        { dend1: synI.dend1, dend2: synI.dend2, dend3: synI.dend3 }, LIF_DEND_GC, dt)
      lifDendStates.set(neuron.id, dnext)
      updatedNeurons.push({
        ...neuron,
        compartments: {
          soma:  { V: next.V },
          dend1: { V: dnext.dend1 },
          dend2: { V: dnext.dend2 },
          dend3: { V: dnext.dend3 },
        },
      })
    } else if (neuron.model === 'graded') {
      // Non-spiking neuron: a leaky integrator with no threshold. It integrates input
      // and shows a graded membrane potential, but never fires. (Phase B will add a
      // graded synaptic output proportional to V.)
      const params = neuron.params as LIFParams
      const prevV = gradedStates.get(neuron.id) ?? params.E_rest
      const synSum = synI.soma + synI.dend1 + synI.dend2 + synI.dend3
      synapticCurrents[neuron.id] = synSum
      const I = stimAtTime(params, currentT) + synSum
      const V = prevV + (dt / params.tau_m) * (params.E_rest - prevV + params.R_m * I)
      gradedStates.set(neuron.id, V)
      voltages[neuron.id] = V
      spikes[neuron.id] = false
      const dprev = lifDendStates.get(neuron.id) ?? makeDendCableState(params.E_rest)
      const dnext = dendCableStep(dprev, params, V,
        { dend1: synI.dend1, dend2: synI.dend2, dend3: synI.dend3 }, LIF_DEND_GC, dt)
      lifDendStates.set(neuron.id, dnext)
      updatedNeurons.push({
        ...neuron,
        compartments: {
          soma:  { V },
          dend1: { V: dnext.dend1 },
          dend2: { V: dnext.dend2 },
          dend3: { V: dnext.dend3 },
        },
      })
    } else {
      const rawParams = neuron.params as HHParams
      const stimI = stimAtTime(rawParams, currentT)
      const stimComp = rawParams.stimCompartment ?? 'soma'
      // Stimulus goes to the soma by default, or directly into a chosen dendrite.
      const params = { ...rawParams, I_stim: stimComp === 'soma' ? stimI : 0 }
      const prev   = hhStates.get(neuron.id)
      const prevSomaV = prev?.soma.V ?? DEFAULT_HH_COMPARTMENT.V
      // The synaptic conductance scale is calibrated for LIF; HH neurons have a much
      // lower input resistance, so the same conductance delivers far less effect.
      // Scale synaptic current into HH targets so the slider means the same for both.
      const gSoma = synI.soma * HH_SYN_GAIN
      const gD1 = synI.dend1 * HH_SYN_GAIN, gD2 = synI.dend2 * HH_SYN_GAIN, gD3 = synI.dend3 * HH_SYN_GAIN
      synapticCurrents[neuron.id] = gSoma
      // HH Forward-Euler is only stable at dt ≤ ~0.04 ms.
      // Sub-step 4× so the reported step (typically 0.1 ms) stays stable.
      const HH_SUB_STEPS = 4
      const subDt = dt / HH_SUB_STEPS
      const subSyn: Record<'soma' | 'dend1' | 'dend2' | 'dend3', number> = {
        soma: gSoma / HH_SUB_STEPS, dend1: gD1 / HH_SUB_STEPS,
        dend2: gD2 / HH_SUB_STEPS, dend3: gD3 / HH_SUB_STEPS,
      }
      // Route a dendritic stimulus into the chosen compartment. Applied undivided
      // per sub-step, matching how the soma stimulus (params.I_stim) is injected.
      if (stimComp !== 'soma') subSyn[stimComp] += stimI
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
