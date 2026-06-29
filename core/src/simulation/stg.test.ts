import { describe, it, expect } from 'vitest'
import { stgStep, makeSTGState } from './stg'
import { DEFAULT_STG_PARAMS } from '../types'

describe('stgStep (Prinz STG neuron)', () => {
  it('PM_4 pacemaker bursts intrinsically (slow oscillation with spike crests)', () => {
    const p = DEFAULT_STG_PARAMS   // PM_4 — AB/PD pacemaker
    let s = makeSTGState()
    const dt = 0.025
    const V: number[] = []
    let minV = 100, maxV = -100
    for (let i = 0; i < 4000 / dt; i++) {   // 4 s
      s = stgStep(s, p, 0, dt)
      if (i % 4 === 0) V.push(s.V)           // sample every 0.1 ms
      if (i * dt > 1000) {                    // ignore the first second (settling)
        if (s.V < minV) minV = s.V
        if (s.V > maxV) maxV = s.V
      }
    }
    // Bursting swings between a hyperpolarised trough and depolarised spike crests.
    expect(maxV).toBeGreaterThan(0)     // spikes overshoot
    expect(minV).toBeLessThan(-40)      // hyperpolarised between bursts
    expect(maxV - minV).toBeGreaterThan(40)
    // Not NaN / not stuck at a fixed point: count upward 0-crossings = activity.
    let crossings = 0
    for (let i = 1; i < V.length; i++) if (V[i - 1] <= 0 && V[i] > 0) crossings++
    expect(Number.isFinite(s.V)).toBe(true)
    expect(crossings).toBeGreaterThan(5)   // many spikes over the run
  })

  it('stays bounded and finite over a long run', () => {
    let s = makeSTGState()
    for (let i = 0; i < 80000; i++) s = stgStep(s, DEFAULT_STG_PARAMS, 0, 0.025)
    expect(Number.isFinite(s.V)).toBe(true)
    expect(s.V).toBeGreaterThan(-90)
    expect(s.V).toBeLessThan(60)
    expect(s.Ca).toBeGreaterThan(0)
  })
})
