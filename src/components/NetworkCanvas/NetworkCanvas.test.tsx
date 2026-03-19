import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NetworkCanvas } from './NetworkCanvas'
import { useNetworkStore } from '../../store/networkStore'

beforeEach(() => useNetworkStore.setState(useNetworkStore.getInitialState()))

describe('NetworkCanvas', () => {
  it('renders without crashing with empty network', () => {
    const { container } = render(<NetworkCanvas />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('creates a neuron on double-click in editor mode', () => {
    useNetworkStore.getState().setMode('editor')
    const { container } = render(<NetworkCanvas />)
    const svg = container.querySelector('svg')!
    fireEvent.dblClick(svg, { clientX: 200, clientY: 200 })
    expect(useNetworkStore.getState().neurons).toHaveLength(1)
  })

  it('does not create neuron on double-click in presentation mode', () => {
    useNetworkStore.getState().setMode('presentation')
    const { container } = render(<NetworkCanvas />)
    fireEvent.dblClick(container.querySelector('svg')!, { clientX: 200, clientY: 200 })
    expect(useNetworkStore.getState().neurons).toHaveLength(0)
  })
})
