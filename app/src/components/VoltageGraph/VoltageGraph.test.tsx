import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { VoltageGraph } from './VoltageGraph'
import { useNetworkStore } from '../../store/networkStore'
import type { VoltageTrace } from '../../store/networkStore'
import { getMessages } from '../../i18n'

describe('VoltageGraph', () => {
  it('renders nothing when there are no traces and no network (startup)', () => {
    useNetworkStore.setState({ neurons: [] })
    const { container } = render(<VoltageGraph traces={[]} running={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('hints to add an electrode when a network exists but nothing is measured', () => {
    useNetworkStore.setState({ neurons: [{ id: 'n1', position: { x: 0, y: 0 }, model: 'lif', params: {} as never }] })
    const { getByText } = render(<VoltageGraph traces={[]} running={false} />)
    expect(getByText(getMessages().voltage.placeholder)).toBeTruthy()
    useNetworkStore.setState({ neurons: [] })
  })

  it('renders a polyline per trace', () => {
    const traces: VoltageTrace[] = [{
      neuronId: 'n1', compartment: 'soma',
      points: [[0, -70], [1, -65], [2, -70]],
    }]
    const { container } = render(<VoltageGraph traces={traces} running={false} />)
    expect(container.querySelectorAll('polyline')).toHaveLength(1)
  })

  it('renders legend dot for each trace', () => {
    const traces: VoltageTrace[] = [
      { neuronId: 'n1', compartment: 'soma',  points: [] },
      { neuronId: 'n1', compartment: 'dend1', points: [] },
    ]
    const { container } = render(<VoltageGraph traces={traces} running={false} />)
    const dots = container.querySelectorAll('[data-legend]')
    expect(dots).toHaveLength(2)
  })
})
