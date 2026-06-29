import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { NetworkCanvas } from './NetworkCanvas'
import { useNetworkStore } from '../../store/networkStore'

beforeEach(() => useNetworkStore.setState(useNetworkStore.getInitialState()))

describe('NetworkCanvas', () => {
  it('renders without crashing with empty network', () => {
    const { container } = render(<NetworkCanvas />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('places a neuron of the active tool on background click', () => {
    useNetworkStore.getState().setMode('editor')
    useNetworkStore.getState().setEditorTool('nonspiking')
    const { container } = render(<NetworkCanvas />)
    fireEvent.click(container.querySelector('svg')!, { clientX: 150, clientY: 150 })
    const ns = useNetworkStore.getState().neurons
    expect(ns).toHaveLength(1)
    expect(ns[0].model).toBe('graded')
    // placing is one-shot → tool resets to Sperre
    expect(useNetworkStore.getState().editorTool).toBe('select')
  })

  it('places a spiking neuron with the chosen model and afferent kind', () => {
    useNetworkStore.getState().setMode('editor')
    useNetworkStore.getState().setEditorTool('afferent')
    useNetworkStore.getState().setEditorModel('lif')
    const { container } = render(<NetworkCanvas />)
    fireEvent.click(container.querySelector('svg')!, { clientX: 150, clientY: 150 })
    const ns = useNetworkStore.getState().neurons
    expect(ns[0].model).toBe('lif')
    expect(ns[0].kind).toBe('afferent')
  })

  it('select (Sperre) tool does not place a neuron on background click', () => {
    useNetworkStore.getState().setMode('editor')   // editorTool defaults to 'select'
    const { container } = render(<NetworkCanvas />)
    fireEvent.click(container.querySelector('svg')!, { clientX: 150, clientY: 150 })
    expect(useNetworkStore.getState().neurons).toHaveLength(0)
  })

  it('synapse tool connects source → target across two neuron clicks', () => {
    const store = useNetworkStore.getState()
    store.setMode('editor')
    store.addNeuron({ x: 100, y: 100 }, 'lif')
    store.addNeuron({ x: 300, y: 100 }, 'lif')
    useNetworkStore.getState().setEditorTool('synapse')
    const { container } = render(<NetworkCanvas />)
    const somas = container.querySelectorAll('[data-compartment="soma"]')
    fireEvent.click(somas[0])   // source
    fireEvent.click(somas[1])   // target
    const syn = useNetworkStore.getState().synapses
    expect(syn).toHaveLength(1)
    const ns = useNetworkStore.getState().neurons
    expect(syn[0].sourceId).toBe(ns[0].id)
    expect(syn[0].targetId).toBe(ns[1].id)
    // tool resets to Sperre after one synapse — must re-arm to draw another
    expect(useNetworkStore.getState().editorTool).toBe('select')
  })

  it('synapse tool does not place a neuron on background click', () => {
    useNetworkStore.getState().setMode('editor')
    useNetworkStore.getState().setEditorTool('synapse')
    const { container } = render(<NetworkCanvas />)
    fireEvent.click(container.querySelector('svg')!, { clientX: 150, clientY: 150 })
    expect(useNetworkStore.getState().neurons).toHaveLength(0)
  })
})
