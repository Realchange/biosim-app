// src/simulation/network.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { networkStep, resetSimulationState } from './network'
import { DEFAULT_LIF_PARAMS, DEFAULT_HH_PARAMS } from '../types'
import type { Neuron, Synapse } from '../types'
import { swimRhythmPreset } from '../presets/swim-rhythm'

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
    const neurons: Neuron[] = [{ ...makeLIF('n1'), params: { ...DEFAULT_LIF_PARAMS, I_stim: 100 } }]
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
    // Source fires vigorously; target fires on its own (I_stim=3.0) but synapse makes it fire sooner
    const sourceFiring: Neuron = makeLIF('src', 100)
    const targetAlone: Neuron  = makeLIF('tgt', 3.0)  // fires alone at ~69 steps

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
      conductance: 10,
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

  it('HH neuron fires exactly once per action potential (upward zero-crossing detection)', () => {
    const dt = 0.1
    // Drive HH neuron with large stimulus to elicit a spike
    const hhNeuron: Neuron = {
      id: 'hh1',
      position: { x: 0, y: 0 },
      model: 'hodgkin-huxley',
      params: { ...DEFAULT_HH_PARAMS, I_stim: 10 },
    }
    let neurons = [hhNeuron]
    let spiked = false
    let maxConsecutiveTrue = 0
    let currentConsecutive = 0

    for (let i = 0; i < 2000; i++) {
      const result = networkStep(neurons, [], dt)
      neurons = result.neurons
      if (result.spikes['hh1']) {
        spiked = true
        currentConsecutive++
        if (currentConsecutive > maxConsecutiveTrue) maxConsecutiveTrue = currentConsecutive
      } else {
        currentConsecutive = 0
      }
    }

    // The neuron must have spiked at least once
    expect(spiked).toBe(true)
    // With upward zero-crossing detection, a single AP should never produce
    // two consecutive true values in spikes (that would indicate V > 0 fired twice in a row)
    expect(maxConsecutiveTrue).toBe(1)
  })

  it('HH neuron with a brief stimulus pulse fires exactly one action potential', () => {
    const dt = 0.1
    const hhNeuron: Neuron = {
      id: 'hh1',
      position: { x: 0, y: 0 },
      model: 'hodgkin-huxley',
      params: { ...DEFAULT_HH_PARAMS, I_stim: 10, stimOnset: 5, stimDuration: 1 },
    }
    let neurons = [hhNeuron]
    let spikeCount = 0
    for (let i = 0; i < 300; i++) {   // 30 ms
      const result = networkStep(neurons, [], dt)
      neurons = result.neurons
      if (result.spikes['hh1']) spikeCount++
    }
    expect(spikeCount).toBe(1)
  })

  it('HH neuron with sustained current (no pulse window) fires repeatedly', () => {
    const dt = 0.1
    const hhNeuron: Neuron = {
      id: 'hh1',
      position: { x: 0, y: 0 },
      model: 'hodgkin-huxley',
      params: { ...DEFAULT_HH_PARAMS, I_stim: 10 },  // stimDuration absent => sustained
    }
    let neurons = [hhNeuron]
    let spikeCount = 0
    for (let i = 0; i < 1000; i++) {  // 100 ms
      const result = networkStep(neurons, [], dt)
      neurons = result.neurons
      if (result.spikes['hh1']) spikeCount++
    }
    expect(spikeCount).toBeGreaterThan(1)
  })

  it('stimulus pulse does not inject current before its onset', () => {
    const dt = 0.1
    const hhNeuron: Neuron = {
      id: 'hh1',
      position: { x: 0, y: 0 },
      model: 'hodgkin-huxley',
      params: { ...DEFAULT_HH_PARAMS, I_stim: 10, stimOnset: 20, stimDuration: 1 },
    }
    let neurons = [hhNeuron]
    let spikedBeforeOnset = false
    for (let i = 0; i < 150; i++) {   // up to 15 ms, before onset at 20 ms
      const result = networkStep(neurons, [], dt)
      neurons = result.neurons
      if (result.spikes['hh1']) spikedBeforeOnset = true
    }
    expect(spikedBeforeOnset).toBe(false)
  })

  it('stimulus injected into a dendrite raises that dendrite before the soma', () => {
    const dt = 0.025
    const neuron: Neuron = {
      id: 'hh1', position: { x: 0, y: 0 }, model: 'hodgkin-huxley',
      // Moderate, sustained current; sampled at 2 ms, well before any spike.
      params: { ...DEFAULT_HH_PARAMS, I_stim: 15, stimCompartment: 'dend1' },
    }
    let neurons = [neuron]
    let last = neurons[0]
    for (let i = 0; i < 2 / dt; i++) {
      const r = networkStep(neurons, [], dt)
      neurons = r.neurons
      last = neurons[0]
    }
    const c = last.compartments as Record<string, { V: number }>
    // Current enters dend1 directly; the soma only sees it through axial coupling.
    expect(c.dend1.V).toBeGreaterThan(c.soma.V)
    expect(c.dend1.V).toBeGreaterThan(-65)
  })

  it('stimulus injected into a dendrite can still drive the soma to fire', () => {
    const dt = 0.025
    const neuron: Neuron = {
      id: 'hh1', position: { x: 0, y: 0 }, model: 'hodgkin-huxley',
      params: { ...DEFAULT_HH_PARAMS, I_stim: 40, stimCompartment: 'dend1' },
    }
    let neurons = [neuron]
    let somaSpiked = false
    for (let i = 0; i < 100 / dt; i++) {
      const r = networkStep(neurons, [], dt)
      neurons = r.neurons
      if (r.spikes['hh1']) somaSpiked = true
    }
    expect(somaSpiked).toBe(true)
  })

  it('a single excitatory synapse with sufficient conductance can fire a resting target', () => {
    const dt = 0.1
    // Source fires tonically; target sits below threshold on its own (I_stim small).
    const src: Neuron = makeLIF('src', 3.0)
    const tgt: Neuron = makeLIF('tgt', 0.3)   // sub-threshold alone
    const synapse: Synapse = {
      id: 's1', sourceId: 'src', targetId: 'tgt',
      targetCompartment: 'dend1', type: 'excitatory',
      conductance: 9, deliveryTime: 1,         // within the 0–20 slider range
    }
    let neurons = [src, tgt]
    let tgtFired = false
    for (let i = 0; i < 1500; i++) {            // 150 ms
      const r = networkStep(neurons, [synapse], dt)
      neurons = r.neurons
      if (r.spikes['tgt']) { tgtFired = true; break }
    }
    expect(tgtFired).toBe(true)
  })

  it('LIF: a dendritic synapse produces a measurable voltage at that dendrite', () => {
    const dt = 0.1
    resetSimulationState()
    const src = makeLIF('src', 3.0)
    const tgt = makeLIF('tgt', 0)
    const syn: Synapse = {
      id: 's', sourceId: 'src', targetId: 'tgt',
      targetCompartment: 'dend1', type: 'excitatory', conductance: 5, deliveryTime: 1,
    }
    let neurons = [src, tgt]
    let peakDend1 = -70
    let peakDend2 = -70
    for (let i = 0; i < 400; i++) {
      const r = networkStep(neurons, [syn], dt)
      neurons = r.neurons
      const c = neurons.find(n => n.id === 'tgt')!.compartments
      if (c) {
        if (c.dend1.V > peakDend1) peakDend1 = c.dend1.V
        if (c.dend2.V > peakDend2) peakDend2 = c.dend2.V
      }
    }
    // The targeted dendrite depolarises measurably…
    expect(peakDend1).toBeGreaterThan(-65)
    // …while an untargeted dendrite stays near rest.
    expect(peakDend1).toBeGreaterThan(peakDend2)
  })

  it('LIF: dendritic depolarisation spreads passively to neighbouring dendrites', () => {
    const dt = 0.1
    resetSimulationState()
    const src = makeLIF('src', 3.0)
    const tgt = makeLIF('tgt', 0)
    const syn: Synapse = {
      id: 's', sourceId: 'src', targetId: 'tgt',
      targetCompartment: 'dend1', type: 'excitatory', conductance: 5, deliveryTime: 1,
    }
    let neurons = [src, tgt]
    let p1 = -70, p2 = -70, p3 = -70
    for (let i = 0; i < 400; i++) {
      const r = networkStep(neurons, [syn], dt)
      neurons = r.neurons
      const c = neurons.find(n => n.id === 'tgt')!.compartments!
      if (c.dend1.V > p1) p1 = c.dend1.V
      if (c.dend2.V > p2) p2 = c.dend2.V
      if (c.dend3.V > p3) p3 = c.dend3.V
    }
    // Input is at dend1; it spreads, decaying with distance: dend1 > dend2 > dend3 > rest.
    expect(p1).toBeGreaterThan(p2)
    expect(p2).toBeGreaterThan(p3)
    expect(p3).toBeGreaterThan(-70)   // even the far dendrite sees some spread
  })

  it('LIF: a synapse onto a distal dendrite depolarises the soma less than a proximal one', () => {
    const dt = 0.1
    const peakDepol = (targetCompartment: 'dend1' | 'dend3'): number => {
      resetSimulationState()
      const src = makeLIF('src', 3.0)
      const tgt = makeLIF('tgt', 0)   // at rest, never fires alone
      const syn: Synapse = {
        id: 's', sourceId: 'src', targetId: 'tgt',
        targetCompartment, type: 'excitatory', conductance: 2, deliveryTime: 1,
      }
      let neurons = [src, tgt]
      let peak = -70
      for (let i = 0; i < 600; i++) {
        const r = networkStep(neurons, [syn], dt)
        neurons = r.neurons
        const v = r.voltages['tgt']
        if (v > peak && v < 0) peak = v   // ignore spike waveform, track sub-threshold peak
      }
      return peak - (-70)
    }
    const near = peakDepol('dend1')
    const far = peakDepol('dend3')
    expect(near).toBeGreaterThan(0)         // proximal input depolarises the soma
    expect(far).toBeLessThan(near)          // distal input is attenuated
  })

  it('the swim-rhythm preset produces a sustained left/right alternation', () => {
    resetSimulationState()
    let neurons = swimRhythmPreset.neurons.map(n => ({ ...n }))
    const dt = swimRhythmPreset.simulation.step
    // Record spike times for the first segment's left/right neurons.
    const tL: number[] = []
    const tR: number[] = []
    let t = 0
    for (let i = 0; t < 600; i++) {
      const r = networkStep(neurons, swimRhythmPreset.synapses, dt)
      neurons = r.neurons
      t += dt
      if (r.spikes['cpg1L']) tL.push(t)
      if (r.spikes['cpg1R']) tR.push(t)
    }
    // Sustained rhythm: both sides keep firing (not the old fire-once-and-die).
    expect(tL.length).toBeGreaterThan(5)
    expect(tR.length).toBeGreaterThan(5)
    // Each side keeps firing in the second half, not just at onset.
    expect(tL.some(t => t > 400)).toBe(true)
    expect(tR.some(t => t > 400)).toBe(true)
    // Alternating bursts: in 40 ms bins, each side has bins where it fires and the
    // other is silent, and there are several switches between left- and right-active
    // phases (a sustained rhythm, not a single takeover).
    const bin = 40, nb = 15
    const binsL = Array(nb).fill(0), binsR = Array(nb).fill(0)
    for (const t of tL) binsL[Math.min(nb - 1, Math.floor(t / bin))]++
    for (const t of tR) binsR[Math.min(nb - 1, Math.floor(t / bin))]++
    const dom = binsL.map((l, i) => (l > binsR[i] ? 'L' : binsR[i] > l ? 'R' : '.')).join('')
    const switches = (dom.replace(/\./g, '').match(/LR|RL/g) || []).length
    expect(switches).toBeGreaterThan(2)
  })

  it('graded neuron integrates input but never spikes', () => {
    const n: Neuron = {
      id: 'g', position: { x: 0, y: 0 }, model: 'graded',
      params: { E_rest: -70, V_threshold: -55, tau_m: 12, R_m: 10, I_stim: 5 },
    }
    let neurons: Neuron[] = [n]
    let spiked = false, maxV = -70
    for (let i = 0; i < 2000; i++) {
      const r = networkStep(neurons, [], 0.1)
      neurons = r.neurons
      if (r.spikes['g']) spiked = true
      if (r.voltages['g'] > maxV) maxV = r.voltages['g']
    }
    expect(spiked).toBe(false)          // never fires
    expect(maxV).toBeGreaterThan(-70)   // but depolarises
    expect(maxV).toBeLessThan(0)        // stays graded, no AP overshoot
  })

  it('an inhibitory synapse hyperpolarises a resting target below its resting potential', () => {
    const dt = 0.1
    resetSimulationState()
    const driver = makeLIF('driver', 2.5)   // fires tonically
    const target = makeLIF('target', 0)     // at rest, -70 mV
    const syn: Synapse = {
      id: 's', sourceId: 'driver', targetId: 'target',
      targetCompartment: 'dend2', type: 'inhibitory', conductance: 3, deliveryTime: 2,
    }
    let neurons = [driver, target]
    let minV = 0
    for (let i = 0; i < 2000; i++) {
      const r = networkStep(neurons, [syn], dt)
      neurons = r.neurons
      if (r.voltages['target'] < minV) minV = r.voltages['target']
    }
    expect(minV).toBeLessThan(-70)   // driven below rest = hyperpolarised (not depolarised)
  })

  it('a resting target stays silent without synaptic input (no spurious firing)', () => {
    const dt = 0.1
    const tgt: Neuron = makeLIF('tgt', 0.3)
    let neurons = [tgt]
    let fired = false
    for (let i = 0; i < 1500; i++) {
      const r = networkStep(neurons, [], dt)
      neurons = r.neurons
      if (r.spikes['tgt']) { fired = true; break }
    }
    expect(fired).toBe(false)
  })

  it('dendrite-1 injection reaches soma threshold with reasonable damping (<3.5x soma)', () => {
    const dt = 0.025
    // Minimum sustained current that makes the soma fire, for a given injection site.
    const fireThreshold = (stimCompartment: 'soma' | 'dend1'): number => {
      for (let I = 1; I <= 100; I += 1) {
        resetSimulationState()
        let neurons: Neuron[] = [{
          id: 'h', position: { x: 0, y: 0 }, model: 'hodgkin-huxley',
          params: { ...DEFAULT_HH_PARAMS, I_stim: I, stimCompartment },
        }]
        let fired = false
        for (let i = 0; i < 80 / dt; i++) {
          const r = networkStep(neurons, [], dt)
          neurons = r.neurons
          if (r.spikes['h']) { fired = true; break }
        }
        if (fired) return I
      }
      return Infinity
    }
    const soma = fireThreshold('soma')
    const dend1 = fireThreshold('dend1')
    expect(dend1).toBeLessThan(Infinity)        // dendritic input CAN fire the soma
    expect(dend1).toBeLessThanOrEqual(100)      // …within the I_stim slider range
    expect(dend1 / soma).toBeLessThan(3.5)      // damping is moderate, not ~5x+
  })

  it('synapse targeting dend1 produces larger dend1 voltage change than a soma-targeted synapse', () => {
    const dt = 0.1
    const conductance = 50
    const deliveryTime = 1 // ms — 10 steps at dt=0.1

    // Helper: run a single scenario (src + tgt with given synapse targetCompartment),
    // drive src to spike, then run deliveryTime/dt more steps, return tgt's dend1 voltage
    const runScenario = (targetCompartment: 'dend1' | 'soma'): number => {
      resetSimulationState()
      const src: Neuron = {
        id: 'src',
        position: { x: 0, y: 0 },
        model: 'hodgkin-huxley',
        params: { ...DEFAULT_HH_PARAMS, I_stim: 10 },
      }
      const tgt: Neuron = {
        id: 'tgt',
        position: { x: 0, y: 0 },
        model: 'hodgkin-huxley',
        params: { ...DEFAULT_HH_PARAMS, I_stim: 0 },
      }
      const synapse: Synapse = {
        id: 'syn',
        sourceId: 'src',
        targetId: 'tgt',
        targetCompartment,
        type: 'excitatory',
        conductance,
        deliveryTime,
      }

      let neurons = [src, tgt]
      let srcSpikedStep = -1

      // Run until source spikes (up to 500 steps = 50ms)
      for (let i = 0; i < 500; i++) {
        const result = networkStep(neurons, [synapse], dt)
        neurons = result.neurons
        if (result.spikes['src']) {
          srcSpikedStep = i
          break
        }
      }

      // Spike must have occurred
      if (srcSpikedStep < 0) throw new Error('Source HH neuron did not spike')

      // Run exactly deliveryTime/dt more steps so the synaptic event is delivered
      const deliverySteps = Math.round(deliveryTime / dt)
      for (let i = 0; i < deliverySteps; i++) {
        const result = networkStep(neurons, [synapse], dt)
        neurons = result.neurons
      }

      // Return target dend1 voltage after delivery
      const tgt2 = neurons.find(n => n.id === 'tgt')!
      return (tgt2.compartments as Record<string, { V: number }>)['dend1'].V
    }

    const dend1WhenTargetingDend1 = runScenario('dend1')
    const dend1WhenTargetingSoma  = runScenario('soma')

    // When synaptic current is injected directly into dend1, dend1 voltage should be
    // higher than when the same current goes to soma and only reaches dend1 via weak axial coupling.
    // This test fails if routing is broken (e.g., all current goes to soma regardless of targetCompartment).
    expect(dend1WhenTargetingDend1).toBeGreaterThan(dend1WhenTargetingSoma)
  })
})
