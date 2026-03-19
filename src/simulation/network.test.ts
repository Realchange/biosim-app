// src/simulation/network.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { networkStep, resetSimulationState } from './network'
import { DEFAULT_LIF_PARAMS, DEFAULT_HH_PARAMS } from '../types'
import type { Neuron, Synapse } from '../types'

beforeEach(() => resetSimulationState())

const makeLIF = (id: string, I_stim?: number): Neuron => ({
  id,
  position: { x: 0, y: 0 },
  model: 'lif',
  params: I_stim !== undefined ? { ...DEFAULT_LIF_PARAMS, I_stim } : DEFAULT_LIF_PARAMS,
})

const makeHH = (id: string): Neuron => ({
  id,
  position: { x: 0, y: 0 },
  model: 'hodgkin-huxley',
  params: DEFAULT_HH_PARAMS,
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

  it('synaptic input from firing source causes target LIF to fire sooner', () => {
    const dt = 0.1
    // Source fires vigorously; target subthreshold alone but receives excitatory synapse
    const sourceFiring: Neuron = makeLIF('src', 100)
    const targetAlone: Neuron  = makeLIF('tgt', 0.5)  // DEFAULT_LIF_PARAMS.I_stim — fires slowly on its own

    // Run target alone to record when it first spikes
    resetSimulationState()
    let stepsAlone = 0
    for (let i = 0; i < 2000; i++) {
      const r = networkStep([targetAlone], [], dt)
      stepsAlone++
      if (r.spikes['tgt']) break
    }

    // Run with synapse from source to target
    resetSimulationState()
    const synapse: Synapse = {
      id: 's1',
      sourceId: 'src',
      targetId: 'tgt',
      targetCompartment: 'soma',
      type: 'excitatory',
      conductance: 5,
      deliveryTime: 1,
    }
    let stepsWithSyn = 0
    let neurons = [sourceFiring, targetAlone]
    for (let i = 0; i < 2000; i++) {
      const r = networkStep(neurons, [synapse], dt)
      neurons = r.neurons
      stepsWithSyn++
      if (r.spikes['tgt']) break
    }

    expect(stepsWithSyn).toBeLessThan(stepsAlone)
  })

  it('synaptic event is delivered after deliveryTime steps', () => {
    const dt = 0.1
    // Source fires immediately (very high stim)
    const src: Neuron = makeLIF('src', 1000)
    // Target is subthreshold — we just watch for any synaptic current effect
    // Use a target with I_stim = 0 so any spike must come from synapse
    const tgt: Neuron = makeLIF('tgt', 0)

    const deliveryTime = 2  // ms — 20 steps at dt=0.1
    const synapse: Synapse = {
      id: 's1',
      sourceId: 'src',
      targetId: 'tgt',
      targetCompartment: 'soma',
      type: 'excitatory',
      conductance: 1000,  // large enough to force spike once delivered
      deliveryTime,
    }

    let neurons = [src, tgt]
    let srcSpikedAt = -1
    let tgtSpikedAt = -1

    for (let i = 0; i < 500; i++) {
      const r = networkStep(neurons, [synapse], dt)
      neurons = r.neurons
      if (srcSpikedAt < 0 && r.spikes['src']) srcSpikedAt = i
      if (tgtSpikedAt < 0 && r.spikes['tgt']) tgtSpikedAt = i
      if (srcSpikedAt >= 0 && tgtSpikedAt >= 0) break
    }

    expect(srcSpikedAt).toBeGreaterThanOrEqual(0)
    expect(tgtSpikedAt).toBeGreaterThan(srcSpikedAt)
    // Target should fire at least deliveryTime/dt steps after source
    expect(tgtSpikedAt - srcSpikedAt).toBeGreaterThanOrEqual(deliveryTime / dt)
  })

  it('HH neuron runs and produces a numeric voltage snapshot', () => {
    const neurons = [makeHH('hh1')]
    const result = networkStep(neurons, [], 0.1)
    expect(result.voltages).toHaveProperty('hh1')
    expect(typeof result.voltages['hh1']).toBe('number')
    expect(Number.isFinite(result.voltages['hh1'])).toBe(true)
  })
})
