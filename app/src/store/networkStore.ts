import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  Neuron, Synapse, Network, AppMode, Electrode, Compartment, SimulationParams,
} from '@biosim/core'
import {
  DEFAULT_LIF_PARAMS, DEFAULT_HH_PARAMS, DEFAULT_GRADED_PARAMS, DEFAULT_STG_PARAMS, DEFAULT_SYNAPSE,
} from '@biosim/core'

export type NeuronModel = 'lif' | 'hodgkin-huxley' | 'graded' | 'stg'
export type EditorTool = 'select' | 'synapse' | 'spiking' | 'nonspiking' | 'afferent'
export type EditorModel = 'hodgkin-huxley' | 'lif' | 'stg'

// Voltage trace: per-electrode, array of [t, V] pairs
export type VoltageTrace = { neuronId: string; compartment: Compartment; points: [number, number][] }
// Current trace: per-electrode neuron, array of [t, I_syn] pairs
export type CurrentTrace = { neuronId: string; points: [number, number][] }

interface SimState {
  running: boolean
  paused: boolean
  t: number   // current simulation time ms
  loop: boolean   // restart automatically when the run finishes
  speed: number   // ms of real delay between snapshots (higher = slower playback)
  live: boolean   // continuous "manipulate" mode: runs until stopped, params editable live
}

interface NetworkState {
  neurons: Neuron[]
  synapses: Synapse[]
  simulationParams: SimulationParams
  networkName: string
  mode: AppMode
  selectedId: string | null
  electrodes: Electrode[]
  traces: VoltageTrace[]
  currentTraces: CurrentTrace[]
  loadedNetwork: Network | null   // the last loaded preset/file (for "reset to preset")
  graphWindowMs: number           // width of the scrolling graph window (also sets live resolution)
  sim: SimState
  activity: Record<string, number>   // per-neuron smoothed firing activity (0..1) for the glow
  editorTool: EditorTool             // active editor placement tool
  editorModel: EditorModel           // model for newly placed spiking/afferent neurons

  // Actions
  addNeuron: (pos: { x: number; y: number }, model: NeuronModel, kind?: 'afferent') => void
  removeNeuron: (id: string) => void
  updateNeuron: (id: string, patch: Partial<Neuron>) => void
  moveNeuron: (id: string, pos: { x: number; y: number }) => void
  addSynapse: (sourceId: string, targetId: string) => void
  removeSynapse: (id: string) => void
  updateSynapse: (id: string, patch: Partial<Synapse>) => void
  setSelected: (id: string | null) => void
  setMode: (mode: AppMode) => void
  setNetworkName: (name: string) => void
  setGraphWindowMs: (ms: number) => void
  restorePresetParams: () => void   // restore neuron/synapse parameters of the loaded preset
  addElectrode: (neuronId: string, compartment: Compartment) => void
  removeElectrode: (neuronId: string, compartment: Compartment) => void
  appendTracePoints: (neuronId: string, compartment: Compartment, pts: [number, number][]) => void
  appendCurrentPoints: (neuronId: string, pts: [number, number][]) => void
  clearTraces: () => void
  setSim: (patch: Partial<SimState>) => void
  setActivity: (activity: Record<string, number>) => void
  setSimulationParams: (patch: Partial<SimulationParams>) => void
  setEditorTool: (tool: EditorTool) => void
  setEditorModel: (model: EditorModel) => void
  clearNetwork: () => void
  loadNetwork: (network: Network) => void
  getInitialState: () => NetworkState
}

const INITIAL: Pick<NetworkState, 'neurons' | 'synapses' | 'simulationParams' | 'networkName' | 'mode' | 'selectedId' | 'electrodes' | 'traces' | 'currentTraces' | 'loadedNetwork' | 'graphWindowMs' | 'sim' | 'activity' | 'editorTool' | 'editorModel'> = {
  neurons: [], synapses: [],
  simulationParams: { length: 100, step: 0.1 },
  networkName: 'Neue Simulation',
  mode: 'presentation',
  selectedId: null, electrodes: [], traces: [], currentTraces: [],
  loadedNetwork: null,
  graphWindowMs: 1000,
  sim: { running: false, paused: false, t: 0, loop: false, speed: 16, live: false },
  activity: {},
  editorTool: 'select', editorModel: 'hodgkin-huxley',
}

// Rolling cap on stored trace points (keeps the last N) so a continuous live run
// can't grow unbounded. Generous enough that fixed-length runs are unaffected.
const MAX_TRACE_POINTS = 12000
function capPoints(points: [number, number][]): [number, number][] {
  return points.length > MAX_TRACE_POINTS ? points.slice(points.length - MAX_TRACE_POINTS) : points
}

