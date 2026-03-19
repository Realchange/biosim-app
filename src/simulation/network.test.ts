// src/simulation/network.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { networkStep, resetSimulationState } from './network'
import { DEFAULT_LIF_PARAMS } from '../types'
import type { Neuron } from '../types'

beforeEach(() => resetSimulationState())

const makeLIF = (id: string): Neuron => ({
  id,
  position: { x: 0, y: 0 },
  model: 'lif',
  params: DEFAULT_LIF_PARAMS,
})

describe('networkStep', () => {
  it('returns a voltage snapshot for each neuron', () => {
    const neurons = [makeLIF('n1'), makeLIF('n2')]
    const result = networkStep(neurons, [], 0.1)
    expect(result.voltages).toHaveProperty('n1')
    expect(result.voltages).toHaveProperty('n2')
  })

  it('returns updated neurons', () => {
    const neurons = [makeLIF('n1')]
    const result = networkStep(neurons, [], 0.1)
    expect(result.neurons).toHaveLength(1)
  })

  it('records a spike in spikes map when LIF neuron fires', () => {
    const neurons = [{ ...makeLIF('n1'), params: { ...DEFAULT_LIF_PARAMS, I_stim: 100 } }]
    let result = { neurons, voltages: {} as Record<string, number>, spikes: {} as Record<string, boolean> }
    let spiked = false
    for (let i = 0; i < 500; i++) {
      result = networkStep(result.neurons, [], 0.1)
      if (result.spikes['n1']) { spiked = true; break }
    }
    expect(spiked).toBe(true)
  })
})
