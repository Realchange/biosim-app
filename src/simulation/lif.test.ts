import { describe, it, expect } from 'vitest'
import { lifStep, DEFAULT_LIF_STATE } from './lif'
import { DEFAULT_LIF_PARAMS } from '../types'

describe('lifStep', () => {
  it('decays toward E_rest with no stimulus', () => {
    const state = { V: -50 }  // depolarized, no stim
    const params = { ...DEFAULT_LIF_PARAMS, I_stim: 0 }
    const next = lifStep(state, params, 0.1)
    expect(next.V).toBeLessThan(-50)   // decays back toward -70
    expect(next.V).toBeGreaterThanOrEqual(-70)  // moves toward rest
  })

  it('fires and resets when threshold is crossed', () => {
    const params = { ...DEFAULT_LIF_PARAMS, I_stim: 5 }
    let state = DEFAULT_LIF_STATE
    let spiked = false
    for (let i = 0; i < 1000; i++) {
      const result = lifStep(state, params, 0.1)
      state = result
      if (result.spiked) { spiked = true; break }
    }
    expect(spiked).toBe(true)
    expect(state.V).toBe(params.E_rest)  // reset after spike
  })

  it('stays at rest with zero stimulus', () => {
    const params = { ...DEFAULT_LIF_PARAMS, I_stim: 0 }
    const state = DEFAULT_LIF_STATE
    const next = lifStep(state, params, 0.1)
    expect(next.V).toBeCloseTo(-70, 3)
  })
})
