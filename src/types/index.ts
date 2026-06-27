// src/types/index.ts

export type AppMode = 'presentation' | 'editor' | 'student'

export type Compartment = 'soma' | 'dend1' | 'dend2' | 'dend3'

// Stimulus waveform spec, shared by LIF and HH neurons.
//  - 'pulse': rectangular — I_stim from stimOnset for stimDuration (0 = sustained).
//  - 'ramp':  I_stim·position ramps up over rampTime then holds (stimDuration = plateau
//             hold, 0 = sustained), plus an optional velocity term during the rise
//             (dynamicGain) and brief acceleration pulses at onset & plateau (accelGain).
//             Models muscle-spindle / Ia sensitivities (position / velocity / acceleration).
export interface StimulusSpec {
  stimType?: 'pulse' | 'ramp'   // default 'pulse'
  stimOnset?: number            // ms, stimulus starts; default 0
  stimDuration?: number         // ms; pulse: on-time, ramp: plateau hold; 0 = sustained
  rampTime?: number             // ms, ramp rise time; default 50
  dynamicGain?: number          // ramp velocity sensitivity (× I_stim during the rise); 0 = off
  accelGain?: number            // ramp acceleration sensitivity (brief pulses at onset & plateau); 0 = off
}

export interface LIFParams extends StimulusSpec {
  E_rest: number        // mV, default -70
  V_threshold: number   // mV, default -55
  tau_m: number         // ms, default 10
  R_m: number           // MΩ, default 10
  I_stim: number        // nA, default 0.5
  adapt?: number        // spike-triggered adaptation/fatigue (nA per spike); 0 = off (default)
}

// Prinz, Bucher & Marder (2004) STG neuron: 8 maximal conductances (mS/cm²).
// Reversal potentials and Ca²⁺ dynamics are fixed in the engine.
export interface STGParams extends StimulusSpec {
  gNa: number
  gCaT: number
  gCaS: number
  gA: number
  gKCa: number
  gKd: number
  gH: number
  gLeak: number
  I_stim: number   // injected current (µA); 0 = autonomous (default)
}

export interface HHParams extends StimulusSpec {
  I_stim: number        // nA delivered to soma
  E_Na: number          // mV, default +50
  E_K: number           // mV, default -77
  E_Ca: number          // mV, default +120
  E_leak: number        // mV, default -65
  g_Na: number          // mS/cm², default 120
  g_K: number           // mS/cm², default 36
  g_Ca: number          // mS/cm², default 0.3
  g_leak: number        // mS/cm², default 0.3
  C_m: number           // µF/cm², default 1.0
  g_core: number        // axial conductance between soma and dendrites, default 0.1
  // Where the stimulus current is injected; default 'soma'. Injecting into a
  // dendrite low-pass filters the input through the cable → smoother soma response.
  stimCompartment?: Compartment
}

export interface CompartmentState {
  V: number             // membrane potential (mV)
  // HH gating variables
  m?: number; h?: number  // Na channel
  n?: number              // K channel
  q?: number              // Ca channel
}

export interface Neuron {
  id: string
  position: { x: number; y: number }
  label?: string        // optional role name shown instead of "Neuron N"
  kind?: 'afferent'     // editor marker: sensory input neuron (spiking, visual only)
  model: 'lif' | 'hodgkin-huxley' | 'graded' | 'stg'
  params: LIFParams | HHParams | STGParams
  // HH only: per-compartment simulation state (soma + 3 dendrite levels)
  // LIF: compartments field is absent; all synaptic input collapses to soma
  //      regardless of targetCompartment — the field is used for visualization only
  compartments?: {
    soma: CompartmentState
    dend1: CompartmentState
    dend2: CompartmentState
    dend3: CompartmentState
  }
}

export interface Synapse {
  id: string
  sourceId: string
  targetId: string
  targetCompartment: Compartment
  type: 'excitatory' | 'inhibitory'
  conductance: number     // spike synapse: nS; graded synapse: ḡ_syn in mS
  deliveryTime: number    // ms synaptic delay, default 1
  // Graded chemical synapse (STG / Prinz): continuous, voltage-dependent release.
  mechanism?: 'spike' | 'graded'   // default 'spike'
  synClass?: 'glut' | 'chol'       // graded only: E_syn/kminus preset (default glut)
}

export interface SimulationParams {
  length: number          // ms total duration, default 100
  step: number            // ms time step, default 0.1
}

export interface Network {
  version: 1
  name: string
  neurons: Neuron[]
  synapses: Synapse[]
  simulation: SimulationParams
  electrodes?: Electrode[]   // optional: measuring electrodes to place on load
}

// Electrode placed on a compartment of a specific neuron
export interface Electrode {
  neuronId: string
  compartment: Compartment
}

export const COMPARTMENT_COLORS: Record<Compartment, string> = {
  soma:  '#3fb950',   // green
  dend1: '#f0883e',   // orange
  dend2: '#58a6ff',   // blue
  dend3: '#a371f7',   // purple
}

// Voltage → color mapping for animation
export function voltageToColor(v: number): string {
  if (v <= -70) return '#1f6feb'          // blue  (rest)
  if (v <= -40) return '#d29922'          // yellow
  if (v <= 0)   return '#f0883e'          // orange
  return '#da3633'                        // red   (spike)
}

export const DEFAULT_LIF_PARAMS: LIFParams = {
  E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 0.5,
  stimOnset: 0, stimDuration: 0,
}

// Non-spiking (graded) neuron: a leaky integrator. V_threshold is unused (it never
// spikes) but kept so the type matches LIFParams (the dendrite cable expects it).
export const DEFAULT_GRADED_PARAMS: LIFParams = {
  E_rest: -70, V_threshold: -55, tau_m: 12, R_m: 10, I_stim: 0,
  stimOnset: 0, stimDuration: 0,
}

// Default STG params = Prinz "PM_4" — the AB/PD pacemaker (bursts intrinsically).
// [gNa, gCaT, gCaS, gA, gKCa, gKd, gH, gLeak]
export const DEFAULT_STG_PARAMS: STGParams = {
  gNa: 300, gCaT: 2.5, gCaS: 2, gA: 10, gKCa: 5, gKd: 125, gH: 0.01, gLeak: 0,
  I_stim: 0, stimOnset: 0, stimDuration: 0,
}

export const DEFAULT_HH_PARAMS: HHParams = {
  I_stim: 10, E_Na: 50, E_K: -77, E_Ca: 120, E_leak: -54.387,
  g_Na: 120, g_K: 36, g_Ca: 0.3, g_leak: 0.3, C_m: 1.0, g_core: 0.3,
  stimOnset: 0, stimDuration: 0, stimCompartment: 'soma',
}

export const DEFAULT_SYNAPSE: Omit<Synapse, 'id' | 'sourceId' | 'targetId'> = {
  targetCompartment: 'dend1',
  type: 'excitatory',
  conductance: 6,
  deliveryTime: 1,
}
