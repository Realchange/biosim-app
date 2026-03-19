import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NeuronSVG } from './NeuronSVG'
import { DEFAULT_LIF_PARAMS } from '../../types'

const neuron = {
  id: 'n1', position: { x: 0, y: 0 }, model: 'lif' as const,
  params: DEFAULT_LIF_PARAMS,
}

describe('NeuronSVG', () => {
  it('renders soma ellipse', () => {
    const { container } = render(
      <svg><NeuronSVG neuron={neuron} /></svg>
    )
    expect(container.querySelector('ellipse')).toBeTruthy()
  })

  it('renders axon line', () => {
    const { container } = render(
      <svg><NeuronSVG neuron={neuron} /></svg>
    )
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBeGreaterThan(0)
  })

  it('applies voltageColor to soma when provided', () => {
    const { container } = render(
      <svg><NeuronSVG neuron={neuron} somaColor="#da3633" /></svg>
    )
    const soma = container.querySelector('ellipse')
    expect(soma?.getAttribute('fill')).toBe('#da3633')
  })

  it('highlights a compartment when highlightCompartment is set', () => {
    const { container } = render(
      <svg><NeuronSVG neuron={neuron} highlightCompartment="dend1" /></svg>
    )
    const circles = container.querySelectorAll('circle')
    const highlighted = Array.from(circles).some(c =>
      c.getAttribute('data-compartment') === 'dend1' &&
      c.getAttribute('stroke-width') !== '1.5'
    )
    expect(highlighted).toBe(true)
  })
})
