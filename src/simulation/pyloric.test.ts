import { describe, it, expect } from 'vitest'
import { networkStep, resetSimulationState } from './network'
import { synActivationInf, stepGradedS, SYN_GLUT, SYN_CHOL } from './stg'
import { pyloricPreset } from '../presets/pyloric'
import type { Neuron } from '../types'

describe('graded synapse activation', () => {
  it('s∞ is ~0 when presynaptic is hyperpolarised, ~1 when depolarised (Vth=−35)', () => {
    expect(synActivationInf(-60)).toBeLessThan(0.01)
    expect(synActivationInf(-35)).toBeCloseTo(0.5, 1)
    expect(synActivationInf(0)).toBeGreaterThan(0.99)
  })
  it('s relaxes toward s∞; cholinergic decays slower than glutamatergic', () => {
    const glut = stepGradedS(1, -60, SYN_GLUT.kminus, 1)
    const chol = stepGradedS(1, -60, SYN_CHOL.kminus, 1)
    expect(glut).toBeLessThan(1)
    expect(chol).toBeGreaterThan(glut)   // chol (kminus=100) holds longer than glut (40)
  })
})

describe('pyloric circuit preset (full 7-synapse Prinz connectivity)', () => {
  // Simulate the actual "Pylorisches Netzwerk" preset and analyse the rhythm.
  function run(ms: number) {
    resetSimulationState()
    let neurons = pyloricPreset.neurons.map(n => ({ ...n })) as Neuron[]
    const syn = pyloricPreset.synapses
    const dt = 0.1
    const sp: Record<string, number[]> = { abpd: [], lp: [], py: [] }
    const prevV: Record<string, number> = { abpd: -55, lp: -55, py: -55 }
    for (let i = 0; i < ms / dt; i++) {
      const r = networkStep(neurons, syn, dt)
      neurons = r.neurons
      const t = i * dt
      for (const id of ['abpd', 'lp', 'py']) {
        const v = r.voltages[id]
        if (prevV[id] <= 0 && v > 0) sp[id].push(t)
        prevV[id] = v
      }
    }
    return sp
  }
  const bursts = (a: number[], from = 1500) => {
    const out: number[][] = []
    let cur: number[] = []
    for (const x of a) { if (cur.length && x - cur[cur.length - 1] > 120) { out.push(cur); cur = [] } cur.push(x) }
    if (cur.length) out.push(cur)
    return out.filter(b => b[0] > from)
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const std = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))) }

  it('uses the full 7-synapse glut+chol connectivity with no spike synapses', () => {
    const s = pyloricPreset.synapses
    expect(s.length).toBe(7)
    expect(s.every(x => x.mechanism === 'graded')).toBe(true)
    expect(s.filter(x => x.synClass === 'chol').length).toBe(2)   // AB/PD→LP and AB/PD→PY
  })

  it('every cell fires exactly one burst per cycle, in order AB/PD → LP → PY', () => {
    const sp = run(9000)
    const cB = bursts(sp.abpd), lB = bursts(sp.lp), pB = bursts(sp.py)
    const Nc = cB.length
    expect(Nc).toBeGreaterThanOrEqual(3)

    // Reliability: LP and PY each fire one burst per pacemaker cycle (±1 over the run).
    expect(Math.abs(lB.length - Nc)).toBeLessThanOrEqual(1)
    expect(Math.abs(pB.length - Nc)).toBeLessThanOrEqual(1)

    // Phase of each spike within the pacemaker cycle.
    const cyc = cB.map(b => b[0])
    const phases = (spk: number[]) => {
      const ph: number[] = []
      for (const x of spk) {
        if (x < cyc[0] || x >= cyc[cyc.length - 1]) continue
        let k = 0
        while (k < cyc.length - 1 && cyc[k + 1] <= x) k++
        ph.push((x - cyc[k]) / (cyc[k + 1] - cyc[k]))
      }
      return ph
    }
    const lpPh = phases(sp.lp), pyPh = phases(sp.py)
    const lpM = mean(lpPh), pyM = mean(pyPh)

    // Triphasic order with clear separation: AB/PD (0) → LP → PY.
    expect(lpM).toBeGreaterThan(0.2)
    expect(pyM - lpM).toBeGreaterThan(0.15)
    expect(pyM).toBeLessThan(1)

    // LP fires a TIGHT burst (clearly not tonic).
    expect(std(lpPh)).toBeLessThan(0.1)
  })
})
