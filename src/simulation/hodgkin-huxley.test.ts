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
})
