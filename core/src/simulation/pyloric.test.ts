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

describe('pyloric circuit preset (validated reference parameters)', () => {
  function run(ms: number) {
    resetSimulationState()
    let neurons = pyloricPreset.neurons.map(n => ({ ...n })) as Neuron[]
    const syn = pyloricPreset.synapses
    const dt = 0.05
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
  const bursts = (a: number[], gap: number, from = 1500) => {
    const out: number[][] = []
    let cur: number[] = []
    for (const x of a) { if (cur.length && x - cur[cur.length - 1] > gap) { out.push(cur); cur = [] } cur.push(x) }
    if (cur.length) out.push(cur)
    return out.filter(b => b[0] > from)
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length

  it('uses the full 7-synapse glut+chol connectivity (2 cholinergic, no spike synapses)', () => {
    const s = pyloricPreset.synapses
    expect(s.length).toBe(7)
    expect(s.every(x => x.mechanism === 'graded')).toBe(true)
    expect(s.filter(x => x.synClass === 'chol').length).toBe(2)
  })

  it('reproduces the reference rhythm: AB/PD → LP → PY, ~1 s period, LP burst longer than PY', () => {
    const sp = run(8000)
    // Cycle = AB/PD bursts (merge the short pacemaker burst with a generous gap).
    const cB = bursts(sp.abpd, 300)
    const lB = bursts(sp.lp, 120)
    const pB = bursts(sp.py, 120)
    expect(cB.length).toBeGreaterThanOrEqual(4)

    // Each follower fires about one burst per cycle.
    expect(Math.abs(lB.length - cB.length)).toBeLessThanOrEqual(1)
    expect(Math.abs(pB.length - cB.length)).toBeLessThanOrEqual(1)

    // Period ~1 s (well below our old 1.7 s; reference ≈ 0.97 s).
    const cyc = cB.map(b => b[0])
    const period = (cyc[cyc.length - 1] - cyc[0]) / (cyc.length - 1)
    expect(period).toBeGreaterThan(800)
    expect(period).toBeLessThan(1300)

    // Triphasic order AB/PD (0) → LP → PY.
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
    expect(mean(phases(sp.lp))).toBeGreaterThan(0.15)
    expect(mean(phases(sp.py))).toBeGreaterThan(mean(phases(sp.lp)))

    // Reference signature: the LP burst carries many more spikes than the PY burst.
    const spikesPerBurst = (B: number[][]) => B.reduce((s, b) => s + b.length, 0) / B.length
    expect(spikesPerBurst(lB)).toBeGreaterThan(spikesPerBurst(pB))
    expect(spikesPerBurst(lB)).toBeGreaterThan(10)
  })
})
