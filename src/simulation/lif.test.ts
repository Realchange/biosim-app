import { describe, it, expect } from 'vitest'
import { lifStep, DEFAULT_LIF_STATE } from './lif'
import { DEFAULT_LIF_PARAMS } from '../types'

describe('lifStep', () => {
  it('decays toward E_rest with no stimulus', () => {
    const state = { V: -65 }  // depolarized below threshold, no stim
    const params = { ...DEFAULT_LIF_PARAMS, I_stim: 0 }
    const next = lifStep(state, params, 0.1)
    expect(next.V).toBeLessThan(-65)   // decays back toward -70
    expect(next.V).toBeGreaterThan(-70)  // above rest (hasn't overshot)
  })

  it('fires and shows spike peak when threshold is crossed', () => {
    const params = { ...DEFAULT_LIF_PARAMS, I_stim: 5 }
    let state = DEFAULT_LIF_STATE
    let spiked = false
    for (let i = 0; i < 1000; i++) {
      state = lifStep(state, params, 0.1)
      if (state.spiked) { spiked = true; break }
    }
    expect(spiked).toBe(true)
    expect(state.V).toBe(40)  // spike peak shown at firing step
  })

  it('recovers to near E_rest after spike waveform', () => {
    const params = { ...DEFAULT_LIF_PARAMS, I_stim: 5 }
    let state = DEFAULT_LIF_STATE
    for (let i = 0; i < 1000; i++) {
      state = lifStep(state, params, 0.1)
      if (state.spiked) break
    }
    // Step through spike waveform (2ms = 20 steps at dt=0.1)
    for (let i = 0; i < 25; i++) state = lifStep(state, params, 0.1)
    // After waveform, V is in normal subthreshold dynamics
    expect(state.V).toBeGreaterThan(-85)
    expect(state.spiked).toBe(false)
  })

  it('stays at rest with zero stimulus', () => {
    const params = { ...DEFAULT_LIF_PARAMS, I_stim: 0 }
    const state = DEFAULT_LIF_STATE
    const next = lifStep(state, params, 0.1)
    expect(next.V).toBeCloseTo(-70, 3)
  })
})
