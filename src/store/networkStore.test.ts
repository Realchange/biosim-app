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
})
