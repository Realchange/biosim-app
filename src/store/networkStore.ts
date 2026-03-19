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
  clearTraces: () => void
  setSim: (patch: Partial<SimState>) => void
  loadNetwork: (network: Network) => void
  getInitialState: () => NetworkState
}

const INITIAL: Pick<NetworkState, 'neurons' | 'synapses' | 'simulationParams' | 'mode' | 'selectedId' | 'electrodes' | 'traces' | 'sim'> = {
  neurons: [], synapses: [],
  simulationParams: { length: 100, step: 0.1 },
  mode: 'presentation',
  selectedId: null, electrodes: [], traces: [],
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
    return { electrodes: [...s.electrodes, electrode], traces: [...s.traces, trace] }
  }),

  removeElectrode: (neuronId, compartment) => set(s => ({
    electrodes: s.electrodes.filter(e => !(e.neuronId === neuronId && e.compartment === compartment)),
    traces: s.traces.filter(tr => !(tr.neuronId === neuronId && tr.compartment === compartment)),
  })),

  appendTracePoints: (neuronId, compartment, t, V) => set(s => ({
    traces: s.traces.map(tr =>
      tr.neuronId === neuronId && tr.compartment === compartment
        ? { ...tr, points: [...tr.points, [t, V]] }
        : tr
    ),
  })),

  clearTraces: () => set(s => ({ traces: s.traces.map(tr => ({ ...tr, points: [] })) })),

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
  }),
}))
