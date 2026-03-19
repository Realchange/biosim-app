import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { VoltageGraph } from './VoltageGraph'
import { VoltageTrace } from '../../store/networkStore'

describe('VoltageGraph', () => {
  it('renders placeholder when no traces', () => {
    const { getByText } = render(<VoltageGraph traces={[]} running={false} />)
    expect(getByText(/Elektrode/i)).toBeTruthy()
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
