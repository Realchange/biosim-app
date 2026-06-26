// src/simulation/hodgkin-huxley.test.ts
import { describe, it, expect } from 'vitest'
import { hhStep, DEFAULT_HH_COMPARTMENT } from './hodgkin-huxley'
import { DEFAULT_HH_PARAMS } from '../types'

describe('hhStep', () => {
  it('rests near -65 mV with zero stimulus', () => {
    const params = { ...DEFAULT_HH_PARAMS, I_stim: 0 }
    let soma = { ...DEFAULT_HH_COMPARTMENT }
    for (let i = 0; i < 5000; i++) {
      soma = hhStep(soma, params, 0, 0.1).soma
    }
    expect(soma.V).toBeCloseTo(-65, 0)
  })

  it('fires action potentials with sufficient stimulus', () => {
    const params = { ...DEFAULT_HH_PARAMS, I_stim: 10 }
    let soma = { ...DEFAULT_HH_COMPARTMENT }
    let maxV = soma.V
    for (let i = 0; i < 2000; i++) {
      soma = hhStep(soma, params, 0, 0.1).soma
      if (soma.V > maxV) maxV = soma.V
    }
    expect(maxV).toBeGreaterThan(0)  // spike reaches positive values
  })

  it('returns state for all 4 compartments', () => {
    const params = DEFAULT_HH_PARAMS
    const result = hhStep(DEFAULT_HH_COMPARTMENT, params, 0, 0.1)
    expect(result).toHaveProperty('soma')
    expect(result).toHaveProperty('dend1')
    expect(result).toHaveProperty('dend2')
    expect(result).toHaveProperty('dend3')
  })

  it('dendrites are passive: a strong dendritic input never produces a regenerative spike', () => {
    const params = { ...DEFAULT_HH_PARAMS, I_stim: 0 }
    let st = {
      soma:  { ...DEFAULT_HH_COMPARTMENT },
      dend1: { ...DEFAULT_HH_COMPARTMENT },
      dend2: { ...DEFAULT_HH_COMPARTMENT },
      dend3: { ...DEFAULT_HH_COMPARTMENT },
    }
    const dt = 0.025
    let dendPeak = -100
    for (let i = 0; i < 20 / dt; i++) {
      const t = i * dt
      const inj = t < 1 ? 10 : 0   // brief pulse into dend1 only
      st = hhStep(st.soma, params, 0, dt, st, { dend1: inj, dend2: 0, dend3: 0 })
      if (st.dend1.V > dendPeak) dendPeak = st.dend1.V
    }
    // It depolarises passively…
    expect(dendPeak).toBeGreaterThan(-65)
    // …but never overshoots into action-potential territory (no Na⁺ regeneration)
    expect(dendPeak).toBeLessThan(0)
  })

  it('dendrites decay back toward rest after a passive depolarisation', () => {
    const params = { ...DEFAULT_HH_PARAMS, I_stim: 0 }
    let st = {
      soma:  { ...DEFAULT_HH_COMPARTMENT },
      dend1: { ...DEFAULT_HH_COMPARTMENT },
      dend2: { ...DEFAULT_HH_COMPARTMENT },
      dend3: { ...DEFAULT_HH_COMPARTMENT },
    }
    const dt = 0.025
    // 2 ms pulse, record peak, then keep running and check it relaxes
    let peak = -100
    for (let i = 0; i < 2 / dt; i++) {
      st = hhStep(st.soma, params, 0, dt, st, { dend1: 8, dend2: 0, dend3: 0 })
      if (st.dend1.V > peak) peak = st.dend1.V
    }
    for (let i = 0; i < 30 / dt; i++) {
      st = hhStep(st.soma, params, 0, dt, st, { dend1: 0, dend2: 0, dend3: 0 })
    }
    expect(st.dend1.V).toBeLessThan(peak)       // came back down
    expect(st.dend1.V).toBeCloseTo(-65, 0)      // toward passive rest
  })
})
