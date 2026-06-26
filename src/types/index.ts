// src/types/index.ts

export type AppMode = 'presentation' | 'editor' | 'student'

export type Compartment = 'soma' | 'dend1' | 'dend2' | 'dend3'

export interface LIFParams {
  E_rest: number        // mV, default -70
  V_threshold: number   // mV, default -55
  tau_m: number         // ms, default 10
  R_m: number           // MΩ, default 10
  I_stim: number        // nA, default 0.5
  // Stimulus pulse window. Absent/0 stimDuration = sustained current (always on from stimOnset).
  stimOnset?: number    // ms, stimulus starts; default 0
  stimDuration?: number // ms, how long the stimulus stays on; 0 = sustained
  adapt?: number        // spike-triggered adaptation/fatigue (nA per spike); 0 = off (default)
}

export interface HHParams {
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
  // Stimulus pulse window. Absent/0 stimDuration = sustained current (always on from stimOnset).
  stimOnset?: number    // ms, stimulus starts; default 0
  stimDuration?: number // ms, how long the stimulus stays on; 0 = sustained
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
  model: 'lif' | 'hodgkin-huxley' | 'graded'
  params: LIFParams | HHParams
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
  conductance: number     // nS, default 1
  deliveryTime: number    // ms synaptic delay, default 1
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