export const useNetworkStore = create<NetworkState>()((set, get) => ({
  ...INITIAL,

  getInitialState: () => ({ ...get(), ...INITIAL }),

  addNeuron: (pos, model, kind) => set(s => {
    const base = model === 'graded'
      ? { ...DEFAULT_GRADED_PARAMS }
      : model === 'stg' ? { ...DEFAULT_STG_PARAMS }
      : model === 'lif' ? { ...DEFAULT_LIF_PARAMS } : { ...DEFAULT_HH_PARAMS }
    // Placed neurons receive NO external current by default — the user decides which
    // neurons get a stimulus by raising their I_stim in the parameter panel.
    return {
      neurons: [...s.neurons, {
        id: uuidv4(),
        position: pos,
        model,
        ...(kind ? { kind } : {}),
        params: { ...base, I_stim: 0 },
      }],
    }
  }),

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

  addSynapse: (sourceId, targetId) => set(s => {
    // A synapse between two STG neurons defaults to a graded chemical synapse
    // (the only kind STG neurons use); everything else defaults to spike-driven.
    const bothSTG = s.neurons.find(n => n.id === sourceId)?.model === 'stg'
      && s.neurons.find(n => n.id === targetId)?.model === 'stg'
    const base = bothSTG
      ? { ...DEFAULT_SYNAPSE, mechanism: 'graded' as const, synClass: 'glut' as const,
          targetCompartment: 'soma' as const, conductance: 3e-4, deliveryTime: 0 }
      : { ...DEFAULT_SYNAPSE }
    return { synapses: [...s.synapses, { id: uuidv4(), sourceId, targetId, ...base }] }
  }),

  removeSynapse: (id) => set(s => ({ synapses: s.synapses.filter(sy => sy.id !== id) })),

  updateSynapse: (id, patch) => set(s => ({
    synapses: s.synapses.map(sy => sy.id === id ? { ...sy, ...patch } : sy),
  })),

  setSelected: (id) => set({ selectedId: id }),
  setNetworkName: (name) => set({ networkName: name }),
  setGraphWindowMs: (ms) => set({ graphWindowMs: ms }),
  // Restore the parameters of the loaded preset (keeps electrodes/traces/run going)
  // — the "back to working values" button for live manipulation.
  restorePresetParams: () => set(s => {
    if (!s.loadedNetwork) return s
    const origParams = new Map(s.loadedNetwork.neurons.map(n => [n.id, n.params]))
    return {
      neurons: s.neurons.map(n => origParams.has(n.id) ? { ...n, params: { ...origParams.get(n.id)! } } : n),
      synapses: s.loadedNetwork.synapses.map(sy => ({ ...sy })),
    }
  }),
  // Leaving the editor resets the placement tool to 'select'.
  setMode: (mode) => set(s => ({ mode, editorTool: mode === 'editor' ? s.editorTool : 'select' })),

  setEditorTool: (tool) => set({ editorTool: tool }),
  setEditorModel: (model) => set({ editorModel: model }),

  clearNetwork: () => set({
    neurons: [], synapses: [], electrodes: [], traces: [], currentTraces: [],
    selectedId: null, activity: {},
  }),

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

  // Append a BATCH of points in one update. Appending point-by-point copied the
  // whole (growing) array per point — O(n²) over a run, which froze the tab on
  // long simulations. One concat per batch keeps it manageable. A hard cap keeps
  // the array bounded as a rolling buffer (essential for the continuous live mode).
  appendTracePoints: (neuronId, compartment, pts) => set(s => (pts.length === 0 ? s : {
    traces: s.traces.map(tr =>
      tr.neuronId === neuronId && tr.compartment === compartment
        ? { ...tr, points: capPoints(tr.points.concat(pts)) }
        : tr
    ),
  })),

  appendCurrentPoints: (neuronId, pts) => set(s => (pts.length === 0 ? s : {
    currentTraces: s.currentTraces.map(ct =>
      ct.neuronId === neuronId ? { ...ct, points: capPoints(ct.points.concat(pts)) } : ct
    ),
  })),

  clearTraces: () => set(s => ({
    traces: s.traces.map(tr => ({ ...tr, points: [] })),
    currentTraces: s.currentTraces.map(ct => ({ ...ct, points: [] })),
  })),

  setSim: (patch) => set(s => ({ sim: { ...s.sim, ...patch } })),

  setActivity: (activity) => set({ activity }),

  setSimulationParams: (patch) => set(s => ({ simulationParams: { ...s.simulationParams, ...patch } })),

  loadNetwork: (network) => {
    // Use the preset's own electrodes if it defines them, else default to the first
    // neuron's soma.
    const electrodes = network.electrodes && network.electrodes.length > 0
      ? network.electrodes
      : network.neurons.length > 0
        ? [{ neuronId: network.neurons[0].id, compartment: 'soma' as const }]
        : []
    // One current trace per measured neuron (deduplicated).
    const measuredNeurons = [...new Set(electrodes.map(e => e.neuronId))]
    set({
      neurons: network.neurons,
      synapses: network.synapses,
      simulationParams: network.simulation,
      networkName: network.name || 'Neue Simulation',
      loadedNetwork: network,
      selectedId: network.neurons.length > 0 ? network.neurons[0].id : null,
      electrodes,
      traces: electrodes.map(e => ({ neuronId: e.neuronId, compartment: e.compartment, points: [] })),
      currentTraces: measuredNeurons.map(neuronId => ({ neuronId, points: [] })),
    })
  },
}))
