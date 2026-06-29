import { describe, it, expect, beforeEach } from 'vitest'
import { useNetworkStore } from './networkStore'

beforeEach(() => {
  useNetworkStore.setState(useNetworkStore.getInitialState())
})

describe('networkStore', () => {
  it('starts with empty neurons and synapses', () => {
    const { neurons, synapses } = useNetworkStore.getState()
    expect(neurons).toHaveLength(0)
    expect(synapses).toHaveLength(0)
  })

  it('addNeuron creates a neuron with a unique id', () => {
    useNetworkStore.getState().addNeuron({ x: 100, y: 100 }, 'lif')
    const { neurons } = useNetworkStore.getState()
    expect(neurons).toHaveLength(1)
    expect(neurons[0].id).toBeTruthy()
    expect(neurons[0].model).toBe('lif')
  })

  it('removeNeuron also removes connected synapses', () => {
    const store = useNetworkStore.getState()
    store.addNeuron({ x: 0, y: 0 }, 'lif')
    store.addNeuron({ x: 100, y: 0 }, 'lif')
    const { neurons } = useNetworkStore.getState()
    store.addSynapse(neurons[0].id, neurons[1].id)
    store.removeNeuron(neurons[0].id)
    const after = useNetworkStore.getState()
    expect(after.synapses).toHaveLength(0)
  })

  it('setMode updates the app mode', () => {
    useNetworkStore.getState().setMode('editor')
    expect(useNetworkStore.getState().mode).toBe('editor')
  })

  it('addElectrode places electrode at compartment', () => {
    useNetworkStore.getState().addNeuron({ x: 0, y: 0 }, 'lif')
    const { neurons } = useNetworkStore.getState()
    useNetworkStore.getState().addElectrode(neurons[0].id, 'soma')
    const { electrodes } = useNetworkStore.getState()
    expect(electrodes).toHaveLength(1)
    expect(electrodes[0]).toEqual({ neuronId: neurons[0].id, compartment: 'soma' })
  })

  it('removeElectrode removes electrode', () => {
    useNetworkStore.getState().addNeuron({ x: 0, y: 0 }, 'lif')
    const { neurons } = useNetworkStore.getState()
    useNetworkStore.getState().addElectrode(neurons[0].id, 'soma')
    useNetworkStore.getState().removeElectrode(neurons[0].id, 'soma')
    expect(useNetworkStore.getState().electrodes).toHaveLength(0)
  })

  it('addNeuron stores model and kind, with no stimulus by default', () => {
    useNetworkStore.getState().addNeuron({ x: 0, y: 0 }, 'graded')
    useNetworkStore.getState().addNeuron({ x: 10, y: 0 }, 'hodgkin-huxley', 'afferent')
    const ns = useNetworkStore.getState().neurons
    expect(ns[0].model).toBe('graded')
    expect(ns[1].kind).toBe('afferent')
    expect(ns[0].params.I_stim).toBe(0)
    expect(ns[1].params.I_stim).toBe(0)   // placed neurons start without external current
  })

  it('setEditorTool / setEditorModel update editor state', () => {
    useNetworkStore.getState().setEditorTool('spiking')
    useNetworkStore.getState().setEditorModel('lif')
    expect(useNetworkStore.getState().editorTool).toBe('spiking')
    expect(useNetworkStore.getState().editorModel).toBe('lif')
  })

  it('clearNetwork empties the network', () => {
    useNetworkStore.getState().addNeuron({ x: 0, y: 0 }, 'lif')
    useNetworkStore.getState().clearNetwork()
    expect(useNetworkStore.getState().neurons).toHaveLength(0)
    expect(useNetworkStore.getState().synapses).toHaveLength(0)
  })

  it('leaving editor mode resets editorTool to select', () => {
    useNetworkStore.getState().setEditorTool('spiking')
    useNetworkStore.getState().setMode('presentation')
    expect(useNetworkStore.getState().editorTool).toBe('select')
  })

  it('setSimulationParams updates the simulation length', () => {
    useNetworkStore.getState().setSimulationParams({ length: 500 })
    const { simulationParams } = useNetworkStore.getState()
    expect(simulationParams.length).toBe(500)
    expect(simulationParams.step).toBe(0.1)
  })
})
