import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  Neuron, Synapse, Network, AppMode, Electrode, Compartment, SimulationParams,
} from '../types'
import {
  DEFAULT_LIF_PARAMS, DEFAULT_HH_PARAMS, DEFAULT_SYNAPSE,
} from '../types'

// Voltage trace: per-electrode, array of [t, V] pairs
export type VoltageTrace = { neuronId: string; compartment: Compartment; points: [number, number][] }
// Current trace: per-electrode neuron, array of [t, I_syn] pairs
export type CurrentTrace = { neuronId: string; points: [number, number][] }

interface SimState {
  running: boolean
  paused: boolean
  t: number   // current simulation time ms
}

interface NetworkState {
  neurons: Neuron[]
  synapses: Synapse[]
  simulationParams: SimulationParams
  mode: AppMode
  selectedId: string | null
  electrodes: Electrode[]
  traces: VoltageTrace[]
  currentTraces: CurrentTrace[]
  sim: SimState

  // Actions
  addNeuron: (pos: { x: number; y: number }, model: 'lif' | 'hodgkin-huxley') => void
  removeNeuron: (id: string) => void
  updateNeuron: (id: string, patch: Partial<Neuron>) => void
  moveNeuron: (id: string, pos: { x: number; y: number }) => void
  addSynapse: (sourceId: string, targetId: string) => void
  removeSynapse: (id: string) => void
  updateSynapse: (id: string, patch: Partial<Synapse>) => void
  setSelected: (id: string | null) => void
  setMode: (mode: AppMode) => void
  addElectrode: (neuronId: string, compartment: Compartment) => void
  removeElectrode: (neuronId: string, compartment: Compartment) => void
  appendTracePoints: (neuronId: string, compartment: Compartment, t: number, V: number) => void
  appendCurrentPoints: (neuronId: string, t: number, I: number) => void
  clearTraces: () => void
  setSim: (patch: Partial<SimState>) => void
  loadNetwork: (network: Network) => void
  getInitialState: () => NetworkState
}

const INITIAL: Pick<NetworkState, 'neurons' | 'synapses' | 'simulationParams' | 'mode' | 'selectedId' | 'electrodes' | 'traces' | 'currentTraces' | 'sim'> = {
  neurons: [], synapses: [],
  simulationParams: { length: 100, step: 0.1 },
  mode: 'presentation',
  selectedId: null, electrodes: [], traces: [], currentTraces: [],
  sim: { running: false, paused: false, t: 0 },
}

export const useNetworkStore = create<NetworkState>()((set, get) => ({
  ...INITIAL,

  getInitialState: () => ({ ...get(), ...INITIAL }),

  addNeuron: (pos, model) => set(s => ({
    neurons: [...s.neurons, {
      id: uuidv4(),
      position: pos,
      model,
      params: model === 'lif' ? { ...DEFAULT_LIF_PARAMS } : { ...DEFAULT_HH_PARAMS },
    }],
  })),

  removeNeuron: (id) => set(s => ({
    neurons: s.neurons.filter(n => n.id !== id),
    synapses: s.synapses.filter(sy => sy.sourceId !== id && sy.targetId !== id),
    electrodes: s.electrodes.filter(e => e.neuronId !== id),
    traces: s.traces.filter(tr => tr.neuronId !== id),
    currentTraces: s.currentTraces.filter(ct => ct.neuronId !== id),
  })),

  updateNeuron: (id, patch) => set(s => ({
    neurons: s.neurons.map(n => n.id === id ? { ...n, ...patch } : n),
  })),

  moveNeuron: (id, pos) => set(s => ({
    neurons: s.neurons.map(n => n.id === id ? { ...n, position: pos } : n),
  })),

  addSynapse: (sourceId, targetId) => set(s => ({
    synapses: [...s.synapses, {
      id: uuidv4(),
      sourceId,
      targetId,
      ...DEFAULT_SYNAPSE,
    }],
  })),

  removeSynapse: (id) => set(s => ({ synapses: s.synapses.filter(sy => sy.id !== id) })),

  updateSynapse: (id, patch) => set(s => ({
    synapses: s.synapses.map(sy => sy.id === id ? { ...sy, ...patch } : sy),
  })),

  setSelected: (id) => set({ selectedId: id }),
  setMode: (mode) => set({ mode }),

  addElectrode: (neuronId, compartment) => set(s => {
    const exists = s.electrodes.some(e => e.neuronId === neuronId && e.compartment === compartment)
    if (exists) return s
    const electrode: Electrode = { neuronId, compartment }
    const trace: VoltageTrace = { neuronId, compartment, points: [] }
    // Add current trace only if this is the first electrode for this neuron
    const hasCurrentTrace = s.currentTraces.some(ct => ct.neuronId === neuronId)
    const newCurrentTraces = hasCurrentTrace
      ? s.currentTraces
      : [...s.currentTraces, { neuronId, points: [] }]
    return { electrodes: [...s.electrodes, electrode], traces: [...s.traces, trace], currentTraces: newCurrentTraces }
  }),

  removeElectrode: (neuronId, compartment) => set(s => {
    const remaining = s.electrodes.filter(e => !(e.neuronId === neuronId && e.compartment === compartment))
    const stillHasNeuron = remaining.some(e => e.neuronId === neuronId)
    return {
      electrodes: remaining,
      traces: s.traces.filter(tr => !(tr.neuronId === neuronId && tr.compartment === compartment)),
      currentTraces: stillHasNeuron ? s.currentTraces : s.currentTraces.filter(ct => ct.neuronId !== neuronId),
    }
  }),

  appendTracePoints: (neuronId, compartment, t, V) => set(s => ({
    traces: s.traces.map(tr =>
      tr.neuronId === neuronId && tr.compartment === compartment
        ? { ...tr, points: [...tr.points, [t, V]] }
        : tr
    ),
  })),

  appendCurrentPoints: (neuronId, t, I) => set(s => ({
    currentTraces: s.currentTraces.map(ct =>
      ct.neuronId === neuronId ? { ...ct, points: [...ct.points, [t, I]] } : ct
    ),
  })),

  clearTraces: () => set(s => ({
    traces: s.traces.map(tr => ({ ...tr, points: [] })),
    currentTraces: s.currentTraces.map(ct => ({ ...ct, points: [] })),
  })),

  setSim: (patch) => set(s => ({ sim: { ...s.sim, ...patch } })),

  loadNetwork: (network) => set({
    neurons: network.neurons,
    synapses: network.synapses,
    simulationParams: network.simulation,
    selectedId: network.neurons.length > 0 ? network.neurons[0].id : null,
    electrodes: network.neurons.length > 0
      ? [{ neuronId: network.neurons[0].id, compartment: 'soma' }]
      : [],
    traces: network.neurons.length > 0
      ? [{ neuronId: network.neurons[0].id, compartment: 'soma', points: [] }]
      : [],
    currentTraces: network.neurons.length > 0
      ? [{ neuronId: network.neurons[0].id, points: [] }]
      : [],
  }),
}))
