import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NeuronSVG } from './NeuronSVG'
import { DEFAULT_LIF_PARAMS } from '@biosim/core'

const neuron = {
  id: 'n1', position: { x: 0, y: 0 }, model: 'lif' as const,
  params: DEFAULT_LIF_PARAMS,
}

describe('NeuronSVG', () => {
  it('renders the soma as a circle', () => {
    const { container } = render(<svg><NeuronSVG neuron={neuron} /></svg>)
    const soma = container.querySelector('circle[data-compartment="soma"]')
    expect(soma).toBeTruthy()
  })

  it('renders three dendrite segments', () => {
    const { container } = render(<svg><NeuronSVG neuron={neuron} /></svg>)
    for (const c of ['dend1', 'dend2', 'dend3']) {
      expect(container.querySelector(`[data-compartment="${c}"]`)).toBeTruthy()
    }
  })

  it('applies somaColor to the soma fill', () => {
    const { container } = render(<svg><NeuronSVG neuron={neuron} somaColor="#da3633" /></svg>)
    const soma = container.querySelector('circle[data-compartment="soma"]')
    expect(soma?.getAttribute('fill')).toBe('#da3633')
  })

  it('highlights a compartment when highlightCompartment is set', () => {
    const { container } = render(<svg><NeuronSVG neuron={neuron} highlightCompartment="dend1" /></svg>)
    // A dedicated highlight outline appears for the highlighted compartment
    expect(container.querySelector('[data-highlight="dend1"]')).toBeTruthy()
  })

  it('renders a dashed soma outline for a graded neuron', () => {
    const g = { ...neuron, model: 'graded' as const }
    const { container } = render(<svg><NeuronSVG neuron={g} /></svg>)
    const soma = container.querySelector('circle[data-compartment="soma"]')
    expect(soma?.getAttribute('stroke-dasharray')).toBeTruthy()
  })

  it('renders an afferent marker for an afferent neuron', () => {
    const a = { ...neuron, kind: 'afferent' as const }
    const { container } = render(<svg><NeuronSVG neuron={a} /></svg>)
    expect(container.querySelector('[data-afferent]')).toBeTruthy()
  })

  it('calls onClick with the clicked compartment', () => {
    const onClick = vi.fn()
    const { container } = render(<svg><NeuronSVG neuron={neuron} onClick={onClick} /></svg>)
    const dend2 = container.querySelector('[data-compartment="dend2"]')!
    fireEvent.click(dend2)
    expect(onClick).toHaveBeenCalled()
    expect(onClick.mock.calls[0][0]).toBe('dend2')
  })
})
