import { describe, it, expect } from 'vitest'
import { networkStep, resetSimulationState } from './network'
import { xolotlBurstPreset } from '../presets/xolotl-burst'
import { xolotlHcoPreset } from '../presets/xolotl-hco'
import type { Neuron, Network } from '../types'

function simulate(net: Network, ms: number) {
  resetSimulationState()
  let neurons = net.neurons.map(n => ({ ...n })) as Neuron[]
  const syn = net.synapses
  const dt = 0.05
  const sp: Record<string, number[]> = {}
  const prevV: Record<string, number> = {}
  for (const n of net.neurons) { sp[n.id] = []; prevV[n.id] = -55 }
  for (let i = 0; i < ms / dt; i++) {
    const r = networkStep(neurons, syn, dt)
    neurons = r.neurons
    const t = i * dt
    for (const n of net.neurons) {
      const v = r.voltages[n.id]
      if (prevV[n.id] <= 0 && v > 0) sp[n.id].push(t)
      prevV[n.id] = v
    }
  }
  return sp
}
const bursts = (a: number[], from = 1500) => {
  const out: number[][] = []
  let cur: number[] = []
  for (const x of a) { if (cur.length && x - cur[cur.length - 1] > 150) { out.push(cur); cur = [] } cur.push(x) }
  if (cur.length) out.push(cur)
  return out.filter(b => b[0] > from)
}

describe('xolotl: bursting neuron preset', () => {
  it('a single STG neuron bursts intrinsically', () => {
    const sp = simulate(xolotlBurstPreset, 5000)
    const b = bursts(sp.ab)
    expect(b.length).toBeGreaterThanOrEqual(3)            // several bursts
    const spb = b.reduce((s, x) => s + x.length, 0) / b.length
    expect(spb).toBeGreaterThan(3)                        // multiple spikes per burst
  })
})

describe('xolotl: half-centre oscillator preset', () => {
  it('two reciprocally inhibiting bursters fire in anti-phase', () => {
    const sp = simulate(xolotlHcoPreset, 8000)
    const b1 = bursts(sp.c1, 2000), b2 = bursts(sp.c2, 2000)
    expect(b1.length).toBeGreaterThanOrEqual(2)
    expect(b2.length).toBeGreaterThanOrEqual(2)

    // Anti-phase: each c2 burst falls near the middle of a c1 cycle (phase ~0.5).
    const s1 = b1.map(b => b[0])
    const period = (s1[s1.length - 1] - s1[0]) / (s1.length - 1)
    const phases: number[] = []
    for (const s of b2.map(b => b[0])) {
      if (s < s1[0] || s >= s1[s1.length - 1]) continue
      let k = 0
      while (k < s1.length - 1 && s1[k + 1] <= s) k++
      phases.push((s - s1[k]) / period)
    }
    const meanPhase = phases.reduce((a, b) => a + b, 0) / phases.length
    expect(meanPhase).toBeGreaterThan(0.3)   // clearly not synchronised (0 or 1)
    expect(meanPhase).toBeLessThan(0.7)
  })
})
